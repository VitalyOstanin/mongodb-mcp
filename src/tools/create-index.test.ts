import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { Db, Collection } from 'mongodb';
import type { MongoDBClient } from '../mongodb-client.js';
import { registerCreateIndexTool } from './create-index.js';
import { toolSuccess, toolError } from '../utils/tool-response.js';

const mockCollection: jest.Mocked<Collection> = {
  createIndex: jest.fn(),
} as unknown as jest.Mocked<Collection>;
const mockDb: jest.Mocked<Db> = {
  collection: jest.fn().mockReturnValue(mockCollection),
} as unknown as jest.Mocked<Db>;

describe('Create Index Tool', () => {
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
    } as unknown as jest.Mocked<MongoDBClient>;
  });

  it('should register the create-index tool with write annotation', () => {
    registerCreateIndexTool(mockServer, mockClient);

    expect(mockServer.registerTool).toHaveBeenCalledWith(
      'create-index',
      expect.objectContaining({
        title: 'Create Index',
        description: expect.stringContaining('Create an index'),
        annotations: expect.objectContaining({
          readOnlyHint: false,
        }),
      }),
      expect.any(Function),
    );
  });

  it('should return an error if not connected to MongoDB', async () => {
    mockClient.isConnectedToMongoDB.mockReturnValue(false);

    registerCreateIndexTool(mockServer, mockClient);

    const registerCall = mockServer.registerTool.mock.calls[0];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const handler = registerCall[2] as (params: any) => Promise<any>;
    const result = await handler({
      database: 'testdb',
      collection: 'testcollection',
      keys: { name: 1 },
    });

    expect(result.isError).toBe(true);
    expect(mockCollection.createIndex).not.toHaveBeenCalled();
  });

  it('should create a single-field ascending index', async () => {
    mockClient.isConnectedToMongoDB.mockReturnValue(true);
    (mockCollection.createIndex as jest.Mock).mockResolvedValue('name_1');

    registerCreateIndexTool(mockServer, mockClient);

    const registerCall = mockServer.registerTool.mock.calls[0];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const handler = registerCall[2] as (params: any) => Promise<any>;
    const result = await handler({
      database: 'testdb',
      collection: 'users',
      keys: { name: 1 },
    });

    expect(mockClient.getDatabase).toHaveBeenCalledWith('testdb');
    expect(mockDb.collection).toHaveBeenCalledWith('users');
    expect(mockCollection.createIndex).toHaveBeenCalledWith({ name: 1 }, undefined);
    expect(result).toEqual(
      toolSuccess({
        database: 'testdb',
        collection: 'users',
        indexName: 'name_1',
        keys: { name: 1 },
        options: {},
        message: 'Index created successfully',
      }),
    );
  });

  it('should create an index with unique option', async () => {
    mockClient.isConnectedToMongoDB.mockReturnValue(true);
    (mockCollection.createIndex as jest.Mock).mockResolvedValue('email_1');

    registerCreateIndexTool(mockServer, mockClient);

    const registerCall = mockServer.registerTool.mock.calls[0];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const handler = registerCall[2] as (params: any) => Promise<any>;
    const options = { unique: true, sparse: true };
    const result = await handler({
      database: 'testdb',
      collection: 'users',
      keys: { email: 1 },
      options,
    });

    expect(mockCollection.createIndex).toHaveBeenCalledWith({ email: 1 }, options);
    expect(result).toEqual(
      toolSuccess({
        database: 'testdb',
        collection: 'users',
        indexName: 'email_1',
        keys: { email: 1 },
        options,
        message: 'Index created successfully',
      }),
    );
  });

  it('should return an error if index creation fails', async () => {
    mockClient.isConnectedToMongoDB.mockReturnValue(true);
    (mockCollection.createIndex as jest.Mock).mockRejectedValue(new Error('Duplicate key'));

    registerCreateIndexTool(mockServer, mockClient);

    const registerCall = mockServer.registerTool.mock.calls[0];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const handler = registerCall[2] as (params: any) => Promise<any>;
    const result = await handler({
      database: 'testdb',
      collection: 'users',
      keys: { email: 1 },
      options: { unique: true },
    });

    expect(result).toEqual(toolError(new Error('Duplicate key')));
  });
});
