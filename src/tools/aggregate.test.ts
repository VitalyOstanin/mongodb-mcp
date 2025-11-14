import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { Db, Collection } from 'mongodb';
import type { MongoDBClient } from '../mongodb-client.js';
import { registerAggregateTool } from './aggregate.js';
import { toolSuccess, toolError } from '../utils/tool-response.js';

// Mock the streaming functions to avoid actual file operations
jest.mock('../utils/mongodb-stream.js', () => ({
  streamMongoCursorToFile: jest.fn().mockResolvedValue(7), // Mock to return 7 documents processed
  streamMongoCursorToFileAsArray: jest.fn().mockResolvedValue(4), // Mock to return 4 documents processed
}));

// Mock objects for testing
const mockCollection: jest.Mocked<Collection> = {
  aggregate: jest.fn(),
} as unknown as jest.Mocked<Collection>;
const mockDb: jest.Mocked<Db> = {
  collection: jest.fn().mockReturnValue(mockCollection),
  aggregate: jest.fn(),
} as unknown as jest.Mocked<Db>;

describe('Aggregate Tool', () => {
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

  it('should register the aggregate tool correctly', () => {
    registerAggregateTool(mockServer, mockClient);

    expect(mockServer.registerTool).toHaveBeenCalledWith(
      'aggregate',
      expect.objectContaining({
        description: 'Run an aggregation against a MongoDB collection',
      }),
      expect.any(Function),
    );
  });

  it('should return an error if not connected to MongoDB', async () => {
    mockClient.isConnectedToMongoDB.mockReturnValue(false);

    registerAggregateTool(mockServer, mockClient);

    // Get the tool handler function
    const registerCall = mockServer.registerTool.mock.calls[0];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const handler = registerCall[2] as (params: any) => Promise<any>;
    const params = {
      database: 'testdb',
      collection: 'testcollection',
      pipeline: [{ $match: { status: 'active' } }],
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

  it('should execute aggregation pipeline successfully in non-read-only mode', async () => {
    mockClient.isConnectedToMongoDB.mockReturnValue(true);

    // Mock the aggregation cursor
    const mockCursor = {
      async *[Symbol.asyncIterator] () {
        yield { _id: 1, name: 'Test' };
        yield { _id: 2, name: 'Another Test' };
      },
      async toArray() {
        return [
          { _id: 1, name: 'Test' },
          { _id: 2, name: 'Another Test' },
        ];
      },
    };

    // Using 'any' because the mock cursor implementation has a complex type structure
    // that's difficult to type exactly, and the important part is that it implements the async iterator
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockCollection.aggregate.mockReturnValue(mockCursor as any);

    registerAggregateTool(mockServer, mockClient);

    // Get the tool handler function
    const registerCall = mockServer.registerTool.mock.calls[0];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const handler = registerCall[2] as (params: any) => Promise<any>;
    const params = {
      database: 'testdb',
      collection: 'testcollection',
      pipeline: [{ $match: { status: 'active' } }],
    };
    const result = await handler(params);

    expect(mockClient.getDatabase).toHaveBeenCalledWith('testdb');
    expect(mockDb.collection).toHaveBeenCalledWith('testcollection');
    expect(mockCollection.aggregate).toHaveBeenCalledWith([{ $match: { status: 'active' } }, { $limit: 1000 }]);

    expect(result).toEqual(
      toolSuccess({
        database: 'testdb',
        collection: 'testcollection',
        results: [
          { _id: 1, name: 'Test' },
          { _id: 2, name: 'Another Test' },
        ],
        count: 2,
        hasMoreResults: false,
      }),
    );
  });

  it('should execute aggregation pipeline successfully in read-only mode with safe operations', async () => {
    mockClient.isConnectedToMongoDB.mockReturnValue(true);
    mockClient.isReadonly.mockReturnValue(true);

    // Mock the aggregation cursor
    const mockCursor = {
      async *[Symbol.asyncIterator] () {
        yield { _id: 1, name: 'Test' };
        yield { _id: 2, name: 'Another Test' };
      },
      async toArray() {
        return [
          { _id: 1, name: 'Test' },
          { _id: 2, name: 'Another Test' },
        ];
      },
    };

    // Using 'any' because the mock cursor implementation has a complex type structure
    // that's difficult to type exactly, and the important part is that it implements the async iterator
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockCollection.aggregate.mockReturnValue(mockCursor as any);

    registerAggregateTool(mockServer, mockClient);

    // Get the tool handler function
    const registerCall = mockServer.registerTool.mock.calls[0];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const handler = registerCall[2] as (params: any) => Promise<any>;
    const params = {
      database: 'testdb',
      collection: 'testcollection',
      pipeline: [{ $match: { status: 'active' } }, { $project: { name: 1 } }], // Safe operations
    };
    const result = await handler(params);

    expect(mockCollection.aggregate).toHaveBeenCalledWith([{ $match: { status: 'active' } }, { $project: { name: 1 } }, { $limit: 1000 }]);

    expect(result).toEqual(
      toolSuccess({
        database: 'testdb',
        collection: 'testcollection',
        results: [
          { _id: 1, name: 'Test' },
          { _id: 2, name: 'Another Test' },
        ],
        count: 2,
        hasMoreResults: false,
      }),
    );
  });

  it('should block dangerous aggregation stages in read-only mode', async () => {
    mockClient.isConnectedToMongoDB.mockReturnValue(true);
    mockClient.isReadonly.mockReturnValue(true);

    registerAggregateTool(mockServer, mockClient);

    // Get the tool handler function
    const registerCall = mockServer.registerTool.mock.calls[0];
    // Using 'any' for params and return type because we're accessing the registered tool handler
    // from mock calls, and the exact type is complex to define since it comes from the tool registration system
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const handler = registerCall[2] as (params: any) => Promise<any>;
    const params = {
      database: 'testdb',
      collection: 'testcollection',
      pipeline: [{ $match: { status: 'active' } }, { $out: 'output_collection' }], // Dangerous operation
    };
    const result = await handler(params);

    expect(result).toEqual(
      toolError(new Error("Aggregation stage '$out' is not allowed in read-only mode")),
    );
  });

  it('should allow dangerous aggregation stages in non-read-only mode', async () => {
    mockClient.isConnectedToMongoDB.mockReturnValue(true);
    mockClient.isReadonly.mockReturnValue(false);

    // Mock the aggregation cursor for $out operation
    const mockCursor = {
      async *[Symbol.asyncIterator] () {
        yield { _id: 1, name: 'Test' };
      },
      async toArray() {
        return [
          { _id: 1, name: 'Test' },
        ];
      },
    };

    // Using 'any' because the mock cursor implementation has a complex type structure
    // that's difficult to type exactly, and the important part is that it implements the async iterator
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockCollection.aggregate.mockReturnValue(mockCursor as any);

    registerAggregateTool(mockServer, mockClient);

    // Get the tool handler function
    const registerCall = mockServer.registerTool.mock.calls[0];
    // Using 'any' for params and return type because we're accessing the registered tool handler
    // from mock calls, and the exact type is complex to define since it comes from the tool registration system
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const handler = registerCall[2] as (params: any) => Promise<any>;
    const params = {
      database: 'testdb',
      collection: 'testcollection',
      pipeline: [{ $match: { status: 'active' } }, { $out: 'output_collection' }], // Dangerous in read-only but allowed in normal mode
    };
    const result = await handler(params);

    expect(mockCollection.aggregate).toHaveBeenCalledWith([{ $match: { status: 'active' } }, { $out: 'output_collection' }, { $limit: 1000 }]);

    expect(result).toEqual(
      toolSuccess({
        database: 'testdb',
        collection: 'testcollection',
        results: [
          { _id: 1, name: 'Test' },
        ],
        count: 1,
        hasMoreResults: false,
      }),
    );
  });

  it('should return an error if aggregation fails', async () => {
    mockClient.isConnectedToMongoDB.mockReturnValue(true);
    mockCollection.aggregate.mockImplementation(() => {
      throw new Error('Aggregation failed');
    });

    registerAggregateTool(mockServer, mockClient);

    // Get the tool handler function
    const registerCall = mockServer.registerTool.mock.calls[0];
    // Using 'any' for params and return type because we're accessing the registered tool handler
    // from mock calls, and the exact type is complex to define since it comes from the tool registration system
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const handler = registerCall[2] as (params: any) => Promise<any>;
    const params = {
      database: 'testdb',
      collection: 'testcollection',
      pipeline: [{ $match: { status: 'active' } }],
    };
    const result = await handler(params);

    expect(result).toEqual(
      toolError(new Error('Aggregation failed')),
    );
  });

  it('should stream aggregation results to a file with document count for JSONL format', async () => {
    mockClient.isConnectedToMongoDB.mockReturnValue(true);

    const mockAggregateResult = {
      // Mock the async iterator for the aggregation cursor
      [Symbol.asyncIterator]: jest.fn().mockImplementation(function*() {
        yield { _id: 1, name: 'test1' };
        yield { _id: 2, name: 'test2' };
      }),
    };
    const mockCollection = {
      find: jest.fn(),
      aggregate: jest.fn().mockReturnValue(mockAggregateResult),
      countDocuments: jest.fn(),
    };

    // Using 'any' for mocking database object because the exact type is complex to define
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockClient.getDatabase.mockReturnValue({ collection: jest.fn().mockReturnValue(mockCollection) } as any);

    registerAggregateTool(mockServer, mockClient);

    // Get the tool handler function
    const registerCall = mockServer.registerTool.mock.calls[0];
    // Using 'any' for params and return type because we're accessing the registered tool handler
    // from mock calls, and the exact type is complex to define since it comes from the tool registration system
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const handler = registerCall[2] as (params: any) => Promise<any>;
    const params = {
      database: 'testdb',
      collection: 'testcollection',
      pipeline: [{ $match: { status: 'active' } }],
      saveToFile: true,
      format: 'jsonl',
    };
    const result = await handler(params);

    // Verify that the database and collection methods were called
    expect(mockClient.getDatabase).toHaveBeenCalledWith('testdb');
    expect(mockCollection.aggregate).toHaveBeenCalledWith([{ $match: { status: 'active' } }]);

    // Result should indicate successful file save
    expect(result.isError).toBeUndefined(); // Not an error

    const resultObj = JSON.parse(result.content[0].text);

    expect(resultObj.success).toBe(true);
    expect(resultObj.payload.savedToFile).toBe(true);
    expect(resultObj.payload.filePath).toBeDefined();
    expect(resultObj.payload.processedCount).toBe(7); // Should return the mock count of 7
    expect(resultObj.payload.format).toBe('jsonl');
    expect(resultObj.payload.message).toContain('7 documents were written to the file');
  });

  it('should stream aggregation results to a file with document count for JSON format', async () => {
    mockClient.isConnectedToMongoDB.mockReturnValue(true);

    const mockAggregateResult = {
      // Mock the async iterator for the aggregation cursor
      [Symbol.asyncIterator]: jest.fn().mockImplementation(function*() {
        yield { _id: 1, name: 'test1' };
        yield { _id: 2, name: 'test2' };
      }),
    };
    const mockCollection = {
      find: jest.fn(),
      aggregate: jest.fn().mockReturnValue(mockAggregateResult),
      countDocuments: jest.fn(),
    };

    // Using 'any' for mocking database object because the exact type is complex to define
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockClient.getDatabase.mockReturnValue({ collection: jest.fn().mockReturnValue(mockCollection) } as any);

    registerAggregateTool(mockServer, mockClient);

    // Get the tool handler function
    const registerCall = mockServer.registerTool.mock.calls[0];
    // Using 'any' for params and return type because we're accessing the registered tool handler
    // from mock calls, and the exact type is complex to define since it comes from the tool registration system
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const handler = registerCall[2] as (params: any) => Promise<any>;
    const params = {
      database: 'testdb',
      collection: 'testcollection',
      pipeline: [{ $match: { status: 'active' } }],
      saveToFile: true,
      format: 'json',
    };
    const result = await handler(params);

    // Verify that the database and collection methods were called
    expect(mockClient.getDatabase).toHaveBeenCalledWith('testdb');
    expect(mockCollection.aggregate).toHaveBeenCalledWith([{ $match: { status: 'active' } }]);

    // Result should indicate successful file save
    expect(result.isError).toBeUndefined(); // Not an error

    const resultObj = JSON.parse(result.content[0].text);

    expect(resultObj.success).toBe(true);
    expect(resultObj.payload.savedToFile).toBe(true);
    expect(resultObj.payload.filePath).toBeDefined();
    expect(resultObj.payload.processedCount).toBe(4); // Should return the mock count of 4
    expect(resultObj.payload.format).toBe('json');
    expect(resultObj.payload.message).toContain('4 documents were written to the file');
  });

  it('should limit results to 1000 documents', async () => {
    mockClient.isConnectedToMongoDB.mockReturnValue(true);

    // Mock a cursor that would yield more than 1000 documents
    const mockCursor = {
      async *[Symbol.asyncIterator] () {
        for (let i = 0; i < 1005; i++) {
          yield { _id: i, name: `Test${i}` };
        }
      },
      async toArray() {
        // With $limit: 1000, should only return first 1000 documents
        const results = [];

        for (let i = 0; i < 1000; i++) {
          results.push({ _id: i, name: `Test${i}` });
        }

        return results;
      },
    };

    // Using 'any' because the mock cursor implementation has a complex type structure
    // that's difficult to type exactly, and the important part is that it implements the async iterator
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockCollection.aggregate.mockReturnValue(mockCursor as any);

    registerAggregateTool(mockServer, mockClient);

    // Get the tool handler function
    const registerCall = mockServer.registerTool.mock.calls[0];
    // Using 'any' for params and return type because we're accessing the registered tool handler
    // from mock calls, and the exact type is complex to define since it comes from the tool registration system
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const handler = registerCall[2] as (params: any) => Promise<any>;
    const params = {
      database: 'testdb',
      collection: 'testcollection',
      pipeline: [{ $match: { status: 'active' } }],
    };
    const result = await handler(params);
    const resultObj = JSON.parse(result.content[0].text);

    expect(resultObj.success).toBe(true);
    expect(resultObj.payload.results).toHaveLength(1000);
    expect(resultObj.payload.hasMoreResults).toBe(true);
  });
});
