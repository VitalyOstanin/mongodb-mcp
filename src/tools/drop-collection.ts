import { z } from 'zod';
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { MongoDBClient } from '../mongodb-client.js';
import { toolSuccess, toolError } from '../utils/tool-response.js';

const dropCollectionSchema = z.object({
  database: z.string().describe('Database name'),
  collection: z.string().describe('Collection name to drop'),
});

export type DropCollectionParams = z.infer<typeof dropCollectionSchema>;

export function registerDropCollectionTool(server: McpServer, client: MongoDBClient) {
  server.registerTool(
    'drop-collection',
    {
      title: 'Drop Collection',
      description: 'Drop a collection from a MongoDB database. Use for: Removing collections that are no longer needed.',
      inputSchema: dropCollectionSchema.shape,
      annotations: {
        writeOperation: true,
        category: 'write',
      },
    },
    async (params: DropCollectionParams) => {
      const { database, collection: collectionName } = params;

      if (!client.isConnectedToMongoDB()) {
        return toolError(new Error('Not connected to MongoDB. Please connect first.'));
      }

      try {
        const db = client.getDatabase(database);
        // Drop the collection
        const result = await db.dropCollection(collectionName);

        return toolSuccess({
          database,
          collection: collectionName,
          result,
          message: 'Collection dropped successfully',
        });
      } catch (error) {
        return toolError(error);
      }
    },
  );
}
