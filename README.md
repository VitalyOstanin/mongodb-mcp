# MongoDB MCP Server

Also available in Russian: [README-ru.md](README-ru.md)

[![CI](https://github.com/VitalyOstanin/mongodb-mcp/actions/workflows/ci.yml/badge.svg)](https://github.com/VitalyOstanin/mongodb-mcp/actions/workflows/ci.yml)
[![npm version](https://img.shields.io/npm/v/@vitalyostanin/mongodb-mcp.svg)](https://www.npmjs.com/package/@vitalyostanin/mongodb-mcp)

MCP server for comprehensive MongoDB integration with the following capabilities:

- **Database operations** - connect to MongoDB instances, list databases and collections
- **Document management** - find, aggregate, and count documents
- **Schema analysis** - analyze collection schemas and indexes
- **Query tools** - execute queries and aggregations with full MongoDB syntax
- **Connection management** - manage MongoDB connections with read-only mode support
- **Monitoring** - database statistics, performance metrics, and MongoDB logs
- **Query Analysis** - execution plan analysis for performance optimization

## Table of Contents

- [Table of Contents](#table-of-contents)
- [Requirements](#requirements)
- [Installation](#installation)
  - [Using npx (Recommended)](#using-npx-recommended)
  - [Using Claude MCP CLI](#using-claude-mcp-cli)
  - [Manual Installation (Development)](#manual-installation-development)
- [Development \& Release](#development--release)
  - [GitHub Actions Workflows](#github-actions-workflows)
    - [CI Workflow (`.github/workflows/ci.yml`)](#ci-workflow-githubworkflowsciyml)
    - [Publish Workflow (`.github/workflows/publish.yml`)](#publish-workflow-githubworkflowspublishyml)
  - [Setting up NPM\_TOKEN](#setting-up-npm_token)
  - [Release Process](#release-process)
  - [Manual Build \& Test](#manual-build--test)
- [Configuration for Code (Recommended)](#configuration-for-code-recommended)
- [Configuration for Claude Code CLI](#configuration-for-claude-code-cli)
- [Configuration for VS Code Cline](#configuration-for-vs-code-cline)
- [MCP Tools](#mcp-tools)
  - [Service](#service)
  - [Database Operations](#database-operations)
  - [Collection Operations](#collection-operations)
  - [Document Operations](#document-operations)
  - [Schema and Index Analysis](#schema-and-index-analysis)
  - [Query and Aggregation](#query-and-aggregation)
  - [Monitoring and Logs](#monitoring-and-logs)
- [Important Notes](#important-notes)
  - [Read-Only Mode](#read-only-mode)
  - [Destructive Operations](#destructive-operations)

## Requirements

- Node.js ≥ 20
- Environment variables:
  - `MONGODB_MCP_CONNECTION_STRING` — MongoDB connection string (mongodb:// or mongodb+srv:// format)
  - `MONGODB_MCP_DEFAULT_DATABASE` — optional default database name for operations
  - `MONGODB_MCP_TIMEZONE` — optional timezone for date operations (default: `Europe/Moscow`), must be a valid IANA timezone identifier (e.g., `Europe/London`, `America/New_York`, `Asia/Tokyo`)

## Installation

### Using npx (Recommended)

You can run the server directly with npx without installation:

```bash
MONGODB_MCP_CONNECTION_STRING="mongodb://localhost:27017" \
MONGODB_MCP_DEFAULT_DATABASE="myapp" \
npx -y @vitalyostanin/mongodb-mcp@latest
```

### Using Claude MCP CLI

Install using Claude MCP CLI:

```bash
claude mcp add --scope user \
--env MONGODB_MCP_CONNECTION_STRING='mongodb://localhost:27017' \
--env MONGODB_MCP_DEFAULT_DATABASE='myapp' \
mongodb-mcp -- npx -y @vitalyostanin/mongodb-mcp@latest
```

**Scope Options:**
- `--scope user`: Install for current user (all projects)
- `--scope project`: Install for current project only

**Removal:**

```bash
claude mcp remove mongodb-mcp --scope user
```

### Manual Installation (Development)

```bash
npm install
npm run build
```

## Development & Release

### GitHub Actions Workflows

This project uses GitHub Actions for continuous integration and automated releases:

#### CI Workflow (`.github/workflows/ci.yml`)

Runs automatically on every push and pull request:
- **Triggers**: All branches, all pull requests
- **Node.js versions**: 20.x, 22.x (matrix testing)
- **Steps**:
  1. Install dependencies (`npm ci`)
  2. Run linter (`npm run lint`)
  3. Run tests (`npm test`)
  4. Build project (`npm run build`)
  5. Verify build artifacts (executable check)

**Important**: All tests must pass in the CI workflow before a pull request can be merged, and before releases can be published.

#### Publish Workflow (`.github/workflows/publish.yml`)

Runs automatically when you create a new version tag:
- **Trigger**: Git tags matching `v*` pattern (e.g., `v0.1.0`, `v1.2.3`)
- **Node.js version**: 20.x
- **Steps**:
  1. Install dependencies
  2. Build project
  3. Publish to npm registry
  4. Create GitHub Release

### Setting up NPM_TOKEN

To enable automatic publishing to npm, you need to configure the `NPM_TOKEN` secret:

1. **Generate npm Access Token**:
   - Go to [npmjs.com](https://www.npmjs.com/) and log in
   - Navigate to **Access Tokens** in your account settings
   - Click **Generate New Token** → **Classic Token**
   - Select **Automation** type (for CI/CD)
   - Copy the generated token

2. **Add Secret to GitHub**:
   - Go to your GitHub repository
   - Navigate to **Settings** → **Secrets and variables** → **Actions**
   - Click **New repository secret**
   - Name: `NPM_TOKEN`
   - Value: Paste your npm token
   - Click **Add secret**

### Release Process

To create a new release:

```bash
# 1. Update version in package.json and create git tag
npm version patch   # for 0.1.0 → 0.1.1
# or
npm version minor   # for 0.1.0 → 0.2.0
# or
npm version major   # for 0.1.0 → 1.0.0

# 2. Push the tag to GitHub
git push --follow-tags

# 3. GitHub Actions will automatically:
#    - Run tests and build
#    - Publish to npm
#    - Create GitHub Release
```

**Important**: Before creating a release, ensure all tests pass by running `npm test`. The automated release process will be cancelled if any tests fail.

**Note**: The `npm version` command automatically:
- Updates `package.json` and `package-lock.json`
- Creates a git commit with message like "0.1.1"
- Creates a git tag like "v0.1.1"

### Manual Build & Test

```bash
# Install dependencies
npm install

# Run tests
npm test

# Build the project
npm run build

# Run linter
npm run lint

# Watch mode for development
npm run dev:watch
```

**Note**: All tests must pass before committing changes or creating releases. The test suite ensures that the MongoDB MCP server functions correctly and that read-only mode restrictions are properly enforced.
```

## Running the server (stdio)

```bash
MONGODB_MCP_CONNECTION_STRING="mongodb://localhost:27017" \
MONGODB_MCP_DEFAULT_DATABASE="myapp" \
node dist/index.js
```

## Configuration for Code (Recommended)
Add to `~/.code/config.toml`:
```toml
[mcp_servers.mongodb-mcp]
command = "npx"
args = ["-y", "@vitalyostanin/mongodb-mcp@latest"]

[mcp_servers.mongodb-mcp.env]
MONGODB_MCP_CONNECTION_STRING = "mongodb://localhost:27017"
MONGODB_MCP_DEFAULT_DATABASE = "myapp"
```

## Configuration for Claude Code CLI

To use this MCP server with [Claude Code CLI](https://github.com/anthropics/claude-code), you can:

1. **Use Claude MCP CLI** - see [Installation](#installation) section above
2. **Manual configuration** - add to your `~/.claude.json` file:

```json
{
  "mcpServers": {
    "mongodb-mcp": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "@vitalyostanin/mongodb-mcp@latest"],
      "env": {
        "MONGODB_MCP_CONNECTION_STRING": "mongodb://localhost:27017",
        "MONGODB_MCP_DEFAULT_DATABASE": "myapp"
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
        "MONGODB_MCP_CONNECTION_STRING": "mongodb://localhost:27017",
        "MONGODB_MCP_DEFAULT_DATABASE": "myapp"
      }
    }
  }
}
```

**Note:** This configuration uses npx to run the published package. For local development, use `"command": "node"` with `"args": ["/absolute/path/to/mongodb-mcp/dist/index.js"]`. The `MONGODB_MCP_TIMEZONE` environment variable is optional.

## MCP Tools

### Service

| Tool | Description | Main Parameters |
| --- | --- | --- |
| `service_info` | Get MongoDB service information, environment configuration, version, and current timezone | — |

### Database Operations

| Tool | Description | Main Parameters |
| --- | --- | --- |
| `connect` | Establish connection to MongoDB using connection string | `connectionString` — MongoDB connection string (optional, can use environment variable) |
| `list_databases` | List all databases in the MongoDB instance | — |
| `db_stats` | Get statistics for a specific database | `database` — database name |

### Collection Operations

| Tool | Description | Main Parameters |
| --- | --- | --- |
| `list_collections` | List all collections for a given database | `database` — database name |
| `collection_schema` | Analyze the schema for a collection | `database` — database name, `collection` — collection name, optionally `sampleSize` (default 50) |
| `collection_indexes` | Describe the indexes for a collection | `database` — database name, `collection` — collection name |
| `collection_storage_size` | Get the size of a collection | `database` — database name, `collection` — collection name |

### Document Operations

| Tool | Description | Main Parameters |
| --- | --- | --- |
| `find` | Run find queries against a MongoDB collection | `database` — database name, `collection` — collection name, optionally `filter`, `limit` (default 10), `projection`, `sort` |
| `count` | Count documents in a MongoDB collection | `database` — database name, `collection` — collection name, optionally `query` — filter for counting |

### Schema and Index Analysis

| Tool | Description | Main Parameters |
| --- | --- | --- |
| `collection_schema` | Describe the schema for a collection by sampling documents | `database` — database name, `collection` — collection name, optionally `sampleSize` (default 50) |
| `collection_indexes` | Describe the indexes for a collection | `database` — database name, `collection` — collection name |

### Query and Aggregation

| Tool | Description | Main Parameters |
| --- | --- | --- |
| `aggregate` | Run an aggregation against a MongoDB collection | `database` — database name, `collection` — collection name, `pipeline` — array of aggregation stages |
| `explain` | Returns statistics describing the execution of the winning plan chosen by the query optimizer | `database` — database name, `collection` — collection name, `method` — method object with name and arguments, optionally `verbosity` (default 'queryPlanner') |

### Monitoring and Logs

| Tool | Description | Main Parameters |
| --- | --- | --- |
| `mongodb_logs` | Returns the most recent logged mongod events | optionally `limit` (default 50), `type` (default 'global', or 'startupWarnings') |

## Important Notes

### Read-Only Mode

The server supports read-only mode which prevents destructive operations:

- **Read-only protection**: When `--read-only` flag is used (default) or `MONGODB_READONLY` environment variable is set to 'true', write operations are blocked. Use `--read-only=false` to allow write operations.
- **Protected operations**: `update`, `delete`, `insert`, `$out`, and `$merge` operations are forbidden
- **Connection safety**: Read-only mode ensures no accidental data modifications occur

### Destructive Operations

The MongoDB MCP server operates in read-only mode by default to prevent accidental data loss. Some operations that could modify data are restricted and would only be available in read-write mode (which is not enabled by default).
