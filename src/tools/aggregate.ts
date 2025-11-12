import { z } from 'zod';
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { MongoDBClient } from '../mongodb-client.js';
import { toolSuccess, toolError } from '../utils/tool-response.js';

// Define the Tool type
interface Tool {
  name: string;
  description: string;
  inputSchema: object;
  // Examples can contain any structure based on the tool's requirements
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  examples?: any[];
  // Tool implementation params are dynamic based on the specific tool schema
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  implementation: (_params: any) => Promise<any>;
}

const aggregateSchema = z.object({
  database: z.string().describe('Database name'),
  collection: z.string().describe('Collection name'),
  pipeline: z.array(z.record(z.unknown())).describe('An array of aggregation stages to execute'),
  saveToFile: z.boolean().optional().describe('Save results to a file instead of returning them directly. Useful for large datasets that can be analyzed by scripts.'),
  filePath: z.string().optional().describe('Explicit path to save the file (optional, auto-generated if not provided). Directory will be created if it doesn\'t exist.'),
});

export type AggregateParams = z.infer<typeof aggregateSchema>;

export const aggregateTool: Tool = {
  name: 'aggregate',
  description: 'Run an aggregation against a MongoDB collection',
  inputSchema: aggregateSchema,
  examples: [
    {
      input: {
        database: 'testdb',
        collection: 'users',
        pipeline: [
          { $match: { age: { $gte: 18 } } },
          { $group: { _id: "$status", count: { $sum: 1 } } },
        ],
      },
      output: {
        database: 'testdb',
        collection: 'users',
        results: [
          { _id: 'active', count: 25 },
          { _id: 'inactive', count: 5 },
        ],
        count: 2,
        hasMoreResults: false,
      },
      description: 'Aggregate users by status in testdb for users with age greater than or equal to 18',
    },
  ],
  async implementation(params: AggregateParams) {
    const mongoClient = MongoDBClient.getInstance();

    if (!mongoClient.isConnectedToMongoDB()) {
      throw new Error('Not connected to MongoDB. Please connect first.');
    }

    try {
      const db = mongoClient.getDatabase(params.database);
      const collection = db.collection(params.collection);

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
};

// Export the registration function for the server
// The _client parameter is required to match the registration function signature used by other tools
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function registerAggregateTool(server: McpServer, _client: MongoDBClient) {
  server.registerTool(
    aggregateTool.name,
    {
      description: aggregateTool.description,
      inputSchema: aggregateSchema.shape,
    },
    aggregateTool.implementation,
  );
}
