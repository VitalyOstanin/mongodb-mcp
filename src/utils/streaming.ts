import { mkdirSync, existsSync } from 'fs';
import { mkdir } from 'fs/promises';
import { randomUUID } from 'crypto';
import { resolve, sep, join, dirname } from 'path';
import { tmpdir } from 'os';

// MCP tools accept filePath from the LLM, so an attacker controlling the
// model context could ask for a path like ../../../etc/passwd or
// /home/user/.ssh/authorized_keys. Restrict writes to a configurable
// directory (default: $TMPDIR) and reject anything outside it.
export function resolveExportDir(): string {
  const explicit = process.env.MONGODB_MCP_EXPORT_DIR;

  return explicit ? resolve(explicit) : tmpdir();
}

export function assertSafeExportPath(filePath: string): string {
  const exportDir = resolveExportDir();
  const resolved = resolve(filePath);
  const exportDirWithSep = exportDir.endsWith(sep) ? exportDir : exportDir + sep;

  if (resolved !== exportDir && !resolved.startsWith(exportDirWithSep)) {
    throw new Error(
      `Refusing to write outside export directory '${exportDir}'. Set MONGODB_MCP_EXPORT_DIR or pass a path inside it. Got: ${resolved}`,
    );
  }

  return resolved;
}

// Generates a unique file path inside the configured export directory.
// crypto.randomUUID() avoids collisions even when called within the same
// millisecond from parallel tool invocations.
export function generateTempFilePath(): string {
  const dir = resolveExportDir();

  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }

  return join(dir, `mongodb-${Date.now()}-${randomUUID()}.json`);
}

// Validates an explicit path or generates a fresh one, then ensures the
// containing directory exists. Used by every tool that supports saveToFile.
export async function prepareExportPath(filePath: string | undefined): Promise<string> {
  const finalPath = filePath ? assertSafeExportPath(filePath) : generateTempFilePath();

  await mkdir(dirname(finalPath), { recursive: true });

  return finalPath;
}
