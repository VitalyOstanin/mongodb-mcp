import { z } from 'zod';

// Shared zod fragments for tools that support exporting their result to a file.
// Tools spread this object into their input schema so the wording stays in one place.
export const saveToFileSchemaFragment = {
  saveToFile: z.boolean().optional()
    .describe('Save results to a file instead of returning them directly. Useful for large datasets that can be analyzed by scripts.'),
  filePath: z.string().optional()
    .describe('Explicit path to save the file (optional, auto-generated if not provided). Directory will be created if it does not exist.'),
  format: z.enum(['jsonl', 'json']).optional().default('jsonl')
    .describe('Output format when saving to file: jsonl (JSON Lines) or json (JSON array format)'),
};
