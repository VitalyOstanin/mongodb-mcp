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

const collectionIndexesSchema = z.object({
  database: z.string().describe('Database name'),
  collection: z.string().describe('Collection name'),
});

export type CollectionIndexesParams = z.infer<typeof collectionIndexesSchema>;

export const collectionIndexesTool: Tool = {
  name: 'collection-indexes',
  description: 'Describe the indexes for a collection',
  inputSchema: collectionIndexesSchema,
  examples: [
    {
      input: { database: 'testdb', collection: 'users' },
      output: {
        database: 'testdb',
        collection: 'users',
        indexes: [
          {
            v: 2,
            key: { _id: 1 },
            name: '_id_',
          },
          {
            v: 2,
            key: { email: 1 },
            name: 'email_1',
            unique: true,
          },
        ],
        total: 2,
      },
      description: 'Get index information for the users collection in testdb database',
    },
  ],
  async implementation(params: CollectionIndexesParams) {
    const mongoClient = MongoDBClient.getInstance();

    if (!mongoClient.isConnectedToMongoDB()) {
      throw new Error('Not connected to MongoDB. Please connect first.');
    }

    try {
      const db = mongoClient.getDatabase(params.database);
      const collection = db.collection(params.collection);
      // Get index information
      const indexes = await collection.indexes();
      const response = {
        database: params.database,
        collection: params.collection,
        indexes,
        total: indexes.length,
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
export function registerCollectionIndexesTool(server: McpServer, _client: MongoDBClient) {
  server.registerTool(
    collectionIndexesTool.name,
    {
      description: collectionIndexesTool.description,
      inputSchema: collectionIndexesSchema.shape,
    },
    collectionIndexesTool.implementation,
  );
}
