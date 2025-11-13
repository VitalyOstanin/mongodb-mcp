import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { MongoClient, Db, Admin } from 'mongodb';
import type { MongoDBClient } from '../mongodb-client.js';
import { registerMongodbLogsTool } from './mongodb-logs.js';
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

describe('MongodbLogs Tool', () => {
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

  it('should register the mongodb-logs tool correctly', () => {
    registerMongodbLogsTool(mockServer, mockClient);

    expect(mockServer.registerTool).toHaveBeenCalledWith(
      'mongodb-logs',
      expect.objectContaining({
        description: 'Returns the most recent logged mongod events',
      }),
      expect.any(Function),
    );
  });

  it('should return an error if not connected to MongoDB', async () => {
    mockClient.isConnectedToMongoDB.mockReturnValue(false);

    registerMongodbLogsTool(mockServer, mockClient);

    // Get the tool handler function
    const registerCall = mockServer.registerTool.mock.calls[0];
    // Using 'any' for params and return type because we're accessing the registered tool handler
    // from mock calls, and the exact type is complex to define since it comes from the tool registration system
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const handler = registerCall[2] as (params: any) => Promise<any>;
    const params = {};
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

  it('should get global logs successfully in non-read-only mode', async () => {
    mockClient.isConnectedToMongoDB.mockReturnValue(true);

    const mockLogs = [
      '2023-01-01T10:00:00.000+00:00 I NETWORK  [conn1] connection accepted from 127.0.0.1:12345',
      '2023-01-01T10:00:01.000+00:00 I NETWORK  [conn1] [127.0.0.1:12345] end connection',
    ];
    const mockResult = { log: mockLogs };

    mockAdmin.command.mockResolvedValue(mockResult);

    registerMongodbLogsTool(mockServer, mockClient);

    // Get the tool handler function
    const registerCall = mockServer.registerTool.mock.calls[0];
    // Using 'any' for params and return type because we're accessing the registered tool handler
    // from mock calls, and the exact type is complex to define since it comes from the tool registration system
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const handler = registerCall[2] as (params: any) => Promise<any>;
    const params = {
      type: 'global',
      limit: 50,
    };
    const result = await handler(params);

    expect(mockClient.getClient).toHaveBeenCalled();
    expect(mockMongoClient.db).toHaveBeenCalledWith('admin');
    expect(mockDb.admin).toHaveBeenCalled();
    expect(mockAdmin.command).toHaveBeenCalledWith({
      getLog: 'global',
      n: 50,
    });

    expect(result).toEqual(
      toolSuccess({
        logs: mockLogs,
        total: 2,
        limit: 50,
        type: 'global',
      }),
    );
  });

  it('should get startup warnings successfully in read-only mode', async () => {
    mockClient.isConnectedToMongoDB.mockReturnValue(true);
    mockClient.isReadonly.mockReturnValue(true);

    const mockLogs = [
      'WARNING: This 64-bit system supports only 0.000GB of shared memory (using 0.000GB). For better performance, increase shared memory to at least 1GB.',
    ];
    const mockResult = { log: mockLogs };

    mockAdmin.command.mockResolvedValue(mockResult);

    registerMongodbLogsTool(mockServer, mockClient);

    // Get the tool handler function
    const registerCall = mockServer.registerTool.mock.calls[0];
    // Using 'any' for params and return type because we're accessing the registered tool handler
    // from mock calls, and the exact type is complex to define since it comes from the tool registration system
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const handler = registerCall[2] as (params: any) => Promise<any>;
    const params = {
      type: 'startupWarnings',
      limit: 20,
    };
    const result = await handler(params);

    expect(mockAdmin.command).toHaveBeenCalledWith({
      getLog: 'startupWarnings',
      n: 20,
    });

    expect(result).toEqual(
      toolSuccess({
        logs: mockLogs,
        total: 1,
        limit: 20,
        type: 'startupWarnings',
      }),
    );
  });

  it('should use default values when parameters are not provided', async () => {
    mockClient.isConnectedToMongoDB.mockReturnValue(true);

    const mockLogs = ['Sample log entry'];
    const mockResult = { log: mockLogs };

    mockAdmin.command.mockResolvedValue(mockResult);

    registerMongodbLogsTool(mockServer, mockClient);

    // Get the tool handler function
    const registerCall = mockServer.registerTool.mock.calls[0];
    // Using 'any' for params and return type because we're accessing the registered tool handler
    // from mock calls, and the exact type is complex to define since it comes from the tool registration system
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const handler = registerCall[2] as (params: any) => Promise<any>;
    const params = {}; // No parameters provided
    const result = await handler(params);

    expect(mockAdmin.command).toHaveBeenCalledWith(
      expect.objectContaining({
        getLog: 'global', // Default type
        n: 50,           // Default limit
      }),
    );

    const resultObj = JSON.parse(result.content[0].text);

    expect(resultObj.payload.type).toBe('global');
    expect(resultObj.payload.limit).toBe(50);
  });

  it('should handle response without log property', async () => {
    mockClient.isConnectedToMongoDB.mockReturnValue(true);

    const mockResult = {};

    mockAdmin.command.mockResolvedValue(mockResult);

    registerMongodbLogsTool(mockServer, mockClient);

    // Get the tool handler function
    const registerCall = mockServer.registerTool.mock.calls[0];
    // Using 'any' for params and return type because we're accessing the registered tool handler
    // from mock calls, and the exact type is complex to define since it comes from the tool registration system
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const handler = registerCall[2] as (params: any) => Promise<any>;
    const params = {
      type: 'global',
      limit: 10,
    };
    const result = await handler(params);

    expect(result).toEqual(
      toolSuccess({
        logs: [],
        total: 0,
        limit: 10,
        type: 'global',
      }),
    );
  });

  it('should return an error if getting logs fails', async () => {
    mockClient.isConnectedToMongoDB.mockReturnValue(true);

    mockAdmin.command.mockRejectedValue(new Error('Get logs failed'));

    registerMongodbLogsTool(mockServer, mockClient);

    // Get the tool handler function
    const registerCall = mockServer.registerTool.mock.calls[0];
    // Using 'any' for params and return type because we're accessing the registered tool handler
    // from mock calls, and the exact type is complex to define since it comes from the tool registration system
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const handler = registerCall[2] as (params: any) => Promise<any>;
    const params = {
      type: 'global',
      limit: 10,
    };
    const result = await handler(params);

    expect(result).toEqual(
      toolError(new Error('Get logs failed')),
    );
  });
});
