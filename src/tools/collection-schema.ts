import { z } from 'zod';
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ObjectId } from 'mongodb';
import type { MongoDBClient } from '../mongodb-client.js';
import { toolSuccess, toolError } from '../utils/tool-response.js';
import { prepareExportPath } from '../utils/streaming.js';
import { writeFile } from 'fs/promises';
import { saveToFileSchemaFragment } from '../utils/save-to-file-schema.js';

const { saveToFile: saveToFileFragment, filePath: filePathFragment } = saveToFileSchemaFragment;

const collectionSchemaSchema = z.object({
  database: z.string().describe('Database name'),
  collection: z.string().describe('Collection name'),
  sampleSize: z.number().optional().default(50).describe('Number of documents to sample for schema inference'),
  saveToFile: saveToFileFragment,
  filePath: filePathFragment,
});

export type CollectionSchemaParams = z.infer<typeof collectionSchemaSchema>;

interface PropertySchema {
  type: string;
  anyOf?: Array<{ type: string }>;
}

interface SchemaInferenceResult {
  properties: Record<string, PropertySchema>;
  required: string[];
}

// Strict ISO 8601 (date-only or date+time). new Date('123') happily produces
// year 0123-01-01, so anything we accept must look like ISO at minimum.
const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}([T ]\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:?\d{2})?)?$/;

function isLikelyIsoDate(value: string): boolean {
  if (!ISO_DATE_PATTERN.test(value)) {
    return false;
  }

  const parsed = Date.parse(value);

  return Number.isFinite(parsed);
}

function getTypeOfValue(value: unknown): string {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  if (value instanceof Date) return 'date';

  if (value instanceof ObjectId) return 'objectId';

  // Other BSON types (Decimal128, Long, Binary, ...) carry _bsontype as a string.
  if (value && typeof value === 'object' && '_bsontype' in value && typeof value._bsontype === 'string') {
    return value._bsontype.toLowerCase();
  }

  switch (typeof value) {
    case 'string':
      return isLikelyIsoDate(value) ? 'date' : 'string';
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

  return typeof value;
}

function getMoreGeneralType(type1: string, type2: string): string {
  if ((type1 === 'integer' && type2 === 'number') || (type1 === 'number' && type2 === 'integer')) {
    return 'number';
  }

  if (type1 === 'object' || type2 === 'object') {
    return 'object';
  }

  return 'mixed';
}

export function inferSchema(documents: unknown[]): SchemaInferenceResult {
  if (documents.length === 0) {
    return { properties: {}, required: [] };
  }

  const properties: Record<string, PropertySchema> = {};
  const typesPerKey = new Map<string, Set<string>>();
  const presentCount = new Map<string, number>();

  for (const doc of documents) {
    if (!doc || typeof doc !== 'object') {
      continue;
    }

    for (const [key, value] of Object.entries(doc)) {
      const valueType = getTypeOfValue(value);
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
      if (!properties[key]) {
        properties[key] = { type: valueType };
        typesPerKey.set(key, new Set([valueType]));
      } else {
        const seenTypes = typesPerKey.get(key)!;

        if (!seenTypes.has(valueType)) {
          seenTypes.add(valueType);
          // Type already differs from the first one we saw -- promote it.
          if (seenTypes.size === 2) {
            properties[key].type = getMoreGeneralType(properties[key].type, valueType);
            properties[key].anyOf = Array.from(seenTypes).map((t) => ({ type: t }));
          } else {
            properties[key].type = 'mixed';
            properties[key].anyOf = Array.from(seenTypes).map((t) => ({ type: t }));
          }
        }
      }

      if (value !== undefined && value !== null) {
        presentCount.set(key, (presentCount.get(key) ?? 0) + 1);
      }
    }
  }

  const required: string[] = [];

  for (const [key, count] of presentCount) {
    if (count === documents.length) {
      required.push(key);
    }
  }

  return { properties, required };
}

async function sampleDocuments(
  client: MongoDBClient,
  database: string,
  collectionName: string,
  sampleSize: number,
) {
  const db = client.getDatabase(database);
  const collection = db.collection(collectionName);

  return collection.find({}).limit(sampleSize).toArray();
}

interface SchemaResponse {
  database: string;
  collection: string;
  sampleSize: number;
  schema: SchemaInferenceResult;
  message?: string;
}

function buildResponse(
  database: string,
  collection: string,
  documents: unknown[],
  requestedSampleSize: number,
): SchemaResponse {
  if (documents.length === 0) {
    return {
      database,
      collection,
      sampleSize: requestedSampleSize,
      schema: { properties: {}, required: [] },
      message: 'No documents found in the collection to infer schema',
    };
  }

  return {
    database,
    collection,
    sampleSize: documents.length,
    schema: inferSchema(documents),
  };
}

export function registerCollectionSchemaTool(server: McpServer, client: MongoDBClient) {
  server.registerTool(
    'collection-schema',
    {
      title: 'Collection Schema',
      description: 'Describe the schema for a collection by sampling documents',
      inputSchema: collectionSchemaSchema.shape,
      annotations: {
        readOnlyHint: true,
      },
    },
    async (params: CollectionSchemaParams) => {
      if (!client.isConnectedToMongoDB()) {
        return toolError(new Error('Not connected to MongoDB. Please connect first.'));
      }

      try {
        const documents = await sampleDocuments(client, params.database, params.collection, params.sampleSize);
        const response = buildResponse(params.database, params.collection, documents, params.sampleSize);

        if (params.saveToFile) {
          const filePath = await prepareExportPath(params.filePath);

          await writeFile(filePath, JSON.stringify(response, null, 2), { encoding: 'utf8', flag: 'wx' });

          return toolSuccess({
            savedToFile: true,
            filePath,
            database: params.database,
            collection: params.collection,
            message: response.message ?? 'Schema inference completed',
          });
        }

        return toolSuccess(response);
      } catch (error) {
        return toolError(error);
      }
    },
  );
}
