import type { MongoClient, Db, Collection } from 'mongodb';
import { MongoDBClient } from './mongodb-client.js';

// Mock MongoDB objects for testing
const mockAggregateCursor = {
  explain: jest.fn(),
  [Symbol.asyncIterator]: jest.fn(),
};
const mockFindCursor = {
  explain: jest.fn(),
  project: jest.fn().mockReturnThis(),
  limit: jest.fn().mockReturnThis(),
  sort: jest.fn().mockReturnThis(),
};
const mockCollection: jest.Mocked<Collection> = {
  aggregate: jest.fn().mockReturnValue(mockAggregateCursor),
  find: jest.fn().mockReturnValue(mockFindCursor),
  findOne: jest.fn().mockReturnValue({}),
  countDocuments: jest.fn().mockResolvedValue(0),
  insertOne: jest.fn(),
  insertMany: jest.fn(),
  updateOne: jest.fn(),
  updateMany: jest.fn(),
  deleteOne: jest.fn(),
  deleteMany: jest.fn(),
  findOneAndReplace: jest.fn(),
  findOneAndUpdate: jest.fn(),
  findOneAndDelete: jest.fn(),
  bulkWrite: jest.fn(),
  createIndex: jest.fn(),
  dropIndex: jest.fn(),
  drop: jest.fn(),
} as unknown as jest.Mocked<Collection>;
const mockDb: jest.Mocked<Db> = {
  collection: jest.fn().mockReturnValue(mockCollection),
  aggregate: jest.fn().mockReturnValue(mockAggregateCursor),
  insertOne: jest.fn(),
} as unknown as jest.Mocked<Db>;
const mockMongoClient: jest.Mocked<MongoClient> = {
  connect: jest.fn().mockResolvedValue(undefined),
  db: jest.fn().mockReturnValue(mockDb),
  close: jest.fn().mockResolvedValue(undefined),
} as unknown as jest.Mocked<MongoClient>;

