import { z } from 'zod';
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { MongoDBClient } from '../mongodb-client.js';
import { toolSuccess, toolError } from '../utils/tool-response.js';

const dropIndexSchema = z.object({
  database: z.string().describe('Database name'),
  collection: z.string().describe('Collection name'),
  index: z.union([z.string(), z.record(z.unknown())]).describe('Index name or index specification document to drop'),
});

export type DropIndexParams = z.infer<typeof dropIndexSchema>;

export function registerDropIndexTool(server: McpServer, client: MongoDBClient) {
  server.registerTool(
    'drop-index',
    {
      title: 'Drop Index',
      description: 'Drop an index from a MongoDB collection. Use for: Removing indexes that are no longer needed or causing performance issues.',
      inputSchema: dropIndexSchema.shape,
      annotations: {
        writeOperation: true,
        category: 'write',
      },
    },
    async (params: DropIndexParams) => {
      const { database, collection: collectionName, index } = params;

      if (!client.isConnectedToMongoDB()) {
        return toolError(new Error('Not connected to MongoDB. Please connect first.'));
      }

      try {
        const db = client.getDatabase(database);
        const collection = db.collection(collectionName);
        // Drop the index
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const result = await collection.dropIndex(index as any);

        return toolSuccess({
          database,
          collection: collectionName,
          result,
          index,
          message: 'Index dropped successfully',
        });
      } catch (error) {
        return toolError(error);
      }
    },
  );
}
