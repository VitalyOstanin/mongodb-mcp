import { z } from 'zod';
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { MongoDBClient } from '../mongodb-client.js';
import { toolSuccess, toolError } from '../utils/tool-response.js';

const createIndexSchema = z.object({
  database: z.string().describe('Database name'),
  collection: z.string().describe('Collection name'),
  keys: z.record(z.unknown()).describe('Index specification document (e.g., { field: 1 } for ascending, { field: -1 } for descending)'),
  options: z.record(z.unknown()).optional().describe('Additional index options (e.g., { unique: true, sparse: true })'),
});

export type CreateIndexParams = z.infer<typeof createIndexSchema>;

export function registerCreateIndexTool(server: McpServer, client: MongoDBClient) {
  server.registerTool(
    'create-index',
    {
      title: 'Create Index',
      description: 'Create an index on a MongoDB collection. Use for: Improving query performance by creating indexes on collection fields.',
      inputSchema: createIndexSchema.shape,
      annotations: {
        writeOperation: true,
        category: 'write',
      },
    },
    async (params: CreateIndexParams) => {
      const { database, collection: collectionName, keys, options } = params;

      if (!client.isConnectedToMongoDB()) {
        return toolError(new Error('Not connected to MongoDB. Please connect first.'));
      }

      try {
        const db = client.getDatabase(database);
        const collection = db.collection(collectionName);
        // Create the index
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const indexName = await collection.createIndex(keys as any, options ?? undefined);

        return toolSuccess({
          database,
          collection: collectionName,
          indexName,
          keys,
          options: options ?? {},
          message: 'Index created successfully',
        });
      } catch (error) {
        return toolError(error);
      }
    },
  );
}
