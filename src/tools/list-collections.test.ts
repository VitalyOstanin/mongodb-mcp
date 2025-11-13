import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { Db, CollectionInfo } from 'mongodb';
import type { MongoDBClient } from '../mongodb-client.js';
import { registerListCollectionsTool } from './list-collections.js';
import { toolSuccess, toolError } from '../utils/tool-response.js';

// Mock objects for testing
const mockCollectionInfo: jest.Mocked<CollectionInfo[]> = [
  { name: 'users', type: 'collection' },
  { name: 'products', type: 'collection' },
  { name: 'orders', type: 'collection' },
] as jest.Mocked<CollectionInfo[]>;
const mockListCollectionsCursor = {
  toArray: jest.fn(),
};
const mockDb: jest.Mocked<Db> = {
  listCollections: jest.fn().mockReturnValue(mockListCollectionsCursor),
} as unknown as jest.Mocked<Db>;

describe('ListCollections Tool', () => {
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
      isReadonly: jest.fn().mockReturnValue(false), // Default to non-read-only mode
    } as unknown as jest.Mocked<MongoDBClient>;
  });

  it('should register the list-collections tool correctly', () => {
    registerListCollectionsTool(mockServer, mockClient);

    expect(mockServer.registerTool).toHaveBeenCalledWith(
      'list-collections',
      expect.objectContaining({
        description: 'List all collections in a specific database',
      }),
      expect.any(Function),
    );
  });

  it('should return an error if not connected to MongoDB', async () => {
    mockClient.isConnectedToMongoDB.mockReturnValue(false);

    registerListCollectionsTool(mockServer, mockClient);

    // Get the tool handler function
    const registerCall = mockServer.registerTool.mock.calls[0];
    // Using 'any' for params and return type because we're accessing the registered tool handler
    // from mock calls, and the exact type is complex to define since it comes from the tool registration system
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const handler = registerCall[2] as (params: any) => Promise<any>;
    const params = {
      database: 'testdb',
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

  it('should list collections successfully in non-read-only mode', async () => {
    mockClient.isConnectedToMongoDB.mockReturnValue(true);

    mockListCollectionsCursor.toArray.mockResolvedValue(mockCollectionInfo);

    registerListCollectionsTool(mockServer, mockClient);

    // Get the tool handler function
    const registerCall = mockServer.registerTool.mock.calls[0];
    // Using 'any' for params and return type because we're accessing the registered tool handler
    // from mock calls, and the exact type is complex to define since it comes from the tool registration system
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const handler = registerCall[2] as (params: any) => Promise<any>;
    const params = {
      database: 'testdb',
    };
    const result = await handler(params);

    expect(mockClient.getDatabase).toHaveBeenCalledWith('testdb');
    expect(mockDb.listCollections).toHaveBeenCalled();
    expect(mockListCollectionsCursor.toArray).toHaveBeenCalled();

    expect(result).toEqual(
      toolSuccess({
        database: 'testdb',
        collections: ['users', 'products', 'orders'],
        total: 3,
      }),
    );
  });

  it('should list collections successfully in read-only mode', async () => {
    mockClient.isConnectedToMongoDB.mockReturnValue(true);
    mockClient.isReadonly.mockReturnValue(true);

    mockListCollectionsCursor.toArray.mockResolvedValue(mockCollectionInfo);

    registerListCollectionsTool(mockServer, mockClient);

    // Get the tool handler function
    const registerCall = mockServer.registerTool.mock.calls[0];
    // Using 'any' for params and return type because we're accessing the registered tool handler
    // from mock calls, and the exact type is complex to define since it comes from the tool registration system
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const handler = registerCall[2] as (params: any) => Promise<any>;
    const params = {
      database: 'testdb',
    };
    const result = await handler(params);

    expect(mockListCollectionsCursor.toArray).toHaveBeenCalled();

    expect(result).toEqual(
      toolSuccess({
        database: 'testdb',
        collections: ['users', 'products', 'orders'],
        total: 3,
      }),
    );
  });

  it('should handle database with no collections', async () => {
    mockClient.isConnectedToMongoDB.mockReturnValue(true);

    mockListCollectionsCursor.toArray.mockResolvedValue([]);

    registerListCollectionsTool(mockServer, mockClient);

    // Get the tool handler function
    const registerCall = mockServer.registerTool.mock.calls[0];
    // Using 'any' for params and return type because we're accessing the registered tool handler
    // from mock calls, and the exact type is complex to define since it comes from the tool registration system
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const handler = registerCall[2] as (params: any) => Promise<any>;
    const params = {
      database: 'emptydb',
    };
    const result = await handler(params);

    expect(result).toEqual(
      toolSuccess({
        database: 'emptydb',
        collections: [],
        total: 0,
      }),
    );
  });

  it('should return an error if listing collections fails', async () => {
    mockClient.isConnectedToMongoDB.mockReturnValue(true);

    mockListCollectionsCursor.toArray.mockRejectedValue(new Error('List collections failed'));

    registerListCollectionsTool(mockServer, mockClient);

    // Get the tool handler function
    const registerCall = mockServer.registerTool.mock.calls[0];
    // Using 'any' for params and return type because we're accessing the registered tool handler
    // from mock calls, and the exact type is complex to define since it comes from the tool registration system
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const handler = registerCall[2] as (params: any) => Promise<any>;
    const params = {
      database: 'testdb',
    };
    const result = await handler(params);

    expect(result).toEqual(
      toolError(new Error('List collections failed')),
    );
  });
});
