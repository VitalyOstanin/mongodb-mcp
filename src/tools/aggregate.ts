import { z } from 'zod';
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { MongoDBClient } from '../mongodb-client.js';
import { toolSuccess, toolError } from '../utils/tool-response.js';

const aggregateSchema = z.object({
  database: z.string().describe('Database name'),
  collection: z.string().describe('Collection name'),
  pipeline: z.array(z.record(z.unknown())).describe('An array of aggregation stages to execute'),
  saveToFile: z.boolean().optional().describe('Save results to a file instead of returning them directly. Useful for large datasets that can be analyzed by scripts.'),
  filePath: z.string().optional().describe('Explicit path to save the file (optional, auto-generated if not provided). Directory will be created if it doesn\'t exist.'),
});

export type AggregateParams = z.infer<typeof aggregateSchema>;

// Export the registration function for the server
// The client parameter is required to match the registration function signature used by other tools
export function registerAggregateTool(server: McpServer, client: MongoDBClient) {
  server.registerTool(
    'aggregate',
    {
      title: 'Aggregate Collection',
      description: 'Run an aggregation against a MongoDB collection',
      inputSchema: aggregateSchema.shape,
      annotations: {
        readOnlyHint: false,  // Some aggregation operations can be destructive (like $out, $merge)
        idempotentHint: true,
      },
    },
    async (params: AggregateParams) => {
      if (!client.isConnectedToMongoDB()) {
        throw new Error('Not connected to MongoDB. Please connect first.');
      }

      try {
        const db = client.getDatabase(params.database);
        const collection = db.collection(params.collection);

        // Check if pipeline contains dangerous operations in read-only mode
        if (client.isReadonly()) {
          const dangerousStages = ['$out', '$merge'];

          for (const stage of params.pipeline) {
            const stageName = Object.keys(stage)[0];

            if (stageName && dangerousStages.includes(stageName)) {
              throw new Error(`Aggregation stage '${stageName}' is not allowed in read-only mode`);
            }
          }
        }

        if (params.saveToFile) {
          return toolError({
            error: 'File saving functionality has been removed from this version',
            code: 'NOT_IMPLEMENTED',
          });
        } else {
          // For in-memory results (when not saving to file), use the original approach but with a reasonable limit
          // Execute the aggregation pipeline with a reasonable limit to prevent memory issues
          const cursor = collection.aggregate(params.pipeline);
          // Limit results to prevent memory issues if not saving to file
          const documents = [];
          let count = 0;
          const maxDocs = 1000; // Reasonable limit for in-memory operations

          for await (const doc of cursor) {
            if (count >= maxDocs) {
              break;
            }
            documents.push(doc);
            count++;
          }

          const result = {
            database: params.database,
            collection: params.collection,
            results: documents,
            count: documents.length,
            hasMoreResults: count >= maxDocs, // Indicate if there were more results that were limited
          };

          return toolSuccess(result);
        }
      } catch (error) {
        return toolError(error);
      }
    },
  );
}
