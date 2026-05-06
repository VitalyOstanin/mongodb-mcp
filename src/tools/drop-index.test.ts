import type { Mocked, Mock } from 'vitest';
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { Db, Collection } from 'mongodb';
import type { MongoDBClient } from '../mongodb-client.js';
import { registerDropIndexTool } from './drop-index.js';
import { toolSuccess, toolError } from '../utils/tool-response.js';

const mockCollection: Mocked<Collection> = {
  dropIndex: vi.fn(),
} as unknown as Mocked<Collection>;
const mockDb: Mocked<Db> = {
  collection: vi.fn().mockReturnValue(mockCollection),
} as unknown as Mocked<Db>;

describe('Drop Index Tool', () => {
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

  it('should register the drop-index tool with write annotation', () => {
    registerDropIndexTool(mockServer, mockClient);

    expect(mockServer.registerTool).toHaveBeenCalledWith(
      'drop-index',
      expect.objectContaining({
        title: 'Drop Index',
        description: expect.stringContaining('Drop an index'),
        annotations: expect.objectContaining({
          readOnlyHint: false,
        }),
      }),
      expect.any(Function),
    );
  });

  it('should return an error if not connected to MongoDB', async () => {
    mockClient.isConnectedToMongoDB.mockReturnValue(false);

    registerDropIndexTool(mockServer, mockClient);

    const registerCall = mockServer.registerTool.mock.calls[0]!;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const handler = registerCall[2] as (params: any) => Promise<any>;
    const result = await handler({
      database: 'testdb',
      collection: 'testcollection',
      index: 'name_1',
    });

    expect(result.isError).toBe(true);
    expect(mockCollection.dropIndex).not.toHaveBeenCalled();
  });

  it('should drop an index by name', async () => {
    mockClient.isConnectedToMongoDB.mockReturnValue(true);
    (mockCollection.dropIndex as Mock).mockResolvedValue({ ok: 1, nIndexesWas: 2 });

    registerDropIndexTool(mockServer, mockClient);

    const registerCall = mockServer.registerTool.mock.calls[0]!;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const handler = registerCall[2] as (params: any) => Promise<any>;
    const result = await handler({
      database: 'testdb',
      collection: 'users',
      index: 'name_1',
    });

    expect(mockClient.getDatabase).toHaveBeenCalledWith('testdb');
    expect(mockDb.collection).toHaveBeenCalledWith('users');
    expect(mockCollection.dropIndex).toHaveBeenCalledWith('name_1');
    expect(result).toEqual(
      toolSuccess({
        database: 'testdb',
        collection: 'users',
        result: { ok: 1, nIndexesWas: 2 },
        index: 'name_1',
        message: 'Index dropped successfully',
      }),
    );
  });

  it('should drop an index by specification document', async () => {
    mockClient.isConnectedToMongoDB.mockReturnValue(true);
    (mockCollection.dropIndex as Mock).mockResolvedValue({ ok: 1, nIndexesWas: 3 });

    registerDropIndexTool(mockServer, mockClient);

    const registerCall = mockServer.registerTool.mock.calls[0]!;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const handler = registerCall[2] as (params: any) => Promise<any>;
    const result = await handler({
      database: 'testdb',
      collection: 'users',
      index: { email: 1 },
    });

    expect(mockCollection.dropIndex).toHaveBeenCalledWith({ email: 1 });
    expect(result).toEqual(
      toolSuccess({
        database: 'testdb',
        collection: 'users',
        result: { ok: 1, nIndexesWas: 3 },
        index: { email: 1 },
        message: 'Index dropped successfully',
      }),
    );
  });

  it('should return an error if drop fails', async () => {
    mockClient.isConnectedToMongoDB.mockReturnValue(true);
    (mockCollection.dropIndex as Mock).mockRejectedValue(new Error('IndexNotFound'));

    registerDropIndexTool(mockServer, mockClient);

    const registerCall = mockServer.registerTool.mock.calls[0]!;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const handler = registerCall[2] as (params: any) => Promise<any>;
    const result = await handler({
      database: 'testdb',
      collection: 'users',
      index: 'missing_idx',
    });

    expect(result).toEqual(toolError(new Error('IndexNotFound')));
  });
});
