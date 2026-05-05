import { MongoClient as DriverMongoClient } from 'mongodb';
import { MongoDBClient } from '../src/mongodb-client.js';

// Single source of truth for the test connection string. `setup.ts` populates
// the env var with a default that points at the compose.yaml container;
// reading the same var here keeps the admin client and the
// MongoDBClient-under-test on the same database when a developer overrides
// the port (e.g. when the container is published on a non-default port to
// avoid colliding with a local MongoDB install).
function getConnectionString(): string {
  const dsn = process.env['MONGODB_MCP_CONNECTION_STRING'];

  if (!dsn) {
    throw new Error(
      'MONGODB_MCP_CONNECTION_STRING is not set. test-integration/setup.ts should populate it; if you imported this module outside of vitest, set it manually.',
    );
  }

  return dsn;
}

// Shared admin MongoClient used purely for setup/teardown SQL outside the
// MongoDBClient singleton path.
let adminClient: DriverMongoClient | null = null;

export async function getAdminClient(): Promise<DriverMongoClient> {
  if (!adminClient) {
    adminClient = new DriverMongoClient(getConnectionString());
    await adminClient.connect();
  }

  return adminClient;
}

export async function closeAdminClient(): Promise<void> {
  if (adminClient) {
    await adminClient.close();
    adminClient = null;
  }
}

export async function dropDb(databaseName: string): Promise<void> {
  const client = await getAdminClient();

  await client.db(databaseName).dropDatabase();
}

// MongoDBClient is a singleton with private static `instance`. Integration
// test files must each start from a clean state, so we clear the slot via
// defineProperty (the same trick used in mongodb-client-extended.test.ts).
function resetMongoDBClientSingleton(): void {
  Object.defineProperty(MongoDBClient, 'instance', {
    value: undefined,
    writable: true,
    configurable: true,
  });
}

// Build a fresh MongoDBClient connected to the same DB, in either readonly
// or RW mode. Reading MONGODB_MCP_CONNECTION_STRING is delegated to the
// client itself, just like in production.
export async function setupMongoDBClient(readonlyMode: boolean): Promise<MongoDBClient> {
  resetMongoDBClientSingleton();

  const client = MongoDBClient.getInstance();

  client.setReadonlyMode(readonlyMode);
  await client.connect();

  return client;
}

// Helper for grabbing the registered tool handler from a registerXxxTool call.
// register*Tool calls server.registerTool(name, config, handler); we capture
// the handler so tests can invoke it directly with input params.
export interface CapturedTool {
  name: string;
  handler: (input: unknown, extra?: unknown) => Promise<unknown>;
}

export interface RecordingServer {
  server: { registerTool: (name: string, config: unknown, handler: CapturedTool['handler']) => void };
  captured: CapturedTool[];
}

export function makeRecordingServer(): RecordingServer {
  const captured: CapturedTool[] = [];
  const server = {
    registerTool(name: string, _config: unknown, handler: CapturedTool['handler']) {
      captured.push({ name, handler });
    },
  };

  return { server, captured };
}

export interface ToolResult {
  structuredContent?: { payload: Record<string, unknown> };
  content?: Array<{ type: string; text: string }>;
  isError?: boolean;
}

export function readPayload(result: unknown): Record<string, unknown> {
  const r = result as ToolResult;

  if (r.isError) {
    throw new Error(`tool returned error: ${JSON.stringify(r.content)}`);
  }

  const text = r.content?.[0]?.text ?? '';

  return (JSON.parse(text) as { payload: Record<string, unknown> }).payload;
}

export function expectError(result: unknown): { name?: string; message: string } {
  const r = result as ToolResult;

  if (!r.isError) {
    throw new Error(`expected tool error but got ok: ${JSON.stringify(r)}`);
  }

  const text = r.content?.[0]?.text ?? '';

  return JSON.parse(text) as { name?: string; message: string };
}
