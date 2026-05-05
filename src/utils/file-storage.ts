import { writeFile } from "fs/promises";
import { join } from "path";
import { randomUUID } from "crypto";
import { prepareExportPath, resolveExportDir } from "./streaming.js";

export interface FileStorageOptions {
  data: unknown;
  filePath?: string;
}

/**
 * Saves data to a JSON file and returns the file path.
 * Uses writeFile with flag 'wx' for an atomic create-or-fail, which avoids
 * the access()+writeFile() TOCTOU window in the previous implementation.
 */
export async function saveDataToFile(options: FileStorageOptions): Promise<string> {
  const { data, filePath } = options;
  const finalPath = filePath
    ? await prepareExportPath(filePath)
    : await prepareExportPath(join(resolveExportDir(), `mongodb-data-${Date.now()}-${randomUUID()}.json`));
  const jsonData = JSON.stringify(data, null, 2);

  // 'wx' = create-only, fail with EEXIST if the path is already taken.
  // This is the kernel-level atomic check the old access()+writeFile() pair
  // could not provide.
  try {
    await writeFile(finalPath, jsonData, { encoding: "utf-8", flag: "wx" });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'EEXIST') {
      throw new Error(`File already exists: ${finalPath}. Choose a different file path or remove the existing file.`);
    }
    throw error;
  }

  return finalPath;
}

export interface FileStorageResult<T> {
  data: T;
  savedToFile?: boolean;
  filePath?: string;
}

export async function processWithFileStorage<T>(
  data: T,
  saveToFile?: boolean,
  filePath?: string,
): Promise<FileStorageResult<T>> {
  if (saveToFile) {
    const savedPath = await saveDataToFile({
      data,
      filePath,
    });

    return {
      data,
      savedToFile: true,
      filePath: savedPath,
    };
  }

  return { data };
}
