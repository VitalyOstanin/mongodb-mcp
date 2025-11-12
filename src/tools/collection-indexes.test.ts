import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { Db, Collection } from 'mongodb';
import type { MongoDBClient } from '../mongodb-client.js';
import { registerCollectionIndexesTool } from './collection-indexes.js';
import { toolSuccess, toolError } from '../utils/tool-response.js';

// Mock objects for testing
const mockCollection: jest.Mocked<Collection> = {
  indexes: jest.fn(),
} as unknown as jest.Mocked<Collection>;
const mockDb: jest.Mocked<Db> = {
  collection: jest.fn().mockReturnValue(mockCollection),
} as unknown as jest.Mocked<Db>;

describe('CollectionIndexes Tool', () => {
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

  it('should register the collection-indexes tool correctly', () => {
    registerCollectionIndexesTool(mockServer, mockClient);

    expect(mockServer.registerTool).toHaveBeenCalledWith(
      'collection-indexes',
      expect.objectContaining({
        description: 'Describe the indexes for a collection',
      }),
      expect.any(Function),
    );
  });

  it('should return an error if not connected to MongoDB', async () => {
    mockClient.isConnectedToMongoDB.mockReturnValue(false);

    registerCollectionIndexesTool(mockServer, mockClient);

    // Get the tool handler function
    const registerCall = mockServer.registerTool.mock.calls[0];
    // Using 'any' for params and return type because we're accessing the registered tool handler
    // from mock calls, and the exact type is complex to define since it comes from the tool registration system
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const handler = registerCall[2] as (params: any) => Promise<any>;
    const params = {
      database: 'testdb',
      collection: 'testcollection',
    };
    const result = await handler(params);

    expect(result).toEqual(
      toolError(new Error('Not connected to MongoDB. Please connect first.')),
    );
  });

  it('should get collection indexes successfully in non-read-only mode', async () => {
    mockClient.isConnectedToMongoDB.mockReturnValue(true);

    // Using 'any' for index objects because MongoDB index objects have variable structures
    // that are complex to type exactly for testing purposes

    const mockIndexes = [
      { v: 2, key: { _id: 1 }, name: '_id_', ns: 'testdb.testcollection' } as any, // eslint-disable-line @typescript-eslint/no-explicit-any
      { v: 2, key: { name: 1 }, name: 'name_1', ns: 'testdb.testcollection' } as any, // eslint-disable-line @typescript-eslint/no-explicit-any
    ];

    mockCollection.indexes.mockResolvedValue(mockIndexes);

    registerCollectionIndexesTool(mockServer, mockClient);

    // Get the tool handler function
    const registerCall = mockServer.registerTool.mock.calls[0];
    // Using 'any' for params and return type because we're accessing the registered tool handler
    // from mock calls, and the exact type is complex to define since it comes from the tool registration system
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const handler = registerCall[2] as (params: any) => Promise<any>;
    const params = {
      database: 'testdb',
      collection: 'testcollection',
    };
    const result = await handler(params);

    expect(mockClient.getDatabase).toHaveBeenCalledWith('testdb');
    expect(mockDb.collection).toHaveBeenCalledWith('testcollection');
    expect(mockCollection.indexes).toHaveBeenCalled();

    expect(result).toEqual(
      toolSuccess({
        database: 'testdb',
        collection: 'testcollection',
        indexes: mockIndexes,
        total: 2,
      }),
    );
  });

  it('should get collection indexes successfully in read-only mode', async () => {
    mockClient.isConnectedToMongoDB.mockReturnValue(true);
    mockClient.isReadonly.mockReturnValue(true);

    // Using 'any' for index objects because MongoDB index objects have variable structures
    // that are complex to type exactly for testing purposes

    const mockIndexes = [
      { v: 2, key: { _id: 1 }, name: '_id_', ns: 'testdb.testcollection' } as any, // eslint-disable-line @typescript-eslint/no-explicit-any
      { v: 2, key: { name: 1 }, name: 'name_1', ns: 'testdb.testcollection' } as any, // eslint-disable-line @typescript-eslint/no-explicit-any
    ];

    mockCollection.indexes.mockResolvedValue(mockIndexes);

    registerCollectionIndexesTool(mockServer, mockClient);

    // Get the tool handler function
    const registerCall = mockServer.registerTool.mock.calls[0];
    // Using 'any' for params and return type because we're accessing the registered tool handler
    // from mock calls, and the exact type is complex to define since it comes from the tool registration system
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const handler = registerCall[2] as (params: any) => Promise<any>;
    const params = {
      database: 'testdb',
      collection: 'testcollection',
    };
    const result = await handler(params);

    expect(mockCollection.indexes).toHaveBeenCalled();

    expect(result).toEqual(
      toolSuccess({
        database: 'testdb',
        collection: 'testcollection',
        indexes: mockIndexes,
        total: 2,
      }),
    );
  });

  it('should return an error if getting indexes fails', async () => {
    mockClient.isConnectedToMongoDB.mockReturnValue(true);
    mockCollection.indexes.mockRejectedValue(new Error('Failed to get indexes'));

    registerCollectionIndexesTool(mockServer, mockClient);

    // Get the tool handler function
    const registerCall = mockServer.registerTool.mock.calls[0];
    // Using 'any' for params and return type because we're accessing the registered tool handler
    // from mock calls, and the exact type is complex to define since it comes from the tool registration system
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const handler = registerCall[2] as (params: any) => Promise<any>;
    const params = {
      database: 'testdb',
      collection: 'testcollection',
    };
    const result = await handler(params);

    expect(result).toEqual(
      toolError(new Error('Failed to get indexes')),
    );
  });
});
