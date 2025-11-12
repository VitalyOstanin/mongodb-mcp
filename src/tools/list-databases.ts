import { z } from 'zod';
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { MongoDBClient } from '../mongodb-client.js';
import { toolSuccess, toolError } from '../utils/tool-response.js';

type ListDatabasesResult = { databases: Array<{ name: string; sizeOnDisk?: number; empty?: boolean }> } | Array<{ name: string; sizeOnDisk?: number; empty?: boolean }>;

const listDatabasesSchema = z.object({
});

export type ListDatabasesParams = z.infer<typeof listDatabasesSchema>;

// Export the registration function for the server
// The client parameter is required to match the registration function signature used by other tools
export function registerListDatabasesTool(server: McpServer, client: MongoDBClient) {
  server.registerTool(
    'list-databases',
    {
      title: 'List Databases',
      description: 'List all databases in the MongoDB instance',
      inputSchema: listDatabasesSchema.shape,
      annotations: {
        readOnlyHint: true,
      },
    },
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    async (_params: ListDatabasesParams) => {
      if (!client.isConnectedToMongoDB()) {
        return toolError(new Error('Not connected to MongoDB. Please connect first.'));
      }

      try {
        const clientMongo = client.getClient();
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
  );
}
