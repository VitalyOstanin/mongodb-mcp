import { z } from 'zod';
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { MongoDBClient } from '../mongodb-client.js';
import { toolSuccess, toolError } from '../utils/tool-response.js';
import { generateTempFilePath } from '../utils/streaming.js';
import { writeFileSync, mkdirSync } from 'fs';
import { dirname } from 'path';

// Define the Tool type
interface Tool {
  name: string;
  description: string;
  inputSchema: object;
  // Examples can contain any structure based on the tool's requirements
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  examples?: any[];
  // Tool implementation params are dynamic based on the specific tool schema
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  implementation: (_params: any) => Promise<any>;
}

const collectionSchemaSchema = z.object({
  database: z.string().describe('Database name'),
  collection: z.string().describe('Collection name'),
  sampleSize: z.number().optional().default(50).describe('Number of documents to sample for schema inference'),
  saveToFile: z.boolean().optional().describe('Save results to a file instead of returning them directly. Useful for large datasets that can be analyzed by scripts.'),
  filePath: z.string().optional().describe('Explicit path to save the file (optional, auto-generated if not provided). Directory will be created if it doesn\'t exist.'),
});

export type CollectionSchemaParams = z.infer<typeof collectionSchemaSchema>;

export const collectionSchemaTool: Tool = {
  name: 'collection-schema',
  description: 'Describe the schema for a collection by sampling documents',
  inputSchema: collectionSchemaSchema,
  examples: [
    {
      input: { database: 'testdb', collection: 'users', sampleSize: 10 },
      output: {
        database: 'testdb',
        collection: 'users',
        sampleSize: 10,
        schema: {
          properties: {
            _id: { type: 'objectId' },
            name: { type: 'string' },
            age: { type: 'integer' },
            email: { type: 'string' },
            isActive: { type: 'boolean' },
          },
          required: ['_id', 'name', 'email'],
        },
      },
      description: 'Get schema information for the users collection in testdb database by sampling 10 documents',
    },
  ],
  async implementation(params: CollectionSchemaParams) {
    const mongoClient = MongoDBClient.getInstance();

    if (!mongoClient.isConnectedToMongoDB()) {
      throw new Error('Not connected to MongoDB. Please connect first.');
    }

    try {
      const db = mongoClient.getDatabase(params.database);
      const collection = db.collection(params.collection);

      if (params.saveToFile) {
        // For saving to file, fetch documents and process
        const documents = await collection.find({}).limit(params.sampleSize).toArray();
        let response;

        if (documents.length === 0) {
          response = {
            database: params.database,
            collection: params.collection,
            sampleSize: params.sampleSize,
            schema: { properties: {}, required: [] },
            message: 'No documents found in the collection to infer schema',
          };
        } else {
          // Infer schema from the documents
          const schema = inferSchema(documents);

          response = {
            database: params.database,
            collection: params.collection,
            sampleSize: documents.length, // Return actual sample size
            schema,
          };
        }

        const filePath = params.filePath ?? generateTempFilePath();
        // Ensure directory exists
        const dir = dirname(filePath);

        mkdirSync(dir, { recursive: true });

        // Write response to file
        writeFileSync(filePath, JSON.stringify(response, null, 2), 'utf8');

        return toolSuccess({
          savedToFile: true,
          filePath,
          database: params.database,
          collection: params.collection,
          message: response.message ?? 'Schema inference completed',
        });
      } else {
        // For in-memory results (when not saving to file), use the original approach but with a reasonable limit
        // Sample documents from the collection
        const documents = await collection.find({}).limit(params.sampleSize).toArray();
        let response;

        if (documents.length === 0) {
          response = {
            database: params.database,
            collection: params.collection,
            sampleSize: params.sampleSize,
            schema: { properties: {}, required: [] },
            message: 'No documents found in the collection to infer schema',
          };
        } else {
          // Infer schema from the documents
          const schema = inferSchema(documents);

          response = {
            database: params.database,
            collection: params.collection,
            sampleSize: documents.length, // Return actual sample size
            schema,
          };
        }

        return toolSuccess(response);
      }
    } catch (error) {
      return toolError(error);
    }
  },
};

