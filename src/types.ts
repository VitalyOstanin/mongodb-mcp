export interface ServiceInfo {
  name: string;
  version: string;
  timezone: string;
  description?: string;
}

export interface MongoDBConfig {
  connectionString?: string;
  defaultDatabase?: string;
  timezone: string;
}

export interface DatabaseInfo {
  name: string;
  sizeOnDisk: number;
  empty: boolean;
}

export interface DatabaseListPayload {
  databases: DatabaseInfo[];
}

export interface CollectionInfo {
  name: string;
  type: string; // "collection", "view", "timeseries", etc.
}

export interface CollectionListPayload {
  collections: CollectionInfo[];
  database: string;
}

export interface CollectionSchema {
  sampleSize: number;
  fields: Record<string, {
    type: string;
    count: number;
    percentage: number;
    hasNull: boolean;
    uniqueValues?: number;
  }>;
}

export interface CollectionSchemaPayload {
  schema: CollectionSchema;
  database: string;
  collection: string;
}

export interface IndexInfo {
  name: string;
  key: Record<string, 1 | -1>;
  unique?: boolean;
  sparse?: boolean;
  background?: boolean;
  expireAfterSeconds?: number;
}

export interface CollectionIndexesPayload {
  indexes: IndexInfo[];
  database: string;
  collection: string;
}

export interface DocumentQuery {
  filter?: Record<string, unknown>;
  limit?: number;
  skip?: number;
  sort?: Record<string, 1 | -1>;
  projection?: Record<string, 0 | 1>;
}

export interface FindPayload {
  documents: Array<Record<string, unknown>>;
  database: string;
  collection: string;
  query: DocumentQuery;
  totalCount: number;
}

export interface CountPayload {
  count: number;
  database: string;
  collection: string;
  filter?: Record<string, unknown>;
}

export interface AggregatePayload {
  results: Array<Record<string, unknown>>;
  database: string;
  collection: string;
  pipeline: Array<Record<string, unknown>>;
}

export interface ConnectionStatus {
  connected: boolean;
  host: string;
  port: number;
  database: string;
  serverVersion: string;
  uptime: number;
  connections: {
    current: number;
    available: number;
    totalCreated: number;
  };
}

export interface ConnectionStatusPayload {
  status: ConnectionStatus;
}

export interface DatabaseStats {
  db: string;
  collections: number;
  views: number;
  objects: number;
  avgObjSize: number;
  dataSize: number;
  storageSize: number;
  indexes: number;
  indexSize: number;
  fsTotalSize: number;
  fsUsedSize: number;
}

export interface DatabaseStatsPayload {
  stats: DatabaseStats;
}

export interface MongoDBHealth {
  ok: number;
  isMaster: boolean;
  maxBsonObjectSize: number;
  maxMessageSizeBytes: number;
  localTime: Date;
  logicalSessionTimeoutMinutes: number;
}

export interface MongoDBHealthPayload {
  health: MongoDBHealth;
}

export interface ExportTarget {
  name: string;
  arguments: {
    filter?: Record<string, unknown>;
    limit?: number;
    skip?: number;
    sort?: Record<string, 1 | -1>;
    projection?: Record<string, 0 | 1>;
    pipeline?: Array<Record<string, unknown>>;
  };
}

export interface ExportInput {
  database: string;
  collection: string;
  exportTarget: ExportTarget[];
  exportTitle: string;
  jsonExportFormat?: "relaxed" | "canonical";
}

export interface ExportPayload {
  exportUrl: string;
  exportTitle: string;
  exportTarget: ExportTarget[];
}
