// Tool system types
import type { z } from 'zod';

export interface ToolInput {
  [key: string]: unknown;
}

export interface ToolOutput {
  success: boolean;
  result?: unknown;
  error?: string;
  stdout?: string;
  stderr?: string;
}

export interface Tool {
  name: string;
  description: string;
  parameters: z.ZodType<any>;
  execute: (input: any) => Promise<ToolOutput>;
}
