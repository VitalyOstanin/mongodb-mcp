import { z } from "zod";

export interface MongoDBConfig {
  connectionString?: string;
  defaultDatabase?: string;
  timezone: string;
}

const configSchema = z.object({
  MONGODB_CONNECTION_STRING: z.string().min(1).optional(),
  MONGODB_DEFAULT_DATABASE: z.string().optional(),
  MONGODB_TIMEZONE: z.string().optional(),
});

export function loadConfig(env: NodeJS.ProcessEnv = process.env): MongoDBConfig {
  // Make a copy of the environment and set missing optional values to undefined
  // to satisfy the schema
  const envToParse = {
    MONGODB_CONNECTION_STRING: env.MONGODB_CONNECTION_STRING,
    MONGODB_DEFAULT_DATABASE: env.MONGODB_DEFAULT_DATABASE,
    MONGODB_TIMEZONE: env.MONGODB_TIMEZONE,
  };
  const parsed = configSchema.safeParse(envToParse);

  if (!parsed.success) {
    const { fieldErrors } = parsed.error.flatten();
    const missingFields = Object.entries(fieldErrors)
      .filter(([, issues]) => Array.isArray(issues) && issues.length > 0)
      .map(([field]) => field);
    const errorMessage = missingFields.length
      ? `missing environment variables: ${missingFields.join(", ")}`
      : "invalid configuration";

    throw new Error(`MongoDB configuration error: ${errorMessage}`);
  }

  return {
    connectionString: parsed.data.MONGODB_CONNECTION_STRING,
    defaultDatabase: parsed.data.MONGODB_DEFAULT_DATABASE,
    timezone: parsed.data.MONGODB_TIMEZONE ?? "Europe/Moscow",
  };
}

export function enrichConfigWithRedaction(config: MongoDBConfig) {
  return {
    hasConnectionString: config.connectionString ? config.connectionString.length > 0 : false,
    defaultDatabase: config.defaultDatabase,
    timezone: config.timezone,
  };
}
