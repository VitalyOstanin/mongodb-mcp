import { z } from 'zod';
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { MongoDBClient } from '../mongodb-client.js';
import { toolSuccess, toolError } from '../utils/tool-response.js';

const insertSchema = z.object({
  database: z.string().describe('Database name'),
  collection: z.string().describe('Collection name'),
  document: z.record(z.unknown()).describe('Document to insert'),
  documents: z.array(z.record(z.unknown())).optional().describe('Array of documents to insert (use instead of single document)'),
});

export type InsertParams = z.infer<typeof insertSchema>;

export function registerInsertTool(server: McpServer, client: MongoDBClient) {
  server.registerTool(
    'insert',
    {
      title: 'Insert Documents',
      description: 'Insert one or multiple documents into a MongoDB collection. Use for: Adding new records to MongoDB collections.',
      inputSchema: insertSchema.shape,
      annotations: {
        writeOperation: true,
        category: 'write',
      },
    },
    async (params: InsertParams) => {
      const { database, collection: collectionName, document, documents } = params;

      if (!client.isConnectedToMongoDB()) {
        return toolError(new Error('Not connected to MongoDB. Please connect first.'));
      }

      // documents=[] is almost certainly a template-rendering bug on the
      // caller side. Reject it explicitly instead of silently falling back
      // to the single-document path with the unrelated `document` payload.
      if (documents !== undefined && documents.length === 0) {
        return toolError(new Error('documents array must not be empty when provided'));
      }

      try {
        const db = client.getDatabase(database);
        const collection = db.collection(collectionName);

        if (documents !== undefined) {
          const result = await collection.insertMany(documents);

          return toolSuccess({
            database,
            collection: collectionName,
            insertedCount: result.insertedCount,
            insertedIds: Object.values(result.insertedIds),
            operation: 'insertMany',
          });
        }

        const result = await collection.insertOne(document);

        return toolSuccess({
          database,
          collection: collectionName,
          insertedId: result.insertedId,
          insertedCount: 1,
          operation: 'insertOne',
        });
      } catch (error) {
        return toolError(error);
      }
    },
  );
}
