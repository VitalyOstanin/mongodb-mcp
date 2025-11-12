import { z } from 'zod';
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { MongoDBClient } from '../mongodb-client.js';
import { toolSuccess } from '../utils/tool-response.js';
import { VERSION } from '../version.js';
import { getTimezone } from '../utils/date.js';

const serviceInfoSchema = z.object({
});

export type ServiceInfoParams = z.infer<typeof serviceInfoSchema>;

// Export the registration function for the server
// The client parameter is required to match the registration function signature used by other tools
export function registerServiceInfoTool(server: McpServer, client: MongoDBClient) {
  server.registerTool(
    'service_info',
    {
      title: 'Service Information',
      description: 'Get MongoDB service information and current connection status',
      inputSchema: serviceInfoSchema.shape,
      annotations: {
        readOnlyHint: true,
      },
    },
    async () => {
      const connectionInfo = client.getConnectionInfo();
      const response = {
        name: 'mongodb-mcp',
        isConnected: connectionInfo.isConnected,
        hasConnectionString: connectionInfo.hasConnectionString,
        readonly: client.isReadonly(),
        version: VERSION,
        timezone: getTimezone(),
      };

      return toolSuccess(response);
    },
  );
}