describe('MongoDBClient', () => {
  let client: MongoDBClient;

  beforeEach(() => {
    jest.clearAllMocks();
    client = MongoDBClient.getInstance();
    // Accessing private properties for testing purposes
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (client as any).client = mockMongoClient;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (client as any).isConnected = true;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (client as any).connectionString = 'mongodb://localhost:27017';
  });

  afterEach(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (client as any).readonlyMode = false;
  });

  describe('getDatabase in read-only mode', () => {
    beforeEach(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (client as any).readonlyMode = true;
    });

    it('should block write operations like insertOne', () => {
      const db = client.getDatabase('test');

      expect(() => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (db as any).insertOne({});
      }).toThrow("Operation 'insertOne' is not allowed in read-only mode");
    });

    it('should allow read operations like collection access', () => {
      const db = client.getDatabase('test');
      const collection = db.collection('users');

      expect(collection).toBeDefined();
      expect(mockDb.collection).toHaveBeenCalledWith('users');
    });

    it('should allow safe aggregation operations', () => {
      const db = client.getDatabase('test');
      const pipeline = [
        { $match: { status: 'active' } },
        { $project: { name: 1, status: 1 } },
      ];
      const result = db.aggregate(pipeline);

      expect(result).toBeDefined();
      expect(mockDb.aggregate).toHaveBeenCalled();
    });

    it('should block database-level aggregation with $out stage', () => {
      const db = client.getDatabase('test');
      const pipeline = [
        { $match: { status: 'active' } },
        { $out: 'output_collection' },
      ];

      expect(() => {
        db.aggregate(pipeline);
      }).toThrow("Aggregation stage '$out' is not allowed in read-only mode");
    });

    it('should block database-level aggregation with $merge stage', () => {
      const db = client.getDatabase('test');
      const pipeline = [
        { $match: { status: 'active' } },
        { $merge: { into: 'target_collection' } },
      ];

      expect(() => {
        db.aggregate(pipeline);
      }).toThrow("Aggregation stage '$merge' is not allowed in read-only mode");
    });
  });

  describe('Collection proxy in read-only mode', () => {
    beforeEach(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (client as any).readonlyMode = true;
    });

    it('should allow safe collection-level aggregation operations', () => {
      const db = client.getDatabase('test');
      const collection = db.collection('users');
      const pipeline = [
        { $match: { status: 'active' } },
        { $project: { name: 1, status: 1 } },
      ];
      const result = collection.aggregate(pipeline);

      expect(result).toBeDefined();
      expect(mockCollection.aggregate).toHaveBeenCalled();
    });

    it('should block collection-level aggregation with $out stage', () => {
      const db = client.getDatabase('test');
      const collection = db.collection('users');
      const pipeline = [
        { $match: { status: 'active' } },
        { $out: 'output_collection' },
      ];

      expect(() => {
        collection.aggregate(pipeline);
      }).toThrow("Aggregation stage '$out' is not allowed in read-only mode");
    });

    it('should block collection-level aggregation with $merge stage', () => {
      const db = client.getDatabase('test');
      const collection = db.collection('users');
      const pipeline = [
        { $match: { status: 'active' } },
        { $merge: { into: 'target_collection' } },
      ];

      expect(() => {
        collection.aggregate(pipeline);
      }).toThrow("Aggregation stage '$merge' is not allowed in read-only mode");
    });

    it('should handle mixed pipelines correctly - safe pipeline should pass', () => {
      const db = client.getDatabase('test');
      const collection = db.collection('users');
      const pipeline = [
        { $match: { status: 'active' } },
        { $group: { _id: '$category', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 10 },
      ];
      const result = collection.aggregate(pipeline);

      expect(result).toBeDefined();
      expect(mockCollection.aggregate).toHaveBeenCalled();
    });

    it('should handle mixed pipelines correctly - dangerous pipeline should be blocked', () => {
      const db = client.getDatabase('test');
      const collection = db.collection('users');
      const pipeline = [
        { $match: { status: 'active' } },
        { $group: { _id: '$category', count: { $sum: 1 } } },
        { $out: 'results' },
      ];

      expect(() => {
        collection.aggregate(pipeline);
      }).toThrow("Aggregation stage '$out' is not allowed in read-only mode");
    });

    it('should block collection-level write operations like insertOne', () => {
      const db = client.getDatabase('test');
      const collection = db.collection('users');

      expect(() => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (collection as any).insertOne({ name: 'test' });
      }).toThrow("Operation 'insertOne' is not allowed in read-only mode");
    });

    it('should block collection-level write operations like insertMany', () => {
      const db = client.getDatabase('test');
      const collection = db.collection('users');

      expect(() => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (collection as any).insertMany([{ name: 'test1' }, { name: 'test2' }]);
      }).toThrow("Operation 'insertMany' is not allowed in read-only mode");
    });

    it('should block collection-level write operations like updateOne', () => {
      const db = client.getDatabase('test');
      const collection = db.collection('users');

      expect(() => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (collection as any).updateOne({ name: 'test' }, { $set: { updated: true } });
      }).toThrow("Operation 'updateOne' is not allowed in read-only mode");
    });

    it('should block collection-level write operations like updateMany', () => {
      const db = client.getDatabase('test');
      const collection = db.collection('users');

      expect(() => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (collection as any).updateMany({ name: 'test' }, { $set: { updated: true } });
      }).toThrow("Operation 'updateMany' is not allowed in read-only mode");
    });

    it('should block collection-level write operations like deleteOne', () => {
      const db = client.getDatabase('test');
      const collection = db.collection('users');

      expect(() => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (collection as any).deleteOne({ name: 'test' });
      }).toThrow("Operation 'deleteOne' is not allowed in read-only mode");
    });

    it('should block collection-level write operations like deleteMany', () => {
      const db = client.getDatabase('test');
      const collection = db.collection('users');

      expect(() => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (collection as any).deleteMany({ name: 'test' });
      }).toThrow("Operation 'deleteMany' is not allowed in read-only mode");
    });

    it('should block collection-level write operations like findOneAndReplace', () => {
      const db = client.getDatabase('test');
      const collection = db.collection('users');

      expect(() => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (collection as any).findOneAndReplace({ name: 'test' }, { name: 'replacement' });
      }).toThrow("Operation 'findOneAndReplace' is not allowed in read-only mode");
    });

    it('should block collection-level write operations like findOneAndUpdate', () => {
      const db = client.getDatabase('test');
      const collection = db.collection('users');

      expect(() => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (collection as any).findOneAndUpdate({ name: 'test' }, { $set: { updated: true } });
      }).toThrow("Operation 'findOneAndUpdate' is not allowed in read-only mode");
    });

    it('should block collection-level write operations like findOneAndDelete', () => {
      const db = client.getDatabase('test');
      const collection = db.collection('users');

      expect(() => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (collection as any).findOneAndDelete({ name: 'test' });
      }).toThrow("Operation 'findOneAndDelete' is not allowed in read-only mode");
    });

    it('should block collection-level write operations like bulkWrite', () => {
      const db = client.getDatabase('test');
      const collection = db.collection('users');

      expect(() => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (collection as any).bulkWrite([{ insertOne: { document: { name: 'test' } } }]);
      }).toThrow("Operation 'bulkWrite' is not allowed in read-only mode");
    });

    it('should block collection-level write operations like createIndex', () => {
      const db = client.getDatabase('test');
      const collection = db.collection('users');

      expect(() => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (collection as any).createIndex({ name: 1 });
      }).toThrow("Operation 'createIndex' is not allowed in read-only mode");
    });

    it('should block collection-level write operations like dropIndex', () => {
      const db = client.getDatabase('test');
      const collection = db.collection('users');

      expect(() => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (collection as any).dropIndex({ name: 1 });
      }).toThrow("Operation 'dropIndex' is not allowed in read-only mode");
    });

    it('should block collection-level write operations like drop', () => {
      const db = client.getDatabase('test');
      const collection = db.collection('users');

      expect(() => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (collection as any).drop();
      }).toThrow("Operation 'drop' is not allowed in read-only mode");
    });

    it('should allow collection-level read operations like find', () => {
      const db = client.getDatabase('test');
      const collection = db.collection('users');

      expect(() => {
        collection.find({ name: 'test' });
      }).not.toThrow();
    });

    it('should allow collection-level read operations like findOne', () => {
      const db = client.getDatabase('test');
      const collection = db.collection('users');

      expect(() => {
        collection.findOne({ name: 'test' });
      }).not.toThrow();
    });

    it('should allow collection-level read operations like countDocuments', () => {
      const db = client.getDatabase('test');
      const collection = db.collection('users');

      expect(() => {
        collection.countDocuments({ name: 'test' });
      }).not.toThrow();
    });
  });

  describe('Non-read-only mode', () => {
    beforeEach(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (client as any).readonlyMode = false;
    });

    it('should allow all operations including write operations', () => {
      const db = client.getDatabase('test');

      // This should not throw in non-read-only mode
      expect(() => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (db as any).insertOne({});
      }).not.toThrow();
    });

    it('should allow all aggregation operations including dangerous ones', () => {
      const db = client.getDatabase('test');
      const pipeline = [
        { $match: { status: 'active' } },
        { $out: 'output_collection' },
      ];

      // This should not throw in non-read-only mode
      expect(() => {
        db.aggregate(pipeline);
      }).not.toThrow();
    });
  });

  describe('Aggregation pipeline validation', () => {
    const dangerousStages = ['$out', '$merge'];
    const safeStages = [
      '$match', '$project', '$group', '$sort', '$limit', '$skip',
      '$unwind', '$lookup', '$addFields', '$set', '$unset', '$replaceRoot',
    ];

    beforeEach(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (client as any).readonlyMode = true;
    });

    test.each(dangerousStages)('should block aggregation with dangerous stage %s', (stage) => {
      const db = client.getDatabase('test');
      const collection = db.collection('users');
      const pipeline = [
        { $match: { status: 'active' } },
        { [stage]: stage === '$out' ? 'output_collection' : { into: 'target_collection' } },
      ];

      expect(() => {
        collection.aggregate(pipeline);
      }).toThrow(`Aggregation stage '${stage}' is not allowed in read-only mode`);
    });

    test.each(safeStages)('should allow aggregation with safe stage %s', (stage) => {
      const db = client.getDatabase('test');
      const collection = db.collection('users');
      const pipeline = [
        { $match: { status: 'active' } },
        { [stage]: {} },
      ];

      expect(() => {
        collection.aggregate(pipeline);
      }).not.toThrow();
    });
  });
});
