import { z } from 'zod';
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { MongoDBClient } from '../mongodb-client.js';
import { toolSuccess, toolError } from '../utils/tool-response.js';

const deleteSchema = z.object({
  database: z.string().describe('Database name'),
  collection: z.string().describe('Collection name'),
  filter: z.record(z.unknown()).describe('Filter to match documents for deletion'),
  multi: z.boolean().optional().default(false).describe('If true, deletes all matching documents (deleteMany), otherwise deletes only one (deleteOne)'),
});

export type DeleteParams = z.infer<typeof deleteSchema>;

export function registerDeleteTool(server: McpServer, client: MongoDBClient) {
  server.registerTool(
    'delete',
    {
      title: 'Delete Documents',
      description: 'Delete one or multiple documents from a MongoDB collection. Use for: Removing records from MongoDB collections.',
      inputSchema: deleteSchema.shape,
      annotations: {
        writeOperation: true,
        category: 'write',
      },
    },
    async (params: DeleteParams) => {
      const { database, collection: collectionName, filter, multi = false } = params;

      if (!client.isConnectedToMongoDB()) {
        return toolError(new Error('Not connected to MongoDB. Please connect first.'));
      }

      try {
        const db = client.getDatabase(database);
        const collection = db.collection(collectionName);
        let result;

        if (multi) {
          // Delete multiple documents
          result = await collection.deleteMany(filter);

        } else {
          // Delete single document
          result = await collection.deleteOne(filter);
        }

        return toolSuccess({
          database,
          collection: collectionName,
          deletedCount: result.deletedCount,
          operation: multi ? 'deleteMany' : 'deleteOne',
        });
      } catch (error) {
        return toolError(error);
      }
    },
  );
}
