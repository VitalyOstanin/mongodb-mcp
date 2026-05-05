import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { Db, Collection, FindCursor } from 'mongodb';
import { ObjectId } from 'mongodb';
import type { MongoDBClient } from '../mongodb-client.js';
import { registerCollectionSchemaTool, inferSchema } from './collection-schema.js';
import { toolSuccess, toolError } from '../utils/tool-response.js';

// Mock objects for testing
const mockFindCursor: jest.Mocked<FindCursor> = {
  limit: jest.fn().mockReturnThis(),
  toArray: jest.fn(),
} as unknown as jest.Mocked<FindCursor>;
const mockCollection: jest.Mocked<Collection> = {
  find: jest.fn().mockReturnValue(mockFindCursor),
} as unknown as jest.Mocked<Collection>;
const mockDb: jest.Mocked<Db> = {
  collection: jest.fn().mockReturnValue(mockCollection),
} as unknown as jest.Mocked<Db>;

describe('CollectionSchema Tool', () => {
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

  it('should register the collection-schema tool correctly', () => {
    registerCollectionSchemaTool(mockServer, mockClient);

    expect(mockServer.registerTool).toHaveBeenCalledWith(
      'collection-schema',
      expect.objectContaining({
        description: 'Describe the schema for a collection by sampling documents',
      }),
      expect.any(Function),
    );
  });

  it('should return an error if not connected to MongoDB', async () => {
    mockClient.isConnectedToMongoDB.mockReturnValue(false);

    registerCollectionSchemaTool(mockServer, mockClient);

    // Get the tool handler function
    const registerCall = mockServer.registerTool.mock.calls[0];
    // Using 'any' for params and return type because we're accessing the registered tool handler
    // from mock calls, and the exact type is complex to define since it comes from the tool registration system
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const handler = registerCall[2] as (params: any) => Promise<any>;
    const params = {
      database: 'testdb',
      collection: 'testcollection',
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

  it('should get collection schema successfully with sample documents in non-read-only mode', async () => {
    mockClient.isConnectedToMongoDB.mockReturnValue(true);

    const mockDocuments = [
      { _id: 1, name: 'Test', age: 30 },
      { _id: 2, name: 'Another Test', age: 25, email: 'test@example.com' },
    ];

    mockFindCursor.toArray.mockResolvedValue(mockDocuments);

    registerCollectionSchemaTool(mockServer, mockClient);

    // Get the tool handler function
    const registerCall = mockServer.registerTool.mock.calls[0];
    // Using 'any' for params and return type because we're accessing the registered tool handler
    // from mock calls, and the exact type is complex to define since it comes from the tool registration system
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const handler = registerCall[2] as (params: any) => Promise<any>;
    const params = {
      database: 'testdb',
      collection: 'testcollection',
      sampleSize: 50,
    };
    const result = await handler(params);

    expect(mockClient.getDatabase).toHaveBeenCalledWith('testdb');
    expect(mockDb.collection).toHaveBeenCalledWith('testcollection');
    expect(mockCollection.find).toHaveBeenCalledWith({});
    expect(mockFindCursor.limit).toHaveBeenCalledWith(50);
    expect(mockFindCursor.toArray).toHaveBeenCalled();

    expect(result).toEqual(
      toolSuccess({
        database: 'testdb',
        collection: 'testcollection',
        sampleSize: 2,
        schema: {
          properties: {
            _id: { type: 'integer' },
            name: { type: 'string' },
            age: { type: 'integer' },
            email: { type: 'string' },
          },
          required: ['_id', 'name', 'age'],
        },
      }),
    );
  });

  it('should get collection schema successfully with sample documents in read-only mode', async () => {
    mockClient.isConnectedToMongoDB.mockReturnValue(true);
    mockClient.isReadonly.mockReturnValue(true);

    const mockDocuments = [
      { _id: 1, name: 'Test', age: 30 },
      { _id: 2, name: 'Another Test', age: 25, email: 'test@example.com' },
    ];

    mockFindCursor.toArray.mockResolvedValue(mockDocuments);

    registerCollectionSchemaTool(mockServer, mockClient);

    // Get the tool handler function
    const registerCall = mockServer.registerTool.mock.calls[0];
    // Using 'any' for params and return type because we're accessing the registered tool handler
    // from mock calls, and the exact type is complex to define since it comes from the tool registration system
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const handler = registerCall[2] as (params: any) => Promise<any>;
    const params = {
      database: 'testdb',
      collection: 'testcollection',
      sampleSize: 50,
    };
    const result = await handler(params);

    expect(mockCollection.find).toHaveBeenCalledWith({});
    expect(mockFindCursor.limit).toHaveBeenCalledWith(50);
    expect(mockFindCursor.toArray).toHaveBeenCalled();

    expect(result).toEqual(
      toolSuccess({
        database: 'testdb',
        collection: 'testcollection',
        sampleSize: 2,
        schema: {
          properties: {
            _id: { type: 'integer' },
            name: { type: 'string' },
            age: { type: 'integer' },
            email: { type: 'string' },
          },
          required: ['_id', 'name', 'age'],
        },
      }),
    );
  });

  it('should return empty schema when collection has no documents', async () => {
    mockClient.isConnectedToMongoDB.mockReturnValue(true);
    mockFindCursor.toArray.mockResolvedValue([]);

    registerCollectionSchemaTool(mockServer, mockClient);

    // Get the tool handler function
    const registerCall = mockServer.registerTool.mock.calls[0];
    // Using 'any' for params and return type because we're accessing the registered tool handler
    // from mock calls, and the exact type is complex to define since it comes from the tool registration system
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const handler = registerCall[2] as (params: any) => Promise<any>;
    const params = {
      database: 'testdb',
      collection: 'testcollection',
      sampleSize: 50,
    };
    const result = await handler(params);

    expect(result).toEqual(
      toolSuccess({
        database: 'testdb',
        collection: 'testcollection',
        sampleSize: 50,
        schema: { properties: {}, required: [] },
        message: 'No documents found in the collection to infer schema',
      }),
    );
  });

  it('should mark a field required only when present (non-null) in every sampled document', async () => {
    mockClient.isConnectedToMongoDB.mockReturnValue(true);
    mockFindCursor.toArray.mockResolvedValue([
      { _id: 1, name: 'a' },
      { _id: 2, name: 'b', extra: 'sometimes' },
      { _id: 3, name: null },
      { _id: 4 },
    ]);

    registerCollectionSchemaTool(mockServer, mockClient);
    const handler = mockServer.registerTool.mock.calls[0][2] as (
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      params: any,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ) => Promise<any>;
    const result = await handler({ database: 'db', collection: 'c', sampleSize: 50 });

    // _id is the only field present (and non-null) in all 4 documents.
    // name is null in one and missing in another -> not required.
    // extra is in only one document -> not required.
    expect(result.content[0].text).toContain('"required":["_id"]');
  });

  it('should not flag short non-ISO strings as date', () => {
    const schema = inferSchema([
      { v: '123' },
      { v: '2025' },
      { v: 'active' },
      { v: 'user-id-abc-123' },
    ]);

    expect(schema.properties.v.type).toBe('string');
  });

  it('should detect ISO date strings as date', () => {
    const schema = inferSchema([
      { ts: '2025-11-14T10:31:26.517Z' },
      { ts: '2025-11-15T10:31:26.517Z' },
    ]);

    expect(schema.properties.ts.type).toBe('date');
  });

  it('should detect MongoDB ObjectId via instanceof', () => {
    const schema = inferSchema([
      { _id: new ObjectId(), name: 'a' },
      { _id: new ObjectId(), name: 'b' },
    ]);

    expect(schema.properties._id.type).toBe('objectId');
  });

  it('should return an error if getting schema fails', async () => {
    mockClient.isConnectedToMongoDB.mockReturnValue(true);
    mockFindCursor.toArray.mockRejectedValue(new Error('Failed to get schema'));

    registerCollectionSchemaTool(mockServer, mockClient);

    // Get the tool handler function
    const registerCall = mockServer.registerTool.mock.calls[0];
    // Using 'any' for params and return type because we're accessing the registered tool handler
    // from mock calls, and the exact type is complex to define since it comes from the tool registration system
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const handler = registerCall[2] as (params: any) => Promise<any>;
    const params = {
      database: 'testdb',
      collection: 'testcollection',
      sampleSize: 50,
    };
    const result = await handler(params);

    expect(result).toEqual(
      toolError(new Error('Failed to get schema')),
    );
  });
});
