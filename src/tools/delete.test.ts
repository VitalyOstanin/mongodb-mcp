import type { Mocked, Mock } from 'vitest';
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { Db, Collection } from 'mongodb';
import type { MongoDBClient } from '../mongodb-client.js';
import { registerDeleteTool } from './delete.js';
import { toolSuccess, toolError } from '../utils/tool-response.js';

const mockCollection: Mocked<Collection> = {
  deleteOne: vi.fn(),
  deleteMany: vi.fn(),
} as unknown as Mocked<Collection>;
const mockDb: Mocked<Db> = {
  collection: vi.fn().mockReturnValue(mockCollection),
} as unknown as Mocked<Db>;

describe('Delete Tool', () => {
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

  it('should register the delete tool with write annotation', () => {
    registerDeleteTool(mockServer, mockClient);

    expect(mockServer.registerTool).toHaveBeenCalledWith(
      'delete',
      expect.objectContaining({
        title: 'Delete Documents',
        description: expect.stringContaining('Delete one or multiple documents'),
        annotations: expect.objectContaining({
          readOnlyHint: false,
        }),
      }),
      expect.any(Function),
    );
  });

  it('should return an error if not connected to MongoDB', async () => {
    mockClient.isConnectedToMongoDB.mockReturnValue(false);

    registerDeleteTool(mockServer, mockClient);

    const registerCall = mockServer.registerTool.mock.calls[0]!;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const handler = registerCall[2] as (params: any) => Promise<any>;
    const result = await handler({
      database: 'testdb',
      collection: 'testcollection',
      filter: { _id: 'x' },
    });

    expect(result.isError).toBe(true);
    expect(mockCollection.deleteOne).not.toHaveBeenCalled();
    expect(mockCollection.deleteMany).not.toHaveBeenCalled();
  });

  it('should call deleteOne by default', async () => {
    mockClient.isConnectedToMongoDB.mockReturnValue(true);
    (mockCollection.deleteOne as Mock).mockResolvedValue({ acknowledged: true, deletedCount: 1 });

    registerDeleteTool(mockServer, mockClient);

    const registerCall = mockServer.registerTool.mock.calls[0]!;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const handler = registerCall[2] as (params: any) => Promise<any>;
    const filter = { name: 'foo' };
    const result = await handler({
      database: 'testdb',
      collection: 'users',
      filter,
    });

    expect(mockClient.getDatabase).toHaveBeenCalledWith('testdb');
    expect(mockDb.collection).toHaveBeenCalledWith('users');
    expect(mockCollection.deleteOne).toHaveBeenCalledWith(filter);
    expect(mockCollection.deleteMany).not.toHaveBeenCalled();
    expect(result).toEqual(
      toolSuccess({
        database: 'testdb',
        collection: 'users',
        deletedCount: 1,
        operation: 'deleteOne',
      }),
    );
  });

  it('should call deleteMany when multi=true', async () => {
    mockClient.isConnectedToMongoDB.mockReturnValue(true);
    (mockCollection.deleteMany as Mock).mockResolvedValue({ acknowledged: true, deletedCount: 5 });

    registerDeleteTool(mockServer, mockClient);

    const registerCall = mockServer.registerTool.mock.calls[0]!;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const handler = registerCall[2] as (params: any) => Promise<any>;
    const filter = { archived: true };
    const result = await handler({
      database: 'testdb',
      collection: 'users',
      filter,
      multi: true,
      confirmation: 'I_KNOW_THIS_IS_DESTRUCTIVE',
    });

    expect(mockCollection.deleteMany).toHaveBeenCalledWith(filter);
    expect(mockCollection.deleteOne).not.toHaveBeenCalled();
    expect(result).toEqual(
      toolSuccess({
        database: 'testdb',
        collection: 'users',
        deletedCount: 5,
        operation: 'deleteMany',
      }),
    );
  });

  it('should return an error if delete fails', async () => {
    mockClient.isConnectedToMongoDB.mockReturnValue(true);
    (mockCollection.deleteOne as Mock).mockRejectedValue(new Error('WriteConcernError'));

    registerDeleteTool(mockServer, mockClient);

    const registerCall = mockServer.registerTool.mock.calls[0]!;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const handler = registerCall[2] as (params: any) => Promise<any>;
    const result = await handler({
      database: 'testdb',
      collection: 'users',
      filter: { _id: 'x' },
    });

    expect(result).toEqual(toolError(new Error('WriteConcernError')));
  });
});
