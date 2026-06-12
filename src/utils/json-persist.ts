import fs from 'node:fs/promises';
import path from 'node:path';

/**
 * Atomic JSON write: write to temp file then rename.
 * Prevents partial reads on crash.
 */
export async function writeJSON<T>(filePath: string, data: T): Promise<void> {
  const dir = path.dirname(filePath);
  await fs.mkdir(dir, { recursive: true });

  const tmpPath = filePath + '.tmp';
  const content = JSON.stringify(data, null, 2);
  await fs.writeFile(tmpPath, content, 'utf-8');
  await fs.rename(tmpPath, filePath);
}

/**
 * Read and parse a JSON file. Returns null if file doesn't exist or is invalid.
 */
export async function readJSON<T>(filePath: string): Promise<T | null> {
  try {
    const raw = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

/**
 * List all JSON files in a directory, sorted by name.
 */
export async function listJSONFiles(dirPath: string): Promise<string[]> {
  try {
    const files = await fs.readdir(dirPath);
    return files
      .filter((f) => f.endsWith('.json'))
      .sort()
      .map((f) => path.join(dirPath, f));
  } catch {
    return [];
  }
}
