import { z } from 'zod';
import fs from 'node:fs/promises';
import path from 'node:path';
import type { Tool, ToolOutput } from '../../types/tool.js';

const fileReaderSchema = z.object({
  file_path: z.string().describe('Relative path of the file to read (within workspace)'),
});

export function createFileReader(workspaceDir: string): Tool {
  return {
    name: 'file_reader',
    description: 'Read the contents of a file from the workspace. Returns the file content as text.',
    parameters: fileReaderSchema,
    execute: async (input): Promise<ToolOutput> => {
      const { file_path } = fileReaderSchema.parse(input);

      const fullPath = path.join(workspaceDir, file_path);

      // Security: ensure file is within workspace
      if (!fullPath.startsWith(workspaceDir)) {
        return {
          success: false,
          error: `File path must be within workspace: ${workspaceDir}`,
        };
      }

      try {
        const content = await fs.readFile(fullPath, 'utf-8');
        return {
          success: true,
          result: { file_path, content, size: content.length },
        };
      } catch (error: any) {
        if (error.code === 'ENOENT') {
          return {
            success: false,
            error: `File not found: ${file_path}`,
          };
        }
        return {
          success: false,
          error: `Failed to read file: ${error.message}`,
        };
      }
    },
  };
}
