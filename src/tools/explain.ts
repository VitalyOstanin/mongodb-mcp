import { z } from 'zod';
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { MongoDBClient } from '../mongodb-client.js';
import { toolSuccess, toolError } from '../utils/tool-response.js';
import { writeFile } from 'fs/promises';
import { prepareExportPath } from '../utils/streaming.js';
import { saveToFileSchemaFragment } from '../utils/save-to-file-schema.js';

// explain saves a single JSON object, not a stream of documents, so the
// jsonl/json `format` switch is not relevant. Only saveToFile + filePath apply.
const { saveToFile: saveToFileFragment, filePath: filePathFragment } = saveToFileSchemaFragment;
const explainSchema = z.object({
  database: z.string().describe('Database name'),
  collection: z.string().describe('Collection name'),
  method: z.object({
    name: z.enum(['find', 'count', 'aggregate']).describe('The method name to run explain on'),
    arguments: z.record(z.string(), z.unknown()).describe('Arguments for the method'),
  }).describe('The method and its arguments to run'),
  verbosity: z.enum(['queryPlanner', 'queryPlannerExtended', 'executionStats', 'allPlansExecution']).optional().default('queryPlanner')
    .describe('The verbosity of the explain plan, defaults to queryPlanner. If the user wants to know how fast is a query in execution time, use executionStats.'),
  saveToFile: saveToFileFragment,
  filePath: filePathFragment,
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

            // Use db.command({ explain: { count, query }, verbosity }) so the
            // optimizer reports the COUNT_SCAN plan rather than the
            // IXSCAN+FETCH plan that find().explain() would expose.
            explainResult = await db.command({
              explain: { count: params.collection, query },
              verbosity,
            });
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
          const filePath = await prepareExportPath(params.filePath);

          await writeFile(filePath, JSON.stringify(explainResult, null, 2), { encoding: 'utf8', flag: 'wx' });

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
