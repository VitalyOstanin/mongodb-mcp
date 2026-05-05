import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerFindTool } from '../src/tools/find.js';
import { MongoDBClient } from '../src/mongodb-client.js';
import {
  closeAdminClient,
  dropDb,
  getAdminClient,
  makeRecordingServer,
  readPayload,
  setupMongoDBClient,
} from './helpers.js';

const DB = 'mongodb_mcp_it_find';
const COLL = 'people';

interface FindPayload {
  documents: Array<Record<string, unknown>>;
  returnedCount: number;
  limit: number;
  limited: boolean;
}

describe('find (integration)', () => {
  let invoke: (input: unknown) => Promise<unknown>;

  beforeAll(async () => {
    const admin = await getAdminClient();

    await dropDb(DB);

    interface Person {
      _id: number;
      name: string;
      role: string;
      createdAt: Date;
    }

    await admin.db(DB).collection<Person>(COLL).insertMany([
      { _id: 1, name: 'Alice', role: 'admin', createdAt: new Date('2025-01-01T00:00:00Z') },
      { _id: 2, name: 'Bob', role: 'user', createdAt: new Date('2025-02-01T00:00:00Z') },
      { _id: 3, name: 'Carol', role: 'user', createdAt: new Date('2025-03-01T00:00:00Z') },
    ]);

    const client = await setupMongoDBClient(true);
    const { server, captured } = makeRecordingServer();

    registerFindTool(server as unknown as McpServer, client);
    invoke = captured[0]!.handler;
  });

  afterAll(async () => {
    await MongoDBClient.getInstance().disconnect('test cleanup');
    await dropDb(DB);
    await closeAdminClient();
  });

  it('returns documents matching a simple equality filter', async () => {
    const payload = readPayload(await invoke({
      database: DB,
      collection: COLL,
      filter: { role: 'user' },
      sort: { _id: 1 },
    })) as unknown as FindPayload;

    expect(payload.documents.map((d) => d['name'])).toEqual(['Bob', 'Carol']);
    expect(payload.returnedCount).toBe(2);
    expect(payload.limited).toBe(false);
  });

  it('honours limit and projection', async () => {
    const payload = readPayload(await invoke({
      database: DB,
      collection: COLL,
      filter: {},
      sort: { _id: 1 },
      limit: 1,
      projection: { name: 1, _id: 0 },
    })) as unknown as FindPayload;

    expect(payload.documents).toEqual([{ name: 'Alice' }]);
    expect(payload.returnedCount).toBe(1);
    expect(payload.limit).toBe(1);
    expect(payload.limited).toBe(true);
  });

  it('converts ISO date strings in the filter to Date objects', async () => {
    const payload = readPayload(await invoke({
      database: DB,
      collection: COLL,
      filter: { createdAt: { $gte: '2025-02-01T00:00:00.000Z' } },
      sort: { _id: 1 },
    })) as unknown as FindPayload;

    expect(payload.documents.map((d) => d['name'])).toEqual(['Bob', 'Carol']);
  });

  it('supports $or with array of conditions (regression: convertStringDatesToObjects must not stringify arrays)', async () => {
    const payload = readPayload(await invoke({
      database: DB,
      collection: COLL,
      filter: { $or: [{ name: 'Alice' }, { name: 'Carol' }] },
      sort: { _id: 1 },
    })) as unknown as FindPayload;

    expect(payload.documents.map((d) => d['name'])).toEqual(['Alice', 'Carol']);
  });
});
