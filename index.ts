#!/usr/bin/env node

import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { MongoDBServer } from './src/server.js';
import { redactError } from './src/utils/redact.js';

interface PackageManifest {
  name: string;
  version: string;
}

function readManifest(): PackageManifest {
  const here = dirname(fileURLToPath(import.meta.url));
  const candidates = [
    resolve(here, 'package.json'),
    resolve(here, '..', 'package.json'),
  ];

  for (const path of candidates) {
    try {
      const raw = readFileSync(path, 'utf8');

      return JSON.parse(raw) as PackageManifest;
    } catch {
      // try next candidate
    }
  }

  return { name: '@vitalyostanin/mongodb-mcp', version: 'unknown' };
}

function maybePrintVersionAndExit(): void {
  const argv = process.argv.slice(2);

  if (argv.includes('--version') || argv.includes('-v')) {
    const manifest = readManifest();

    console.log(`${manifest.name} ${manifest.version}`);
    process.exit(0);
  }
}

async function main() {
  maybePrintVersionAndExit();

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
  console.error('MongoDB MCP server crashed', redactError(error));
  process.exit(1);
});
