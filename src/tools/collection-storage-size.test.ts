import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { MongoClient, Db, Admin } from 'mongodb';
import type { MongoDBClient } from '../mongodb-client.js';
import { registerCollectionStorageSizeTool } from './collection-storage-size.js';
import { toolSuccess, toolError } from '../utils/tool-response.js';

// Mock objects for testing
const mockAdmin: jest.Mocked<Admin> = {
  command: jest.fn(),
} as unknown as jest.Mocked<Admin>;
const mockDb: jest.Mocked<Db> = {
  admin: jest.fn().mockReturnValue(mockAdmin),
} as unknown as jest.Mocked<Db>;
const mockMongoClient: jest.Mocked<MongoClient> = {
  db: jest.fn().mockReturnValue(mockDb),
} as unknown as jest.Mocked<MongoClient>;

describe('CollectionStorageSize Tool', () => {
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
      getClient: jest.fn().mockReturnValue(mockMongoClient),
    } as unknown as jest.Mocked<MongoDBClient>;
  });

  it('should register the collection-storage-size tool correctly', () => {
    registerCollectionStorageSizeTool(mockServer, mockClient);

    expect(mockServer.registerTool).toHaveBeenCalledWith(
      'collection-storage-size',
      expect.objectContaining({
        description: 'Get storage size of a specific collection',
      }),
      expect.any(Function),
    );
  });

  it('should return an error if not connected to MongoDB', async () => {
    mockClient.isConnectedToMongoDB.mockReturnValue(false);

    registerCollectionStorageSizeTool(mockServer, mockClient);

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

  it('should get collection storage size successfully in non-read-only mode', async () => {
    mockClient.isConnectedToMongoDB.mockReturnValue(true);

    const mockStats = { size: 2048, storageSize: 4096 };

    mockAdmin.command.mockResolvedValue(mockStats);

    registerCollectionStorageSizeTool(mockServer, mockClient);

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
    expect(mockDb.admin).toHaveBeenCalled();
    expect(mockAdmin.command).toHaveBeenCalledWith({ collStats: 'testcollection' });

    expect(result).toEqual(
      toolSuccess({
        database: 'testdb',
        collection: 'testcollection',
        size: 2048,
        sizeFormatted: '2 KB',
      }),
    );
  });

  it('should get collection storage size using storageSize when size is not available', async () => {
    mockClient.isConnectedToMongoDB.mockReturnValue(true);

    const mockStats = { storageSize: 4096 }; // No size property

    mockAdmin.command.mockResolvedValue(mockStats);

    registerCollectionStorageSizeTool(mockServer, mockClient);

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

    expect(mockAdmin.command).toHaveBeenCalledWith({ collStats: 'testcollection' });

    expect(result).toEqual(
      toolSuccess({
        database: 'testdb',
        collection: 'testcollection',
        size: 4096,
        sizeFormatted: '4 KB',
      }),
    );
  });

  it('should get collection storage size using default size of 0 when neither size nor storageSize are available', async () => {
    mockClient.isConnectedToMongoDB.mockReturnValue(true);

    const mockStats = {}; // No size or storageSize properties

    mockAdmin.command.mockResolvedValue(mockStats);

    registerCollectionStorageSizeTool(mockServer, mockClient);

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

    expect(mockAdmin.command).toHaveBeenCalledWith({ collStats: 'testcollection' });

    expect(result).toEqual(
      toolSuccess({
        database: 'testdb',
        collection: 'testcollection',
        size: 0,
        sizeFormatted: '0 Bytes',
      }),
    );
  });

  it('should get collection storage size successfully in read-only mode', async () => {
    mockClient.isConnectedToMongoDB.mockReturnValue(true);
    mockClient.isReadonly.mockReturnValue(true);

    const mockStats = { size: 2048, storageSize: 4096 };

    mockAdmin.command.mockResolvedValue(mockStats);

    registerCollectionStorageSizeTool(mockServer, mockClient);

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

    expect(mockAdmin.command).toHaveBeenCalledWith({ collStats: 'testcollection' });

    expect(result).toEqual(
      toolSuccess({
        database: 'testdb',
        collection: 'testcollection',
        size: 2048,
        sizeFormatted: '2 KB',
      }),
    );
  });

  it('should return an error if getting storage size fails', async () => {
    mockClient.isConnectedToMongoDB.mockReturnValue(true);
    mockAdmin.command.mockRejectedValue(new Error('Failed to get storage size'));

    registerCollectionStorageSizeTool(mockServer, mockClient);

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
      toolError(new Error('Failed to get storage size')),
    );
  });
});
