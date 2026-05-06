import type { Mocked, Mock } from 'vitest';
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { Db, Collection } from 'mongodb';
import type { MongoDBClient } from '../mongodb-client.js';
import { registerCreateIndexTool } from './create-index.js';
import { toolSuccess, toolError } from '../utils/tool-response.js';

const mockCollection: Mocked<Collection> = {
  createIndex: vi.fn(),
} as unknown as Mocked<Collection>;
const mockDb: Mocked<Db> = {
  collection: vi.fn().mockReturnValue(mockCollection),
} as unknown as Mocked<Db>;

describe('Create Index Tool', () => {
  let mockServer: Mocked<McpServer>;
  let mockClient: Mocked<MongoDBClient>;

  beforeEach(() => {
    vi.clearAllMocks();

    mockServer = {
      registerTool: vi.fn(),
    } as unknown as Mocked<McpServer>;

    mockClient = {
      isConnectedToMongoDB: vi.fn(),
      getDatabase: vi.fn().mockReturnValue(mockDb),
    } as unknown as Mocked<MongoDBClient>;
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

    const registerCall = mockServer.registerTool.mock.calls[0]!;
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
    (mockCollection.createIndex as Mock).mockResolvedValue('name_1');

    registerCreateIndexTool(mockServer, mockClient);

    const registerCall = mockServer.registerTool.mock.calls[0]!;
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
    (mockCollection.createIndex as Mock).mockResolvedValue('email_1');

    registerCreateIndexTool(mockServer, mockClient);

    const registerCall = mockServer.registerTool.mock.calls[0]!;
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
    (mockCollection.createIndex as Mock).mockRejectedValue(new Error('Duplicate key'));

    registerCreateIndexTool(mockServer, mockClient);

    const registerCall = mockServer.registerTool.mock.calls[0]!;
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
