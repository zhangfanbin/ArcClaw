import { z } from 'zod';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import type { Tool, ToolOutput } from '../../types/tool.js';

const execFileAsync = promisify(execFile);

const bashSchema = z.object({
  command: z.string().describe('The shell command to execute'),
  cwd: z.string().optional().describe('Working directory for the command'),
  timeout: z.number().optional().default(30000).describe('Timeout in milliseconds'),
});

export function createBashExecutor(workspaceDir: string): Tool {
  return {
    name: 'bash_executor',
    description: 'Execute shell commands in the agent workspace. Use for running builds, tests, npm commands, etc.',
    parameters: bashSchema,
    execute: async (input): Promise<ToolOutput> => {
      const { command, cwd, timeout } = bashSchema.parse(input);

      // Security: restrict working directory to workspace
      const workDir = cwd || workspaceDir;
      if (!workDir.startsWith(workspaceDir)) {
        return {
          success: false,
          error: `Working directory must be within workspace: ${workspaceDir}`,
        };
      }

      try {
        const { stdout, stderr } = await execFileAsync('sh', ['-c', command], {
          cwd: workDir,
          timeout,
          maxBuffer: 1024 * 1024 * 10, // 10MB
          env: { ...process.env, PATH: process.env.PATH },
        });

        return {
          success: true,
          stdout: stdout.trim(),
          stderr: stderr.trim(),
          result: { exitCode: 0 },
        };
      } catch (error: any) {
        return {
          success: false,
          stdout: error.stdout?.trim() || '',
          stderr: error.stderr?.trim() || error.message,
          error: `Command failed: ${error.message}`,
          result: { exitCode: error.code || 1 },
        };
      }
    },
  };
}
