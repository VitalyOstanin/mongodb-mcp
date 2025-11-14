import { z } from 'zod';
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { MongoDBClient } from '../mongodb-client.js';
import { toolSuccess, toolError } from '../utils/tool-response.js';

const updateSchema = z.object({
  database: z.string().describe('Database name'),
  collection: z.string().describe('Collection name'),
  filter: z.record(z.unknown()).describe('Filter to match documents for update'),
  update: z.record(z.unknown()).describe('Update operations to perform'),
  upsert: z.boolean().optional().default(false).describe('If true, creates a new document if no documents match the filter'),
  multi: z.boolean().optional().default(false).describe('If true, updates all matching documents (updateMany), otherwise updates only one (updateOne)'),
});

export type UpdateParams = z.infer<typeof updateSchema>;

export function registerUpdateTool(server: McpServer, client: MongoDBClient) {
  server.registerTool(
    'update',
    {
      title: 'Update Documents',
      description: 'Update one or multiple documents in a MongoDB collection. Use for: Modifying existing records in MongoDB collections.',
      inputSchema: updateSchema.shape,
      annotations: {
        writeOperation: true,
        category: 'write',
      },
    },
    async (params: UpdateParams) => {
      const { database, collection: collectionName, filter, update, upsert = false, multi = false } = params;

      if (!client.isConnectedToMongoDB()) {
        return toolError(new Error('Not connected to MongoDB. Please connect first.'));
      }

      try {
        const db = client.getDatabase(database);
        const collection = db.collection(collectionName);
        let result;

        if (multi) {
          // Update multiple documents
          result = await collection.updateMany(filter, update, { upsert });
        } else {
          // Update single document
          result = await collection.updateOne(filter, update, { upsert });
        }

        return toolSuccess({
          database,
          collection: collectionName,
          matchedCount: result.matchedCount,
          modifiedCount: result.modifiedCount,
          upsertedCount: result.upsertedCount,
          upsertedId: result.upsertedId,
          operation: multi ? 'updateMany' : 'updateOne',
        });
      } catch (error) {
        return toolError(error);
      }
    },
  );
}
