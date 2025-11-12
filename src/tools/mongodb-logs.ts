import { z } from 'zod';
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { MongoDBClient } from '../mongodb-client.js';
import { toolSuccess, toolError } from '../utils/tool-response.js';
import { writeFileSync, mkdirSync } from 'fs';
import { dirname } from 'path';
import { generateTempFilePath } from '../utils/streaming.js';

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

const mongodbLogsSchema = z.object({
  limit: z.number().optional().default(50).describe('The maximum number of log entries to return.'),
  type: z.enum(['global', 'startupWarnings']).optional().default('global')
    .describe('The type of logs to return. Global returns all recent log entries, while startupWarnings returns only warnings and errors from when the process started.'),
  saveToFile: z.boolean().optional().describe('Save results to a file instead of returning them directly. Useful for large datasets that can be analyzed by scripts.'),
  filePath: z.string().optional().describe('Explicit path to save the file (optional, auto-generated if not provided). Directory will be created if it doesn\'t exist.'),
});

export type MongodbLogsParams = z.infer<typeof mongodbLogsSchema>;

export const mongodbLogsTool: Tool = {
  name: 'mongodb-logs',
  description: 'Returns the most recent logged mongod events',
  inputSchema: mongodbLogsSchema,
  examples: [
    {
      input: { limit: 10, type: 'global' },
      output: {
        logs: ['2022-01-01T00:00:00.000Z I NETWORK  [conn1] end connection 127.0.0.1:54321'],
        total: 1,
        limit: 10,
        type: 'global',
      },
      description: 'Get the most recent 10 global log entries',
    },
    {
      input: { type: 'startupWarnings' },
      output: {
        logs: [],
        total: 0,
        limit: 50,
        type: 'startupWarnings',
      },
      description: 'Get any startup warnings from the MongoDB server',
    },
  ],
  async implementation(params: MongodbLogsParams) {
    const mongoClient = MongoDBClient.getInstance();

    if (!mongoClient.isConnectedToMongoDB()) {
      throw new Error('Not connected to MongoDB. Please connect first.');
    }

    try {
      const db = mongoClient.getClient().db('admin'); // Admin database is used for admin commands
      // Use the database to run the getLog command
      const result = await db.admin().command({
        getLog: params.type,
        n: params.limit,
      });
      // The result should contain log entries
      const logs = result.log ?? [];
      // Format the logs to ensure they are properly structured
      const resultData = {
        logs,
        total: logs.length,
        limit: params.limit,
        type: params.type,
      };

      if (params.saveToFile) {
        const filePath = params.filePath ?? generateTempFilePath();
        // Ensure directory exists
        const dir = dirname(filePath);

        mkdirSync(dir, { recursive: true });

        // Write response to file
        writeFileSync(filePath, JSON.stringify(resultData, null, 2), 'utf8');

        return toolSuccess({
          savedToFile: true,
          filePath,
          total: logs.length,
          limit: params.limit,
          type: params.type,
        });
      }

      return toolSuccess(resultData);
    } catch (error) {
      return toolError(error);
    }
  },
};

// Export the registration function for the server
// The _client parameter is required to match the registration function signature used by other tools
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function registerMongodbLogsTool(server: McpServer, _client: MongoDBClient) {
  server.registerTool(
    mongodbLogsTool.name,
    {
      description: mongodbLogsTool.description,
      inputSchema: mongodbLogsSchema.shape,
    },
    mongodbLogsTool.implementation,
  );
}
