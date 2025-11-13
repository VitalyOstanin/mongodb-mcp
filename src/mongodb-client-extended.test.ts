import { MongoDBClient } from './mongodb-client.js';

// Mock MongoDB objects for testing
const mockAggregateCursor = {
  explain: jest.fn(),
  [Symbol.asyncIterator]: jest.fn(),
};
const mockFindCursor = {
  explain: jest.fn(),
  project: jest.fn().mockReturnThis(),
  limit: jest.fn().mockReturnThis(),
  sort: jest.fn().mockReturnThis(),
};
const mockCollection = {
  aggregate: jest.fn().mockReturnValue(mockAggregateCursor),
  find: jest.fn().mockReturnValue(mockFindCursor),
  insertOne: jest.fn(),
  updateOne: jest.fn(),
};
const mockDb = {
  collection: jest.fn().mockReturnValue(mockCollection),
  aggregate: jest.fn().mockReturnValue(mockAggregateCursor),
  insertOne: jest.fn(),
  db: jest.fn(),
};
const mockMongoClient = {
  connect: jest.fn().mockResolvedValue(undefined),
  db: jest.fn().mockReturnValue(mockDb),
  close: jest.fn().mockResolvedValue(undefined),
  on: jest.fn().mockReturnThis(),
  topology: {
    isConnected: jest.fn().mockReturnValue(true),
  },
};

describe('MongoDBClient Extended', () => {
  let client: MongoDBClient;

  beforeEach(() => {
    jest.clearAllMocks();

    // Clear the singleton instance by accessing private property
    Object.defineProperty(MongoDBClient, 'instance', {
      value: undefined,
      writable: true,
    });

    client = MongoDBClient.getInstance();
  });

  describe('Disconnect functionality', () => {
    it('should disconnect successfully and set disconnect reason', async () => {
      // Setup mock client
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (client as any).client = mockMongoClient;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (client as any).isConnected = true;

      await client.disconnect('custom disconnect reason');

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect((client as any).isConnected).toBe(false);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect((client as any).client).toBe(null);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect((client as any).connectionString).toBe(null);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect((client as any).disconnectReason).toBe('custom disconnect reason');
      expect(mockMongoClient.close).toHaveBeenCalled();
    });

    it('should disconnect with default reason when no reason provided', async () => {
      // Setup mock client
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (client as any).client = mockMongoClient;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (client as any).isConnected = true;

      await client.disconnect();

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect((client as any).disconnectReason).toBe('normal disconnect');
    });

    it('should return correct connection info after disconnect', async () => {
      // Setup mock client
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (client as any).client = mockMongoClient;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (client as any).isConnected = true;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (client as any).disconnectReason = 'test reason';

      await client.disconnect();

      const info = client.getConnectionInfo();

      expect(info.isConnected).toBe(false);
      expect(info.disconnectReason).toBe('normal disconnect');
    });
  });

  describe('Connection info with disconnect reason', () => {
    it('should return connection info with disconnect reason when not connected', () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (client as any).isConnected = false;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (client as any).disconnectReason = 'manual disconnect';

      const info = client.getConnectionInfo();

      expect(info.isConnected).toBe(false);
      expect(info.disconnectReason).toBe('manual disconnect');
    });

    it('should return connection info without disconnect reason when connected', () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (client as any).isConnected = true;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (client as any).disconnectReason = 'manual disconnect';

      const info = client.getConnectionInfo();

      expect(info.isConnected).toBe(true);
      expect(info.disconnectReason).toBeUndefined();
    });

    it('should return connection info with error when there is a connection error', () => {
      const testError = new Error('Test connection error');

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (client as any).isConnected = false;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (client as any).connectionError = testError;

      const info = client.getConnectionInfo();

      expect(info.isConnected).toBe(false);
      expect(info.connectionError).toBe('Test connection error');
    });
  });

  describe('Connection error handling', () => {
    it('should clear connection error on intentional disconnect', async () => {
      // Set an error initially
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (client as any).connectionError = new Error('Some error');
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (client as any).isConnected = true;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (client as any).client = mockMongoClient;

      await client.disconnect();

      const info = client.getConnectionInfo();

      expect(info.connectionError).toBeUndefined();
    });

    it('should preserve disconnect reason after disconnect', async () => {
      // Set client as connected with a disconnect reason
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (client as any).isConnected = true;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (client as any).client = mockMongoClient;

      await client.disconnect('manual disconnect');

      const info = client.getConnectionInfo();

      expect(info.isConnected).toBe(false);
      expect(info.disconnectReason).toBe('manual disconnect');
    });
  });

  describe('Connection status and error propagation', () => {
    it('should throw error when getting database while not connected and set error', () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (client as any).isConnected = false;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (client as any).client = null;

      expect(() => client.getDatabase('test')).toThrow('Not connected to MongoDB. Please connect first.');

      const info = client.getConnectionInfo();

      expect(info.connectionError).toBe('Not connected to MongoDB. Please connect first.');
    });

    it('should update connection state when manually set to disconnected', () => {
      // Setup mock client
      const mockClientWithTopology = {
        ...mockMongoClient,
        topology: { isConnected: jest.fn().mockReturnValue(true) },
      };

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (client as any).isConnected = true;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (client as any).client = mockClientWithTopology;

      // Call getDatabase which should work fine when connected
      expect(() => client.getDatabase('test')).not.toThrow();

      const info = client.getConnectionInfo();

      expect(info.isConnected).toBe(true);
    });
  });

  describe('Connection info with disconnect reason', () => {
    it('should return connection info with disconnect reason when not connected', () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (client as any).isConnected = false;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (client as any).disconnectReason = 'manual disconnect';

      const info = client.getConnectionInfo();

      expect(info.isConnected).toBe(false);
      expect(info.disconnectReason).toBe('manual disconnect');
    });

    it('should return connection info without disconnect reason when connected', () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (client as any).isConnected = true;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (client as any).disconnectReason = 'manual disconnect';

      const info = client.getConnectionInfo();

      expect(info.isConnected).toBe(true);
      expect(info.disconnectReason).toBeUndefined();
    });

    it('should return connection info with error when there is a connection error', () => {
      const testError = new Error('Test connection error');

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (client as any).isConnected = false;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (client as any).connectionError = testError;

      const info = client.getConnectionInfo();

      expect(info.isConnected).toBe(false);
      expect(info.connectionError).toBe('Test connection error');
    });
  });
});
