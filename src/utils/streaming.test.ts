import { tmpdir } from 'os';
import { join } from 'path';
import { rm, writeFile, mkdir } from 'fs/promises';
import {
  resolveExportDir,
  assertSafeExportPath,
  generateTempFilePath,
  prepareExportPath,
} from './streaming.js';

const ORIGINAL_EXPORT_DIR = process.env.MONGODB_MCP_EXPORT_DIR;

describe('export path utilities', () => {
  afterEach(() => {
    if (ORIGINAL_EXPORT_DIR === undefined) {
      delete process.env.MONGODB_MCP_EXPORT_DIR;
    } else {
      process.env.MONGODB_MCP_EXPORT_DIR = ORIGINAL_EXPORT_DIR;
    }
  });

  describe('resolveExportDir', () => {
    it('should default to os.tmpdir() when MONGODB_MCP_EXPORT_DIR is unset', () => {
      delete process.env.MONGODB_MCP_EXPORT_DIR;
      expect(resolveExportDir()).toBe(tmpdir());
    });

    it('should honour MONGODB_MCP_EXPORT_DIR when set', () => {
      process.env.MONGODB_MCP_EXPORT_DIR = '/var/data/mongo-mcp';
      expect(resolveExportDir()).toBe('/var/data/mongo-mcp');
    });
  });

  describe('assertSafeExportPath', () => {
    it('should accept paths inside the export directory', () => {
      process.env.MONGODB_MCP_EXPORT_DIR = '/tmp/mongo-mcp-test';
      expect(assertSafeExportPath('/tmp/mongo-mcp-test/out.json')).toBe('/tmp/mongo-mcp-test/out.json');
      expect(assertSafeExportPath('/tmp/mongo-mcp-test/sub/out.json')).toBe('/tmp/mongo-mcp-test/sub/out.json');
    });

    it('should reject path traversal attempts', () => {
      process.env.MONGODB_MCP_EXPORT_DIR = '/tmp/mongo-mcp-test';
      expect(() => assertSafeExportPath('/tmp/mongo-mcp-test/../etc/passwd')).toThrow(/Refusing to write outside/);
      expect(() => assertSafeExportPath('/etc/passwd')).toThrow(/Refusing to write outside/);
      expect(() => assertSafeExportPath('/home/user/.ssh/authorized_keys')).toThrow(/Refusing to write outside/);
    });

    it('should reject sibling directories that share a prefix', () => {
      process.env.MONGODB_MCP_EXPORT_DIR = '/tmp/mongo-mcp';
      expect(() => assertSafeExportPath('/tmp/mongo-mcp-evil/out.json')).toThrow(/Refusing to write outside/);
    });
  });

  describe('generateTempFilePath', () => {
    it('should produce unique paths under the export directory', () => {
      delete process.env.MONGODB_MCP_EXPORT_DIR;
      const a = generateTempFilePath();
      const b = generateTempFilePath();

      expect(a).not.toBe(b);
      expect(a.startsWith(tmpdir())).toBe(true);
    });
  });

  describe('prepareExportPath', () => {
    const fixtureDir = join(tmpdir(), `mongo-mcp-prepare-${Date.now()}`);

    afterAll(async () => {
      await rm(fixtureDir, { recursive: true, force: true });
    });

    beforeEach(() => {
      process.env.MONGODB_MCP_EXPORT_DIR = fixtureDir;
    });

    it('should generate a path when filePath is undefined', async () => {
      const path = await prepareExportPath(undefined);

      expect(path.startsWith(fixtureDir)).toBe(true);
    });

    it('should accept an explicit path inside the export dir and create its parent', async () => {
      const target = join(fixtureDir, 'nested/dir/out.json');
      const result = await prepareExportPath(target);

      expect(result).toBe(target);
    });

    it('should reject explicit paths outside the export dir', async () => {
      await expect(prepareExportPath('/etc/passwd')).rejects.toThrow(/Refusing to write outside/);
    });
  });
});

// Lightweight integration to make sure the helpers actually compose with fs.
describe('writeFile integration with prepareExportPath (wx flag enforces no-overwrite)', () => {
  const fixtureDir = join(tmpdir(), `mongo-mcp-wx-${Date.now()}`);

  beforeAll(async () => {
    process.env.MONGODB_MCP_EXPORT_DIR = fixtureDir;
    await mkdir(fixtureDir, { recursive: true });
  });

  afterAll(async () => {
    await rm(fixtureDir, { recursive: true, force: true });
    if (ORIGINAL_EXPORT_DIR === undefined) {
      delete process.env.MONGODB_MCP_EXPORT_DIR;
    } else {
      process.env.MONGODB_MCP_EXPORT_DIR = ORIGINAL_EXPORT_DIR;
    }
  });

  it('writes once but the second write with flag wx fails with EEXIST', async () => {
    const target = join(fixtureDir, 'once.json');

    await prepareExportPath(target);
    await writeFile(target, '{}', { encoding: 'utf-8', flag: 'wx' });
    await expect(writeFile(target, '{}', { encoding: 'utf-8', flag: 'wx' })).rejects.toMatchObject({ code: 'EEXIST' });
  });
});
