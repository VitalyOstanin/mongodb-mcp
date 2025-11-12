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

const listCollectionsSchema = z.object({
  database: z.string().describe('Database name to list collections from'),
});

export type ListCollectionsParams = z.infer<typeof listCollectionsSchema>;

export const listCollectionsTool: Tool = {
  name: 'list-collections',
  description: 'List all collections in a specific database',
  inputSchema: listCollectionsSchema,
  examples: [
    {
      input: { database: 'testdb' },
      output: {
        database: 'testdb',
        collections: ['users', 'products', 'orders'],
        total: 3,
      },
      description: 'List all collections in the testdb database',
    },
  ],
  async implementation(params: ListCollectionsParams) {
    const mongoClient = MongoDBClient.getInstance();

    if (!mongoClient.isConnectedToMongoDB()) {
      throw new Error('Not connected to MongoDB. Please connect first.');
    }

    try {
      const db = mongoClient.getDatabase(params.database);
      const collections = await db.listCollections().toArray();
      const response = {
        database: params.database,
        // MongoDB collection objects can have dynamic structure
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        collections: collections.map((collection: any) => collection.name),
        total: collections.length,
      };

      return toolSuccess(response);
    } catch (error) {
      return toolError(error);
    }
  },
};

// Export the registration function for the server
// The _client parameter is required to match the registration function signature used by other tools
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function registerListCollectionsTool(server: McpServer, _client: MongoDBClient) {
  server.registerTool(
    listCollectionsTool.name,
    {
      description: listCollectionsTool.description,
      inputSchema: listCollectionsSchema.shape,
    },
    listCollectionsTool.implementation,
  );
}
