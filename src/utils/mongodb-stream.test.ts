import { tmpdir } from 'os';
import { join } from 'path';
import { mkdir, readFile, rm } from 'fs/promises';
import type { FindCursor } from 'mongodb';
import { streamMongoCursorToFile, streamMongoCursorToFileAsArray } from './mongodb-stream.js';

function makeCursor<T>(docs: T[]): FindCursor {
  // Drives the async iteration that streamMongoCursor* uses; the rest of
  // the FindCursor surface is unused by these helpers.
  return {
    async *[Symbol.asyncIterator]() {
      for (const doc of docs) {
        yield doc;
      }
    },
  } as unknown as FindCursor;
}

describe('mongodb-stream', () => {
  const fixtureDir = join(tmpdir(), `mongo-mcp-stream-${Date.now()}`);

  beforeAll(async () => {
    await mkdir(fixtureDir, { recursive: true });
  });

  afterAll(async () => {
    await rm(fixtureDir, { recursive: true, force: true });
  });

  describe('streamMongoCursorToFile (JSON Lines)', () => {
    it('writes nothing and returns 0 for an empty cursor', async () => {
      const target = join(fixtureDir, 'empty-jsonl.txt');
      const count = await streamMongoCursorToFile(makeCursor([]), target);

      expect(count).toBe(0);
      expect(await readFile(target, 'utf-8')).toBe('');
    });

    it('writes a single document without trailing newline and returns 1', async () => {
      const target = join(fixtureDir, 'single-jsonl.txt');
      const count = await streamMongoCursorToFile(makeCursor([{ a: 1 }]), target);

      expect(count).toBe(1);
      expect(await readFile(target, 'utf-8')).toBe('{"a":1}');
    });

    it('separates multiple documents with \\n and returns the count', async () => {
      const target = join(fixtureDir, 'multi-jsonl.txt');
      const docs = [{ a: 1 }, { b: 2 }, { c: 3 }];
      const count = await streamMongoCursorToFile(makeCursor(docs), target);

      expect(count).toBe(3);

      const lines = (await readFile(target, 'utf-8')).split('\n');

      expect(lines).toHaveLength(3);
      expect(lines.map((l) => JSON.parse(l))).toEqual(docs);
    });
  });

  describe('streamMongoCursorToFileAsArray (JSON array)', () => {
    it('writes "[]" and returns 0 for an empty cursor', async () => {
      const target = join(fixtureDir, 'empty-array.json');
      const count = await streamMongoCursorToFileAsArray(makeCursor([]), target);

      expect(count).toBe(0);
      expect(await readFile(target, 'utf-8')).toBe('[]');
    });

    it('writes a single document inside an array and returns 1', async () => {
      const target = join(fixtureDir, 'single-array.json');
      const count = await streamMongoCursorToFileAsArray(makeCursor([{ a: 1 }]), target);

      expect(count).toBe(1);

      const text = await readFile(target, 'utf-8');

      expect(JSON.parse(text)).toEqual([{ a: 1 }]);
    });

    it('writes multiple documents as a valid JSON array and returns the count', async () => {
      const target = join(fixtureDir, 'multi-array.json');
      const docs = [{ a: 1 }, { b: 2 }, { c: 3 }];
      const count = await streamMongoCursorToFileAsArray(makeCursor(docs), target);

      expect(count).toBe(3);

      const text = await readFile(target, 'utf-8');

      expect(JSON.parse(text)).toEqual(docs);
    });
  });
});
