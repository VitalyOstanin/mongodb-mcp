import { MongoClient, type MongoClientOptions, type Db, type Collection, type Document } from 'mongodb';
import { findDangerousStage } from './utils/aggregation-safety.js';
import { redactError } from './utils/redact.js';

const DB_LEVEL_WRITE_OPERATIONS = new Set([
  'addUser', 'removeUser', 'createCollection', 'createIndex', 'dropCollection',
  'dropIndex', 'dropDatabase', 'renameCollection', 'updateOne', 'updateMany',
  'replaceOne', 'deleteOne', 'deleteMany', 'insertOne', 'insertMany',
  'findOneAndReplace', 'findOneAndUpdate', 'findOneAndDelete',
  'bulkWrite',
]);
const COLLECTION_LEVEL_WRITE_OPERATIONS = new Set([
  'insertOne', 'insertMany', 'updateOne', 'updateMany',
  'replaceOne', 'deleteOne', 'deleteMany', 'findOneAndReplace',
  'findOneAndUpdate', 'findOneAndDelete', 'bulkWrite',
  'createIndex', 'dropIndex', 'createIndexes', 'dropIndexes',
  'renameIndex', 'drop', 'initializeOrderedBulkOp', 'initializeUnorderedBulkOp',
  'insert', 'save', 'update', 'remove',
]);

function checkAggregatePipeline(pipeline: ReadonlyArray<Record<string, unknown>>): void {
  const stage = findDangerousStage(pipeline);

  if (stage) {
    throw new Error(`Aggregation stage '${stage}' is not allowed in read-only mode`);
  }
}

export class MongoDBClient {
  private static instance: MongoDBClient;
  private client: MongoClient | null = null;
  private isConnected: boolean = false;
  private connectionString: string | null = null;
  private readonlyMode: boolean = false;
  private disconnectReason: string | null = null;
  private connectionError: Error | null = null;
  // Serialise connect/disconnect against each other and themselves so two
  // tool calls cannot race on the singleton state.
  private connectInFlight: Promise<void> | null = null;
  private disconnectInFlight: Promise<void> | null = null;

  private constructor() {}

  static getInstance(): MongoDBClient {
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    if (!MongoDBClient.instance) {
      MongoDBClient.instance = new MongoDBClient();
    }

    return MongoDBClient.instance;
  }

  setReadonlyMode(readonly: boolean): void {
    this.readonlyMode = readonly;
  }

  isReadonly(): boolean {
    return this.readonlyMode;
  }

  async connect(): Promise<void> {
    if (this.connectInFlight) {
      return this.connectInFlight;
    }

    this.connectInFlight = this.doConnect();
    try {
      await this.connectInFlight;
    } finally {
      this.connectInFlight = null;
    }
  }

  private async doConnect(): Promise<void> {
    const connString = process.env.MONGODB_MCP_CONNECTION_STRING;

    if (!connString) {
      throw new Error('Connection string is required. Please set MONGODB_MCP_CONNECTION_STRING environment variable.');
    }

    if (this.isConnected && this.client) {
      // Tear down the existing connection before opening a new one. doConnect
      // bypasses the connect mutex (it is held by the caller), so we go
      // directly to doDisconnect.
      await this.doDisconnect('reconnect');
    }

    try {
      this.client = new MongoClient(connString, {} as MongoClientOptions);

      this.client.on('serverClosed', () => {
        if (this.isConnected) {
          this.isConnected = false;
          this.connectionError = new Error('MongoDB server closed connection');
          this.disconnectReason = 'server closed connection';
        }
      });

      this.client.on('serverHeartbeatFailed', () => {
        if (this.isConnected) {
          this.connectionError = new Error('MongoDB heartbeat failed - connection lost');
          this.disconnectReason = 'heartbeat failed';
        }
      });

      this.client.on('connectionClosed', () => {
        if (this.isConnected) {
          this.isConnected = false;
          this.connectionError = new Error('MongoDB connection closed');
          this.disconnectReason = 'connection closed';
        }
      });

      this.client.on('error', (error) => {
        if (this.isConnected) {
          this.isConnected = false;
          this.connectionError = error instanceof Error ? error : new Error(String(error));
          this.disconnectReason = 'connection error';
        }
      });

      await this.client.connect();
      this.connectionString = connString;
      this.isConnected = true;
      this.disconnectReason = null;
      this.connectionError = null;
      // readonlyMode is set only via CLI arg (setReadonlyMode), not on reconnect
    } catch (error) {
      this.connectionError = error instanceof Error ? error : new Error(String(error));
      throw new Error(`Failed to connect to MongoDB: ${redactError(error)}`);
    }
  }

