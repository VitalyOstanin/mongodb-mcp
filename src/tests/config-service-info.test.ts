import { loadConfig } from '../config';
import type { MongoDBClient } from '../mongodb-client';
import { registerServiceInfoTool } from '../tools/service-info';
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

// Mock the environment variables
const originalEnv = process.env;

describe('Config and Service Info Tests', () => {
  beforeEach(() => {
    // Clean environment before each test
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    // Restore original environment after each test
    process.env = originalEnv;
  });

  describe('MONGODB_MCP_CONNECTION_STRING validation', () => {
    it('should allow loading config without MONGODB_MCP_CONNECTION_STRING', () => {
      // Remove the connection string from environment
      delete process.env.MONGODB_MCP_CONNECTION_STRING;

      // This should not throw an error anymore
      expect(() => {
        loadConfig();
      }).toThrow(); // Since the connection string is now mandatory, this should throw an error

      expect(() => {
        loadConfig();
      }).toThrow('MongoDB configuration error: missing environment variables: MONGODB_MCP_CONNECTION_STRING');
    });

    it('should accept MONGODB_MCP_CONNECTION_STRING when provided', () => {
      process.env.MONGODB_MCP_CONNECTION_STRING = 'mongodb://localhost:27017';

      const config = loadConfig();

      expect(config.connectionString).toBe('mongodb://localhost:27017');
    });
  });

  describe('service_info tool response', () => {
    let mockServer: jest.Mocked<McpServer>;
    let mockClient: jest.Mocked<MongoDBClient>;

    beforeEach(() => {
      mockServer = {
        registerTool: jest.fn(),
      } as unknown as jest.Mocked<McpServer>;

      mockClient = {
        getConnectionInfo: jest.fn(),
        isReadonly: jest.fn(),
      } as unknown as jest.Mocked<MongoDBClient>;
    });

    it('should return correct connection status', async () => {
      mockClient.getConnectionInfo.mockReturnValue({
        isConnected: true,
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
      const response = JSON.parse(result.content[0].text);

      expect(response.payload.isConnected).toBe(true);
    });

    it('should return correct connection status when client is not connected', async () => {
      mockClient.getConnectionInfo.mockReturnValue({
        isConnected: false,
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
      const response = JSON.parse(result.content[0].text);

      expect(response.payload.isConnected).toBe(false);
    });

    it('should return correct readonly status from client', async () => {
      // Test with readonly = true
      mockClient.getConnectionInfo.mockReturnValue({
        isConnected: true,
      });
      mockClient.isReadonly.mockReturnValue(true);

      registerServiceInfoTool(mockServer, mockClient);

      // Get the tool handler function
      const registerCall = mockServer.registerTool.mock.calls[0];
      // Using 'any' for params and return type because we're accessing the registered tool handler
      // from mock calls, and the exact type is complex to define since it comes from the tool registration system
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const handler1 = registerCall[2] as (params: any) => Promise<any>;
      const params = {};
      const result1 = await handler1(params);
      const response1 = JSON.parse(result1.content[0].text);

      expect(response1.payload.readonly).toBe(true);

      // Test with readonly = false
      mockClient.isReadonly.mockReturnValue(false);

      const result2 = await handler1(params);
      const response2 = JSON.parse(result2.content[0].text);

      expect(response2.payload.readonly).toBe(false);
    });
  });
});
