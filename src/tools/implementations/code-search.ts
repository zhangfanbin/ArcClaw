import { z } from 'zod';
import fs from 'node:fs/promises';
import path from 'node:path';
import type { Tool, ToolOutput } from '../../types/tool.js';

const codeSearchSchema = z.object({
  pattern: z.string().describe('Text or regex pattern to search for'),
  file_pattern: z.string().optional().describe('Glob pattern to filter files (e.g., "*.ts")'),
  max_results: z.number().optional().default(50).describe('Maximum number of results'),
});

export function createCodeSearch(workspaceDir: string): Tool {
  return {
    name: 'code_search',
    description: 'Search for text patterns in code files within the workspace.',
    parameters: codeSearchSchema,
    execute: async (input): Promise<ToolOutput> => {
      const { pattern, file_pattern, max_results } = codeSearchSchema.parse(input);

      try {
        const results: Array<{ file: string; line: number; content: string }> = [];
        const regex = new RegExp(pattern, 'gi');

        async function searchDir(dir: string): Promise<void> {
          if (results.length >= max_results) return;

          const entries = await fs.readdir(dir, { withFileTypes: true });

          for (const entry of entries) {
            if (results.length >= max_results) break;

            const fullPath = path.join(dir, entry.name);
            const relativePath = path.relative(workspaceDir, fullPath);

            // Skip common non-code directories
            if (
              entry.isDirectory() &&
              !['node_modules', '.git', 'dist', 'build'].includes(entry.name)
            ) {
              await searchDir(fullPath);
            } else if (entry.isFile()) {
              // Check file pattern
              if (file_pattern && !entry.name.match(globToRegex(file_pattern))) {
                continue;
              }

              // Only search text files
              if (!isTextFile(entry.name)) continue;

              try {
                const content = await fs.readFile(fullPath, 'utf-8');
                const lines = content.split('\n');

                for (let i = 0; i < lines.length; i++) {
                  if (results.length >= max_results) break;
                  if (regex.test(lines[i])) {
                    results.push({
                      file: relativePath,
                      line: i + 1,
                      content: lines[i].trim(),
                    });
                    regex.lastIndex = 0; // Reset regex
                  }
                }
              } catch {
                // Skip files that can't be read
              }
            }
          }
        }

        await searchDir(workspaceDir);

        return {
          success: true,
          result: {
            pattern,
            total_results: results.length,
            results,
          },
        };
      } catch (error: any) {
        return {
          success: false,
          error: `Search failed: ${error.message}`,
        };
      }
    },
  };
}

function globToRegex(glob: string): RegExp {
  const escaped = glob
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')
    .replace(/\*/g, '.*')
    .replace(/\?/g, '.');
  return new RegExp(`^${escaped}$`);
}

function isTextFile(filename: string): boolean {
  const textExtensions = [
    '.ts', '.tsx', '.js', '.jsx', '.json', '.md', '.txt',
    '.css', '.scss', '.html', '.yaml', '.yml', '.xml',
    '.sh', '.bash', '.env', '.gitignore', '.py', '.go',
  ];
  const ext = path.extname(filename).toLowerCase();
  return textExtensions.includes(ext) || !ext;
}
