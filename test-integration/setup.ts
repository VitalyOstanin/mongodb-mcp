// Integration test environment. Expects the mongo container from
// compose.yaml to be running on 127.0.0.1:57017 with user/password test/test
// against the admin database.
process.env['MONGODB_MCP_CONNECTION_STRING'] ??= 'mongodb://test:test@127.0.0.1:57017/?authSource=admin';
process.env['MONGODB_MCP_TIMEZONE'] ??= 'UTC';

export {};
