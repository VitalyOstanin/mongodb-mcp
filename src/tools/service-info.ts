import { z } from 'zod';
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { MongoDBClient } from '../mongodb-client.js';
import { toolSuccess } from '../utils/tool-response.js';
import { VERSION } from '../version.js';
import { getTimezone } from '../utils/date.js';

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

const serviceInfoSchema = z.object({
});

export type ServiceInfoParams = z.infer<typeof serviceInfoSchema>;

export const serviceInfoTool: Tool = {
  name: 'service_info',
  description: 'Get MongoDB service information and current connection status',
  inputSchema: serviceInfoSchema,
  examples: [
    {
      input: {},
      output: {
        name: 'mongodb-mcp',
        isConnected: true,
        hasConnectionString: true,
        readonly: false,
        version: '1.0.0',
        timezone: 'Europe/Moscow',
      },
      description: 'Get MongoDB service information and environment configuration',
    },
  ],
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async implementation (_params: ServiceInfoParams) {
    const mongoClient = MongoDBClient.getInstance();
    const connectionInfo = mongoClient.getConnectionInfo();
    const response = {
      name: 'mongodb-mcp',
      isConnected: connectionInfo.isConnected,
      hasConnectionString: connectionInfo.hasConnectionString,
      readonly: mongoClient.isReadonly(),
      version: VERSION,
      timezone: getTimezone(),
    };

    return toolSuccess(response);
  },
};

// Export the registration function for the server
// The _client parameter is required to match the registration function signature used by other tools
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function registerServiceInfoTool(server: McpServer, _client: MongoDBClient) {
  server.registerTool(
    serviceInfoTool.name,
    {
      description: serviceInfoTool.description,
      inputSchema: serviceInfoSchema.shape,
    },
    serviceInfoTool.implementation,
  );
}
