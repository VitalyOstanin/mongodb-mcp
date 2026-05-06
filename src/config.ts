import { z } from "zod";
import type { MongoDBConfig } from "./types.js";
import { DEFAULT_TIMEZONE } from "./utils/date.js";

const configSchema = z.object({
  MONGODB_MCP_CONNECTION_STRING: z.string().min(1),
  MONGODB_MCP_DEFAULT_DATABASE: z.string().optional(),
  MONGODB_MCP_TIMEZONE: z.string().optional(),
});

export function loadConfig(env: NodeJS.ProcessEnv = process.env): MongoDBConfig {
  // Make a copy of the environment and set missing optional values to undefined
  // to satisfy the schema
  const envToParse = {
    MONGODB_MCP_CONNECTION_STRING: env.MONGODB_MCP_CONNECTION_STRING,
    MONGODB_MCP_DEFAULT_DATABASE: env.MONGODB_MCP_DEFAULT_DATABASE,
    MONGODB_MCP_TIMEZONE: env.MONGODB_MCP_TIMEZONE,
  };
  const parsed = configSchema.safeParse(envToParse);

  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
      .join("; ");

    throw new Error(`MongoDB configuration error: ${issues}`);
  }

  // exactOptionalPropertyTypes: only set defaultDatabase when actually provided.
  return {
    connectionString: parsed.data.MONGODB_MCP_CONNECTION_STRING,
    ...(parsed.data.MONGODB_MCP_DEFAULT_DATABASE !== undefined
      ? { defaultDatabase: parsed.data.MONGODB_MCP_DEFAULT_DATABASE }
      : {}),
    timezone: parsed.data.MONGODB_MCP_TIMEZONE ?? DEFAULT_TIMEZONE,
  };
}

