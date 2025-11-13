import { registerDisconnectTool } from './disconnect.js';

describe('disconnectTool', () => {
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
      disconnect: jest.fn(),
    };
  });

  it('should register the disconnect tool correctly', () => {
    registerDisconnectTool(mockServer, mockClient);

    expect(mockServer.registerTool).toHaveBeenCalledWith(
      'disconnect',
      expect.objectContaining({
        title: 'Disconnect from MongoDB',
        description: 'Disconnect from MongoDB and clear the connection. Use service_info to check connection status after disconnecting.',
      }),
      expect.any(Function),
    );
  });

  it('should disconnect successfully when connected', async () => {
    // Get the registered implementation function
    const mockRegisterTool = jest.fn();

    // Using 'any' for mock server object that mimics the McpServer interface for testing purposes
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    registerDisconnectTool({ registerTool: mockRegisterTool } as any, mockClient);

    // Get the implementation function from the registerTool call
    const [, , implementation] = mockRegisterTool.mock.calls[0];

    // Arrange
    mockClient.getConnectionInfo.mockReturnValue({ isConnected: true });

    // Act
    const result = await implementation({});
    const parsedResult = JSON.parse(result.content[0].text);

    // Assert
    expect(mockClient.disconnect).toHaveBeenCalledWith('normal disconnect');
    expect(parsedResult.success).toBe(true);
    expect(parsedResult.payload).toEqual({
      success: true,
      message: 'Disconnected from MongoDB successfully',
      isConnected: false,
      disconnectReason: 'normal disconnect',
    });
  });

  it('should return already disconnected message when not connected', async () => {
    // Get the registered implementation function
    const mockRegisterTool = jest.fn();

    // Using 'any' for mock server object that mimics the McpServer interface for testing purposes
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    registerDisconnectTool({ registerTool: mockRegisterTool } as any, mockClient);

    // Get the implementation function from the registerTool call
    const [, , implementation] = mockRegisterTool.mock.calls[0];

    // Arrange
    mockClient.getConnectionInfo.mockReturnValue({
      isConnected: false,
      disconnectReason: 'some reason',
    });

    // Act
    const result = await implementation({});
    const parsedResult = JSON.parse(result.content[0].text);

    // Assert
    expect(mockClient.disconnect).not.toHaveBeenCalled();
    expect(parsedResult.success).toBe(true);
    expect(parsedResult.payload).toEqual({
      success: true,
      message: 'Already disconnected from MongoDB',
      isConnected: false,
      disconnectReason: 'some reason',
    });
  });

  it('should handle disconnect with no previous disconnect reason', async () => {
    // Get the registered implementation function
    const mockRegisterTool = jest.fn();

    // Using 'any' for mock server object that mimics the McpServer interface for testing purposes
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    registerDisconnectTool({ registerTool: mockRegisterTool } as any, mockClient);

    // Get the implementation function from the registerTool call
    const [, , implementation] = mockRegisterTool.mock.calls[0];

    // Arrange
    mockClient.getConnectionInfo.mockReturnValue({
      isConnected: false,
      disconnectReason: undefined,
    });

    // Act
    const result = await implementation({});
    const parsedResult = JSON.parse(result.content[0].text);

    // Assert
    expect(mockClient.disconnect).not.toHaveBeenCalled();
    expect(parsedResult.success).toBe(true);
    expect(parsedResult.payload).toEqual({
      success: true,
      message: 'Already disconnected from MongoDB',
      isConnected: false,
      disconnectReason: 'not connected',
    });
  });
});
