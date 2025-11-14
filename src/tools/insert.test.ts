import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { Db, Collection, ObjectId } from 'mongodb';
import type { MongoDBClient } from '../mongodb-client.js';
import { registerInsertTool } from './insert.js';
import { toolSuccess, toolError } from '../utils/tool-response.js';

// Mock objects for testing
const mockCollection: jest.Mocked<Collection> = {
  insertOne: jest.fn(),
  insertMany: jest.fn(),
} as unknown as jest.Mocked<Collection>;
const mockDb: jest.Mocked<Db> = {
  collection: jest.fn().mockReturnValue(mockCollection),
} as unknown as jest.Mocked<Db>;
// Create mock ObjectId instances
const createMockObjectId = (id: string): ObjectId => {
  return {
    toString: () => id,
    toHexString: () => id,
    equals: (other: ObjectId) => other.toString() === id,
  } as unknown as ObjectId;
};

describe('Insert Tool', () => {
  let mockServer: jest.Mocked<McpServer>;
  let mockClient: jest.Mocked<MongoDBClient>;

  beforeEach(() => {
    jest.clearAllMocks();

    mockServer = {
      registerTool: jest.fn(),
    } as unknown as jest.Mocked<McpServer>;

    mockClient = {
      isConnectedToMongoDB: jest.fn(),
      getDatabase: jest.fn().mockReturnValue(mockDb),
    } as unknown as jest.Mocked<MongoDBClient>;
  });

  it('should register the insert tool correctly', () => {
    registerInsertTool(mockServer, mockClient);

    expect(mockServer.registerTool).toHaveBeenCalledWith(
      'insert',
      expect.objectContaining({
        title: 'Insert Documents',
        description: expect.stringContaining('Insert one or multiple documents'),
        annotations: {
          writeOperation: true,
          category: 'write',
        },
      }),
      expect.any(Function),
    );
  });

  it('should return an error if not connected to MongoDB', async () => {
    mockClient.isConnectedToMongoDB.mockReturnValue(false);

    registerInsertTool(mockServer, mockClient);

    // Get the tool handler function
    const registerCall = mockServer.registerTool.mock.calls[0];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const handler = registerCall[2] as (params: any) => Promise<any>;
    const params = {
      database: 'testdb',
      collection: 'testcollection',
      document: { name: 'test' },
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

  it('should insert a single document successfully', async () => {
    mockClient.isConnectedToMongoDB.mockReturnValue(true);

    const mockInsertResult = {
      acknowledged: true,
      insertedId: createMockObjectId('test-id'),
      insertedCount: 1,
    };

    mockCollection.insertOne.mockResolvedValue(mockInsertResult);

    registerInsertTool(mockServer, mockClient);

    // Get the tool handler function
    const registerCall = mockServer.registerTool.mock.calls[0];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const handler = registerCall[2] as (params: any) => Promise<any>;
    const params = {
      database: 'testdb',
      collection: 'testcollection',
      document: { name: 'test', value: 123 },
    };
    const result = await handler(params);

    expect(mockClient.getDatabase).toHaveBeenCalledWith('testdb');
    expect(mockDb.collection).toHaveBeenCalledWith('testcollection');
    expect(mockCollection.insertOne).toHaveBeenCalledWith({ name: 'test', value: 123 });

    expect(result).toEqual(
      toolSuccess({
        database: 'testdb',
        collection: 'testcollection',
        insertedId: createMockObjectId('test-id'),
        insertedCount: 1,
        operation: 'insertOne',
      }),
    );
 });

   it('should insert multiple documents successfully', async () => {
    mockClient.isConnectedToMongoDB.mockReturnValue(true);

    const mockInsertResult = {
      acknowledged: true,
      insertedCount: 2,
      insertedIds: { 0: createMockObjectId('id1'), 1: createMockObjectId('id2') },
    };

    mockCollection.insertMany.mockResolvedValue(mockInsertResult);

    registerInsertTool(mockServer, mockClient);

    // Get the tool handler function
    const registerCall = mockServer.registerTool.mock.calls[0];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const handler = registerCall[2] as (params: any) => Promise<any>;
    const params = {
      database: 'testdb',
      collection: 'testcollection',
      documents: [{ name: 'test1' }, { name: 'test2' }],
    };
    const result = await handler(params);

    expect(mockClient.getDatabase).toHaveBeenCalledWith('testdb');
    expect(mockDb.collection).toHaveBeenCalledWith('testcollection');
    expect(mockCollection.insertMany).toHaveBeenCalledWith([{ name: 'test1' }, { name: 'test2' }]);

    expect(result).toEqual(
      toolSuccess({
        database: 'testdb',
        collection: 'testcollection',
        insertedCount: 2,
        insertedIds: [createMockObjectId('id1'), createMockObjectId('id2')],
        operation: 'insertMany',
      }),
    );
 });

  it('should return an error if insertion fails', async () => {
    mockClient.isConnectedToMongoDB.mockReturnValue(true);
    mockCollection.insertOne.mockRejectedValue(new Error('Insert failed'));

    registerInsertTool(mockServer, mockClient);

    // Get the tool handler function
    const registerCall = mockServer.registerTool.mock.calls[0];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const handler = registerCall[2] as (params: any) => Promise<any>;
    const params = {
      database: 'testdb',
      collection: 'testcollection',
      document: { name: 'test' },
    };
    const result = await handler(params);

    expect(result).toEqual(
      toolError(new Error('Insert failed')),
    );
 });
});
