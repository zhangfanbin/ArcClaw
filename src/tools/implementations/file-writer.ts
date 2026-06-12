import { z } from 'zod';
import fs from 'node:fs/promises';
import path from 'node:path';
import type { Tool, ToolOutput } from '../../types/tool.js';

const fileWriterSchema = z.object({
  file_path: z.string().describe('Relative path of the file to create (within workspace)'),
  content: z.string().describe('Content to write to the file'),
  overwrite: z.boolean().optional().default(false).describe('Whether to overwrite if file exists'),
});

export function createFileWriter(workspaceDir: string): Tool {
  return {
    name: 'file_writer',
    description: 'Write content to a file in the workspace. Creates parent directories if needed.',
    parameters: fileWriterSchema,
    execute: async (input): Promise<ToolOutput> => {
      const { file_path, content, overwrite } = fileWriterSchema.parse(input);

      const fullPath = path.join(workspaceDir, file_path);

      // Security: ensure file is within workspace
      if (!fullPath.startsWith(workspaceDir)) {
        return {
          success: false,
          error: `File path must be within workspace: ${workspaceDir}`,
        };
      }

      try {
        // Check if file exists
        if (!overwrite) {
          try {
            await fs.access(fullPath);
            return {
              success: false,
              error: `File already exists: ${file_path}. Set overwrite=true to replace.`,
            };
          } catch {
            // File doesn't exist, good to proceed
          }
        }

        // Create parent directories
        await fs.mkdir(path.dirname(fullPath), { recursive: true });

        // Write file
        await fs.writeFile(fullPath, content, 'utf-8');

        return {
          success: true,
          result: { file_path, bytes_written: content.length },
        };
      } catch (error: any) {
        return {
          success: false,
          error: `Failed to write file: ${error.message}`,
        };
      }
    },
  };
}
