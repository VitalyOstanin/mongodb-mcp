import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { VERSION } from "./version.js";
import { MongoDBClient } from "./mongodb-client.js";
import { loadConfig } from "./config.js";
import { initializeTimezone } from "./utils/date.js";
import { registerConnectTool } from "./tools/connect.js";
import { registerListDatabasesTool } from "./tools/list-databases.js";
import { registerListCollectionsTool } from "./tools/list-collections.js";
import { registerDbStatsTool } from "./tools/db-stats.js";
import { registerCollectionStorageSizeTool } from "./tools/collection-storage-size.js";
import { registerCollectionSchemaTool } from "./tools/collection-schema.js";
import { registerCollectionIndexesTool } from "./tools/collection-indexes.js";
import { registerFindTool } from "./tools/find.js";
import { registerCountTool } from "./tools/count.js";
import { registerAggregateTool } from "./tools/aggregate.js";
import { registerExplainTool } from "./tools/explain.js";
import { registerMongodbLogsTool } from "./tools/mongodb-logs.js";
import { registerServiceInfoTool } from "./tools/service-info.js";


export class MongoDBServer {
  private readonly server: McpServer;
  private readonly mongoClient: MongoDBClient;

  constructor(autoConnect: boolean = false, readonlyMode: boolean = true) {
    this.server = new McpServer(
      {
        name: "mongodb-mcp",
        version: VERSION,
      },
      {
        capabilities: {
          tools: {
            listChanged: false,
          },
          logging: {},
        },
      },
    );

    // Load configuration and initialize timezone
    const config = loadConfig();

    initializeTimezone(config.timezone);

    this.mongoClient = MongoDBClient.getInstance();

    // Import and register the connect tool
    registerConnectTool(this.server, this.mongoClient);
    registerListDatabasesTool(this.server, this.mongoClient);
    registerListCollectionsTool(this.server, this.mongoClient);
    registerDbStatsTool(this.server, this.mongoClient);
    registerCollectionStorageSizeTool(this.server, this.mongoClient);
    registerCollectionSchemaTool(this.server, this.mongoClient);
    registerCollectionIndexesTool(this.server, this.mongoClient);
    registerFindTool(this.server, this.mongoClient);
    registerCountTool(this.server, this.mongoClient);
    registerAggregateTool(this.server, this.mongoClient);
    registerExplainTool(this.server, this.mongoClient);
    registerMongodbLogsTool(this.server, this.mongoClient);
    registerServiceInfoTool(this.server, this.mongoClient);


    // If auto-connect option is enabled, connect to MongoDB on startup
    if (autoConnect) {
      const connectionString = process.env.MONGODB_CONNECTION_STRING;

      if (connectionString) {
        // Connect in readonly mode if it's enabled
        this.mongoClient.connect(connectionString, readonlyMode).catch(error => {
          console.error("Failed to auto-connect to MongoDB:", error);
        });
      }
    }
  }

  async connect(transport: Parameters<McpServer["connect"]>[0]): Promise<void> {
    await this.server.connect(transport);
  }
}
