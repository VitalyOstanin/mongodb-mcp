import { registerServiceInfoTool } from './service-info.js';

describe('serviceInfo Tool', () => {
  // Using 'any' for mock objects as Jest mocks have dynamic properties that are hard to type precisely
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mockServer: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mockClient: any;

  beforeEach(() => {
    mockServer = {
      registerTool: jest.fn(),
    };

    mockClient = {
      getConnectionInfo: jest.fn(),
      isReadonly: jest.fn(),
    };
  });

  it('should register the service_info tool correctly', () => {
    registerServiceInfoTool(mockServer, mockClient);

    expect(mockServer.registerTool).toHaveBeenCalledWith(
      'service_info',
      expect.objectContaining({
        title: 'Service Information',
        description: 'Get MongoDB service information and current connection status',
      }),
      expect.any(Function),
    );
  });

  it('should return service info with disconnect reason when disconnected', async () => {
    // Mock client behavior
    mockClient.getConnectionInfo.mockReturnValue({
      isConnected: false,
      disconnectReason: 'normal disconnect',
    });
    mockClient.isReadonly.mockReturnValue(true);

    registerServiceInfoTool(mockServer, mockClient);

    // Get the registered implementation function
    const [, , implementation] = mockServer.registerTool.mock.calls[0];
    // Call the implementation
    const result = await implementation();
    const parsedResult = JSON.parse(result.content[0].text);

    expect(parsedResult.success).toBe(true);
    expect(parsedResult.payload).toEqual({
      name: 'mongodb-mcp',
      isConnected: false,
      readonly: true,
      version: expect.any(String),
      timezone: expect.any(String),
      disconnectReason: 'normal disconnect',
    });
  });

  it('should return service info with connection error when present', async () => {
    // Mock client behavior
    mockClient.getConnectionInfo.mockReturnValue({
      isConnected: false,
      connectionError: 'Connection failed',
    });
    mockClient.isReadonly.mockReturnValue(false);

    registerServiceInfoTool(mockServer, mockClient);

    // Get the registered implementation function
    const [, , implementation] = mockServer.registerTool.mock.calls[0];
    // Call the implementation
    const result = await implementation();
    const parsedResult = JSON.parse(result.content[0].text);

    expect(parsedResult.success).toBe(true);
    expect(parsedResult.payload).toEqual({
      name: 'mongodb-mcp',
      isConnected: false,
      readonly: false,
      version: expect.any(String),
      timezone: expect.any(String),
      connectionError: 'Connection failed',
    });
  });

  it('should return service info without disconnect reason when connected', async () => {
    // Mock client behavior
    mockClient.getConnectionInfo.mockReturnValue({
      isConnected: true,
    });
    mockClient.isReadonly.mockReturnValue(false);

    registerServiceInfoTool(mockServer, mockClient);

    // Get the registered implementation function
    const [, , implementation] = mockServer.registerTool.mock.calls[0];
    // Call the implementation
    const result = await implementation();
    const parsedResult = JSON.parse(result.content[0].text);

    expect(parsedResult.success).toBe(true);
    expect(parsedResult.payload).toEqual({
      name: 'mongodb-mcp',
      isConnected: true,
      readonly: false,
      version: expect.any(String),
      timezone: expect.any(String),
    });

    // Should not have disconnectReason or connectionError when connected
    expect(parsedResult.payload.disconnectReason).toBeUndefined();
    expect(parsedResult.payload.connectionError).toBeUndefined();
  });

  it('should return service info with both disconnect reason and error when both present', async () => {
    // Mock client behavior
    mockClient.getConnectionInfo.mockReturnValue({
      isConnected: false,
      disconnectReason: 'manual disconnect',
      connectionError: 'Network error',
    });
    mockClient.isReadonly.mockReturnValue(true);

    registerServiceInfoTool(mockServer, mockClient);

    // Get the registered implementation function
    const [, , implementation] = mockServer.registerTool.mock.calls[0];
    // Call the implementation
    const result = await implementation();
    const parsedResult = JSON.parse(result.content[0].text);

    expect(parsedResult.success).toBe(true);
    expect(parsedResult.payload).toEqual({
      name: 'mongodb-mcp',
      isConnected: false,
      readonly: true,
      version: expect.any(String),
      timezone: expect.any(String),
      disconnectReason: 'manual disconnect',
      connectionError: 'Network error',
    });
  });
});
