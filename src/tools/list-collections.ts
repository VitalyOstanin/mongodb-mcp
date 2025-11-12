import { z } from 'zod';
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { MongoDBClient } from '../mongodb-client.js';
import { toolSuccess, toolError } from '../utils/tool-response.js';

const listCollectionsSchema = z.object({
  database: z.string().describe('Database name to list collections from'),
});

export type ListCollectionsParams = z.infer<typeof listCollectionsSchema>;

// Export the registration function for the server
// The client parameter is required to match the registration function signature used by other tools
export function registerListCollectionsTool(server: McpServer, client: MongoDBClient) {
  server.registerTool(
    'list-collections',
    {
      title: 'List Collections',
      description: 'List all collections in a specific database',
      inputSchema: listCollectionsSchema.shape,
      annotations: {
        readOnlyHint: true,
      },
    },
    async (params: ListCollectionsParams) => {
      if (!client.isConnectedToMongoDB()) {
        throw new Error('Not connected to MongoDB. Please connect first.');
      }

      try {
        const db = client.getDatabase(params.database);
        const collections = await db.listCollections().toArray();
        const response = {
          database: params.database,
          // MongoDB collection objects can have dynamic structure
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          collections: collections.map((collection: any) => collection.name),
          total: collections.length,
        };

        return toolSuccess(response);
      } catch (error) {
        return toolError(error);
      }
    },
  );
}
