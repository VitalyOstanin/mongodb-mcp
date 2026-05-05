import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { Db, Collection } from 'mongodb';
import type { MongoDBClient } from '../mongodb-client.js';
import { registerDeleteTool } from './delete.js';
import { toolSuccess, toolError } from '../utils/tool-response.js';

const mockCollection: jest.Mocked<Collection> = {
  deleteOne: jest.fn(),
  deleteMany: jest.fn(),
} as unknown as jest.Mocked<Collection>;
const mockDb: jest.Mocked<Db> = {
  collection: jest.fn().mockReturnValue(mockCollection),
} as unknown as jest.Mocked<Db>;

describe('Delete Tool', () => {
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

    const registerCall = mockServer.registerTool.mock.calls[0];
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
    (mockCollection.deleteOne as jest.Mock).mockResolvedValue({ acknowledged: true, deletedCount: 1 });

    registerDeleteTool(mockServer, mockClient);

    const registerCall = mockServer.registerTool.mock.calls[0];
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
    (mockCollection.deleteMany as jest.Mock).mockResolvedValue({ acknowledged: true, deletedCount: 5 });

    registerDeleteTool(mockServer, mockClient);

    const registerCall = mockServer.registerTool.mock.calls[0];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const handler = registerCall[2] as (params: any) => Promise<any>;
    const filter = { archived: true };
    const result = await handler({
      database: 'testdb',
      collection: 'users',
      filter,
      multi: true,
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
    (mockCollection.deleteOne as jest.Mock).mockRejectedValue(new Error('WriteConcernError'));

    registerDeleteTool(mockServer, mockClient);

    const registerCall = mockServer.registerTool.mock.calls[0];
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
