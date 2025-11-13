import { z } from 'zod';
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { MongoDBClient } from '../mongodb-client.js';
import { toolSuccess, toolError } from '../utils/tool-response.js';

const findSchema = z.object({
  database: z.string().describe('Database name'),
  collection: z.string().describe('Collection name'),
  filter: z.record(z.unknown()).optional().default({}).describe('The query filter, matching the syntax of the query argument of db.collection.find()'),
  limit: z.number().optional().default(10).describe('The maximum number of documents to return'),
  projection: z.record(z.unknown()).optional().describe('The projection, matching the syntax of the projection argument of db.collection.find()'),
  sort: z.record(z.unknown()).optional().describe('A document, describing the sort order, matching the syntax of the sort argument of cursor.sort()'),
  saveToFile: z.boolean().optional().describe('Save results to a file instead of returning them directly. Useful for large datasets that can be analyzed by scripts.'),
  filePath: z.string().optional().describe('Explicit path to save the file (optional, auto-generated if not provided). Directory will be created if it doesn\'t exist.'),
});

export type FindParams = z.infer<typeof findSchema>;

// Export the registration function for the server
// The client parameter is required to match the registration function signature used by other tools
export function registerFindTool(server: McpServer, client: MongoDBClient) {
  server.registerTool(
    'find',
    {
      title: 'Find Documents',
      description: 'Run a find query against a MongoDB collection',
      inputSchema: findSchema.shape,
    },
    async (params: FindParams) => {
      if (!client.isConnectedToMongoDB()) {
        return toolError(new Error('Not connected to MongoDB. Please connect first.'));
      }

      try {
        const db = client.getDatabase(params.database);
        const collection = db.collection(params.collection);

        if (params.saveToFile) {
          return toolError({
            error: 'File saving functionality has been removed from this version',
            code: 'NOT_IMPLEMENTED',
          });
        } else {
          // For in-memory results (when not saving to file), use the original approach but with a reasonable limit
          // Add a default limit to prevent memory issues if no limit is specified
          let query = collection.find(params.filter);
          // Apply limit, using the zod default and capping at 1000 to prevent memory issues
          const { limit = 10 } = params;
          const effectiveLimit = Math.min(limit, 1000); // Use the zod default and respect the maximum limit

          query = query.limit(effectiveLimit);

          // Apply projection if specified
          if (params.projection) {
            query = query.project(params.projection);
          }

          // Apply sort if specified
          if (params.sort) {
            // MongoDB sort parameter can have dynamic structure
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            query = query.sort(params.sort as any);
          }

          // Execute the query
          const documents = await query.toArray();
          const result = {
            database: params.database,
            collection: params.collection,
            documents,
            count: documents.length,
            limit: effectiveLimit,
          };

          return toolSuccess(result);
        }
      } catch (error) {
        return toolError(error);
      }
    },
  );
}
