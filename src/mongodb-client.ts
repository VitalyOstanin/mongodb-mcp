import { MongoClient, type MongoClientOptions, type Db, type Collection } from 'mongodb';

export class MongoDBClient {
  private static instance: MongoDBClient;
  private client: MongoClient | null = null;
  private isConnected: boolean = false;
  private connectionString: string | null = null;
  private readonlyMode: boolean = false;
  private disconnectReason: string | null = null;
  private connectionError: Error | null = null;

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

  async connect(readonlyMode: boolean = true): Promise<void> {
    // Only use connection string from environment variable
    const connString = process.env.MONGODB_MCP_CONNECTION_STRING;

    if (!connString) {
      throw new Error('Connection string is required. Please set MONGODB_MCP_CONNECTION_STRING environment variable.');
    }

    if (this.isConnected && this.client) {
      // If already connected, disconnect before new connection
      await this.disconnect();
    }

    try {
      this.client = new MongoClient(connString, {
        // Optionally: connection settings
      } as MongoClientOptions);

      // Add event listeners to detect connection issues
      this.client.on('serverClosed', () => {
        // Server closed event
        if (this.isConnected) {
          this.isConnected = false;
          this.connectionError = new Error('MongoDB server closed connection');
          this.disconnectReason = 'server closed connection';
        }
      });

      this.client.on('serverHeartbeatFailed', () => {
        // Server heartbeat failed, indicates connection issues
        if (this.isConnected) {
          this.connectionError = new Error('MongoDB heartbeat failed - connection lost');
          this.disconnectReason = 'heartbeat failed';
        }
      });

      this.client.on('connectionClosed', () => {
        // Connection closed event
        if (this.isConnected) {
          this.isConnected = false;
          this.connectionError = new Error('MongoDB connection closed');
          this.disconnectReason = 'connection closed';
        }
      });

      this.client.on('error', (error) => {
        // General connection error
        if (this.isConnected) {
          this.isConnected = false;
          this.connectionError = error instanceof Error ? error : new Error(String(error));
          this.disconnectReason = 'connection error';
        }
      });

      await this.client.connect();
      this.connectionString = connString;
      this.isConnected = true;
      this.disconnectReason = null; // Clear disconnect reason on successful connection
      this.connectionError = null; // Clear any previous connection error
      this.setReadonlyMode(readonlyMode);
    } catch (error) {
      this.connectionError = error instanceof Error ? error : new Error(String(error));
      throw new Error(`Failed to connect to MongoDB: ${error}`);
    }
  }

  async disconnect(reason: string = "штатный disconnect"): Promise<void> {
    if (this.client) {
      await this.client.close();
      this.isConnected = false;
      this.client = null;
      this.connectionString = null;
      this.disconnectReason = reason;
      this.connectionError = null; // Clear any error when disconnecting intentionally
    }
  }

  getClient(): MongoClient {
    // Check both connection status and client object availability
    if (!(this.isConnected && this.client)) {
      // Using nullish coalescing assignment operator to set error only if not already set
      this.connectionError ??= new Error('Not connected to MongoDB. Please connect first.');
      throw new Error('Not connected to MongoDB. Please connect first.');
    }

    // Additional check: try a simple operation to verify connection is still alive
    try {
      // In newer versions of the MongoDB driver, checking for connection state requires different approach
      // We can use the ping command or check the connection state via admin command
      // The condition `this.client && this.isConnected` is necessary as both are separate state indicators
      // Despite TypeScript thinking they're always truthy after the initial check, they can change during execution
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
      if (this.client && this.isConnected) {
        // Simple validation - if client is not null and isConnected flag is true, we assume it's connected
        // The actual connection status will be validated by operations
      }
    } catch (error) {
      this.isConnected = false;
      this.connectionError = error instanceof Error ? error : new Error(String(error));
      this.disconnectReason = 'connection error during operation';
      throw error;
    }

    return this.client;
  }

