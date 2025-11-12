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

const connectSchema = z.object({
  connectionString: z.string().optional(),
});

export type ConnectParams = z.infer<typeof connectSchema>;

export const connectTool: Tool = {
  name: 'connect',
  description: 'Establish connection to MongoDB using connection string. IMPORTANT: Call service_info first to check current connection status. If service_info shows hasConnectionString=true, you can call connect() without parameters to use the available connection string.',
  inputSchema: connectSchema,
  examples: [
    {
      input: {
        connectionString: 'mongodb://localhost:27017',
      },
      output: {
        success: true,
        message: 'Connected to MongoDB successfully',
        isConnected: true,
      },
      description: 'Connect to MongoDB using provided connection string',
    },
    {
      input: {},
      output: {
        success: true,
        message: 'Connected to MongoDB successfully using MONGODB_CONNECTION_STRING environment variable',
        isConnected: true,
      },
      description: 'Connect to MongoDB using connection string from environment variable',
    },
  ],
  async implementation(params: ConnectParams) {
    const mongoClient = MongoDBClient.getInstance();

    try {
      // Get the connection string that will be used (provided or from env)
      const connectionString = params.connectionString ?? process.env.MONGODB_CONNECTION_STRING;

      if (!connectionString) {
        throw new Error('Connection string is required. Either pass it as a parameter or set MONGODB_CONNECTION_STRING environment variable.');
      }

      // Check if we're already connected to the same connection string
      const currentConnectionInfo = mongoClient.getConnectionInfo();

      if (currentConnectionInfo.isConnected && mongoClient.getConnectionString() === connectionString) {
        const response = {
          success: true,
          message: 'Already connected to MongoDB with the same connection string',
          isConnected: true,
        };

        return toolSuccess(response);
      }

      // If connection string is different or we're not connected, connect
      await mongoClient.connect(params.connectionString);

      const response = {
        success: true,
        message: params.connectionString
          ? 'Connected to MongoDB successfully'
          : 'Connected to MongoDB successfully using MONGODB_CONNECTION_STRING environment variable',
        isConnected: true,
      };

      return toolSuccess(response);
    } catch (error) {
      return toolError(error);
    }
  },
};

// Export the registration function for the server
// The _client parameter is required to match the registration function signature used by server.ts
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function registerConnectTool(server: McpServer, _client: MongoDBClient) {
  server.registerTool(
    connectTool.name,
    {
      description: connectTool.description,
      inputSchema: connectSchema.shape,
    },
    connectTool.implementation,
  );
}
