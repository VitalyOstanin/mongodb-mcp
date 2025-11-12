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
  // Check for environment variable override - if MONGODB_READONLY is set, it takes precedence
  // If MONGODB_READONLY is not set, use the command line argument (which defaults to true)
  const envReadOnly = process.env.MONGODB_READONLY;
  const readOnlyMode = envReadOnly !== undefined ? envReadOnly.toLowerCase() === 'true' : argv['read-only'];
  const transport = new StdioServerTransport();
  const server = new MongoDBServer(argv['auto-connect'], readOnlyMode);

  await server.connect(transport);
}

main().catch((error) => {
  console.error("MongoDB MCP server crashed", error);
  process.exit(1);
});
