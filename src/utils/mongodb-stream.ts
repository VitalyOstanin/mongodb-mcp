import { createWriteStream } from 'fs';
import { Transform } from 'stream';
import { pipeline } from 'stream/promises';
import type { FindCursor, AggregationCursor } from 'mongodb';

/**
 * Transform stream that formats documents for JSON Lines format (each document as a separate JSON object on its own line)
 */
class JsonLinesTransform extends Transform {
  private isFirst: boolean = true;
  public count: number = 0;

  constructor() {
    super({ objectMode: true });
  }

  // Using 'any' for chunk type and callback parameters because Transform stream interfaces
  // require flexible typing for the data being processed
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  _transform(chunk: any, encoding: string, callback: (error?: Error | null, data?: any) => void): void {
    try {
      // For the first document, don't add a newline
      if (this.isFirst) {
        this.isFirst = false;
      } else {
        // Add newline before the JSON string for subsequent documents
        callback(null, `\n${JSON.stringify(chunk)}`);
        this.count++;

        return;
      }
      // First document doesn't have a newline before it
      callback(null, JSON.stringify(chunk));
      this.count++;
    } catch (err) {
      callback(err as Error);
    }
  }
}


/**
 * Transform stream that formats documents as a JSON array
 */
class JsonArrayTransform extends Transform {
  private isFirst: boolean = true;
  public count: number = 0;

  constructor() {
    super({ objectMode: true });
  }

  // Using 'any' for chunk type and callback parameters because Transform stream interfaces
  // require flexible typing for the data being processed
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  _transform(chunk: any, encoding: string, callback: (error?: Error | null, data?: any) => void): void {
    try {
      let result: string;

      if (this.isFirst) {
        this.isFirst = false;
        result = `[\n${JSON.stringify(chunk)}`;
      } else {
        result = `,\n${JSON.stringify(chunk)}`;
      }
      callback(null, result);
      this.count++;
    } catch (err) {
      callback(err as Error);
    }
  }

  // Using 'any' for callback parameter because Transform stream interfaces
  // require flexible typing for the data being processed
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  _flush(callback: (error?: Error | null, data?: any) => void): void {
    // Close the JSON array when the stream is done
    callback(null, this.isFirst ? '[]' : '\n]');
  }
}

/**
 * Streams MongoDB cursor directly to a file in JSON Lines format (each document as separate JSON object)
 * @param cursor MongoDB cursor to stream from
 * @param filePath Path to the output file
 * @returns The number of documents processed
 */
export async function streamMongoCursorToFile(cursor: FindCursor | AggregationCursor, filePath: string): Promise<number> {
  // Create a write stream to the output file
  const writeStream = createWriteStream(filePath, { encoding: 'utf8' });
  // Create a JSON Lines transform to format the documents
  const jsonLinesTransform = new JsonLinesTransform();

  // Set up the pipeline: cursor -> transform -> file
  await pipeline(
    // Create a readable stream from the cursor
    async function* () {
      for await (const doc of cursor) {
        yield doc;
      }
    }(),
    jsonLinesTransform,
    writeStream,
  );

  return jsonLinesTransform.count;
}

/**
 * Streams MongoDB cursor directly to a file in JSON array format
 * @param cursor MongoDB cursor to stream from
 * @param filePath Path to the output file
 * @returns The number of documents processed
 */
export async function streamMongoCursorToFileAsArray(cursor: FindCursor | AggregationCursor, filePath: string): Promise<number> {
  // Create a write stream to the output file
  const writeStream = createWriteStream(filePath, { encoding: 'utf8' });
  // Create a JSON array transform to format the documents
  const jsonArrayTransform = new JsonArrayTransform();

  // Set up the pipeline: cursor -> transform -> file
  await pipeline(
    // Create a readable stream from the cursor
    async function* () {
      for await (const doc of cursor) {
        yield doc;
      }
    }(),
    jsonArrayTransform,
    writeStream,
  );

  return jsonArrayTransform.count;
}

export type MongoCursor = FindCursor | AggregationCursor;
