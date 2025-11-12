import { z } from 'zod';
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { MongoDBClient } from '../mongodb-client.js';
import { toolSuccess, toolError } from '../utils/tool-response.js';

const collectionIndexesSchema = z.object({
  database: z.string().describe('Database name'),
  collection: z.string().describe('Collection name'),
});

export type CollectionIndexesParams = z.infer<typeof collectionIndexesSchema>;

// Export the registration function for the server
// The client parameter is required to match the registration function signature used by other tools
export function registerCollectionIndexesTool(server: McpServer, client: MongoDBClient) {
  server.registerTool(
    'collection-indexes',
    {
      title: 'Collection Indexes',
      description: 'Describe the indexes for a collection',
      inputSchema: collectionIndexesSchema.shape,
      annotations: {
        readOnlyHint: true,
      },
    },
    async (params: CollectionIndexesParams) => {
      if (!client.isConnectedToMongoDB()) {
        return toolError(new Error('Not connected to MongoDB. Please connect first.'));
      }

      try {
        const db = client.getDatabase(params.database);
        const collection = db.collection(params.collection);
        // Get index information
        const indexes = await collection.indexes();
        const response = {
          database: params.database,
          collection: params.collection,
          indexes,
          total: indexes.length,
        };

        return toolSuccess(response);
      } catch (error) {
        return toolError(error);
      }
    },
  );
}
