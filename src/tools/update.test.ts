import type { Mocked } from 'vitest';
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { Db, Collection } from 'mongodb';
import type { MongoDBClient } from '../mongodb-client.js';
import { registerUpdateTool } from './update.js';
import { toolSuccess, toolError } from '../utils/tool-response.js';

// Mock objects for testing
const mockCollection: Mocked<Collection> = {
  updateOne: vi.fn(),
  updateMany: vi.fn(),
} as unknown as Mocked<Collection>;
const mockDb: Mocked<Db> = {
  collection: vi.fn().mockReturnValue(mockCollection),
} as unknown as Mocked<Db>;

describe('Update Tool', () => {
  let mockServer: Mocked<McpServer>;
  let mockClient: Mocked<MongoDBClient>;

  beforeEach(() => {
    vi.clearAllMocks();

    mockServer = {
      registerTool: vi.fn(),
    } as unknown as Mocked<McpServer>;

    mockClient = {
      isConnectedToMongoDB: vi.fn(),
      getDatabase: vi.fn().mockReturnValue(mockDb),
    } as unknown as Mocked<MongoDBClient>;
  });

  it('should register the update tool correctly', () => {
    registerUpdateTool(mockServer, mockClient);

    expect(mockServer.registerTool).toHaveBeenCalledWith(
      'update',
      expect.objectContaining({
        title: 'Update Documents',
        description: expect.stringContaining('Update one or multiple documents'),
        annotations: expect.objectContaining({
          readOnlyHint: false,
        }),
      }),
      expect.any(Function),
    );
 });

  it('should return an error if not connected to MongoDB', async () => {
    mockClient.isConnectedToMongoDB.mockReturnValue(false);

    registerUpdateTool(mockServer, mockClient);

    // Get the tool handler function
    const registerCall = mockServer.registerTool.mock.calls[0]!;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const handler = registerCall[2] as (params: any) => Promise<any>;
    const params = {
      database: 'testdb',
      collection: 'testcollection',
      filter: { name: 'test' },
      update: { $set: { value: 456 } },
    };
    const result = await handler(params);

    expect(result.isError).toBe(true);
    expect(result.content).toEqual([
      {
        type: "text",
        text: JSON.stringify({
          name: "Error",
          message: "Not connected to MongoDB. Please connect first.",
        }),
      },
    ]);
  });

  it('should update a single document successfully', async () => {
    mockClient.isConnectedToMongoDB.mockReturnValue(true);

    const mockUpdateResult = {
      acknowledged: true,
      matchedCount: 1,
      modifiedCount: 1,
      upsertedCount: 0,
      upsertedId: null,
    };

    mockCollection.updateOne.mockResolvedValue(mockUpdateResult);

    registerUpdateTool(mockServer, mockClient);

    // Get the tool handler function
    const registerCall = mockServer.registerTool.mock.calls[0]!;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const handler = registerCall[2] as (params: any) => Promise<any>;
    const params = {
      database: 'testdb',
      collection: 'testcollection',
      filter: { name: 'test' },
      update: { $set: { value: 456 } },
      upsert: false,
    };
    const result = await handler(params);

    expect(mockClient.getDatabase).toHaveBeenCalledWith('testdb');
    expect(mockDb.collection).toHaveBeenCalledWith('testcollection');
    expect(mockCollection.updateOne).toHaveBeenCalledWith(
      { name: 'test' },
      { $set: { value: 456 } },
      { upsert: false },
    );

    expect(result).toEqual(
      toolSuccess({
        database: 'testdb',
        collection: 'testcollection',
        matchedCount: 1,
        modifiedCount: 1,
        upsertedCount: 0,
        upsertedId: null,
        operation: 'updateOne',
      }),
    );
  });

  it('should update multiple documents successfully', async () => {
    mockClient.isConnectedToMongoDB.mockReturnValue(true);

    const mockUpdateResult = {
      acknowledged: true,
      matchedCount: 2,
      modifiedCount: 2,
      upsertedCount: 0,
      upsertedId: null,
    };

    mockCollection.updateMany.mockResolvedValue(mockUpdateResult);

    registerUpdateTool(mockServer, mockClient);

    // Get the tool handler function
    const registerCall = mockServer.registerTool.mock.calls[0]!;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const handler = registerCall[2] as (params: any) => Promise<any>;
    const params = {
      database: 'testdb',
      collection: 'testcollection',
      filter: { status: 'active' },
      update: { $set: { status: 'inactive' } },
      multi: true,
    };
    const result = await handler(params);

    expect(mockClient.getDatabase).toHaveBeenCalledWith('testdb');
    expect(mockDb.collection).toHaveBeenCalledWith('testcollection');
    expect(mockCollection.updateMany).toHaveBeenCalledWith(
      { status: 'active' },
      { $set: { status: 'inactive' } },
      { upsert: false },
    );

    expect(result).toEqual(
      toolSuccess({
        database: 'testdb',
        collection: 'testcollection',
        matchedCount: 2,
        modifiedCount: 2,
        upsertedCount: 0,
        upsertedId: null,
        operation: 'updateMany',
      }),
    );
  });

  it('should return an error if update fails', async () => {
    mockClient.isConnectedToMongoDB.mockReturnValue(true);
    mockCollection.updateOne.mockRejectedValue(new Error('Update failed'));

    registerUpdateTool(mockServer, mockClient);

    // Get the tool handler function
    const registerCall = mockServer.registerTool.mock.calls[0]!;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const handler = registerCall[2] as (params: any) => Promise<any>;
    const params = {
      database: 'testdb',
      collection: 'testcollection',
      filter: { name: 'test' },
      update: { $set: { value: 456 } },
    };
    const result = await handler(params);

    expect(result).toEqual(
      toolError(new Error('Update failed')),
    );
  });
});
