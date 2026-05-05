import type { Mocked } from 'vitest';
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { Db, Collection, FindCursor } from 'mongodb';
import type { MongoDBClient } from '../mongodb-client.js';
import { registerFindTool } from './find.js';
import { toolSuccess, toolError } from '../utils/tool-response.js';

// Mock the streaming functions to avoid actual file operations
vi.mock('../utils/mongodb-stream.js', () => ({
  streamMongoCursorToFile: vi.fn().mockResolvedValue(5), // Mock to return 5 documents processed
  streamMongoCursorToFileAsArray: vi.fn().mockResolvedValue(3), // Mock to return 3 documents processed
}));

// Define base mock objects that can be reset for each test
const createBaseMocks = () => {
  const mockFindCursor: Mocked<FindCursor> = {
    limit: vi.fn().mockReturnThis(),
    project: vi.fn().mockReturnThis(),
    sort: vi.fn().mockReturnThis(),
    toArray: vi.fn(),
  } as unknown as Mocked<FindCursor>;
  const mockCollection: Mocked<Collection> = {
    find: vi.fn().mockReturnValue(mockFindCursor),
  } as unknown as Mocked<Collection>;
  const mockDb: Mocked<Db> = {
    collection: vi.fn().mockReturnValue(mockCollection),
  } as unknown as Mocked<Db>;

  return { mockFindCursor, mockCollection, mockDb };
};