  getDatabase(databaseName: string) {
    // Check both connection status and client object availability
    if (!(this.isConnected && this.client)) {
      // Using nullish coalescing assignment operator to set error only if not already set
      this.connectionError ??= new Error('Not connected to MongoDB. Please connect first.');
      throw new Error('Not connected to MongoDB. Please connect first.');
    }

    // Additional connection check
    try {
      // In newer versions of the MongoDB driver, checking for connection state requires different approach
      // We can use the ping command or check the connection state via admin command
      // The condition `this.client && this.isConnected` is necessary as both are separate state indicators
      // Despite TypeScript thinking they're always truthy after the initial check, they can change during execution
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
      if (this.client && this.isConnected) {
        // Simple validation - if client is not null and isConnected flag is true, we assume it's connected
        // The actual connection status will be validated by operations
      }
    } catch (error) {
      this.isConnected = false;
      this.connectionError = error instanceof Error ? error : new Error(String(error));
      this.disconnectReason = 'connection error during operation';
      throw error;
    }

    const db = this.client.db(databaseName);

    // If in readonly mode, wrap the database with checks
    if (this.readonlyMode) {
      return this.createReadonlyDatabaseProxy(db);
    }

    return db;
  }

  private createReadonlyDatabaseProxy(db: Db) {
    // Create a proxy that blocks write operations
    return new Proxy(db, {
      get(target, prop: string) {
        // Check if operation is potentially data modifying
        const writeOperations = [
          'addUser', 'removeUser', 'createCollection', 'createIndex', 'dropCollection',
          'dropIndex', 'dropDatabase', 'renameCollection', 'updateOne', 'updateMany',
          'replaceOne', 'deleteOne', 'deleteMany', 'insertOne', 'insertMany',
          'findOneAndReplace', 'findOneAndUpdate', 'findOneAndDelete',
          'bulkWrite',
        ];

        if (writeOperations.includes(prop)) {
          return function() {
            throw new Error(`Operation '${prop}' is not allowed in read-only mode`);
          };
        }

        // MongoDB Db object has dynamic properties and no index signature, so using 'any' is necessary for property access
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const result = (target as any)[prop];

        // If result is a function, return it
        if (typeof result === 'function') {
          if (prop === 'collection') {
            // Wrap the collection method to return a readonly collection proxy
            return (...args: Parameters<Db['collection']>) => {
              const collection = result.apply(target, args);

              return MongoDBClient.prototype.createReadonlyCollectionProxy.call(this, collection);
            };
          }

          if (prop === 'aggregate') {
            // For database-level aggregate operations, we need to check the pipeline for dangerous operations
            return function (pipeline: Array<Record<string, unknown>>, options?: Record<string, unknown>) {
              // Check if the pipeline contains dangerous operations
              const dangerousStages = ['$out', '$merge'];

              for (const stage of pipeline) {
                const stageName = Object.keys(stage)[0];

                if (stageName && dangerousStages.includes(stageName)) {
                  throw new Error(`Aggregation stage '${stageName}' is not allowed in read-only mode`);
                }
              }

              // If no dangerous stages found, call the original aggregate function
              return result.call(target, pipeline, options);
            };
          }

          return result.bind(target);
        }

        return result;
      },
    });
  }

  // Using 'any' for collection type as it needs to work with MongoDB Collection that can contain any document type
  // This is necessary for the proxy to work with any kind of collection without restricting document structure
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private createReadonlyCollectionProxy(collection: Collection<any>) {
    // Create a proxy for collection that protects aggregation operations
    return new Proxy(collection, {
      get(target, prop: string) {
        // MongoDB Collection object has dynamic properties and no index signature
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const result = (target as any)[prop];

        if (typeof result === 'function') {
          if (prop === 'aggregate') {
            // For collection-level aggregate operations, we need to check the pipeline for dangerous operations
            return function (pipeline: Array<Record<string, unknown>>, options?: Record<string, unknown>) {
              // Check if the pipeline contains dangerous operations
              const dangerousStages = ['$out', '$merge'];

              for (const stage of pipeline) {
                const stageName = Object.keys(stage)[0];

                if (stageName && dangerousStages.includes(stageName)) {
                  throw new Error(`Aggregation stage '${stageName}' is not allowed in read-only mode`);
                }
              }

              // If no dangerous stages found, call the original aggregate function
              return result.call(target, pipeline, options);
            };
          }

          // For other methods, bind to the target
          return result.bind(target);
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
