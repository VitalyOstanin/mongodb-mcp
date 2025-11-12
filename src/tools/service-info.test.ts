import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { MongoDBClient } from '../mongodb-client.js';
import { registerServiceInfoTool } from './service-info.js';
import { VERSION } from '../version.js';
import { getTimezone } from '../utils/date.js';
import { toolSuccess } from '../utils/tool-response.js';

// Mock the getTimezone function
jest.mock('../utils/date.js');

describe('ServiceInfo Tool', () => {
  let mockServer: jest.Mocked<McpServer>;
  let mockClient: jest.Mocked<MongoDBClient>;

  beforeEach(() => {
    jest.clearAllMocks();

    mockServer = {
      registerTool: jest.fn(),
    } as unknown as jest.Mocked<McpServer>;

    mockClient = {
      getConnectionInfo: jest.fn(),
      isReadonly: jest.fn(),
    } as unknown as jest.Mocked<MongoDBClient>;

    // Mock getTimezone to return a consistent value
    (getTimezone as jest.Mock).mockReturnValue('UTC');
  });

  it('should register the service-info tool correctly', () => {
    registerServiceInfoTool(mockServer, mockClient);

    expect(mockServer.registerTool).toHaveBeenCalledWith(
      'service_info',
      expect.objectContaining({
        description: 'Get MongoDB service information and current connection status',
      }),
      expect.any(Function),
    );
  });

  it('should return service info when connected in non-read-only mode', async () => {
    mockClient.getConnectionInfo.mockReturnValue({
      isConnected: true,
      hasConnectionString: true,
    });
    mockClient.isReadonly.mockReturnValue(false);

    registerServiceInfoTool(mockServer, mockClient);

    // Get the tool handler function
    const registerCall = mockServer.registerTool.mock.calls[0];
    // Using 'any' for params and return type because we're accessing the registered tool handler
    // from mock calls, and the exact type is complex to define since it comes from the tool registration system
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const handler = registerCall[2] as (params: any) => Promise<any>;
    const params = {};
    const result = await handler(params);

    expect(mockClient.getConnectionInfo).toHaveBeenCalled();
    expect(mockClient.isReadonly).toHaveBeenCalled();

    expect(result).toEqual(
      toolSuccess({
        name: 'mongodb-mcp',
        isConnected: true,
        hasConnectionString: true,
        readonly: false,
        version: VERSION,
        timezone: 'UTC',
      }),
    );
  });

  it('should return service info when connected in read-only mode', async () => {
    mockClient.getConnectionInfo.mockReturnValue({
      isConnected: true,
      hasConnectionString: true,
    });
    mockClient.isReadonly.mockReturnValue(true);

    registerServiceInfoTool(mockServer, mockClient);

    // Get the tool handler function
    const registerCall = mockServer.registerTool.mock.calls[0];
    // Using 'any' for params and return type because we're accessing the registered tool handler
    // from mock calls, and the exact type is complex to define since it comes from the tool registration system
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const handler = registerCall[2] as (params: any) => Promise<any>;
    const params = {};
    const result = await handler(params);

    expect(mockClient.getConnectionInfo).toHaveBeenCalled();
    expect(mockClient.isReadonly).toHaveBeenCalled();

    expect(result).toEqual(
      toolSuccess({
        name: 'mongodb-mcp',
        isConnected: true,
        hasConnectionString: true,
        readonly: true,
        version: VERSION,
        timezone: 'UTC',
      }),
    );
  });

  it('should return service info when not connected', async () => {
    mockClient.getConnectionInfo.mockReturnValue({
      isConnected: false,
      hasConnectionString: false,
    });
    mockClient.isReadonly.mockReturnValue(false);

    registerServiceInfoTool(mockServer, mockClient);

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
        name: 'mongodb-mcp',
        isConnected: false,
        hasConnectionString: false,
        readonly: false,
        version: VERSION,
        timezone: 'UTC',
      }),
    );
  });

  it('should return service info with connection string but not connected', async () => {
    mockClient.getConnectionInfo.mockReturnValue({
      isConnected: false,
      hasConnectionString: true,
    });
    mockClient.isReadonly.mockReturnValue(false);

    registerServiceInfoTool(mockServer, mockClient);

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
        name: 'mongodb-mcp',
        isConnected: false,
        hasConnectionString: true,
        readonly: false,
        version: VERSION,
        timezone: 'UTC',
      }),
    );
  });
});
