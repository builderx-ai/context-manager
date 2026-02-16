import fs from 'node:fs/promises';
import path from 'node:path';
import chalk from 'chalk';
import { readManifest } from './manifest.js';
import { CONTEXT_DIR, initProject } from './project.js';
import { ensureGitRepo, git } from './git.js';
import { parseSource, sourceToInstallPath, sourceToRepoUrl } from './parse.js';
import { readLock, upsertLock, writeLock, type LockFile } from './lock.js';
import { generateAll } from './generate.js';
import { normalizeDepends, resolveWithConstraints } from './resolver.js';
import { SyncManager } from './sync.js';
import { DistributedLock } from './dist-lock.js';
import YAML from 'yaml';

type ContextYaml = {
  depends?: string[];
  name?: string;
  version?: string;
};

async function readContextYaml(pkgDir: string): Promise<ContextYaml | null> {
  const p = path.join(pkgDir, 'context.yaml');
  try {
    const raw = await fs.readFile(p, 'utf8');
    const doc = YAML.parse(raw) ?? {};
    return doc as ContextYaml;
  } catch {
    return null;
  }
}

async function pathExists(p: string): Promise<boolean> {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

export async function installAll(projectDir: string, opts: { frozen: boolean }): Promise<void> {
  const nodeId = process.env.NODE_NAME || 'pi-edge';
  await DistributedLock.acquire(projectDir, nodeId);

  try {
    await initProject(projectDir);
    await ensureGitRepo(projectDir);

    const manifest = await readManifest(projectDir);
    const lockExisting = await readLock(projectDir);
    if (opts.frozen && !lockExisting) {
      throw new Error('ctx install --frozen requires .context/lock.yaml');
    }

    let lock: LockFile = lockExisting ?? { version: 1, resolved: [] };

    const packagesRoot = path.join(projectDir, CONTEXT_DIR, 'packages');
    await fs.mkdir(packagesRoot, { recursive: true });

    // Build constraints (manifest + transitive depends)
    const constraints = new Map<string, Array<string | null>>();
    const enqueue = (url: string, ref: string | null) => {
      const arr = constraints.get(url) ?? [];
      arr.push(ref);
      constraints.set(url, arr);
    };

    for (const src of manifest.sources) {
      const { url, ref } = parseSource(src);
      enqueue(url, ref ?? null);
    }

    // Frozen mode: install exactly what's in lock (and only what's in lock)
    if (opts.frozen) {
      // eslint-disable-next-line no-console
      console.log(chalk.cyan('Frozen install: using .context/lock.yaml'));
      for (const entry of lock.resolved) {
        const url = entry.url;
        const installRel = sourceToInstallPath(url);
        const installPath = path.join(packagesRoot, installRel);
        const repoUrl = sourceToRepoUrl(url);

        if (!(await pathExists(installPath))) {
          await fs.mkdir(path.dirname(installPath), { recursive: true });
          // eslint-disable-next-line no-console
          console.log(chalk.cyan(`Adding submodule: ${url}`));
          await git(projectDir, ['-c', 'protocol.file.allow=always', 'submodule', 'add', '--', repoUrl, path.join(CONTEXT_DIR, 'packages', installRel)]);
        }

        await git(projectDir, ['-c', 'protocol.file.allow=always', 'submodule', 'update', '--init', '--depth=1', '--', path.join(CONTEXT_DIR, 'packages', installRel)]);

        // Ensure we can checkout the locked commit
        await git(installPath, ['fetch', '--all', '--tags', '--prune']);
        await git(installPath, ['checkout', entry.commit]);

        // eslint-disable-next-line no-console
        console.log(chalk.green(`✓ Installed ${url} @ ${entry.commit.slice(0, 7)}`));
      }

      await generateAll(projectDir, {});
      return;
    }

    const resolved = new Map<string, { requested: Array<string | null>; depends: string[] }>();
    const processing: string[] = [];

    // Resolve recursively: repeatedly pick an unresolved url from constraints.
    while (true) {
      const next = [...constraints.keys()].find((u) => !resolved.has(u));
      if (!next) break;

      processing.push(next);
      const requestedSpecs = constraints.get(next) ?? [];
      const override = manifest.overrides?.[next] ?? null;

      const resolvedRef = await resolveWithConstraints(next, requestedSpecs, override);

      const installRel = sourceToInstallPath(next);
      const installPath = path.join(packagesRoot, installRel);
      const repoUrl = sourceToRepoUrl(next);

      if (!(await pathExists(installPath))) {
        await fs.mkdir(path.dirname(installPath), { recursive: true });
        // eslint-disable-next-line no-console
        console.log(chalk.cyan(`Adding submodule: ${next}`));
        await git(projectDir, ['-c', 'protocol.file.allow=always', 'submodule', 'add', '--', repoUrl, path.join(CONTEXT_DIR, 'packages', installRel)]);
      }

      await git(projectDir, ['-c', 'protocol.file.allow=always', 'submodule', 'update', '--init', '--depth=1', '--', path.join(CONTEXT_DIR, 'packages', installRel)]);

      // Ensure tags/branches are available for checkout.
      await git(installPath, ['fetch', '--all', '--tags', '--prune']);

      // Checkout resolved ref (tag/branch/commit)
      await git(installPath, ['checkout', resolvedRef.checkout]);

      // Record actual commit
      const { stdout } = await git(installPath, ['rev-parse', 'HEAD']);
      const commit = stdout.trim();

      const ctx = await readContextYaml(installPath);
      const depends = Array.isArray(ctx?.depends) ? ctx!.depends!.map(String) : [];

      // Enqueue dependencies
      for (const dep of depends) {
        const { url, ref } = normalizeDepends(String(dep));
        enqueue(url, ref);
      }

      // Persist lock entry
      lock = upsertLock(lock, {
        url: next,
        requested: resolvedRef.requested,
        version: resolvedRef.version,
        commit,
        depends,
        resolved_at: new Date().toISOString()
      });

      resolved.set(next, { requested: requestedSpecs, depends });

      // eslint-disable-next-line no-console
      console.log(
        chalk.green(
          `✓ Installed ${next}` +
            (resolvedRef.version ? `@${resolvedRef.version}` : '') +
            ` @ ${commit.slice(0, 7)}`
        )
      );
    }

    await writeLock(projectDir, lock);
    // eslint-disable-next-line no-console
    console.log(chalk.green('✓ Updated .context/lock.yaml'));

    await generateAll(projectDir, {});
    
    // v0.2 Sync Hook: 异步触发状态广播
    SyncManager.gossip(projectDir).catch(() => {});
  } finally {
    await DistributedLock.release(projectDir, nodeId);
  }
}
