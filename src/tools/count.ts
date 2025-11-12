import { z } from 'zod';
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { MongoDBClient } from "../mongodb-client.js";
import { toolSuccess, toolError } from "../utils/tool-response.js";
import { processWithFileStorage } from "../utils/file-storage.js";

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

export const countTool: Tool = {
  name: "count",
  description:
    "Gets the number of documents in a MongoDB collection using db.collection.count() and query as an optional filter parameter",
  inputSchema: countSchema,
  examples: [
    {
      input: {
        database: "testdb",
        collection: "users",
        query: { age: { $gte: 18 } },
      },
      output: {
        database: "testdb",
        collection: "users",
        query: { age: { $gte: 18 } },
        count: 42,
      },
      description: "Count users in testdb where age is greater than or equal to 18",
    },
  ],
  async implementation(params: CountParams) {
    const mongoClient = MongoDBClient.getInstance();

    if (!mongoClient.isConnectedToMongoDB()) {
      throw new Error("Not connected to MongoDB. Please connect first.");
    }

    try {
      const db = mongoClient.getDatabase(params.database);
      const collection = db.collection(params.collection);
      // Count documents matching the query
      const count = await collection.countDocuments(params.query);
      const result = {
        database: params.database,
        collection: params.collection,
        query: params.query,
        count,
      };
      const processedResult = processWithFileStorage(result, params.saveToFile, params.filePath);

      if (processedResult.savedToFile) {
        return toolSuccess({
          savedToFile: true,
          filePath: processedResult.filePath,
          database: params.database,
          collection: params.collection,
          count,
        });
      }

      return toolSuccess(processedResult.data);
    } catch (error) {
      return toolError(error);
    }
  },
};

// Export the registration function for the server
// The _client parameter is required to match the registration function signature used by other tools
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function registerCountTool(server: McpServer, _client: MongoDBClient) {
  server.registerTool(
    countTool.name,
    {
      description: countTool.description,
      inputSchema: countSchema.shape,
    },
    countTool.implementation,
  );
}
