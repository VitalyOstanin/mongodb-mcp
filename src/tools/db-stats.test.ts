import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { Db } from 'mongodb';
import type { MongoDBClient } from '../mongodb-client.js';
import { registerDbStatsTool } from './db-stats.js';
import { toolSuccess, toolError } from '../utils/tool-response.js';

// Mock objects for testing
const mockDb: jest.Mocked<Db> = {
  stats: jest.fn(),
} as unknown as jest.Mocked<Db>;

describe('DbStats Tool', () => {
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

  it('should register the db-stats tool correctly', () => {
    registerDbStatsTool(mockServer, mockClient);

    expect(mockServer.registerTool).toHaveBeenCalledWith(
      'db-stats',
      expect.objectContaining({
        description: 'Get statistics for a specific database',
      }),
      expect.any(Function),
    );
  });

  it('should return an error if not connected to MongoDB', async () => {
    mockClient.isConnectedToMongoDB.mockReturnValue(false);

    registerDbStatsTool(mockServer, mockClient);

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

  it('should get database stats successfully in non-read-only mode', async () => {
    mockClient.isConnectedToMongoDB.mockReturnValue(true);

    const mockStats = {
      db: 'testdb',
      collections: 3,
      objects: 100,
      avgObjSize: 1024,
      dataSize: 102400,
      storageSize: 204800,
      numExtents: 3,
      indexes: 2,
      indexSize: 32768,
      ok: 1,
    };

    mockDb.stats.mockResolvedValue(mockStats);

    registerDbStatsTool(mockServer, mockClient);

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
    expect(mockDb.stats).toHaveBeenCalled();

    expect(result).toEqual(
      toolSuccess({
        database: 'testdb',
        stats: mockStats,
      }),
    );
  });

  it('should get database stats successfully in read-only mode', async () => {
    mockClient.isConnectedToMongoDB.mockReturnValue(true);
    mockClient.isReadonly.mockReturnValue(true);

    const mockStats = {
      db: 'testdb',
      collections: 3,
      objects: 100,
      avgObjSize: 1024,
      dataSize: 102400,
      storageSize: 204800,
      numExtents: 3,
      indexes: 2,
      indexSize: 32768,
      ok: 1,
    };

    mockDb.stats.mockResolvedValue(mockStats);

    registerDbStatsTool(mockServer, mockClient);

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

    expect(mockDb.stats).toHaveBeenCalled();

    expect(result).toEqual(
      toolSuccess({
        database: 'testdb',
        stats: mockStats,
      }),
    );
  });

  it('should return an error if getting stats fails', async () => {
    mockClient.isConnectedToMongoDB.mockReturnValue(true);
    mockDb.stats.mockRejectedValue(new Error('Stats failed'));

    registerDbStatsTool(mockServer, mockClient);

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
      toolError(new Error('Stats failed')),
    );
  });
});
