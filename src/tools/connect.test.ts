import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { MongoDBClient } from '../mongodb-client.js';
import { registerConnectTool } from './connect.js';
import { toolSuccess, toolError } from '../utils/tool-response.js';

// Mock the MongoDBClient to prevent actual connections
const mockConnectFn = jest.fn();
const mockGetConnectionInfoFn = jest.fn();
const mockGetConnectionStringFn = jest.fn();
const mockIsReadonlyFn = jest.fn();

jest.mock('../mongodb-client.js', () => {
  return {
    MongoDBClient: {
      getInstance: jest.fn(() => ({
        connect: mockConnectFn,
        getConnectionInfo: mockGetConnectionInfoFn,
        getConnectionString: mockGetConnectionStringFn,
        isReadonly: mockIsReadonlyFn,
      })),
    },
  };
});

// Mock environment variables
const originalEnv = process.env;

describe('Connect Tool', () => {
  let mockServer: jest.Mocked<McpServer>;
  let mockClient: jest.Mocked<MongoDBClient>;

  beforeEach(() => {
    jest.clearAllMocks();

    // Restore original environment
    process.env = { ...originalEnv };

    mockServer = {
      registerTool: jest.fn(),
    } as unknown as jest.Mocked<McpServer>;

    mockClient = {
      connect: mockConnectFn,
      getConnectionInfo: mockGetConnectionInfoFn,
      getConnectionString: mockGetConnectionStringFn,
      isReadonly: mockIsReadonlyFn,
    } as unknown as jest.Mocked<MongoDBClient>;
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('should register the connect tool correctly', () => {
    registerConnectTool(mockServer, mockClient);

    expect(mockServer.registerTool).toHaveBeenCalledWith(
      'connect',
      expect.objectContaining({
        description: expect.stringContaining('Establish connection to MongoDB using connection string from environment variable MONGODB_MCP_CONNECTION_STRING'),
      }),
      expect.any(Function),
    );
  });

  // Note: This test is no longer relevant since we removed the connectionString parameter
  // The connection string is only provided via environment variable now

  it('should connect to MongoDB using environment variable', async () => {
    process.env.MONGODB_MCP_CONNECTION_STRING = 'mongodb://env:27017';
    mockConnectFn.mockResolvedValue(undefined);
    mockGetConnectionInfoFn.mockReturnValue({ isConnected: false }); // Updated to remove hasConnectionString

    registerConnectTool(mockServer, mockClient);

    // Get the tool handler function
    const registerCall = mockServer.registerTool.mock.calls[0];
    // Using 'any' for params and return type because we're accessing the registered tool handler
    // from mock calls, and the exact type is complex to define since it comes from the tool registration system
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const handler = registerCall[2] as (params: any) => Promise<any>;
    const params = {}; // No connection string provided
    const result = await handler(params);

    expect(mockConnectFn).toHaveBeenCalledWith(); // The connect method will use the env var internally and default to readonly mode
    expect(mockGetConnectionInfoFn).toHaveBeenCalled();

    expect(result).toEqual(
      toolSuccess({
        success: true,
        message: 'Connected to MongoDB successfully using MONGODB_MCP_CONNECTION_STRING environment variable',
        isConnected: true,
      }),
    );
  });

  it('should return success when already connected to the same connection string', async () => {
    process.env.MONGODB_MCP_CONNECTION_STRING = 'mongodb://localhost:27017';
    mockClient.getConnectionInfo.mockReturnValue({ isConnected: true }); // Updated to remove hasConnectionString
    mockClient.getConnectionString.mockReturnValue('mongodb://localhost:27017');

    registerConnectTool(mockServer, mockClient);

    // Get the tool handler function
    const registerCall = mockServer.registerTool.mock.calls[0];
    // Using 'any' for params and return type because we're accessing the registered tool handler
    // from mock calls, and the exact type is complex to define since it comes from the tool registration system
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const handler = registerCall[2] as (params: any) => Promise<any>;
    const params = {}; // No connection string parameter anymore
    const result = await handler(params);

    expect(mockClient.getConnectionInfo).toHaveBeenCalled();
    expect(mockClient.getConnectionString).toHaveBeenCalled();
    expect(mockClient.connect).not.toHaveBeenCalled(); // Should not connect again

    expect(result).toEqual(
      toolSuccess({
        success: true,
        message: 'Already connected to MongoDB with the same connection string',
        isConnected: true,
      }),
    );
  });

  it('should return an error if no connection string is provided and environment variable is not set', async () => {
    // Ensure MONGODB_MCP_CONNECTION_STRING is not set
    delete process.env.MONGODB_MCP_CONNECTION_STRING;

    registerConnectTool(mockServer, mockClient);

    // Get the tool handler function
    const registerCall = mockServer.registerTool.mock.calls[0];
    // Using 'any' for params and return type because we're accessing the registered tool handler
    // from mock calls, and the exact type is complex to define since it comes from the tool registration system
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const handler = registerCall[2] as (params: any) => Promise<any>;
    const params = {}; // No connection string provided
    const result = await handler(params);

    expect(mockClient.connect).not.toHaveBeenCalled();

    expect(result).toEqual(
      toolError(new Error('Connection string is required. Please set MONGODB_MCP_CONNECTION_STRING environment variable.')),
    );
  });

  it('should return an error if connection fails', async () => {
    process.env.MONGODB_MCP_CONNECTION_STRING = 'mongodb://localhost:27017';
    mockClient.connect.mockRejectedValue(new Error('Connection failed'));
    mockClient.getConnectionInfo.mockReturnValue({ isConnected: false }); // Updated to remove hasConnectionString

    registerConnectTool(mockServer, mockClient);

    // Get the tool handler function
    const registerCall = mockServer.registerTool.mock.calls[0];
    // Using 'any' for params and return type because we're accessing the registered tool handler
    // from mock calls, and the exact type is complex to define since it comes from the tool registration system
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const handler = registerCall[2] as (params: any) => Promise<any>;
    const params = {}; // No connection string parameter anymore
    const result = await handler(params);

    expect(mockClient.connect).toHaveBeenCalledWith(); // Default to readonly mode

    expect(result).toEqual(
      toolError(new Error('Connection failed')),
    );
  });
});