  async disconnect(reason: string = "normal disconnect"): Promise<void> {
    if (this.disconnectInFlight) {
      return this.disconnectInFlight;
    }

    this.disconnectInFlight = this.doDisconnect(reason);
    try {
      await this.disconnectInFlight;
    } finally {
      this.disconnectInFlight = null;
    }
  }

  private async doDisconnect(reason: string): Promise<void> {
    if (!this.client) {
      return;
    }

    // Drop event listeners on the old client before closing it. This avoids
    // any chance of a stale listener flipping isConnected on a future event.
    this.client.removeAllListeners();
    await this.client.close();
    this.isConnected = false;
    this.client = null;
    this.connectionString = null;
    this.disconnectReason = reason;
    this.connectionError = null;
  }

  private ensureConnected(): void {
    if (!(this.isConnected && this.client)) {
      this.connectionError ??= new Error('Not connected to MongoDB. Please connect first.');
      throw this.connectionError;
    }
  }

  getClient(): MongoClient {
    this.ensureConnected();

    return this.client!;
  }

  getDatabase(databaseName: string) {
    this.ensureConnected();

    const db = this.client!.db(databaseName);

    if (this.readonlyMode) {
      return this.createReadonlyDatabaseProxy(db);
    }

    return db;
  }

  private createReadonlyDatabaseProxy(db: Db): Db {
    // Capture `this` so the Proxy handler can call back into class methods
    // even though `this` inside `get(target, prop)` refers to the handler.
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const self = this;

    return new Proxy(db, {
      get(target, prop: string) {
        if (DB_LEVEL_WRITE_OPERATIONS.has(prop)) {
          return function() {
            throw new Error(`Operation '${prop}' is not allowed in read-only mode`);
          };
        }

        const result = (target as unknown as Record<string, unknown>)[prop];

        if (typeof result === 'function') {
          if (prop === 'collection') {
            return (...args: Parameters<Db['collection']>) => {
              const collection = (result as (...a: unknown[]) => Collection<Document>).apply(target, args);

              return self.createReadonlyCollectionProxy(collection);
            };
          }

          if (prop === 'aggregate') {
            return function (pipeline: Array<Record<string, unknown>>, options?: Record<string, unknown>) {
              checkAggregatePipeline(pipeline);

              return (result as (...a: unknown[]) => unknown).call(target, pipeline, options);
            };
          }

          return (result as (...a: unknown[]) => unknown).bind(target);
        }

        return result;
      },
    });
  }

  private createReadonlyCollectionProxy<T extends Document = Document>(collection: Collection<T>): Collection<T> {
    return new Proxy(collection, {
      get(target, prop: string) {
        if (COLLECTION_LEVEL_WRITE_OPERATIONS.has(prop)) {
          return function() {
            throw new Error(`Operation '${prop}' is not allowed in read-only mode`);
          };
        }

        const result = (target as unknown as Record<string, unknown>)[prop];

        if (typeof result === 'function') {
          if (prop === 'aggregate') {
            return function (pipeline: Array<Record<string, unknown>>, options?: Record<string, unknown>) {
              checkAggregatePipeline(pipeline);

              return (result as (...a: unknown[]) => unknown).call(target, pipeline, options);
            };
          }

          return (result as (...a: unknown[]) => unknown).bind(target);
        }

        return result;
      },
    });
  }

  isConnectedToMongoDB(): boolean {
    return this.isConnected;
  }

  getConnectionInfo(): { isConnected: boolean; disconnectReason?: string; connectionError?: string } {
    const info: { isConnected: boolean; disconnectReason?: string; connectionError?: string } = {
      isConnected: this.isConnected,
    };

    if (!this.isConnected && this.disconnectReason) {
      info.disconnectReason = this.disconnectReason;
    }

    if (this.connectionError) {
      info.connectionError = this.connectionError.message;
    }

    return info;
  }

  getConnectionString(): string | null {
    return this.connectionString;
  }
}
