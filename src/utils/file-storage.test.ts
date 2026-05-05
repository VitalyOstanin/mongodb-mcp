import { tmpdir } from 'os';
import { join } from 'path';
import { mkdir, readFile, rm, writeFile } from 'fs/promises';
import { saveDataToFile, processWithFileStorage } from './file-storage.js';

const ORIGINAL_EXPORT_DIR = process.env.MONGODB_MCP_EXPORT_DIR;

describe('file-storage', () => {
  const fixtureDir = join(tmpdir(), `mongo-mcp-file-storage-${Date.now()}`);

  beforeAll(async () => {
    await mkdir(fixtureDir, { recursive: true });
    process.env.MONGODB_MCP_EXPORT_DIR = fixtureDir;
  });

  afterAll(async () => {
    await rm(fixtureDir, { recursive: true, force: true });
    if (ORIGINAL_EXPORT_DIR === undefined) {
      delete process.env.MONGODB_MCP_EXPORT_DIR;
    } else {
      process.env.MONGODB_MCP_EXPORT_DIR = ORIGINAL_EXPORT_DIR;
    }
  });

  describe('saveDataToFile', () => {
    it('writes JSON to the explicit filePath and returns it', async () => {
      const target = join(fixtureDir, 'explicit.json');
      const data = { hello: 'world', n: 42 };
      const path = await saveDataToFile({ data, filePath: target });

      expect(path).toBe(target);
      expect(JSON.parse(await readFile(target, 'utf-8'))).toEqual(data);
    });

    it('generates a unique path inside the export dir when filePath is omitted', async () => {
      const data = { auto: true };
      const path = await saveDataToFile({ data });

      expect(path.startsWith(fixtureDir)).toBe(true);
      expect(JSON.parse(await readFile(path, 'utf-8'))).toEqual(data);
    });

    it('throws "File already exists" when the target already exists (wx flag)', async () => {
      const target = join(fixtureDir, 'taken.json');

      await writeFile(target, '{}', { encoding: 'utf-8' });

      await expect(saveDataToFile({ data: { x: 1 }, filePath: target }))
        .rejects.toThrow(/File already exists/);
    });

    it('rejects an explicit path outside the export dir', async () => {
      await expect(saveDataToFile({ data: { x: 1 }, filePath: '/etc/passwd' }))
        .rejects.toThrow(/Refusing to write outside/);
    });
  });

  describe('processWithFileStorage', () => {
    it('returns the data inline when saveToFile is falsy', async () => {
      const data = { inline: true };

      await expect(processWithFileStorage(data, false)).resolves.toEqual({ data });
      await expect(processWithFileStorage(data)).resolves.toEqual({ data });
    });

    it('writes the file and returns metadata when saveToFile is true', async () => {
      const data = { saved: true };
      const target = join(fixtureDir, 'process.json');
      const result = await processWithFileStorage(data, true, target);

      expect(result).toEqual({ data, savedToFile: true, filePath: target });
      expect(JSON.parse(await readFile(target, 'utf-8'))).toEqual(data);
    });

    it('generates an auto path when saveToFile=true without filePath', async () => {
      const data = { autoSave: true };
      const result = await processWithFileStorage(data, true);

      expect(result.savedToFile).toBe(true);
      expect(result.data).toEqual(data);
      expect(result.filePath).toBeDefined();
      expect(result.filePath?.startsWith(fixtureDir)).toBe(true);
      expect(JSON.parse(await readFile(result.filePath as string, 'utf-8'))).toEqual(data);
    });
  });
});
