import { writeFile, mkdir, access } from "fs/promises";
import { join, dirname } from "path";

export interface FileStorageOptions {
  data: unknown;
  filePath?: string;
  baseDir?: string;
}

/**
 * Saves data to a JSON file and returns the file path
 */
export async function saveDataToFile(options: FileStorageOptions): Promise<string> {
  const { data, filePath, baseDir = "data" } = options;
  let finalPath: string;

  if (filePath) {
    // Use explicit file path
    finalPath = filePath;
  } else {
    // Generate unique file path
    const timestamp = Date.now();
    const randomId = Math.random().toString(36).substring(2, 8);
    const fileName = `mongodb-data-${timestamp}-${randomId}.json`;

    finalPath = join(baseDir, fileName);
  }

  // Ensure directory exists
  const dir = dirname(finalPath);

  await mkdir(dir, { recursive: true });

  // Check if file already exists
  try {
    await access(finalPath);
    throw new Error(`File already exists: ${finalPath}. Choose a different file path or remove the existing file.`);
  } catch (error) {
    // File doesn't exist, which is what we want
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
      throw error;
    }
  }

  // Write data to file
  const jsonData = JSON.stringify(data, null, 2);

  await writeFile(finalPath, jsonData, "utf-8");

  return finalPath;
}

/**
 * Common file storage arguments for tools
 */
export const fileStorageArgs = {
  saveToFile: {
    type: "boolean" as const,
    optional: true,
    describe: "Save results to a file instead of returning them directly. Useful for large datasets that can be analyzed by scripts.",
  },
  filePath: {
    type: "string" as const,
    optional: true,
    describe: "Explicit path to save the file (optional, auto-generated if not provided). Directory will be created if it doesn't exist.",
  },
};

/**
 * Result of file storage operation
 */
export interface FileStorageResult<T> {
  data: T;
  savedToFile?: boolean;
  filePath?: string;
}

/**
 * Processes tool result with optional file storage
 */
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
