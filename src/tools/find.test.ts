import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { Db, Collection, FindCursor } from 'mongodb';
import type { MongoDBClient } from '../mongodb-client.js';
import { registerFindTool } from './find.js';
import { toolSuccess, toolError } from '../utils/tool-response.js';

// Mock the streaming functions to avoid actual file operations
jest.mock('../utils/mongodb-stream.js', () => ({
  streamMongoCursorToFile: jest.fn().mockResolvedValue(undefined),
  streamMongoCursorToFileAsArray: jest.fn().mockResolvedValue(undefined),
}));

// Define base mock objects that can be reset for each test
const createBaseMocks = () => {
  const mockFindCursor: jest.Mocked<FindCursor> = {
    limit: jest.fn().mockReturnThis(),
    project: jest.fn().mockReturnThis(),
    sort: jest.fn().mockReturnThis(),
    toArray: jest.fn(),
  } as unknown as jest.Mocked<FindCursor>;
  const mockCollection: jest.Mocked<Collection> = {
    find: jest.fn().mockReturnValue(mockFindCursor),
  } as unknown as jest.Mocked<Collection>;
  const mockDb: jest.Mocked<Db> = {
    collection: jest.fn().mockReturnValue(mockCollection),
  } as unknown as jest.Mocked<Db>;

  return { mockFindCursor, mockCollection, mockDb };
};

describe('Find Tool', () => {
  let mockServer: jest.Mocked<McpServer>;
  let mockClient: jest.Mocked<MongoDBClient>;
  let mockFindCursor: jest.Mocked<FindCursor>;
  let mockCollection: jest.Mocked<Collection>;
  let mockDb: jest.Mocked<Db>;

  beforeEach(() => {
    jest.clearAllMocks();

    const mocks = createBaseMocks();

    mockFindCursor = mocks.mockFindCursor;
    mockCollection = mocks.mockCollection;
    mockDb = mocks.mockDb;

    mockServer = {
      registerTool: jest.fn(),
    } as unknown as jest.Mocked<McpServer>;

    mockClient = {
      isConnectedToMongoDB: jest.fn(),
      getDatabase: jest.fn().mockReturnValue(mockDb),
      isReadonly: jest.fn().mockReturnValue(false), // Default to non-read-only mode
    } as unknown as jest.Mocked<MongoDBClient>;
  });

  it('should register the find tool correctly', () => {
    registerFindTool(mockServer, mockClient);

    expect(mockServer.registerTool).toHaveBeenCalledWith(
      'find',
      expect.objectContaining({
        description: 'Run a find query against a MongoDB collection',
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
        count: 2,
        limit: 10,
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
        count: 2,
        limit: 5,
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

  it('should stream results to a file if saveToFile is true', async () => {
    mockClient.isConnectedToMongoDB.mockReturnValue(true);

    // Mock the cursor with all required methods for both streaming and normal operations
    const mockCursor = {
      [Symbol.asyncIterator]: jest.fn().mockImplementation(async function*() {
        yield { _id: 1, name: 'test' };
      }),
      limit: jest.fn().mockReturnThis(),
      project: jest.fn().mockReturnThis(),
      sort: jest.fn().mockReturnThis(),
      toArray: jest.fn().mockResolvedValue([{ _id: 1, name: 'test' }]), // Add toArray method
    };
    const mockCollection = {
      find: jest.fn().mockReturnValue(mockCursor),
    } as unknown as jest.Mocked<Collection>;

    // Using 'any' for mocking database object because the exact type is complex to define

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
  });

  it('should return an error if finding fails', async () => {
    mockClient.isConnectedToMongoDB.mockReturnValue(true);

    const findSpy = jest.spyOn(mockCollection, 'find').mockImplementation(() => {
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
