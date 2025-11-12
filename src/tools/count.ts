import { z } from 'zod';
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { MongoDBClient } from "../mongodb-client.js";
import { toolSuccess, toolError } from "../utils/tool-response.js";
import { processWithFileStorage } from "../utils/file-storage.js";

const countSchema = z.object({
  database: z.string().describe("Database name"),
  collection: z.string().describe("Collection name"),
  query: z
    .record(z.unknown())
    .optional()
    .default({})
    .describe(
      "A filter/query parameter. Allows users to filter the documents to count. Matches the syntax of the filter argument of db.collection.count().",
    ),
  saveToFile: z
    .boolean()
    .optional()
    .describe(
      "Save results to a file instead of returning them directly. Useful for large datasets that can be analyzed by scripts.",
    ),
  filePath: z
    .string()
    .optional()
    .describe(
      "Explicit path to save the file (optional, auto-generated if not provided). Directory will be created if it doesnt exist.",
    ),
});

export type CountParams = z.infer<typeof countSchema>;

// Export the registration function for the server
// The client parameter is required to match the registration function signature used by other tools
export function registerCountTool(server: McpServer, client: MongoDBClient) {
  server.registerTool(
    'count',
    {
      title: 'Count Documents',
      description: 'Gets the number of documents in a MongoDB collection using db.collection.count() and query as an optional filter parameter',
      inputSchema: countSchema.shape,
      annotations: {
        readOnlyHint: true,
      },
    },
    async (params: CountParams) => {
      if (!client.isConnectedToMongoDB()) {
        throw new Error('Not connected to MongoDB. Please connect first.');
      }

      try {
        const db = client.getDatabase(params.database);
        const collection = db.collection(params.collection);
        // Count documents matching the query (with default empty object if query is undefined)
        const { query = {} } = params;
        const count = await collection.countDocuments(query);
        const result = {
          database: params.database,
          collection: params.collection,
          query,
          count,
        };
        const processedResult = processWithFileStorage(result, params.saveToFile, params.filePath);
        const { savedToFile, filePath, data } = processedResult;

        if (savedToFile) {
          return toolSuccess({
            savedToFile: true,
            filePath,
            database: params.database,
            collection: params.collection,
            count,
          });
        }

        return toolSuccess(data);
      } catch (error) {
        return toolError(error);
      }
    },
  );
}
