import fs from 'node:fs/promises';
import path from 'node:path';
import chalk from 'chalk';
import { CONTEXT_DIR } from './project.js';
import { readLock } from './lock.js';
import { gitIsRepo, git } from './git.js';
import { sourceToInstallPath } from './parse.js';

export async function doctor(projectDir: string, opts: { fix: boolean }): Promise<void> {
  // eslint-disable-next-line no-console
  console.log(chalk.bold('ctx doctor'));

  const isRepo = await gitIsRepo(projectDir);
  if (!isRepo) {
    throw new Error('Not a git repo. Run: git init');
  }

  const manifest = path.join(projectDir, CONTEXT_DIR, 'manifest.yaml');
  await fs.access(manifest);
  // eslint-disable-next-line no-console
  console.log(chalk.green('✓ manifest.yaml present'));

  // Submodules initialized?
  try {
    await git(projectDir, ['submodule', 'status']);
    // eslint-disable-next-line no-console
    console.log(chalk.green('✓ git submodules ok'));
  } catch (e) {
    // eslint-disable-next-line no-console
    console.log(chalk.yellow('⚠ git submodule status failed'));
    if (opts.fix) {
      // eslint-disable-next-line no-console
      console.log(chalk.cyan('Attempting: git submodule update --init --recursive --depth=1'));
      await git(projectDir, ['submodule', 'update', '--init', '--recursive', '--depth=1']);
      // eslint-disable-next-line no-console
      console.log(chalk.green('✓ submodules initialized'));
    }
  }

  const lock = await readLock(projectDir);
  if (!lock) {
    // eslint-disable-next-line no-console
    console.log(chalk.yellow('⚠ lock.yaml missing (run ctx install)'));
    return;
  }
  // eslint-disable-next-line no-console
  console.log(chalk.green('✓ lock.yaml present'));

  // Best-effort integrity check: ensure each locked url has a matching submodule dir and commit.
  for (const entry of lock.resolved) {
    const subDir = path.join(projectDir, CONTEXT_DIR, 'packages', sourceToInstallPath(entry.url));
    try {
      const { stdout } = await git(subDir, ['rev-parse', 'HEAD']);
      const actual = stdout.trim();
      if (actual !== entry.commit) {
        // eslint-disable-next-line no-console
        console.log(chalk.red(`✗ integrity mismatch: ${entry.url}`));
        // eslint-disable-next-line no-console
        console.log(`  expected ${entry.commit}, got ${actual}`);
        if (opts.fix) {
          // eslint-disable-next-line no-console
          console.log(chalk.cyan(`  fixing: git fetch --all --tags; git checkout ${entry.commit}`));
          await git(subDir, ['fetch', '--all', '--tags', '--prune']);
          await git(subDir, ['checkout', entry.commit]);
          // eslint-disable-next-line no-console
          console.log(chalk.green('  ✓ fixed'));
        }
      } else {
        // eslint-disable-next-line no-console
        console.log(chalk.green(`✓ ${entry.url} @ ${actual.slice(0, 7)}`));
      }
    } catch {
      // eslint-disable-next-line no-console
      console.log(chalk.yellow(`⚠ missing checkout for ${entry.url} (run ctx install)`));
      if (opts.fix) {
        try {
          // eslint-disable-next-line no-console
          console.log(chalk.cyan('  attempting: git submodule update --init --recursive --depth=1'));
          await git(projectDir, ['submodule', 'update', '--init', '--recursive', '--depth=1']);
        } catch {
          // ignore
        }
      }
    }
  }
}
