import { z } from 'zod';
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { MongoDBClient } from '../mongodb-client.js';
import { toolSuccess, toolError } from '../utils/tool-response.js';
import { mkdir } from 'fs/promises';
import { dirname } from 'path';
import { generateTempFilePath } from '../utils/streaming.js';
import { streamMongoCursorToFile, streamMongoCursorToFileAsArray } from '../utils/mongodb-stream.js';

const aggregateSchema = z.object({
  database: z.string().describe('Database name'),
  collection: z.string().describe('Collection name'),
  pipeline: z.array(z.record(z.unknown())).describe('An array of aggregation stages to execute'),
  saveToFile: z.boolean().optional().describe('Save results to a file instead of returning them directly. Useful for large datasets that can be analyzed by scripts.'),
  filePath: z.string().optional().describe('Explicit path to save the file (optional, auto-generated if not provided). Directory will be created if it doesn\'t exist.'),
  format: z.enum(['jsonl', 'json']).optional().default('jsonl').describe('Output format when saving to file: jsonl (JSON Lines) or json (JSON array format)'),
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
        return toolError(new Error('Not connected to MongoDB. Please connect first.'));
      }

      try {
        const { database, collection: collectionName, pipeline, saveToFile } = params;
        const db = client.getDatabase(database);
        const collection = db.collection(collectionName);

        // Check if pipeline contains dangerous operations in read-only mode
        if (client.isReadonly()) {
          const dangerousStages = ['$out', '$merge'];

          for (const stage of pipeline) {
            const stageName = Object.keys(stage)[0];

            if (stageName && dangerousStages.includes(stageName)) {
              return toolError(new Error(`Aggregation stage '${stageName}' is not allowed in read-only mode`));
            }
          }
        }

        if (saveToFile) {
          // Create aggregation cursor and stream directly to file without accumulating in memory
          const cursor = collection.aggregate(pipeline);
          const { filePath = generateTempFilePath(), format = 'jsonl' } = params;
          // Ensure directory exists
          const dir = dirname(filePath);

          await mkdir(dir, { recursive: true });

          // Choose streaming function based on format parameter and get the count of processed documents
          let processedCount: number;

          if (format === 'json') {
            processedCount = await streamMongoCursorToFileAsArray(cursor, filePath);
          } else {
            // Default to jsonl format
            processedCount = await streamMongoCursorToFile(cursor, filePath);
          }

          return toolSuccess({
            savedToFile: true,
            filePath,
            database,
            collection: collectionName,
            format,
            processedCount,
            message: `Aggregation results exported successfully. ${processedCount} documents were written to the file.`,
          });
        } else {
          // For in-memory results (when not saving to file), use the original approach but with a reasonable limit
          // Execute the aggregation pipeline with a reasonable limit to prevent memory issues
          const maxDocs = 1000; // Reasonable limit for in-memory operations
          // Add $limit stage to the pipeline to limit results
          const pipelineWithLimit = [...pipeline, { $limit: maxDocs }];
          const cursor = collection.aggregate(pipelineWithLimit);
          const documents = await cursor.toArray();
          const result = {
            database,
            collection: collectionName,
            results: documents,
            count: documents.length,
            hasMoreResults: documents.length >= maxDocs, // Indicate if there were more results that were limited
          };

          return toolSuccess(result);
        }
      } catch (error) {
        return toolError(error);
      }
    },
  );
}
