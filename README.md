# MongoDB MCP Server

Also available in Russian: [README-ru.md](README-ru.md)

[![CI](https://github.com/VitalyOstanin/mongodb-mcp/actions/workflows/ci.yml/badge.svg)](https://github.com/VitalyOstanin/mongodb-mcp/actions/workflows/ci.yml)
[![codecov](https://codecov.io/gh/VitalyOstanin/mongodb-mcp/graph/badge.svg?branch=master)](https://codecov.io/gh/VitalyOstanin/mongodb-mcp)
[![npm version](https://img.shields.io/npm/v/@vitalyostanin/mongodb-mcp.svg)](https://www.npmjs.com/package/@vitalyostanin/mongodb-mcp)

**Note**: This project is designed for my personal needs. I do not plan to expand its functionality with features I don't use or cannot verify. You are free to submit suggestions and pull requests, but I make no guarantee that everything will be accepted.

MCP server for comprehensive MongoDB integration with the following capabilities:

- **Database operations** - connect to MongoDB instances, list databases and collections
- **Document management** - find, aggregate, and count documents
- **Schema analysis** - analyze collection schemas and indexes
- **Query tools** - execute queries and aggregations with full MongoDB syntax
- **Connection management** - manage MongoDB connections with read-only mode support
- **Streaming file export** - streaming save to files for large datasets
- **Read-only mode** - safe read-only operations to prevent accidental data modifications
- **Monitoring** - database statistics, performance metrics, and MongoDB logs
- **Query Analysis** - execution plan analysis for performance optimization

## Table of Contents

- [Table of Contents](#table-of-contents)
- [Requirements](#requirements)
- [Configuration for Qwen Code](#configuration-for-qwen-code)
- [Configuration for VS Code Cline](#configuration-for-vs-code-cline)
- [MCP Tools](#mcp-tools)
  - [Read-Only Mode Tools](#read-only-mode-tools)
  - [Non-Read-Only Mode Tools](#non-read-only-mode-tools)
- [Security considerations](#security-considerations)
- [Concurrency considerations](#concurrency-considerations)
- [Local Development](#local-development)

## Requirements

- Node.js ≥ 22 (Node 20 reached EOL on 2026-04-30)
- Environment variables:
  - `MONGODB_MCP_CONNECTION_STRING` — MongoDB connection string (mongodb:// or mongodb+srv:// format)
  - `MONGODB_MCP_DEFAULT_DATABASE` — optional default database name for operations
  - `MONGODB_MCP_TIMEZONE` — optional timezone for date operations (default: `Europe/Moscow`), must be a valid IANA timezone identifier (e.g., `Europe/London`, `America/New_York`, `Asia/Tokyo`)

## Configuration for Qwen Code

To use this MCP server with [Qwen Code](https://qwenlm.github.io/qwen-code-docs/), add to `~/.qwen/settings.json`:

```json
{
  "mcpServers": {
    "mongodb-mcp": {
      "command": "npx",
      "args": ["-y", "@vitalyostanin/mongodb-mcp@latest"],
      "env": {
        "MONGODB_MCP_CONNECTION_STRING": "mongodb://localhost:27017"
      }
    }
  }
}
```

**Note:** This configuration uses npx to run the published package. For local development, use `"command": "node"` with `"args": ["/absolute/path/to/mongodb-mcp/dist/index.js"]`. The `MONGODB_MCP_TIMEZONE` environment variable is optional.

## Configuration for VS Code Cline

To use this MCP server with [Cline](https://github.com/cline/cline) extension in VS Code:

1. Open VS Code with Cline extension installed
2. Click the MCP Servers icon in Cline's top navigation
3. Select the "Configure" tab and click "Configure MCP Servers"
4. Add the following configuration to `cline_mcp_settings.json`:

```json
{
  "mcpServers": {
    "mongodb-mcp": {
      "command": "npx",
      "args": ["-y", "@vitalyostanin/mongodb-mcp@latest"],
      "env": {
        "MONGODB_MCP_CONNECTION_STRING": "mongodb://localhost:27017"
      }
    }
  }
}
```

**Note:** This configuration uses npx to run the published package. For local development, use `"command": "node"` with `"args": ["/absolute/path/to/mongodb-mcp/dist/index.js"]`. The `MONGODB_MCP_TIMEZONE` environment variable is optional.

## MCP Tools

### Read-Only Mode Tools

| Tool | Description | Main Parameters |
| --- | --- | --- |
| `service-info` | Get MongoDB service information, environment configuration, version, and current timezone | — |
| `connect` | Establish connection to MongoDB using connection string | — |
| `disconnect` | Disconnect from MongoDB | — |
| `list_databases` | List all databases in the MongoDB instance | — |
| `db_stats` | Get statistics for a specific database | `database` — database name |
| `list_collections` | List all collections for a given database | `database` — database name |
| `collection_schema` | Analyze the schema for a collection | `database` — database name, `collection` — collection name, optionally `sampleSize` (default 50) |
| `collection_indexes` | Describe the indexes for a collection | `database` — database name, `collection` — collection name |
| `collection_storage_size` | Get the size of a collection | `database` — database name, `collection` — collection name |
| `find` | Run find queries against a MongoDB collection | `database` — database name, `collection` — collection name, optionally `filter`, `limit` (default 10), `projection`, `sort` |
| `count` | Count documents in a MongoDB collection | `database` — database name, `collection` — collection name, optionally `query` — filter for counting |
| `explain` | Returns statistics describing the execution of the winning plan chosen by the query optimizer | `database` — database name, `collection` — collection name, `method` — method object with name and arguments, optionally `verbosity` (default 'queryPlanner') |
| `mongodb_logs` | Returns the most recent logged mongod events | optionally `limit` (default 50), `type` (default 'global', or 'startupWarnings') |

### Non-Read-Only Mode Tools

| Tool | Description | Main Parameters |
| --- | --- | --- |
| `aggregate` | Run an aggregation against a MongoDB collection | `database` — database name, `collection` — collection name, `pipeline` — array of aggregation stages, `noLimit` — disable the automatic $limit stage (useful for pipelines ending with $out or $merge) |
| `insert` | Insert one or multiple documents into a MongoDB collection | `database` — database name, `collection` — collection name, `document` — single document to insert, `documents` — array of documents to insert (use instead of single document) |
| `update` | Update one or multiple documents in a MongoDB collection | `database` — database name, `collection` — collection name, `filter` — filter to match documents for update, `update` — update operations to perform, `upsert` — if true, creates a new document if no documents match the filter (default: false), `multi` — if true, updates all matching documents (updateMany), otherwise updates only one (updateOne) (default: false) |
| `delete` | Delete one or multiple documents from a MongoDB collection | `database` — database name, `collection` — collection name, `filter` — filter to match documents for deletion, `multi` — if true, deletes all matching documents (deleteMany), otherwise deletes only one (deleteOne) (default: false) |
| `create-index` | Create an index on a MongoDB collection | `database` — database name, `collection` — collection name, `keys` — index specification document (e.g., { field: 1 } for ascending, { field: -1 } for descending), `options` — additional index options (e.g., { unique: true, sparse: true }) |
| `drop-index` | Drop an index from a MongoDB collection | `database` — database name, `collection` — collection name, `index` — index name or index specification document to drop |
| `create-collection` | Create a new collection in a MongoDB database | `database` — database name, `collection` — collection name to create, `options` — additional collection options (e.g., { capped: true, size: 1024 }) |
| `drop-collection` | Drop a collection from a MongoDB database | `database` — database name, `collection` — collection name to drop |

**Note:** The server runs in read-only mode by default to prevent accidental data modifications. In read-only mode, all write operations are blocked including:
- Database-level operations: `insertOne`, `insertMany`, `updateOne`, `updateMany`, `deleteOne`, `deleteMany`, `createIndex`, `dropIndex`, `dropDatabase`, `renameCollection`, etc.
- Collection-level operations: `insertOne`, `insertMany`, `updateOne`, `updateMany`, `deleteOne`, `deleteMany`, `findOneAndReplace`, `findOneAndUpdate`, `findOneAndDelete`, `bulkWrite`, `createIndex`, `dropIndex`, `drop`, etc.
- Aggregation stages that modify data: `$out`, `$merge`

The following aggregation stages are restricted in read-only mode: `$out`, `$merge`. These stages are only available when the server is running in read-write mode.

## Security considerations

Recommendations for safe production use of the MCP server:

- **Use TLS for remote MongoDB clusters.** Prefer `mongodb+srv://` (TLS is implied) or set `tls=true` explicitly in a regular `mongodb://` connection string. Plaintext connections expose credentials and query payloads to anyone on the network path.
- **Apply least-privilege roles.** Create a dedicated MongoDB user with read-only access to only the databases you need. Avoid `root`, `dbAdmin`, or any role that grants `eval` / scripting privileges. Default to read-only mode unless write tools are required.
- **Keep the connection string out of MCP host args.** Configure `MONGODB_MCP_CONNECTION_STRING` via environment variables (e.g., `.env` file) rather than passing it through `args` of the MCP host configuration — `args` are typically logged when the host launches the server, leaking the password.
- **Disable server-side JavaScript.** The MCP server already blocks `$where`, `$function`, and `$accumulator` operators in queries. For defence in depth, run the MongoDB server itself with `--javascriptEnabled=false` (or the equivalent `security.javascriptEnabled: false` in `mongod.conf`).
- **Restrict the export directory.** When using file-export tools, set `MONGODB_MCP_EXPORT_DIR` to a directory accessible only to the MCP user (`chmod 700`). Other users on the machine should not be able to read the dumps that write tools produce.

## Concurrency considerations

The MCP server does not provide transactional or ordering guarantees beyond what MongoDB itself enforces. Plan multi-step interactions accordingly:

- **Tools are independent operations.** Each call runs in its own implicit context; the server does not start multi-statement transactions or share a `ClientSession` across calls. Design atomic multi-step flows by encoding preconditions into the `filter` of the same `update` / `delete` call, rather than chaining a separate `find` followed by a mutating call.
- **Singleton client, parallel operations.** A single `MongoClient` is shared across all tool calls. Only `connect` / `disconnect` are serialised through an internal mutex; ordinary operations (`find`, `aggregate`, `insert`, etc.) execute concurrently against the cluster, with no cross-tool ordering imposed by the MCP server.
- **Connection state is a snapshot.** `getConnectionInfo()` returns the state at the moment of the call. For decisions that depend on connectivity, rely on the result of the next operation rather than a preceding `isConnected` check — the connection may drop between the two.
- **File-export uses `wx`.** Tools that write files open the target with the `wx` flag and will not overwrite an existing file. Concurrent calls targeting the same `filePath` will fail with `EEXIST`; callers must pick a fresh path (e.g., include a timestamp or per-call suffix).

## Local Development

Quick reference for working with the source.

Prerequisites:

- Node.js as specified in [`.nvmrc`](.nvmrc) (current LTS, ≥ 22). With nvm: `nvm use`.
- npm.

Setup:

```bash
git clone https://github.com/VitalyOstanin/mongodb-mcp.git
cd mongodb-mcp
npm install
```

Common scripts:

| Script                  | Purpose                                                          |
| ----------------------- | ---------------------------------------------------------------- |
| `npm run build`         | Compile TypeScript to `dist/` (`tsconfig.build.json`) and chmod the CLI entrypoint |
| `npm run dev`           | Run `index.ts` directly via `tsx watch` for iterative work       |
| `npm start`             | Run the compiled server from `dist/`                             |
| `npm run typecheck`     | Type-check sources + tests (`tsconfig.json`, no emit)            |
| `npm run typecheck:tests` | Type-check with extra strict flags (`tsconfig.test.json`)      |
| `npm run lint`          | Run ESLint                                                       |
| `npm run lint:fix`      | Run ESLint with `--fix`                                          |
| `npm test`              | Run the Vitest test suite once                                   |
| `npm run test:watch`    | Run Vitest in watch mode                                         |
| `npm run test:coverage` | Run Vitest with v8 coverage (opt-in; threshold gate enforced)    |
| `npm run test:debug`    | Run Vitest sequentially (`--no-file-parallelism`)                |

Local connection example:

```bash
export MONGODB_MCP_CONNECTION_STRING="mongodb://localhost:27017"
npm run dev
```

Layout:

- `index.ts` — CLI entry point.
- `src/server.ts` — MCP server bootstrap.
- `src/mongodb-client.ts` — singleton MongoDB client with read-only Proxy.
- `src/tools/` — one MCP tool per file plus its `*.test.ts`.
- `src/utils/` — shared helpers (streaming exports, schema fragments, date handling, redaction).
