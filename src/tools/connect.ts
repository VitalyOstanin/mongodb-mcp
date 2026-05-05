import { z } from 'zod';
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { MongoDBClient } from '../mongodb-client.js';
import { toolSuccess, toolError } from '../utils/tool-response.js';

const connectSchema = z.object({});

export type ConnectParams = z.infer<typeof connectSchema>;

// The _client parameter is required to match the registration function signature used by server.ts.
// connect resolves the client via the singleton because it is the entry point that creates it.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function registerConnectTool(server: McpServer, _client: MongoDBClient) {
  server.registerTool(
    'connect',
    {
      title: 'Connect to MongoDB',
      description: 'Establish connection to MongoDB using connection string from environment variable MONGODB_MCP_CONNECTION_STRING. Call service-info first to check current connection status.',
      inputSchema: connectSchema.shape,
    },
    async (_params: ConnectParams) => {
      const mongoClient = MongoDBClient.getInstance();

      try {
        const connectionString = process.env.MONGODB_MCP_CONNECTION_STRING;

        if (!connectionString) {
          return toolError(new Error('Connection string is required. Please set MONGODB_MCP_CONNECTION_STRING environment variable.'));
        }

        const currentConnectionInfo = mongoClient.getConnectionInfo();

        if (currentConnectionInfo.isConnected && mongoClient.getConnectionString() === connectionString) {
          return toolSuccess({
            success: true,
            message: 'Already connected to MongoDB with the same connection string',
            isConnected: true,
          });
        }

        await mongoClient.connect();

        return toolSuccess({
          success: true,
          message: 'Connected to MongoDB successfully using MONGODB_MCP_CONNECTION_STRING environment variable',
          isConnected: true,
        });
      } catch (error) {
        return toolError(error);
      }
    },
  );
}
