import { z } from 'zod';
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { MongoDBClient } from '../mongodb-client.js';
import { toolSuccess, toolError } from '../utils/tool-response.js';
import { writeFileSync, mkdirSync } from 'fs';
import { dirname } from 'path';
import { generateTempFilePath } from '../utils/streaming.js';

const explainSchema = z.object({
  database: z.string().describe('Database name'),
  collection: z.string().describe('Collection name'),
  method: z.object({
    name: z.enum(['find', 'count', 'aggregate']).describe('The method name to run explain on'),
    arguments: z.record(z.unknown()).describe('Arguments for the method'),
  }).describe('The method and its arguments to run'),
  verbosity: z.enum(['queryPlanner', 'queryPlannerExtended', 'executionStats', 'allPlansExecution']).optional().default('queryPlanner')
    .describe('The verbosity of the explain plan, defaults to queryPlanner. If the user wants to know how fast is a query in execution time, use executionStats.'),
  saveToFile: z.boolean().optional().describe('Save results to a file instead of returning them directly. Useful for large datasets that can be analyzed by scripts.'),
  filePath: z.string().optional().describe('Explicit path to save the file (optional, auto-generated if not provided). Directory will be created if it does not exist.'),
});

export type ExplainParams = z.infer<typeof explainSchema>;

// Export the registration function for the server
// The client parameter is required to match the registration function signature used by other tools
export function registerExplainTool(server: McpServer, client: MongoDBClient) {
  server.registerTool(
    'explain',
    {
      title: 'Explain Query Execution Plan',
      description: 'Returns statistics describing the execution of the winning plan chosen by the query optimizer for the evaluated method',
      inputSchema: explainSchema.shape,
      annotations: {
        readOnlyHint: true,
      },
    },
    async (params: ExplainParams) => {
      if (!client.isConnectedToMongoDB()) {
        return toolError(new Error('Not connected to MongoDB. Please connect first.'));
      }

      try {
        const db = client.getDatabase(params.database);
        const collection = db.collection(params.collection);
        // Prepare the explain command based on the method
        let explainResult;
        // Ensure verbosity has a default value if not provided
        const { verbosity = 'queryPlanner' } = params;

        switch (params.method.name) {
          case 'find': {
            const args = params.method.arguments;
            // MongoDB operation arguments can have dynamic structures based on the operation
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const filter = (args.filter as any) ?? {};
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const projection = args.projection as any;
            const limit = args.limit as number | undefined;
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const sort = args.sort as any;
            let query = collection.find(filter);

            if (projection) {
              query = query.project(projection);
            }

            if (limit) {
              query = query.limit(limit);
            }

            if (sort) {
              query = query.sort(sort);
            }

            explainResult = await query.explain(verbosity);
            break;
          }

          case 'count': {
            const args = params.method.arguments;
            // MongoDB query argument can have dynamic structure
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const query = (args.query as any) ?? {};

            explainResult = await collection.find(query).explain(verbosity);
            break;
          }

          case 'aggregate': {
            const args = params.method.arguments;
            const pipeline = Array.isArray(args.pipeline) ? args.pipeline : [];

            explainResult = await collection.aggregate(pipeline).explain(verbosity);
            break;
          }

          default:
            return toolError(new Error(`Unsupported method for explain: ${params.method.name}`));
        }

        if (params.saveToFile) {
          const filePath = params.filePath ?? generateTempFilePath();
          // Ensure directory exists
          const dir = dirname(filePath);

          mkdirSync(dir, { recursive: true });

          // Write response to file
          writeFileSync(filePath, JSON.stringify(explainResult, null, 2), 'utf8');

          return toolSuccess({
            savedToFile: true,
            filePath,
            database: params.database,
            collection: params.collection,
            method: params.method.name,
            explainResultSize: JSON.stringify(explainResult).length,
          });
        }

        const result = {
          database: params.database,
          collection: params.collection,
          method: params.method.name,
          explainResult,
        };

        return toolSuccess(result);
      } catch (error) {
        return toolError(error);
      }
    },
  );
}
