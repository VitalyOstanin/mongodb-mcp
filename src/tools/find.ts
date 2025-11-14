import { z } from 'zod';
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { MongoDBClient } from '../mongodb-client.js';
import { toolSuccess, toolError } from '../utils/tool-response.js';
import { mkdir } from 'fs/promises';
import { dirname } from 'path';
import { generateTempFilePath } from '../utils/streaming.js';
import { streamMongoCursorToFile, streamMongoCursorToFileAsArray } from '../utils/mongodb-stream.js';

const findSchema = z.object({
  database: z.string().describe('Database name'),
  collection: z.string().describe('Collection name'),
  filter: z.record(z.unknown()).optional().default({}).describe('The query filter, matching the syntax of the query argument of db.collection.find()'),
  limit: z.number().optional().describe('The maximum number of documents to return'),
  projection: z.record(z.unknown()).optional().describe('The projection, matching the syntax of projection argument of db.collection.find()'),
  sort: z.record(z.unknown()).optional().describe('A document, describing the sort order, matching the syntax of sort argument of cursor.sort()'),
  saveToFile: z.boolean().optional().describe('Save results to a file instead of returning them directly. Useful for large datasets that can be analyzed by scripts.'),
  filePath: z.string().optional().describe('Explicit path to save the file (optional, auto-generated if not provided). Directory will be created if it doesn\'t exist.'),
  format: z.enum(['jsonl', 'json']).optional().default('jsonl').describe('Output format when saving to file: jsonl (JSON Lines) or json (JSON array format)'),
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
      const { database, collection: collectionName, filter, limit, projection, sort, saveToFile } = params;

      if (!client.isConnectedToMongoDB()) {
        return toolError(new Error('Not connected to MongoDB. Please connect first.'));
      }

      try {
        const db = client.getDatabase(database);
        const collection = db.collection(collectionName);

        if (saveToFile) {
          // For saving to file, create the query with filters, projection and sort
          let query = collection.find(filter);

          // Only apply limit if explicitly provided (do not use default limit when saving to file)
          if (limit !== undefined) {
            query = query.limit(limit);
          }

          // Apply projection if specified
          if (projection) {
            query = query.project(projection);
          }

          // Apply sort if specified
          if (sort) {
            // MongoDB sort parameter can have dynamic structure
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            query = query.sort(sort as any);
          }

          // Stream the results directly to file without accumulating in memory
          const { filePath = generateTempFilePath(), format = 'jsonl' } = params;
          // Ensure directory exists
          const dir = dirname(filePath);

          await mkdir(dir, { recursive: true });

          // Choose streaming function based on format parameter and get the count of processed documents
          let processedCount: number;

          if (format === 'json') {
            processedCount = await streamMongoCursorToFileAsArray(query, filePath);
          } else {
            // Default to jsonl format
            processedCount = await streamMongoCursorToFile(query, filePath);
          }

          return toolSuccess({
            savedToFile: true,
            filePath,
            database,
            collection: collectionName,
            format,
            processedCount,
            message: `Documents exported successfully. ${processedCount} documents were written to the file.`,
          });
        } else {
          // For in-memory results (when not saving to file), use a default limit of 10 and cap at 1000 to prevent memory issues
          let query = collection.find(filter);
          // Apply default limit of 10 when not provided, but cap at 1000 to prevent memory issues
          const effectiveLimit = Math.min(limit ?? 10, 1000);

          query = query.limit(effectiveLimit);

          // Apply projection if specified
          if (projection) {
            query = query.project(projection);
          }

          // Apply sort if specified
          if (sort) {
            // MongoDB sort parameter can have dynamic structure
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            query = query.sort(sort as any);
          }

          // Execute the query
          const documents = await query.toArray();
          const result = {
            database,
            collection: collectionName,
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
