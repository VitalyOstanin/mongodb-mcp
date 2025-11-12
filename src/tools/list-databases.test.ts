import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { MongoClient, Db, Admin } from 'mongodb';
import type { MongoDBClient } from '../mongodb-client.js';
import { registerListDatabasesTool } from './list-databases.js';
import { toolSuccess, toolError } from '../utils/tool-response.js';

// Mock objects for testing
const mockAdmin: jest.Mocked<Admin> = {
  listDatabases: jest.fn(),
} as unknown as jest.Mocked<Admin>;
const mockDb: jest.Mocked<Db> = {
  admin: jest.fn().mockReturnValue(mockAdmin),
} as unknown as jest.Mocked<Db>;
const mockMongoClient: jest.Mocked<MongoClient> = {
  db: jest.fn().mockReturnValue(mockDb),
} as unknown as jest.Mocked<MongoClient>;

describe('ListDatabases Tool', () => {
  let mockServer: jest.Mocked<McpServer>;
  let mockClient: jest.Mocked<MongoDBClient>;

  beforeEach(() => {
    jest.clearAllMocks();

    mockServer = {
      registerTool: jest.fn(),
    } as unknown as jest.Mocked<McpServer>;

    mockClient = {
      isConnectedToMongoDB: jest.fn(),
      getClient: jest.fn().mockReturnValue(mockMongoClient),
      getDatabase: jest.fn().mockReturnValue(mockDb),
      isReadonly: jest.fn().mockReturnValue(false), // Default to non-read-only mode
    } as unknown as jest.Mocked<MongoDBClient>;
  });

  it('should register the list-databases tool correctly', () => {
    registerListDatabasesTool(mockServer, mockClient);

    expect(mockServer.registerTool).toHaveBeenCalledWith(
      'list-databases',
      expect.objectContaining({
        description: 'List all databases in the MongoDB instance',
      }),
      expect.any(Function),
    );
  });

  it('should return an error if not connected to MongoDB', async () => {
    mockClient.isConnectedToMongoDB.mockReturnValue(false);

    registerListDatabasesTool(mockServer, mockClient);

    // Get the tool handler function
    const registerCall = mockServer.registerTool.mock.calls[0];
    // Using 'any' for params and return type because we're accessing the registered tool handler
    // from mock calls, and the exact type is complex to define since it comes from the tool registration system
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const handler = registerCall[2] as (params: any) => Promise<any>;
    const params = {};
    const result = await handler(params);

    expect(result).toEqual(
      toolError(new Error('Not connected to MongoDB. Please connect first.')),
    );
  });

  it('should list databases successfully in non-read-only mode', async () => {
    mockClient.isConnectedToMongoDB.mockReturnValue(true);

    const mockDatabases = {
      databases: [
        { name: 'admin', sizeOnDisk: 131072, empty: false },
        { name: 'local', sizeOnDisk: 131072, empty: false },
        { name: 'testdb', sizeOnDisk: 262144, empty: false },
      ],
      ok: 1 as const,
    };

    mockAdmin.listDatabases.mockResolvedValue(mockDatabases);

    registerListDatabasesTool(mockServer, mockClient);

    // Get the tool handler function
    const registerCall = mockServer.registerTool.mock.calls[0];
    // Using 'any' for params and return type because we're accessing the registered tool handler
    // from mock calls, and the exact type is complex to define since it comes from the tool registration system
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const handler = registerCall[2] as (params: any) => Promise<any>;
    const params = {};
    const result = await handler(params);

    expect(mockClient.getClient).toHaveBeenCalled();
    expect(mockMongoClient.db).toHaveBeenCalled();
    expect(mockDb.admin).toHaveBeenCalled();
    expect(mockAdmin.listDatabases).toHaveBeenCalled();

    expect(result).toEqual(
      toolSuccess({
        databases: [
          { name: 'admin', sizeOnDisk: 131072, empty: false },
          { name: 'local', sizeOnDisk: 131072, empty: false },
          { name: 'testdb', sizeOnDisk: 262144, empty: false },
        ],
        total: 3,
      }),
    );
  });

  it('should list databases successfully in read-only mode', async () => {
    mockClient.isConnectedToMongoDB.mockReturnValue(true);
    mockClient.isReadonly.mockReturnValue(true);

    // Using 'any' because MongoDB's listDatabases response structure can vary between versions
    // and it's complex to type exactly for testing purposes

    const mockDatabases = [
      { name: 'admin', sizeOnDisk: 131072, empty: false },
      { name: 'local', sizeOnDisk: 131072, empty: false },
      { name: 'testdb', sizeOnDisk: 262144, empty: false },
    ] as any; // eslint-disable-line @typescript-eslint/no-explicit-any

    mockAdmin.listDatabases.mockResolvedValue(mockDatabases);

    registerListDatabasesTool(mockServer, mockClient);

    // Get the tool handler function
    const registerCall = mockServer.registerTool.mock.calls[0];
    // Using 'any' for params and return type because we're accessing the registered tool handler
    // from mock calls, and the exact type is complex to define since it comes from the tool registration system
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const handler = registerCall[2] as (params: any) => Promise<any>;
    const params = {};
    const result = await handler(params);

    expect(mockAdmin.listDatabases).toHaveBeenCalled();

    expect(result).toEqual(
      toolSuccess({
        databases: [
          { name: 'admin', sizeOnDisk: 131072, empty: false },
          { name: 'local', sizeOnDisk: 131072, empty: false },
          { name: 'testdb', sizeOnDisk: 262144, empty: false },
        ],
        total: 3,
      }),
    );
  });

  it('should handle response without databases property', async () => {
    mockClient.isConnectedToMongoDB.mockReturnValue(true);

    // Using 'any' because MongoDB's listDatabases response structure can vary between versions
    // and it's complex to type exactly for testing purposes

    const mockDatabases = [
      { name: 'admin', sizeOnDisk: 131072, empty: false },
      { name: 'testdb', sizeOnDisk: 262144, empty: false },
    ] as any; // eslint-disable-line @typescript-eslint/no-explicit-any

    mockAdmin.listDatabases.mockResolvedValue(mockDatabases);

    registerListDatabasesTool(mockServer, mockClient);

    // Get the tool handler function
    const registerCall = mockServer.registerTool.mock.calls[0];
    // Using 'any' for params and return type because we're accessing the registered tool handler
    // from mock calls, and the exact type is complex to define since it comes from the tool registration system
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const handler = registerCall[2] as (params: any) => Promise<any>;
    const params = {};
    const result = await handler(params);

    expect(mockAdmin.listDatabases).toHaveBeenCalled();

    expect(result).toEqual(
      toolSuccess({
        databases: [
          { name: 'admin', sizeOnDisk: 131072, empty: false },
          { name: 'testdb', sizeOnDisk: 262144, empty: false },
        ],
        total: 2,
      }),
    );
  });

  it('should handle database with no databases', async () => {
    mockClient.isConnectedToMongoDB.mockReturnValue(true);

    const mockDatabases = { databases: [], ok: 1 as const };

    mockAdmin.listDatabases.mockResolvedValue(mockDatabases);

    registerListDatabasesTool(mockServer, mockClient);

    // Get the tool handler function
    const registerCall = mockServer.registerTool.mock.calls[0];
    // Using 'any' for params and return type because we're accessing the registered tool handler
    // from mock calls, and the exact type is complex to define since it comes from the tool registration system
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const handler = registerCall[2] as (params: any) => Promise<any>;
    const params = {};
    const result = await handler(params);

    expect(result).toEqual(
      toolSuccess({
        databases: [],
        total: 0,
      }),
    );
  });

  it('should return an error if listing databases fails', async () => {
    mockClient.isConnectedToMongoDB.mockReturnValue(true);

    mockAdmin.listDatabases.mockRejectedValue(new Error('List databases failed'));

    registerListDatabasesTool(mockServer, mockClient);

    // Get the tool handler function
    const registerCall = mockServer.registerTool.mock.calls[0];
    // Using 'any' for params and return type because we're accessing the registered tool handler
    // from mock calls, and the exact type is complex to define since it comes from the tool registration system
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const handler = registerCall[2] as (params: any) => Promise<any>;
    const params = {};
    const result = await handler(params);

    expect(result).toEqual(
      toolError(new Error('List databases failed')),
    );
  });
});
