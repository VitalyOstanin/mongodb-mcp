import { z } from 'zod';
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { MongoDBClient } from '../mongodb-client.js';
import { toolSuccess, toolError } from '../utils/tool-response.js';

const createCollectionSchema = z.object({
  database: z.string().describe('Database name'),
  collection: z.string().describe('Collection name to create'),
  options: z.record(z.unknown()).optional().describe('Additional collection options (e.g., { capped: true, size: 1024 })'),
});

export type CreateCollectionParams = z.infer<typeof createCollectionSchema>;

export function registerCreateCollectionTool(server: McpServer, client: MongoDBClient) {
  server.registerTool(
    'create-collection',
    {
      title: 'Create Collection',
      description: 'Create a new collection in a MongoDB database. Use for: Creating new collections with optional configuration.',
      inputSchema: createCollectionSchema.shape,
      annotations: {
        writeOperation: true,
        category: 'write',
      },
    },
    async (params: CreateCollectionParams) => {
      const { database, collection: collectionName, options } = params;

      if (!client.isConnectedToMongoDB()) {
        return toolError(new Error('Not connected to MongoDB. Please connect first.'));
      }

      try {
        const db = client.getDatabase(database);
        // Create the collection
        const collection = await db.createCollection(collectionName, options ?? undefined);

        return toolSuccess({
          database,
          collection: collection.collectionName,
          options: options ?? {},
          message: 'Collection created successfully',
        });
      } catch (error) {
        return toolError(error);
      }
    },
  );
}
