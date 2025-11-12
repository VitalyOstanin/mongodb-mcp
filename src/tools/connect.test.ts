import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { MongoDBClient } from '../mongodb-client.js';
import { registerConnectTool } from './connect.js';
import { toolSuccess, toolError } from '../utils/tool-response.js';

// Mock environment variables
const originalEnv = process.env;

describe('Connect Tool', () => {
  jest.setTimeout(10000); // Increase timeout for connect tests

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
      connect: jest.fn(),
      getConnectionInfo: jest.fn(),
      getConnectionString: jest.fn(),
      isReadonly: jest.fn().mockReturnValue(false), // Default to non-read-only mode
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
        description: 'Establish connection to MongoDB using connection string',
      }),
      expect.any(Function),
    );
  });

  it('should connect to MongoDB with provided connection string', async () => {
    mockClient.connect.mockResolvedValue(undefined);
    mockClient.getConnectionInfo.mockReturnValue({ isConnected: false, hasConnectionString: false });

    registerConnectTool(mockServer, mockClient);

    // Get the tool handler function
    const registerCall = mockServer.registerTool.mock.calls[0];
    // Using 'any' for params and return type because we're accessing the registered tool handler
    // from mock calls, and the exact type is complex to define since it comes from the tool registration system
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const handler = registerCall[2] as (params: any) => Promise<any>;
    const params = {
      connectionString: 'mongodb://localhost:27017',
    };
    const result = await handler(params);

    expect(mockClient.connect).toHaveBeenCalledWith('mongodb://localhost:27017');
    expect(mockClient.getConnectionInfo).toHaveBeenCalled();

    expect(result).toEqual(
      toolSuccess({
        success: true,
        message: 'Connected to MongoDB successfully',
        isConnected: true,
      }),
    );
  });

  it('should connect to MongoDB using environment variable', async () => {
    process.env.MONGODB_CONNECTION_STRING = 'mongodb://env:27017';
    mockClient.connect.mockResolvedValue(undefined);
    mockClient.getConnectionInfo.mockReturnValue({ isConnected: false, hasConnectionString: false });

    registerConnectTool(mockServer, mockClient);

    // Get the tool handler function
    const registerCall = mockServer.registerTool.mock.calls[0];
    // Using 'any' for params and return type because we're accessing the registered tool handler
    // from mock calls, and the exact type is complex to define since it comes from the tool registration system
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const handler = registerCall[2] as (params: any) => Promise<any>;
    const params = {}; // No connection string provided
    const result = await handler(params);

    expect(mockClient.connect).toHaveBeenCalledWith(undefined); // The connect method will use the env var internally
    expect(mockClient.getConnectionInfo).toHaveBeenCalled();

    expect(result).toEqual(
      toolSuccess({
        success: true,
        message: 'Connected to MongoDB successfully using MONGODB_CONNECTION_STRING environment variable',
        isConnected: true,
      }),
    );
  });

  it('should return success when already connected to the same connection string', async () => {
    mockClient.getConnectionInfo.mockReturnValue({ isConnected: true, hasConnectionString: true });
    mockClient.getConnectionString.mockReturnValue('mongodb://localhost:27017');

    registerConnectTool(mockServer, mockClient);

    // Get the tool handler function
    const registerCall = mockServer.registerTool.mock.calls[0];
    // Using 'any' for params and return type because we're accessing the registered tool handler
    // from mock calls, and the exact type is complex to define since it comes from the tool registration system
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const handler = registerCall[2] as (params: any) => Promise<any>;
    const params = {
      connectionString: 'mongodb://localhost:27017',
    };
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
    // Ensure MONGODB_CONNECTION_STRING is not set
    delete process.env.MONGODB_CONNECTION_STRING;

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
      toolError(new Error('Connection string is required. Either pass it as a parameter or set MONGODB_CONNECTION_STRING environment variable.')),
    );
  });

  it('should return an error if connection fails', async () => {
    mockClient.connect.mockRejectedValue(new Error('Connection failed'));
    mockClient.getConnectionInfo.mockReturnValue({ isConnected: false, hasConnectionString: false });

    registerConnectTool(mockServer, mockClient);

    // Get the tool handler function
    const registerCall = mockServer.registerTool.mock.calls[0];
    // Using 'any' for params and return type because we're accessing the registered tool handler
    // from mock calls, and the exact type is complex to define since it comes from the tool registration system
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const handler = registerCall[2] as (params: any) => Promise<any>;
    const params = {
      connectionString: 'mongodb://localhost:27017',
    };
    const result = await handler(params);

    expect(mockClient.connect).toHaveBeenCalledWith('mongodb://localhost:27017');

    expect(result).toEqual(
      toolError(new Error('Connection failed')),
    );
  });
});
