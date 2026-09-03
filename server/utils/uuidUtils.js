import { randomUUID } from 'node:crypto';

/**
 * Utility function to generate unique UUIDs across Node environments.
 */
export function generateUUID() {
  if (typeof randomUUID === 'function') {
    return randomUUID();
  }
  // Fallback UUID v4 generator
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}
