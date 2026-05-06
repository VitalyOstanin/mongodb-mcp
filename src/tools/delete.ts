import { z } from 'zod';
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { MongoDBClient } from '../mongodb-client.js';
import { toolSuccess, toolError } from '../utils/tool-response.js';
import { DESTRUCTIVE_CONFIRMATION_VALUE } from '../utils/confirmation.js';

const deleteSchema = z.object({
  database: z.string().describe('Database name'),
  collection: z.string().describe('Collection name'),
  filter: z.record(z.string(), z.unknown()).describe('Filter to match documents for deletion'),
  multi: z.boolean().optional().default(false).describe('If true, deletes all matching documents (deleteMany), otherwise deletes only one (deleteOne)'),
  confirmation: z.string().optional().describe(`Required when multi=true. Must be exactly the string "${DESTRUCTIVE_CONFIRMATION_VALUE}" to confirm bulk deletion.`),
});

export type DeleteParams = z.infer<typeof deleteSchema>;

export function registerDeleteTool(server: McpServer, client: MongoDBClient) {
  server.registerTool(
    'delete',
    {
      title: 'Delete Documents',
      description: 'Delete one or multiple documents from a MongoDB collection. Use for: Removing records from MongoDB collections. Bulk deletes (multi=true) require an explicit confirmation literal.',
      inputSchema: deleteSchema.shape,
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async (params: DeleteParams) => {
      const { database, collection: collectionName, filter, multi = false, confirmation } = params;

      if (!client.isConnectedToMongoDB()) {
        return toolError(new Error('Not connected to MongoDB. Please connect first.'));
      }

      if (multi && confirmation !== DESTRUCTIVE_CONFIRMATION_VALUE) {
        return toolError(new Error(
          `Bulk delete (multi=true) requires the confirmation literal "${DESTRUCTIVE_CONFIRMATION_VALUE}". Pass it in the "confirmation" parameter once the user has approved the operation.`,
        ));
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
