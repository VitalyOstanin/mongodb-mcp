# Changelog

## [0.5.0] - 2026-05-06

### Added

- Integration test harness: compose.yaml (mongo:8.0.21 with auth, healthcheck, tmpfs), `test-integration/` directory with vitest config, and a dedicated `integration-tests` CI job using a service container.
- New tests for `src/utils/file-storage.ts` and `src/utils/mongodb-stream.ts` (was 0% coverage).
- TODO.md with follow-up items: compose stand for local dev, Security considerations, Concurrency considerations.
- DX scaffolding: `.editorconfig`, `.nvmrc`, `tsconfig.base.json`, `tsconfig.test.json`, `typecheck` / `typecheck:tests` scripts, `tsx watch` dev loop.
- Dependabot config for npm + github-actions, single-trigger CI workflow with timeouts.
- CONTRIBUTING.md and a Local Development section in both READMEs.

### Changed

- Bumped runtime deps: `zod` 3→4 (`z.record(key, value)` two-arg signature in 14 places), `mongodb` 6→7 (no source changes), `@modelcontextprotocol/sdk` 1.21→1.29, `luxon` 3.5→3.7.
- Bumped tooling: `typescript` 5→6 (with explicit `types: ["node"]` for the new default), `eslint` 9→10 (incl. `preserve-caught-error`), `actions/checkout` and `actions/setup-node` to v6.
- Migrated the test runner from `jest`/`ts-jest` to `vitest` (24 test files); test runtime dropped from ~7s to ~1s.
- Enabled strict TS flags: `noImplicitOverride`, `exactOptionalPropertyTypes`, `noUncheckedIndexedAccess`.
- Cut ESLint peak memory and runtime via `typescript-eslint` v8 `projectService`.
- Migrated write-tool annotations to standard MCP fields (`readOnlyHint`, `destructiveHint`, `idempotentHint`, `openWorldHint`).
- Refactored `MongoDBClient`: connect/disconnect mutex, listener cleanup, fixed `this` binding in the read-only Proxy.
- `find` tool: renamed result `count` → `returnedCount` and clarified that the field is the page size, not the total.
- Pre-check ISO date strings with a regex before invoking Luxon in `convertStringDatesToObjects`.

### Fixed

- Critical: `convertStringDatesToObjects` no longer breaks `$and` / `$or` / `$nor` filters in `find`.
- Assorted bugs in `insert`, `explain`, `collection-storage-size`, `config`.
- TOCTOU race in `saveDataToFile`: replaced `access()`+`writeFile()` with the `wx` flag for atomic create-or-fail; also switched temp-file naming to `crypto.randomUUID()`.

### Security

- Block server-side JS operators (`$where`, `$function`, `$accumulator`) on every read path.
- Validate `filePath` for write tools against `MONGODB_MCP_EXPORT_DIR` (defaults to `os.tmpdir()`); reject path traversal and sibling-prefix escapes.
- Redact secrets from connection error messages.

### Removed

- Node 20 support (EOL 2026-04-30); `engines.node` is now `>=22.13.0`.
- Dead code from `src/utils/date.ts` (work-item / holidays helpers from a different project).
- `@vitalyostanin/eslint-prefer-de-morgan-law` plugin.

## [0.4.0] - 2026-04-04

### Added

- `noLimit` parameter for aggregate tool to disable automatic $limit stage appended to the pipeline (useful for pipelines ending with $out or $merge)

## [0.3.2] - 2026-03-24

### Changed

- Removed redundant readonlyMode parameter from connect method; readonly mode is now set exclusively via CLI argument

## [0.3.1] - 2025-11-18

### Fixed

- Unnecessary type assertion in date conversion test

## [0.3.0] - 2025-11-14

### Added

- Document count feature to MongoDB stream operations
- Improvements to MongoDB streaming tests

## [0.2.0] - 2025-11-14

### Added

- MongoDB write operation tools (insert, update, delete, create-index, create-collection, drop-index, drop-collection)
- Documentation updates to reflect new write operations
- Comprehensive write operation capabilities to complement existing read operations

## [0.1.1] - 2025-11-14

### Added

- MongoDB write operation tools (insert, update, delete, create-index, create-collection, drop-index, drop-collection)
- Documentation updates to reflect new write operations
- Comprehensive write operation capabilities to complement existing read operations

## [0.1.0] - 2025-11-13

### Added

- Initial release of MongoDB MCP Server
- Comprehensive MongoDB integration via Model Context Protocol
- Database operations (connect, list databases, database statistics)
- Collection management (list collections, schema analysis, index inspection)
- Document operations (find, count, aggregate)
- Query and aggregation tools with full MongoDB syntax support
- Connection management with disconnect tool support
- Monitoring tools for database health and performance metrics
- MongoDB streaming utility for large dataset handling
- Enhanced documentation and configuration handling
- TypeScript implementation with proper type safety
- MCP tool registration and server infrastructure

[0.4.0]: https://github.com/VitalyOstanin/mongodb-mcp/releases/tag/v0.4.0
[0.3.2]: https://github.com/VitalyOstanin/mongodb-mcp/releases/tag/v0.3.2
[0.3.1]: https://github.com/VitalyOstanin/mongodb-mcp/releases/tag/v0.3.1
[0.3.0]: https://github.com/VitalyOstanin/mongodb-mcp/releases/tag/v0.3.0
[0.2.0]: https://github.com/VitalyOstanin/mongodb-mcp/releases/tag/v0.2.0
[0.1.1]: https://github.com/VitalyOstanin/mongodb-mcp/releases/tag/v0.1.1
[0.1.0]: https://github.com/VitalyOstanin/mongodb-mcp/releases/tag/v0.1.0