import { z } from 'zod';
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { MongoDBClient } from '../mongodb-client.js';
import { toolSuccess, toolError } from '../utils/tool-response.js';

const dbStatsSchema = z.object({
  database: z.string().describe('Database name to get stats for'),
});

export type DbStatsParams = z.infer<typeof dbStatsSchema>;

// Export the registration function for the server
// The client parameter is required to match the registration function signature used by other tools
export function registerDbStatsTool(server: McpServer, client: MongoDBClient) {
  server.registerTool(
    'db-stats',
    {
      title: 'Database Statistics',
      description: 'Get statistics for a specific database',
      inputSchema: dbStatsSchema.shape,
      annotations: {
        readOnlyHint: true,
      },
    },
    async (params: DbStatsParams) => {
      if (!client.isConnectedToMongoDB()) {
        return toolError(new Error('Not connected to MongoDB. Please connect first.'));
      }

      try {
        const db = client.getDatabase(params.database);
        const stats = await db.stats();
        const response = {
          database: params.database,
          stats,
        };

        return toolSuccess(response);
      } catch (error) {
        return toolError(error);
      }
    },
  );
}
