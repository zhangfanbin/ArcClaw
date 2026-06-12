import { z } from 'zod';
import fs from 'node:fs/promises';
import path from 'node:path';
import type { Tool, ToolOutput } from '../../types/tool.js';

const fileEditorSchema = z.object({
  file_path: z.string().describe('Relative path of the file to edit (within workspace)'),
  original_text: z.string().describe('The exact text to find and replace'),
  new_text: z.string().describe('The replacement text'),
  replace_all: z.boolean().optional().default(false).describe('Replace all occurrences'),
});

export function createFileEditor(workspaceDir: string): Tool {
  return {
    name: 'file_editor',
    description: 'Edit an existing file by finding and replacing text.',
    parameters: fileEditorSchema,
    execute: async (input): Promise<ToolOutput> => {
      const { file_path, original_text, new_text, replace_all } =
        fileEditorSchema.parse(input);

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

        let updatedContent: string;
        let replacements = 0;

        if (replace_all) {
          updatedContent = content.replaceAll(original_text, () => {
            replacements++;
            return new_text;
          });
        } else {
          const index = content.indexOf(original_text);
          if (index === -1) {
            return {
              success: false,
              error: `Original text not found in file: ${file_path}`,
            };
          }
          updatedContent =
            content.slice(0, index) +
            new_text +
            content.slice(index + original_text.length);
          replacements = 1;
        }

        if (replacements === 0) {
          return {
            success: false,
            error: `Original text not found in file: ${file_path}`,
          };
        }

        await fs.writeFile(fullPath, updatedContent, 'utf-8');

        return {
          success: true,
          result: {
            file_path,
            replacements,
            bytes_written: updatedContent.length,
          },
        };
      } catch (error: any) {
        return {
          success: false,
          error: `Failed to edit file: ${error.message}`,
        };
      }
    },
  };
}
