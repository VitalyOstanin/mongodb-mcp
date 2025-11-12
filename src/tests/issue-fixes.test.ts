import { loadConfig } from '../config';
import { MongoDBClient } from '../mongodb-client';
import { serviceInfoTool } from '../tools/service-info';

// Mock the environment variables
const originalEnv = process.env;

describe('Issue Fixes Tests', () => {
  beforeEach(() => {
    // Clean environment before each test
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    // Restore original environment after each test
    process.env = originalEnv;
  });

  describe('MONGODB_CONNECTION_STRING optional validation', () => {
    it('should allow loading config without MONGODB_CONNECTION_STRING', () => {
      // Remove the connection string from environment
      delete process.env.MONGODB_CONNECTION_STRING;

      // This should not throw an error anymore
      expect(() => {
        loadConfig();
      }).not.toThrow();

      const config = loadConfig();

      expect(config.connectionString).toBeUndefined();
    });

    it('should still accept MONGODB_CONNECTION_STRING when provided', () => {
      process.env.MONGODB_CONNECTION_STRING = 'mongodb://localhost:27017';

      const config = loadConfig();

      expect(config.connectionString).toBe('mongodb://localhost:27017');
    });
  });

  describe('service_info tool response', () => {
    // We need to mock MongoDBClient to test the service info response
    // without actually connecting to MongoDB
    let originalGetInstance: () => MongoDBClient;
    let mockGetInstance: jest.Mock;

    beforeEach(() => {
      // Store original getInstance method
      originalGetInstance = MongoDBClient.getInstance;
      mockGetInstance = jest.fn();
      MongoDBClient.getInstance = mockGetInstance;
    });

    afterEach(() => {
      // Restore original getInstance method
      MongoDBClient.getInstance = originalGetInstance;
    });

    it('should return correct hasConnectionString based on client connection info, not env var', async () => {
      // Create a mock client with specific connection info
      const mockClient = {
        getConnectionInfo: () => ({
          isConnected: true,
          hasConnectionString: true, // This client has a connection string from connect() call
        }),
        isReadonly: () => false,
      } as unknown as MongoDBClient;

      // Mock the getInstance to return our mock client
      mockGetInstance.mockReturnValue(mockClient);

      const result = await serviceInfoTool.implementation({});
      const responseText = result.content[0].text;
      const response = JSON.parse(responseText);

      // The response should indicate that there is a connection string
      // based on the client's connection info, not environment variable
      expect(response.payload.hasConnectionString).toBe(true);
      expect(response.payload.isConnected).toBe(true);
    });

    it('should return hasConnectionString false when client has no connection string', async () => {
      // Create a mock client with no connection
      const mockClient = {
        getConnectionInfo: () => ({
          isConnected: false,
          hasConnectionString: false,
        }),
        isReadonly: () => false,
      } as unknown as MongoDBClient;

      // Mock the getInstance to return our mock client
      mockGetInstance.mockReturnValue(mockClient);

      const result = await serviceInfoTool.implementation({});
      const responseText = result.content[0].text;
      const response = JSON.parse(responseText);

      expect(response.payload.hasConnectionString).toBe(false);
      expect(response.payload.isConnected).toBe(false);
    });

    it('should return correct readonly status from client', async () => {
      // Create a mock client with readonly = true
      const mockClient1 = {
        getConnectionInfo: () => ({
          isConnected: true,
          hasConnectionString: true,
        }),
        isReadonly: () => true,
      } as unknown as MongoDBClient;

      mockGetInstance.mockReturnValue(mockClient1);

      let result = await serviceInfoTool.implementation({});
      let responseText = result.content[0].text;
      let response = JSON.parse(responseText);

      expect(response.payload.readonly).toBe(true);

      // Create a mock client with readonly = false
      const mockClient2 = {
        getConnectionInfo: () => ({
          isConnected: true,
          hasConnectionString: true,
        }),
        isReadonly: () => false,
      } as unknown as MongoDBClient;

      mockGetInstance.mockReturnValue(mockClient2);

      result = await serviceInfoTool.implementation({});
      responseText = result.content[0].text;
      response = JSON.parse(responseText);
      expect(response.payload.readonly).toBe(false);
    });
  });

  describe('Tool descriptions and examples', () => {
    it('should have description for service_info tool', () => {
      expect(serviceInfoTool.description).toBeDefined();
      expect(typeof serviceInfoTool.description).toBe('string');
      expect(serviceInfoTool.description.length).toBeGreaterThan(0);
    });

    it('should have examples for service_info tool', () => {
      expect(serviceInfoTool.examples).toBeDefined();
      if (serviceInfoTool.examples) {
        expect(Array.isArray(serviceInfoTool.examples)).toBe(true);
        expect(serviceInfoTool.examples.length).toBeGreaterThan(0);

        // Check that examples have required structure
        const example = serviceInfoTool.examples[0];

        expect(example.input).toBeDefined();
        expect(example.output).toBeDefined();
        expect(example.description).toBeDefined();
      }
    });
  });
});
