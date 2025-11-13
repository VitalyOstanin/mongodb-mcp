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
      const baseResponse = {
        name: 'mongodb-mcp',
        isConnected: connectionInfo.isConnected,
        readonly: client.isReadonly(),
        version: VERSION,
        timezone: getTimezone(),
      };
      // Create extended response based on connection status
      let finalResponse;

      if (!connectionInfo.isConnected) {
        finalResponse = {
          ...baseResponse,
          ...(connectionInfo.disconnectReason && { disconnectReason: connectionInfo.disconnectReason }),
          ...(connectionInfo.connectionError && { connectionError: connectionInfo.connectionError }),
        };
      } else {
        finalResponse = baseResponse;
      }

      return toolSuccess(finalResponse);
    },
  );
}
