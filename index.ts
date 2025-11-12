#!/usr/bin/env node

import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { MongoDBServer } from "./src/server.js";

async function main() {
  const argv = await yargs(hideBin(process.argv))
    .option('auto-connect', {
      type: 'boolean',
      description: 'Auto connect to MongoDB on startup',
      default: false,
    })
    .option('read-only', {
      type: 'boolean',
      description: 'Run in read-only mode',
      default: true,
    })
    .parseAsync();
  const readOnlyMode = argv['read-only'];
  const transport = new StdioServerTransport();
  const server = new MongoDBServer(argv['auto-connect'], readOnlyMode);

  await server.connect(transport);
}

main().catch((error) => {
  console.error("MongoDB MCP server crashed", error);
  process.exit(1);
});