// MongoDB documents can have any structure, so we need to use any for the schema inference

// Define the types for schema inference
interface PropertySchema {
  type: string;
  anyOf?: Array<{ type: string }>;
}

interface SchemaInferenceResult {
  properties: Record<string, PropertySchema>;
  required: string[];
}

// Helper function to infer schema from an array of documents
function inferSchema(documents: unknown[]): SchemaInferenceResult {
  if (documents.length === 0) {
    return { properties: {}, required: [] };
  }

  const mergedSchema: SchemaInferenceResult = { properties: {}, required: [] };

  for (const doc of documents) {
    if (doc && typeof doc === 'object') {
      for (const [key, value] of Object.entries(doc)) {
      // Check if property doesn't exist yet; this condition is necessary because Record<string, PropertySchema>
      // can have undefined values for keys that don't exist
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
      if (!mergedSchema.properties[key]) {
        mergedSchema.properties[key] = { type: getTypeOfValue(value) };
      } else {
        // If property exists, make sure type is compatible
        const currentType = mergedSchema.properties[key].type;
        const valueType = getTypeOfValue(value);

        if (currentType !== valueType) {
          // Handle mixed types by using the most general type
          mergedSchema.properties[key].type = getMoreGeneralType(currentType, valueType);
          if (!mergedSchema.properties[key].anyOf) {
            mergedSchema.properties[key].anyOf = [
              { type: currentType },
              { type: valueType },
            ];
          } else if (!mergedSchema.properties[key].anyOf.some((t: { type: string }) => t.type === valueType)) {
            mergedSchema.properties[key].anyOf.push({ type: valueType });
          }
        }
      }

      // Add to required if not null/undefined in sample document
      if (value !== undefined && value !== null && !mergedSchema.required.includes(key)) {
        mergedSchema.required.push(key);
      }
    }
  }
}

  return mergedSchema;
}

// MongoDB documents can contain any type of value, making it impossible to define a specific type

// MongoDB documents can contain any type of value, making it impossible to define a specific type

// Helper function to determine the type of a value
function getTypeOfValue(value: unknown): string {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  if (value instanceof Date) return 'date';
  // Check for MongoDB ObjectId
  if (value && typeof value === 'object' && '_bsontype' in value && value._bsontype === 'ObjectID') return 'objectId';
  // Check for other BSON types like Decimal128, etc.
  if (value && typeof value === 'object' && '_bsontype' in value && typeof value._bsontype === 'string') return value._bsontype.toLowerCase();

  switch (typeof value) {
    case 'string':
      // Check if it's a date string
      if (isValidDate(value)) return 'date';

      return 'string';
    case 'number':
      return Number.isInteger(value) ? 'integer' : 'number';
    case 'object':
      return 'object';
    case 'boolean':
      return 'boolean';
    case 'bigint':
      return 'bigint';
    case 'symbol':
      return 'symbol';
    case 'undefined':
      return 'undefined';
    case 'function':
      return 'function';
  }

  // Default fallback type
  return typeof value;
}

// Helper function to get a more general type when values have different types
function getMoreGeneralType(type1: string, type2: string): string {
  // If one is integer and the other is number, use number
  if ((type1 === 'integer' && type2 === 'number') || (type1 === 'number' && type2 === 'integer')) {
    return 'number';
  }

  // If either is object, use object
  if (type1 === 'object' || type2 === 'object') {
    return 'object';
  }

  // Otherwise, use 'mixed' or 'union'
  return 'mixed';
}

// Helper function to check if a string is a valid date
function isValidDate(dateString: string): boolean {
  // Check if it matches ISO date format or other standard formats
  const date = new Date(dateString);

  return date.toString() !== 'Invalid Date' && !isNaN(date.getTime());
}

// Export the registration function for the server
// The _client parameter is required to match the registration function signature used by other tools
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function registerCollectionSchemaTool(server: McpServer, _client: MongoDBClient) {
  server.registerTool(
    collectionSchemaTool.name,
    {
      description: collectionSchemaTool.description,
      inputSchema: collectionSchemaSchema.shape,
    },
    collectionSchemaTool.implementation,
  );
}
