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

const dbStatsSchema = z.object({
  database: z.string().describe('Database name to get stats for'),
});

export type DbStatsParams = z.infer<typeof dbStatsSchema>;

export const dbStatsTool: Tool = {
  name: 'db-stats',
  description: 'Get statistics for a specific database',
  inputSchema: dbStatsSchema,
  examples: [
    {
      input: { database: 'testdb' },
      output: {
        database: 'testdb',
        stats: {
          db: 'testdb',
          collections: 3,
          objects: 150,
          avgObjSize: 543,
          dataSize: 81450,
          storageSize: 122880,
          numExtents: 3,
          indexes: 4,
          indexSize: 131072,
          ok: 1,
        },
      },
      description: 'Get statistics for the testdb database',
    },
  ],
  async implementation(params: DbStatsParams) {
    const mongoClient = MongoDBClient.getInstance();

    if (!mongoClient.isConnectedToMongoDB()) {
      throw new Error('Not connected to MongoDB. Please connect first.');
    }

    try {
      const db = mongoClient.getDatabase(params.database);
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
};

// Export the registration function for the server
// The _client parameter is required to match the registration function signature used by other tools
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function registerDbStatsTool(server: McpServer, _client: MongoDBClient) {
  server.registerTool(
    dbStatsTool.name,
    {
      description: dbStatsTool.description,
      inputSchema: dbStatsSchema.shape,
    },
    dbStatsTool.implementation,
  );
}
