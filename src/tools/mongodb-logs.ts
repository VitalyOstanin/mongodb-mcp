import { z } from 'zod';
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { MongoDBClient } from '../mongodb-client.js';
import { toolSuccess, toolError } from '../utils/tool-response.js';
import { writeFile } from 'fs/promises';
import { prepareExportPath } from '../utils/streaming.js';
import { saveToFileSchemaFragment } from '../utils/save-to-file-schema.js';

const { saveToFile: saveToFileFragment, filePath: filePathFragment } = saveToFileSchemaFragment;

const mongodbLogsSchema = z.object({
  limit: z.number().optional().default(50).describe('The maximum number of log entries to return.'),
  type: z.enum(['global', 'startupWarnings']).optional().default('global')
    .describe('The type of logs to return. Global returns all recent log entries, while startupWarnings returns only warnings and errors from when the process started.'),
  saveToFile: saveToFileFragment,
  filePath: filePathFragment,
});

export type MongodbLogsParams = z.infer<typeof mongodbLogsSchema>;

// Export the registration function for the server
// The client parameter is required to match the registration function signature used by other tools
export function registerMongodbLogsTool(server: McpServer, client: MongoDBClient) {
  server.registerTool(
    'mongodb-logs',
    {
      title: 'MongoDB Logs',
      description: 'Returns the most recent logged mongod events',
      inputSchema: mongodbLogsSchema.shape,
      annotations: {
        readOnlyHint: true,
      },
    },
    async (params: MongodbLogsParams) => {
      if (!client.isConnectedToMongoDB()) {
        return toolError(new Error('Not connected to MongoDB. Please connect first.'));
      }

      try {
        const db = client.getClient().db('admin'); // Admin database is used for admin commands
        // Use the database to run the getLog command with defaults
        const { type = 'global', limit = 50 } = params;
        const result = await db.admin().command({
          getLog: type,
          n: limit,
        });
        // The result should contain log entries
        const logs = result.log ?? [];
        // Format the logs to ensure they are properly structured
        const resultData = {
          logs,
          total: logs.length,
          limit,
          type,
        };

        if (params.saveToFile) {
          const filePath = await prepareExportPath(params.filePath);

          await writeFile(filePath, JSON.stringify(resultData, null, 2), { encoding: 'utf8', flag: 'wx' });

          return toolSuccess({
            savedToFile: true,
            filePath,
            total: logs.length,
            limit,
            type,
          });
        }

        return toolSuccess(resultData);
      } catch (error) {
        return toolError(error);
      }
    },
  );
}
