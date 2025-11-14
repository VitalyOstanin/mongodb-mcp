# MongoDB MCP Server

Also available in Russian: [README-ru.md](README-ru.md)

[![CI](https://github.com/VitalyOstanin/mongodb-mcp/actions/workflows/ci.yml/badge.svg)](https://github.com/VitalyOstanin/mongodb-mcp/actions/workflows/ci.yml)
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

## Requirements

- Node.js ≥ 20
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
| `service_info` | Get MongoDB service information, environment configuration, version, and current timezone | — |
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
| `aggregate` | Run an aggregation against a MongoDB collection | `database` — database name, `collection` — collection name, `pipeline` — array of aggregation stages |

**Note:** The `aggregate` tool allows read-only operations by default but can contain stages that modify data when not in read-only mode. The following aggregation stages are restricted in read-only mode: `$out`, `$merge`. These stages are only available when the server is running in read-write mode.
