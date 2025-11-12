# MongoDB-MCP Unit Tests

This document describes the unit tests for the MongoDB-MCP library, specifically focusing on the read-only mode with aggregation validation.

## Test Coverage

The tests in `mongodb-client.test.ts` verify the following functionality:

### Read-Only Mode
- Blocking write operations (insertOne, updateOne, etc.) in read-only mode
- Allowing read operations (collection access) in read-only mode
- Validating that safe aggregation operations are permitted
- Ensuring dangerous aggregation operations ($out, $merge) are blocked

### Aggregation Pipeline Validation  
- Properly identifying and blocking dangerous stages ($out, $merge)
- Allowing all safe aggregation stages ($match, $project, $group, etc.)
- Handling mixed pipelines with both safe and dangerous stages
- Supporting both database-level and collection-level aggregations

### Non-Read-Only Mode
- Ensuring all operations work normally when read-only mode is disabled
- Allowing all aggregation operations, including potentially dangerous ones

## Key Features Tested

1. **Database Proxy**: Tests that the database object is properly proxied in read-only mode
2. **Collection Proxy**: Tests that collections retrieved in read-only mode are also protected
3. **Pipeline Validation**: Tests that aggregation pipelines are validated for dangerous operations
4. **Backwards Compatibility**: Tests that normal operations work in non-read-only mode

## Running Tests

```bash
npm test
```

To run tests in watch mode:
```bash
npm run test:watch
```

To run with coverage:
```bash
npm test -- --coverage
```