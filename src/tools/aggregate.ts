import { z } from 'zod';
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { MongoDBClient } from '../mongodb-client.js';
import { toolSuccess, toolError } from '../utils/tool-response.js';
import { mkdir } from 'fs/promises';
import { dirname } from 'path';
import { generateTempFilePath } from '../utils/streaming.js';
import { streamMongoCursorToFile, streamMongoCursorToFileAsArray } from '../utils/mongodb-stream.js';
import { saveToFileSchemaFragment } from '../utils/save-to-file-schema.js';
import { findDangerousStage } from '../utils/aggregation-safety.js';

const aggregateSchema = z.object({
  database: z.string().describe('Database name'),
  collection: z.string().describe('Collection name'),
  pipeline: z.array(z.record(z.unknown())).describe('An array of aggregation stages to execute'),
  noLimit: z.boolean().optional().describe('Disable the automatic $limit stage appended to the pipeline. Useful for pipelines ending with $out or $merge.'),
  ...saveToFileSchemaFragment,
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
          const dangerous = findDangerousStage(pipeline);

          if (dangerous) {
            return toolError(new Error(`Aggregation stage '${dangerous}' is not allowed in read-only mode`));
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
          // Add $limit stage to the pipeline to limit results (unless noLimit is set)
          const effectivePipeline = params.noLimit ? pipeline : [...pipeline, { $limit: maxDocs }];
          const cursor = collection.aggregate(effectivePipeline);
          const documents = await cursor.toArray();
          const result = {
            database,
            collection: collectionName,
            results: documents,
            count: documents.length,
            hasMoreResults: !params.noLimit && documents.length >= maxDocs, // Indicate if there were more results that were limited
          };

          return toolSuccess(result);
        }
      } catch (error) {
        return toolError(error);
      }
    },
  );
}
