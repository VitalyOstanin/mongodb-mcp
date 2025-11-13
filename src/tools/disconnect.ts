import { z } from 'zod';
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { MongoDBClient } from '../mongodb-client.js';
import { toolSuccess, toolError } from '../utils/tool-response.js';

const disconnectSchema = z.object({
});

export type DisconnectParams = z.infer<typeof disconnectSchema>;

// Export the registration function for the server
// The client parameter is required to match the registration function signature used by other tools
export function registerDisconnectTool(server: McpServer, client: MongoDBClient) {
  server.registerTool(
    'disconnect',
    {
      title: 'Disconnect from MongoDB',
      description: 'Disconnect from MongoDB and clear the connection. Use service_info to check connection status after disconnecting.',
      inputSchema: disconnectSchema.shape,
      // No readOnlyHint since this tool changes state by disconnecting
    },
    // Parameters are required by the tool interface but not used since disconnect doesn't need input parameters
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    async (_params: DisconnectParams) => {
      try {
        // Check if we're already disconnected
        const currentConnectionInfo = client.getConnectionInfo();

        if (!currentConnectionInfo.isConnected) {
          const response = {
            success: true,
            message: 'Already disconnected from MongoDB',
            isConnected: false,
            disconnectReason: currentConnectionInfo.disconnectReason ?? 'not connected',
          };

          return toolSuccess(response);
        }

        // Disconnect with a reason
        await client.disconnect('normal disconnect');

        const response = {
          success: true,
          message: 'Disconnected from MongoDB successfully',
          isConnected: false,
          disconnectReason: 'normal disconnect',
        };

        return toolSuccess(response);
      } catch (error) {
        return toolError(error);
      }
    },
  );
}
