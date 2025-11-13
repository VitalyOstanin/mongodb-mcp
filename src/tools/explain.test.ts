import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { Db, Collection, FindCursor } from 'mongodb';
import type { MongoDBClient } from '../mongodb-client.js';
import { registerExplainTool } from './explain.js';
import { toolSuccess, toolError } from '../utils/tool-response.js';

// Mock objects for testing
const mockFindCursor: jest.Mocked<FindCursor> = {
  project: jest.fn().mockReturnThis(),
  limit: jest.fn().mockReturnThis(),
  sort: jest.fn().mockReturnThis(),
  explain: jest.fn(),
} as unknown as jest.Mocked<FindCursor>;
// Using 'any' because the mock aggregate cursor has a complex type structure that's difficult to type exactly
// for testing purposes, and the important part is that it implements the explain method
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockAggregateCursor: any = {
  explain: jest.fn(),
};
const mockCollection: jest.Mocked<Collection> = {
  find: jest.fn().mockReturnValue(mockFindCursor),
  aggregate: jest.fn().mockReturnValue(mockAggregateCursor),
} as unknown as jest.Mocked<Collection>;
const mockDb: jest.Mocked<Db> = {
  collection: jest.fn().mockReturnValue(mockCollection),
} as unknown as jest.Mocked<Db>;

