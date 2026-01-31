import path from 'node:path';
import fs from 'node:fs/promises';
import { CONTEXT_DIR } from './project.js';
import { readLock, type LockFile } from './lock.js';
import { git } from './git.js';
import { sourceToInstallPath } from './parse.js';

export type InstalledPackage = {
  url: string;
  dir: string;
};

async function pathExists(p: string): Promise<boolean> {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

export async function listPackagesFromLock(projectDir: string): Promise<InstalledPackage[]> {
  const lock: LockFile | null = await readLock(projectDir);
  if (!lock) return [];
  const root = path.join(projectDir, CONTEXT_DIR, 'packages');
  return lock.resolved.map((e) => ({ url: e.url, dir: path.join(root, sourceToInstallPath(e.url)) }));
}

export async function listPackagesBestEffort(projectDir: string): Promise<InstalledPackage[]> {
  const fromLock = await listPackagesFromLock(projectDir);
  if (fromLock.length > 0) return fromLock;

  // Fall back to scanning .context/packages for git repos.
  const root = path.join(projectDir, CONTEXT_DIR, 'packages');
  if (!(await pathExists(root))) return [];

  const out: InstalledPackage[] = [];
  async function walk(dir: string): Promise<void> {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const e of entries) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) {
        // Detect git repo by trying a cheap command.
        try {
          await git(p, ['rev-parse', '--is-inside-work-tree']);
          const rel = path.relative(root, p).replace(/\\/g, '/');
          out.push({ url: rel, dir: p });
          continue;
        } catch {
          await walk(p);
        }
      }
    }
  }
  await walk(root);
  return out;
}