describe('Find Tool', () => {
  let mockServer: Mocked<McpServer>;
  let mockClient: Mocked<MongoDBClient>;
  let mockFindCursor: Mocked<FindCursor>;
  let mockCollection: Mocked<Collection>;
  let mockDb: Mocked<Db>;

  beforeEach(() => {
    vi.clearAllMocks();

    const mocks = createBaseMocks();

    mockFindCursor = mocks.mockFindCursor;
    mockCollection = mocks.mockCollection;
    mockDb = mocks.mockDb;

    mockServer = {
      registerTool: vi.fn(),
    } as unknown as Mocked<McpServer>;

    mockClient = {
      isConnectedToMongoDB: vi.fn(),
      getDatabase: vi.fn().mockReturnValue(mockDb),
      isReadonly: vi.fn().mockReturnValue(false), // Default to non-read-only mode
    } as unknown as Mocked<MongoDBClient>;
  });

  it('should register the find tool correctly', () => {
    registerFindTool(mockServer, mockClient);

    expect(mockServer.registerTool).toHaveBeenCalledWith(
      'find',
      expect.objectContaining({
        description: expect.stringContaining('Run a find query against a MongoDB collection'),
      }),
      expect.any(Function),
    );
  });

  it('should return an error if not connected to MongoDB', async () => {
    mockClient.isConnectedToMongoDB.mockReturnValue(false);

    registerFindTool(mockServer, mockClient);

    // Get the tool handler function
    const registerCall = mockServer.registerTool.mock.calls[0];
    // Using 'any' for params and return type because we're accessing the registered tool handler
    // from mock calls, and the exact type is complex to define since it comes from the tool registration system
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const handler = registerCall[2] as (params: any) => Promise<any>;
    const params = {
      database: 'testdb',
      collection: 'testcollection',
      filter: { status: 'active' },
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

  it('should find documents successfully in non-read-only mode', async () => {
    mockClient.isConnectedToMongoDB.mockReturnValue(true);

    const mockDocuments = [
      { _id: 1, name: 'Test', status: 'active' },
      { _id: 2, name: 'Another Test', status: 'inactive' },
    ];

    mockFindCursor.toArray.mockResolvedValue(mockDocuments);

    registerFindTool(mockServer, mockClient);

    // Get the tool handler function
    const registerCall = mockServer.registerTool.mock.calls[0];
    // Using 'any' for params and return type because we're accessing the registered tool handler
    // from mock calls, and the exact type is complex to define since it comes from the tool registration system
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const handler = registerCall[2] as (params: any) => Promise<any>;
    const params = {
      database: 'testdb',
      collection: 'testcollection',
      filter: { status: 'active' },
      limit: 10,
    };
    const result = await handler(params);

    expect(mockClient.getDatabase).toHaveBeenCalledWith('testdb');
    expect(mockDb.collection).toHaveBeenCalledWith('testcollection');
    expect(mockCollection.find).toHaveBeenCalledWith({ status: 'active' });
    expect(mockFindCursor.limit).toHaveBeenCalledWith(10);
    expect(mockFindCursor.toArray).toHaveBeenCalled();

    expect(result).toEqual(
      toolSuccess({
        database: 'testdb',
        collection: 'testcollection',
        documents: mockDocuments,
        returnedCount: 2,
        limit: 10,
        limited: false,
      }),
    );
  });

  it('should find documents with projection and sorting in read-only mode', async () => {
    mockClient.isConnectedToMongoDB.mockReturnValue(true);
    mockClient.isReadonly.mockReturnValue(true);

    const mockDocuments = [
      { _id: 1, name: 'Test' },
      { _id: 2, name: 'Another Test' },
    ];

    mockFindCursor.toArray.mockResolvedValue(mockDocuments);

    registerFindTool(mockServer, mockClient);

    // Get the tool handler function
    const registerCall = mockServer.registerTool.mock.calls[0];
    // Using 'any' for params and return type because we're accessing the registered tool handler
    // from mock calls, and the exact type is complex to define since it comes from the tool registration system
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const handler = registerCall[2] as (params: any) => Promise<any>;
    const params = {
      database: 'testdb',
      collection: 'testcollection',
      filter: { status: 'active' },
      projection: { name: 1, _id: 0 },
      sort: { name: 1 },
      limit: 5,
    };
    const result = await handler(params);

    expect(mockCollection.find).toHaveBeenCalledWith({ status: 'active' });
    expect(mockFindCursor.project).toHaveBeenCalledWith({ name: 1, _id: 0 });
    expect(mockFindCursor.sort).toHaveBeenCalledWith({ name: 1 });
    expect(mockFindCursor.limit).toHaveBeenCalledWith(5);

    expect(result).toEqual(
      toolSuccess({
        database: 'testdb',
        collection: 'testcollection',
        documents: mockDocuments,
        returnedCount: 2,
        limit: 5,
        limited: false,
      }),
    );
  });

  it('should apply default limit if none provided', async () => {
    mockClient.isConnectedToMongoDB.mockReturnValue(true);

    const mockDocuments = [{ _id: 1, name: 'Test' }];

    mockFindCursor.toArray.mockResolvedValue(mockDocuments);

    registerFindTool(mockServer, mockClient);

    // Get the tool handler function
    const registerCall = mockServer.registerTool.mock.calls[0];
    // Using 'any' for params and return type because we're accessing the registered tool handler
    // from mock calls, and the exact type is complex to define since it comes from the tool registration system
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const handler = registerCall[2] as (params: any) => Promise<any>;
    const params = {
      database: 'testdb',
      collection: 'testcollection',
      filter: { status: 'active' },
      // No limit specified, should use default (10)
    };
    const result = await handler(params);

    expect(mockFindCursor.limit).toHaveBeenCalledWith(10);

    const resultObj = JSON.parse(result.content[0].text);

    expect(resultObj.payload.limit).toBe(10);
  });

  it('should enforce maximum limit of 1000', async () => {
    mockClient.isConnectedToMongoDB.mockReturnValue(true);

    const mockDocuments = [{ _id: 1, name: 'Test' }];

    mockFindCursor.toArray.mockResolvedValue(mockDocuments);

    registerFindTool(mockServer, mockClient);

    // Get the tool handler function
    const registerCall = mockServer.registerTool.mock.calls[0];
    // Using 'any' for params and return type because we're accessing the registered tool handler
    // from mock calls, and the exact type is complex to define since it comes from the tool registration system
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const handler = registerCall[2] as (params: any) => Promise<any>;
    const params = {
      database: 'testdb',
      collection: 'testcollection',
      filter: { status: 'active' },
      limit: 2000, // This exceeds the maximum limit of 1000
    };
    const result = await handler(params);

    expect(mockFindCursor.limit).toHaveBeenCalledWith(1000); // Should use max limit of 1000

    const resultObj = JSON.parse(result.content[0].text);

    expect(resultObj.payload.limit).toBe(1000);
  });

  it('should stream results to a file with document count for JSONL format', async () => {
    mockClient.isConnectedToMongoDB.mockReturnValue(true);

    // Mock the cursor with all required methods for both streaming and normal operations
    const mockCursor = {
      [Symbol.asyncIterator]: vi.fn().mockImplementation(async function*() {
        yield { _id: 1, name: 'test' };
      }),
      limit: vi.fn().mockReturnThis(),
      project: vi.fn().mockReturnThis(),
      sort: vi.fn().mockReturnThis(),
      toArray: vi.fn().mockResolvedValue([{ _id: 1, name: 'test' }]), // Add toArray method
    };
    const mockCollection = {
      find: vi.fn().mockReturnValue(mockCursor),
    } as unknown as Mocked<Collection>;

    mockDb.collection.mockReturnValue(mockCollection);

    registerFindTool(mockServer, mockClient);

    // Get the tool handler function
    const registerCall = mockServer.registerTool.mock.calls[0];
    // Using 'any' for params and return type because we're accessing the registered tool handler
    // from mock calls, and the exact type is complex to define since it comes from the tool registration system
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const handler = registerCall[2] as (params: any) => Promise<any>;
    const params = {
      database: 'testdb',
      collection: 'testcollection',
      filter: { status: 'active' },
      saveToFile: true,
      filePath: '/tmp/test.json',
      format: 'jsonl',
    };
    const result = await handler(params);

    // Verify that the database and collection methods were called
    expect(mockClient.getDatabase).toHaveBeenCalledWith('testdb');
    expect(mockDb.collection).toHaveBeenCalledWith('testcollection');
    expect(mockCollection.find).toHaveBeenCalledWith({ status: 'active' });

    // Result should indicate successful file save
    expect(result.isError).toBeUndefined(); // Not an error

    const resultObj = JSON.parse(result.content[0].text);

    expect(resultObj.success).toBe(true);
    expect(resultObj.payload.savedToFile).toBe(true);
    expect(resultObj.payload.filePath).toBeDefined();
    expect(resultObj.payload.processedCount).toBe(5); // Should return the mock count of 5
    expect(resultObj.payload.format).toBe('jsonl');
    expect(resultObj.payload.message).toContain('5 documents were written to the file');
  });

  it('should stream results to a file with document count for JSON format', async () => {
    mockClient.isConnectedToMongoDB.mockReturnValue(true);

    // Mock the cursor with all required methods for both streaming and normal operations
    const mockCursor = {
      [Symbol.asyncIterator]: vi.fn().mockImplementation(async function*() {
        yield { _id: 1, name: 'test' };
      }),
      limit: vi.fn().mockReturnThis(),
      project: vi.fn().mockReturnThis(),
      sort: vi.fn().mockReturnThis(),
      toArray: vi.fn().mockResolvedValue([{ _id: 1, name: 'test' }]), // Add toArray method
    };
    const mockCollection = {
      find: vi.fn().mockReturnValue(mockCursor),
    } as unknown as Mocked<Collection>;

    mockDb.collection.mockReturnValue(mockCollection);

    registerFindTool(mockServer, mockClient);

    // Get the tool handler function
    const registerCall = mockServer.registerTool.mock.calls[0];
    // Using 'any' for params and return type because we're accessing the registered tool handler
    // from mock calls, and the exact type is complex to define since it comes from the tool registration system
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const handler = registerCall[2] as (params: any) => Promise<any>;
    const params = {
      database: 'testdb',
      collection: 'testcollection',
      filter: { status: 'active' },
      saveToFile: true,
      filePath: '/tmp/test.json',
      format: 'json',
    };
    const result = await handler(params);

    // Verify that the database and collection methods were called
    expect(mockClient.getDatabase).toHaveBeenCalledWith('testdb');
    expect(mockDb.collection).toHaveBeenCalledWith('testcollection');
    expect(mockCollection.find).toHaveBeenCalledWith({ status: 'active' });

    // Result should indicate successful file save
    expect(result.isError).toBeUndefined(); // Not an error

    const resultObj = JSON.parse(result.content[0].text);

    expect(resultObj.success).toBe(true);
    expect(resultObj.payload.savedToFile).toBe(true);
    expect(resultObj.payload.filePath).toBeDefined();
    expect(resultObj.payload.processedCount).toBe(3); // Should return the mock count of 3
    expect(resultObj.payload.format).toBe('json');
    expect(resultObj.payload.message).toContain('3 documents were written to the file');
  });

  it('should stream all results to a file when saveToFile=true and no limit provided', async () => {
    mockClient.isConnectedToMongoDB.mockReturnValue(true);

    // Mock the cursor with all required methods for both streaming and normal operations
    const mockCursor = {
      [Symbol.asyncIterator]: vi.fn().mockImplementation(async function*() {
        yield { _id: 1, name: 'test1' };
        yield { _id: 2, name: 'test2' };
        yield { _id: 3, name: 'test3' };
      }),
      limit: vi.fn().mockReturnThis(), // This should not be called when no limit is provided
      project: vi.fn().mockReturnThis(),
      sort: vi.fn().mockReturnThis(),
      toArray: vi.fn().mockResolvedValue([{ _id: 1, name: 'test1' }, { _id: 2, name: 'test2' }, { _id: 3, name: 'test3' }]), // Add toArray method
    };
    const mockCollection = {
      find: vi.fn().mockReturnValue(mockCursor),
    } as unknown as Mocked<Collection>;

    mockDb.collection.mockReturnValue(mockCollection);

    registerFindTool(mockServer, mockClient);

    // Get the tool handler function
    const registerCall = mockServer.registerTool.mock.calls[0];
    // Using 'any' for params and return type because we're accessing the registered tool handler
    // from mock calls, and the exact type is complex to define since it comes from the tool registration system
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const handler = registerCall[2] as (params: any) => Promise<any>;
    const params = {
      database: 'testdb',
      collection: 'testcollection',
      filter: { status: 'active' },
      saveToFile: true,
      filePath: '/tmp/test.json',
      format: 'jsonl',
      // No limit provided - should not apply default limit
    };
    const result = await handler(params);

    // Verify that the database and collection methods were called
    expect(mockClient.getDatabase).toHaveBeenCalledWith('testdb');
    expect(mockDb.collection).toHaveBeenCalledWith('testcollection');
    expect(mockCollection.find).toHaveBeenCalledWith({ status: 'active' });
    // The limit method should not be called when no limit is provided for saveToFile
    expect(mockCursor.limit).not.toHaveBeenCalled();

    // Result should indicate successful file save
    expect(result.isError).toBeUndefined(); // Not an error

    const resultObj = JSON.parse(result.content[0].text);

    expect(resultObj.success).toBe(true);
    expect(resultObj.payload.savedToFile).toBe(true);
    expect(resultObj.payload.filePath).toBeDefined();
    expect(resultObj.payload.processedCount).toBe(5); // Should return the mock count of 5
    expect(resultObj.payload.format).toBe('jsonl');
    expect(resultObj.payload.message).toContain('5 documents were written to the file');
  });

  it('should return an error if finding fails', async () => {
    mockClient.isConnectedToMongoDB.mockReturnValue(true);

    const findSpy = vi.spyOn(mockCollection, 'find').mockImplementation(() => {
      throw new Error('Find failed');
    });

    registerFindTool(mockServer, mockClient);

    // Get the tool handler function
    const registerCall = mockServer.registerTool.mock.calls[0];
    // Using 'any' for params and return type because we're accessing the registered tool handler
    // from mock calls, and the exact type is complex to define since it comes from the tool registration system
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const handler = registerCall[2] as (params: any) => Promise<any>;
    const params = {
      database: 'testdb',
      collection: 'testcollection',
      filter: { status: 'active' },
    };
    const result = await handler(params);

    findSpy.mockRestore();

    expect(result).toEqual(
      toolError(new Error('Find failed')),
    );
  });
});
