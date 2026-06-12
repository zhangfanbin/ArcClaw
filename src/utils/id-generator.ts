import { nanoid } from 'nanoid';

/**
 * Generate a unique ID with optional prefix.
 * Default length is 12 characters (after prefix).
 */
export function generateId(prefix?: string, length = 12): string {
  const id = nanoid(length);
  return prefix ? `${prefix}_${id}` : id;
}
