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

type ListDatabasesResult = { databases: Array<{ name: string; sizeOnDisk?: number; empty?: boolean }> } | Array<{ name: string; sizeOnDisk?: number; empty?: boolean }>;

const listDatabasesSchema = z.object({
});

export type ListDatabasesParams = z.infer<typeof listDatabasesSchema>;

export const listDatabasesTool: Tool = {
  name: 'list-databases',
  description: 'List all databases in the MongoDB instance',
  inputSchema: listDatabasesSchema,
  examples: [
    {
      input: {},
      output: {
        databases: [
          { name: 'admin', sizeOnDisk: 4096, empty: false },
          { name: 'local', sizeOnDisk: 4096, empty: false },
          { name: 'testdb', sizeOnDisk: 8192, empty: false },
        ],
        total: 3,
      },
      description: 'List all databases in the MongoDB instance',
    },
  ],
  // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars
  async implementation(_params: ListDatabasesParams): Promise<any> {
    const mongoClient = MongoDBClient.getInstance();

    if (!mongoClient.isConnectedToMongoDB()) {
      throw new Error('Not connected to MongoDB. Please connect first.');
    }

    try {
      const clientMongo = mongoClient.getClient();
      // List databases using the admin() method on a database instance
      const result: ListDatabasesResult = await clientMongo.db().admin().listDatabases();
      // The result structure varies between MongoDB driver versions
      // It might be an object with a 'databases' property or just the array directly
      // Result structure varies dynamically, so we need to use 'any'
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const databasesArray = (result as any).databases ?? result;
      const response = {
        databases: Array.isArray(databasesArray) ? databasesArray : databasesArray.databases ?? [],
        total: Array.isArray(databasesArray) ? databasesArray.length : databasesArray.databases?.length ?? 0,
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
export function registerListDatabasesTool(server: McpServer, _client: MongoDBClient) {
  server.registerTool(
    listDatabasesTool.name,
    {
      description: listDatabasesTool.description,
      inputSchema: listDatabasesSchema.shape,
    },
    listDatabasesTool.implementation,
  );
}
