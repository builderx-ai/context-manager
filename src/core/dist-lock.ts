import { git } from './git.js';
import chalk from 'chalk';

/**
 * Distributed Semantic Lock (SDL) v0.3.1
 * Includes TTL (Time To Live) and Auto-Recovery.
 */
export class DistributedLock {
  static LOCK_TTL_MS = 10 * 60 * 1000; // 10 minutes default

  static async acquire(projectDir: string, nodeId: string): Promise<void> {
    const now = Date.now();
    
    // 1. Fetch remote locks
    await git(projectDir, ['fetch', 'origin', 'refs/context/locks/*:refs/context/locks/*']).catch(() => {});

    // 2. Scan and Audit existing locks
    const { stdout } = await git(projectDir, ['show-ref']).catch(() => ({ stdout: '' }));
    const lockRefs = stdout.split('\n')
      .filter(line => line.includes('refs/context/locks/'))
      .map(line => line.split(' ')[1]);

    for (const ref of lockRefs) {
      if (ref.endsWith(`/${nodeId}`)) continue;

      // Read lock metadata from commit message
      const { stdout: msg } = await git(projectDir, ['log', '-1', '--format=%B', ref]);
      try {
        const meta = JSON.parse(msg);
        if (now < meta.expiresAt) {
          console.error(chalk.red(`\n⚠️ [SDL] Active lock detected: ${ref}`));
          console.error(chalk.red(`[SDL] Held by ${meta.nodeId}, expires in ${((meta.expiresAt - now) / 1000).toFixed(0)}s`));
          throw new Error(`Global lock conflict: ${ref}`);
        } else {
          console.log(chalk.yellow(`\n[SDL] Found expired lock for ${ref}, reclaiming...`));
          // Expired locks will be overwritten by our push --force anyway
        }
      } catch (e: any) {
        if (e.message.includes('Global lock conflict')) throw e;
        // If message isn't valid JSON, assume it's an old-style lock and respect it for safety
        throw new Error(`Legacy global lock detected: ${ref}. Please clear it manually.`);
      }
    }

    // 3. Create a Lock Commit with Metadata
    const expiresAt = now + this.LOCK_TTL_MS;
    const lockMeta = JSON.stringify({ nodeId, expiresAt, createdAt: now });
    
    // Create a dangling commit (no parent needed, uses current tree)
    const { stdout: treeHash } = await git(projectDir, ['rev-parse', 'HEAD^{tree}']);
    const { stdout: commitHash } = await git(projectDir, ['commit-tree', treeHash.trim(), '-m', lockMeta]);
    const finalHash = commitHash.trim();

    // 4. Publish Lock
    await git(projectDir, ['update-ref', `refs/context/locks/${nodeId}`, finalHash]);
    await git(projectDir, ['push', 'origin', `refs/context/locks/${nodeId}:refs/context/locks/${nodeId}`, '--force']);

    // eslint-disable-next-line no-console
    console.log(chalk.yellow(`[SDL] Global lock acquired by: ${nodeId} (Expires in 10m)`));
  }

  static async release(projectDir: string, nodeId: string): Promise<void> {
    try {
      await git(projectDir, ['update-ref', '-d', `refs/context/locks/${nodeId}`]);
      await git(projectDir, ['push', 'origin', '--delete', `refs/context/locks/${nodeId}`]);
      // eslint-disable-next-line no-console
      console.log(chalk.gray(`[SDL] Global lock released by: ${nodeId}`));
    } catch (err) {
       // Silent fail during release is okay
    }
  }
}
