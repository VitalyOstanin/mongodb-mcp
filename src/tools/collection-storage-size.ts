import { z } from 'zod';
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { MongoDBClient } from '../mongodb-client.js';
import { toolSuccess, toolError } from '../utils/tool-response.js';

const collectionStorageSizeSchema = z.object({
  database: z.string().describe('Database name'),
  collection: z.string().describe('Collection name'),
});

export type CollectionStorageSizeParams = z.infer<typeof collectionStorageSizeSchema>;

// Helper function to format bytes in human-readable form
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))  } ${  sizes[i]}`;
}

// Export the registration function for the server
// The client parameter is required to match the registration function signature used by other tools
export function registerCollectionStorageSizeTool(server: McpServer, client: MongoDBClient) {
  server.registerTool(
    'collection-storage-size',
    {
      title: 'Collection Storage Size',
      description: 'Get storage size of a specific collection',
      inputSchema: collectionStorageSizeSchema.shape,
      annotations: {
        readOnlyHint: true,
      },
    },
    async (params: CollectionStorageSizeParams) => {
      if (!client.isConnectedToMongoDB()) {
        throw new Error('Not connected to MongoDB. Please connect first.');
      }

      try {
        const db = client.getDatabase(params.database);
        // Get collection stats which includes size information
        const stats = await db.admin().command({ collStats: params.collection });
        // The stats object contains size information
        const size = stats.size ?? stats.storageSize ?? 0;
        // Format size in human-readable form
        const sizeFormatted = formatBytes(size);
        const response = {
          database: params.database,
          collection: params.collection,
          size,
          sizeFormatted,
        };

        return toolSuccess(response);
      } catch (error) {
        return toolError(error);
      }
    },
  );
}