describe('Explain Tool', () => {
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
      isReadonly: jest.fn().mockReturnValue(false), // Default to non-read-only mode
    } as unknown as jest.Mocked<MongoDBClient>;
  });

  it('should register the explain tool correctly', () => {
    registerExplainTool(mockServer, mockClient);

    expect(mockServer.registerTool).toHaveBeenCalledWith(
      'explain',
      expect.objectContaining({
        description: 'Returns statistics describing the execution of the winning plan chosen by the query optimizer for the evaluated method',
      }),
      expect.any(Function),
    );
  });

  it('should return an error if not connected to MongoDB', async () => {
    mockClient.isConnectedToMongoDB.mockReturnValue(false);

    registerExplainTool(mockServer, mockClient);

    // Get the tool handler function
    const registerCall = mockServer.registerTool.mock.calls[0];
    // Using 'any' for params and return type because we're accessing the registered tool handler
    // from mock calls, and the exact type is complex to define since it comes from the tool registration system
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const handler = registerCall[2] as (params: any) => Promise<any>;
    const params = {
      database: 'testdb',
      collection: 'testcollection',
      method: {
        name: 'find',
        arguments: { filter: { status: 'active' } },
      },
    };
    const result = await handler(params);

    expect(result.isError).toBe(true);
    expect(result.content).toEqual([
      {
        type: "text",
        text: JSON.stringify({
          name: "Error",
          message: "Not connected to MongoDB. Please connect first.",
        }),
      },
    ]);
  });

  it('should explain a find operation successfully in non-read-only mode', async () => {
    mockClient.isConnectedToMongoDB.mockReturnValue(true);

    const mockExplainResult = { queryPlanner: { plannerVersion: 1, namespace: 'testdb.testcollection' } };

    mockFindCursor.explain.mockResolvedValue(mockExplainResult);

    registerExplainTool(mockServer, mockClient);

    // Get the tool handler function
    const registerCall = mockServer.registerTool.mock.calls[0];
    // Using 'any' for params and return type because we're accessing the registered tool handler
    // from mock calls, and the exact type is complex to define since it comes from the tool registration system
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const handler = registerCall[2] as (params: any) => Promise<any>;
    const params = {
      database: 'testdb',
      collection: 'testcollection',
      method: {
        name: 'find',
        arguments: {
          filter: { status: 'active' },
          projection: { name: 1 },
          limit: 10,
          sort: { createdAt: -1 },
        },
      },
      verbosity: 'queryPlanner',
    };
    const result = await handler(params);

    expect(mockClient.getDatabase).toHaveBeenCalledWith('testdb');
    expect(mockDb.collection).toHaveBeenCalledWith('testcollection');
    expect(mockCollection.find).toHaveBeenCalledWith({ status: 'active' });
    expect(mockFindCursor.project).toHaveBeenCalledWith({ name: 1 });
    expect(mockFindCursor.limit).toHaveBeenCalledWith(10);
    expect(mockFindCursor.sort).toHaveBeenCalledWith({ createdAt: -1 });
    expect(mockFindCursor.explain).toHaveBeenCalledWith('queryPlanner');

    expect(result).toEqual(
      toolSuccess({
        database: 'testdb',
        collection: 'testcollection',
        method: 'find',
        explainResult: mockExplainResult,
      }),
    );
  });

  it('should explain a find operation in read-only mode with safe operations', async () => {
    mockClient.isConnectedToMongoDB.mockReturnValue(true);
    mockClient.isReadonly.mockReturnValue(true);

    const mockExplainResult = { queryPlanner: { plannerVersion: 1, namespace: 'testdb.testcollection' } };

    mockFindCursor.explain.mockResolvedValue(mockExplainResult);

    registerExplainTool(mockServer, mockClient);

    // Get the tool handler function
    const registerCall = mockServer.registerTool.mock.calls[0];
    // Using 'any' for params and return type because we're accessing the registered tool handler
    // from mock calls, and the exact type is complex to define since it comes from the tool registration system
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const handler = registerCall[2] as (params: any) => Promise<any>;
    const params = {
      database: 'testdb',
      collection: 'testcollection',
      method: {
        name: 'find',
        arguments: { filter: { status: 'active' } },
      },
    };
    const result = await handler(params);

    expect(mockFindCursor.explain).toHaveBeenCalledWith('queryPlanner');

    expect(result).toEqual(
      toolSuccess({
        database: 'testdb',
        collection: 'testcollection',
        method: 'find',
        explainResult: mockExplainResult,
      }),
    );
  });

  it('should explain a count operation', async () => {
    mockClient.isConnectedToMongoDB.mockReturnValue(true);

    const mockExplainResult = { queryPlanner: { plannerVersion: 1, namespace: 'testdb.testcollection' } };

    mockFindCursor.explain.mockResolvedValue(mockExplainResult);

    registerExplainTool(mockServer, mockClient);

    // Get the tool handler function
    const registerCall = mockServer.registerTool.mock.calls[0];
    // Using 'any' for params and return type because we're accessing the registered tool handler
    // from mock calls, and the exact type is complex to define since it comes from the tool registration system
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const handler = registerCall[2] as (params: any) => Promise<any>;
    const params = {
      database: 'testdb',
      collection: 'testcollection',
      method: {
        name: 'count',
        arguments: { query: { status: 'active' } },
      },
    };
    const result = await handler(params);

    expect(mockCollection.find).toHaveBeenCalledWith({ status: 'active' });
    expect(mockFindCursor.explain).toHaveBeenCalledWith('queryPlanner');

    expect(result).toEqual(
      toolSuccess({
        database: 'testdb',
        collection: 'testcollection',
        method: 'count',
        explainResult: mockExplainResult,
      }),
    );
  });

  it('should explain an aggregate operation', async () => {
    mockClient.isConnectedToMongoDB.mockReturnValue(true);

    const mockExplainResult = { queryPlanner: { plannerVersion: 1, namespace: 'testdb.testcollection' } };

    mockAggregateCursor.explain.mockResolvedValue(mockExplainResult);

    registerExplainTool(mockServer, mockClient);

    // Get the tool handler function
    const registerCall = mockServer.registerTool.mock.calls[0];
    // Using 'any' for params and return type because we're accessing the registered tool handler
    // from mock calls, and the exact type is complex to define since it comes from the tool registration system
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const handler = registerCall[2] as (params: any) => Promise<any>;
    const params = {
      database: 'testdb',
      collection: 'testcollection',
      method: {
        name: 'aggregate',
        arguments: { pipeline: [{ $match: { status: 'active' } }] },
      },
    };
    const result = await handler(params);

    expect(mockCollection.aggregate).toHaveBeenCalledWith([{ $match: { status: 'active' } }]);
    expect(mockAggregateCursor.explain).toHaveBeenCalledWith('queryPlanner');

    expect(result).toEqual(
      toolSuccess({
        database: 'testdb',
        collection: 'testcollection',
        method: 'aggregate',
        explainResult: mockExplainResult,
      }),
    );
  });

  it('should return an error if explaining an unsupported method', async () => {
    mockClient.isConnectedToMongoDB.mockReturnValue(true);

    registerExplainTool(mockServer, mockClient);

    // Get the tool handler function
    const registerCall = mockServer.registerTool.mock.calls[0];
    // Using 'any' for params and return type because we're accessing the registered tool handler
    // from mock calls, and the exact type is complex to define since it comes from the tool registration system
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const handler = registerCall[2] as (params: any) => Promise<any>;
    const params = {
      database: 'testdb',
      collection: 'testcollection',
      method: {
        // Using 'any' to test the unsupported method scenario where we're deliberately passing an invalid method
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        name: 'unsupported' as any,
        arguments: { filter: { status: 'active' } },
      },
    };
    const result = await handler(params);

    expect(result).toEqual(
      toolError(new Error('Unsupported method for explain: unsupported')),
    );
  });

  it('should return an error if explaining fails', async () => {
    mockClient.isConnectedToMongoDB.mockReturnValue(true);
    mockFindCursor.explain.mockRejectedValue(new Error('Explain failed'));

    registerExplainTool(mockServer, mockClient);

    // Get the tool handler function
    const registerCall = mockServer.registerTool.mock.calls[0];
    // Using 'any' for params and return type because we're accessing the registered tool handler
    // from mock calls, and the exact type is complex to define since it comes from the tool registration system
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const handler = registerCall[2] as (params: any) => Promise<any>;
    const params = {
      database: 'testdb',
      collection: 'testcollection',
      method: {
        name: 'find',
        arguments: { filter: { status: 'active' } },
      },
    };
    const result = await handler(params);

    expect(result).toEqual(
      toolError(new Error('Explain failed')),
    );
  });
});
