import type { Mocked, Mock } from 'vitest';
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { Db } from 'mongodb';
import type { MongoDBClient } from '../mongodb-client.js';
import { registerCreateCollectionTool } from './create-collection.js';
import { toolSuccess, toolError } from '../utils/tool-response.js';

const mockDb: Mocked<Db> = {
  createCollection: vi.fn(),
} as unknown as Mocked<Db>;

describe('Create Collection Tool', () => {
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

  it('should register the create-collection tool with write annotation', () => {
    registerCreateCollectionTool(mockServer, mockClient);

    expect(mockServer.registerTool).toHaveBeenCalledWith(
      'create-collection',
      expect.objectContaining({
        title: 'Create Collection',
        description: expect.stringContaining('Create a new collection'),
        annotations: expect.objectContaining({
          readOnlyHint: false,
        }),
      }),
      expect.any(Function),
    );
  });

  it('should return an error if not connected to MongoDB', async () => {
    mockClient.isConnectedToMongoDB.mockReturnValue(false);

    registerCreateCollectionTool(mockServer, mockClient);

    const registerCall = mockServer.registerTool.mock.calls[0]!;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const handler = registerCall[2] as (params: any) => Promise<any>;
    const result = await handler({
      database: 'testdb',
      collection: 'testcollection',
    });

    expect(result.isError).toBe(true);
    expect(mockClient.getDatabase).not.toHaveBeenCalled();
  });

  it('should create a collection without options', async () => {
    mockClient.isConnectedToMongoDB.mockReturnValue(true);
    (mockDb.createCollection as Mock).mockResolvedValue({ collectionName: 'testcollection' });

    registerCreateCollectionTool(mockServer, mockClient);

    const registerCall = mockServer.registerTool.mock.calls[0]!;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const handler = registerCall[2] as (params: any) => Promise<any>;
    const result = await handler({
      database: 'testdb',
      collection: 'testcollection',
    });

    expect(mockClient.getDatabase).toHaveBeenCalledWith('testdb');
    expect(mockDb.createCollection).toHaveBeenCalledWith('testcollection', undefined);
    expect(result).toEqual(
      toolSuccess({
        database: 'testdb',
        collection: 'testcollection',
        options: {},
        message: 'Collection created successfully',
      }),
    );
  });

  it('should create a collection with options (capped)', async () => {
    mockClient.isConnectedToMongoDB.mockReturnValue(true);
    (mockDb.createCollection as Mock).mockResolvedValue({ collectionName: 'logs' });

    registerCreateCollectionTool(mockServer, mockClient);

    const registerCall = mockServer.registerTool.mock.calls[0]!;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const handler = registerCall[2] as (params: any) => Promise<any>;
    const options = { capped: true, size: 1024 };
    const result = await handler({
      database: 'testdb',
      collection: 'logs',
      options,
    });

    expect(mockDb.createCollection).toHaveBeenCalledWith('logs', options);
    expect(result).toEqual(
      toolSuccess({
        database: 'testdb',
        collection: 'logs',
        options,
        message: 'Collection created successfully',
      }),
    );
  });

  it('should return an error if creation fails', async () => {
    mockClient.isConnectedToMongoDB.mockReturnValue(true);
    (mockDb.createCollection as Mock).mockRejectedValue(new Error('NamespaceExists'));

    registerCreateCollectionTool(mockServer, mockClient);

    const registerCall = mockServer.registerTool.mock.calls[0]!;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const handler = registerCall[2] as (params: any) => Promise<any>;
    const result = await handler({
      database: 'testdb',
      collection: 'existing',
    });

    expect(result).toEqual(toolError(new Error('NamespaceExists')));
  });
});
