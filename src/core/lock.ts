import fs from 'node:fs/promises';
import path from 'node:path';
import YAML from 'yaml';
import { CONTEXT_DIR } from './project.js';

export type LockEntry = {
  url: string;
  /** Original ref/range from manifest or dependency */
  requested?: string | null;
  /** Resolved semver version (if tag-based) */
  version?: string | null;
  /** Git commit SHA */
  commit: string;
  /** Dependency list as declared by the context at the resolved commit */
  depends?: string[];
  resolved_at: string;
};

export type LockFile = {
  version: 1;
  resolved: LockEntry[];
};

export async function readLock(projectDir: string): Promise<LockFile | null> {
  const p = path.join(projectDir, CONTEXT_DIR, 'lock.yaml');
  try {
    const raw = await fs.readFile(p, 'utf8');
    const doc = YAML.parse(raw);
    if (!doc) return null;
    return doc as LockFile;
  } catch {
    return null;
  }
}

export async function writeLock(projectDir: string, lock: LockFile): Promise<void> {
  const p = path.join(projectDir, CONTEXT_DIR, 'lock.yaml');
  await fs.writeFile(p, YAML.stringify(lock));
}

export function upsertLock(lock: LockFile, entry: LockEntry): LockFile {
  const idx = lock.resolved.findIndex((e) => e.url === entry.url);
  if (idx >= 0) lock.resolved[idx] = entry;
  else lock.resolved.push(entry);
  return lock;
}
