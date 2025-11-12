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

export const findTool: Tool = {
  name: 'find',
  description: 'Run a find query against a MongoDB collection',
  inputSchema: findSchema,
  examples: [
    {
      input: {
        database: 'testdb',
        collection: 'users',
        filter: { age: { $gte: 18 } },
        limit: 5,
        projection: { name: 1, email: 1, _id: 0 },
      },
      output: {
        database: 'testdb',
        collection: 'users',
        documents: [
          { name: 'John Doe', email: 'john@example.com' },
          { name: 'Jane Smith', email: 'jane@example.com' },
        ],
        count: 2,
        limit: 5,
      },
      description: 'Find users in testdb where age is greater than or equal to 18, with limited fields',
    },
  ],
  async implementation(params: FindParams) {
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
        // Add a default limit to prevent memory issues if no limit is specified
        let query = collection.find(params.filter);
        // Apply limit, using the zod default and capping at 1000 to prevent memory issues
        const effectiveLimit = Math.min(params.limit, 1000); // Use the zod default and respect the maximum limit

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
};

// Export the registration function for the server
// The _client parameter is required to match the registration function signature used by other tools
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function registerFindTool(server: McpServer, _client: MongoDBClient) {
  server.registerTool(
    findTool.name,
    {
      description: findTool.description,
      inputSchema: findSchema.shape,
    },
    findTool.implementation,
  );
}
