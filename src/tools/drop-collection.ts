import { z } from 'zod';
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { MongoDBClient } from '../mongodb-client.js';
import { toolSuccess, toolError } from '../utils/tool-response.js';
import { destructiveConfirmationSchema } from '../utils/confirmation.js';

const dropCollectionSchema = z.object({
  database: z.string().describe('Database name'),
  collection: z.string().describe('Collection name to drop'),
  confirmation: destructiveConfirmationSchema,
});

export type DropCollectionParams = z.infer<typeof dropCollectionSchema>;

export function registerDropCollectionTool(server: McpServer, client: MongoDBClient) {
  server.registerTool(
    'drop-collection',
    {
      title: 'Drop Collection',
      description: 'Drop a collection from a MongoDB database. Use for: Removing collections that are no longer needed. Requires the confirmation literal to be passed explicitly to prevent accidental data loss.',
      inputSchema: dropCollectionSchema.shape,
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: false,
        openWorldHint: true,
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
