import type { Mocked, Mock } from 'vitest';
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { Db } from 'mongodb';
import type { MongoDBClient } from '../mongodb-client.js';
import { registerDropCollectionTool } from './drop-collection.js';
import { toolSuccess, toolError } from '../utils/tool-response.js';

const mockDb: Mocked<Db> = {
  dropCollection: vi.fn(),
} as unknown as Mocked<Db>;

describe('Drop Collection Tool', () => {
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

  it('should register the drop-collection tool with write annotation', () => {
    registerDropCollectionTool(mockServer, mockClient);

    expect(mockServer.registerTool).toHaveBeenCalledWith(
      'drop-collection',
      expect.objectContaining({
        title: 'Drop Collection',
        description: expect.stringContaining('Drop a collection'),
        annotations: expect.objectContaining({
          readOnlyHint: false,
        }),
      }),
      expect.any(Function),
    );
  });

  it('should return an error if not connected to MongoDB', async () => {
    mockClient.isConnectedToMongoDB.mockReturnValue(false);

    registerDropCollectionTool(mockServer, mockClient);

    const registerCall = mockServer.registerTool.mock.calls[0];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const handler = registerCall[2] as (params: any) => Promise<any>;
    const result = await handler({
      database: 'testdb',
      collection: 'testcollection',
    });

    expect(result.isError).toBe(true);
    expect(mockDb.dropCollection).not.toHaveBeenCalled();
  });

  it('should drop a collection successfully', async () => {
    mockClient.isConnectedToMongoDB.mockReturnValue(true);
    (mockDb.dropCollection as Mock).mockResolvedValue(true);

    registerDropCollectionTool(mockServer, mockClient);

    const registerCall = mockServer.registerTool.mock.calls[0];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const handler = registerCall[2] as (params: any) => Promise<any>;
    const result = await handler({
      database: 'testdb',
      collection: 'old_logs',
    });

    expect(mockClient.getDatabase).toHaveBeenCalledWith('testdb');
    expect(mockDb.dropCollection).toHaveBeenCalledWith('old_logs');
    expect(result).toEqual(
      toolSuccess({
        database: 'testdb',
        collection: 'old_logs',
        result: true,
        message: 'Collection dropped successfully',
      }),
    );
  });

  it('should return an error if drop fails (non-existent collection)', async () => {
    mockClient.isConnectedToMongoDB.mockReturnValue(true);
    (mockDb.dropCollection as Mock).mockRejectedValue(new Error('NamespaceNotFound'));

    registerDropCollectionTool(mockServer, mockClient);

    const registerCall = mockServer.registerTool.mock.calls[0];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const handler = registerCall[2] as (params: any) => Promise<any>;
    const result = await handler({
      database: 'testdb',
      collection: 'missing',
    });

    expect(result).toEqual(toolError(new Error('NamespaceNotFound')));
  });
});
