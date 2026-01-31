import chalk from 'chalk';
import path from 'node:path';
import fs from 'node:fs/promises';
import { git } from './git.js';
import { listPackagesBestEffort } from './packages.js';
import { sourceToInstallPath } from './parse.js';

async function isDirty(repoDir: string): Promise<boolean> {
  const { stdout } = await git(repoDir, ['status', '--porcelain']);
  return stdout.trim().length > 0;
}

export async function status(projectDir: string): Promise<void> {
  const pkgs = await listPackagesBestEffort(projectDir);
  if (pkgs.length === 0) {
    // eslint-disable-next-line no-console
    console.log(chalk.yellow('No installed contexts found. Run: ctx install'));
    return;
  }

  const dirty: Array<{ url: string; summary: string }> = [];
  for (const p of pkgs) {
    const { stdout } = await git(p.dir, ['status', '--porcelain']);
    const s = stdout.trim();
    if (s) dirty.push({ url: p.url, summary: s.split('\n').length + ' file(s) changed' });
  }

  if (dirty.length === 0) {
    // eslint-disable-next-line no-console
    console.log(chalk.green('✓ No local context changes'));
    return;
  }

  // eslint-disable-next-line no-console
  console.log(chalk.bold('Modified contexts:'));
  for (const d of dirty) {
    // eslint-disable-next-line no-console
    console.log(`  • ${d.url} (${d.summary})`);
  }
  // eslint-disable-next-line no-console
  console.log("\nRun: ctx diff <context>\n");
}

export async function diff(projectDir: string, url?: string): Promise<void> {
  if (url) {
    const dir = path.join(projectDir, '.context', 'packages', sourceToInstallPath(url));
    const { stdout } = await git(dir, ['diff']);
    // eslint-disable-next-line no-console
    process.stdout.write(stdout);
    return;
  }

  const pkgs = await listPackagesBestEffort(projectDir);
  for (const p of pkgs) {
    if (!(await isDirty(p.dir))) continue;
    // eslint-disable-next-line no-console
    console.log(chalk.bold(`\n# ${p.url}\n`));
    const { stdout } = await git(p.dir, ['diff']);
    // eslint-disable-next-line no-console
    process.stdout.write(stdout);
  }
}

export async function reset(projectDir: string, opts: { url?: string; all: boolean }): Promise<void> {
  const targets = opts.all
    ? await listPackagesBestEffort(projectDir)
    : opts.url
      ? [{ url: opts.url, dir: path.join(projectDir, '.context', 'packages', sourceToInstallPath(opts.url)) }]
      : [];

  if (targets.length === 0) throw new Error('Specify a context url or use --all');

  for (const t of targets) {
    // eslint-disable-next-line no-console
    console.log(chalk.cyan(`Resetting ${t.url}...`));
    await git(t.dir, ['checkout', '--', '.']);
    // Remove untracked files created during editing (best-effort)
    try {
      await git(t.dir, ['clean', '-fd']);
    } catch {
      // ignore
    }
    // eslint-disable-next-line no-console
    console.log(chalk.green(`✓ Reset ${t.url}`));
  }
}

function timestamp(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}

async function hasGh(): Promise<boolean> {
  try {
    await git(process.cwd(), ['--version']);
    await fs.access('/usr/bin/gh');
    return true;
  } catch {
    return false;
  }
}

export async function push(
  projectDir: string,
  opts: { url?: string; all: boolean; branch?: string; message?: string }
): Promise<void> {
  let targets = opts.all
    ? await listPackagesBestEffort(projectDir)
    : opts.url
      ? [{ url: opts.url, dir: path.join(projectDir, '.context', 'packages', sourceToInstallPath(opts.url)) }]
      : [];

  if (opts.all) {
    const filtered: typeof targets = [];
    for (const t of targets) if (await isDirty(t.dir)) filtered.push(t);
    targets = filtered;
  }

  if (targets.length === 0) throw new Error('Nothing to push. Use --all or specify a context url.');

  const projectName = path.basename(projectDir);
  const branchName = opts.branch ?? `ctx/${projectName}/${timestamp()}`;
  const commitMsg = opts.message ?? `Update from ${projectName}`;

  for (const t of targets) {
    const dirty = await isDirty(t.dir);
    if (!dirty) continue;

    // eslint-disable-next-line no-console
    console.log(chalk.bold(`\nPushing ${t.url}`));

    // Create branch
    await git(t.dir, ['checkout', '-B', branchName]);

    // Commit changes
    await git(t.dir, ['add', '-A']);
    try {
      await git(t.dir, ['commit', '-m', commitMsg]);
    } catch {
      // likely nothing to commit
    }

    // Push
    try {
      await git(t.dir, ['push', '-u', 'origin', branchName]);
      // eslint-disable-next-line no-console
      console.log(chalk.green(`✓ Pushed branch ${branchName}`));

      // Best-effort PR creation
      if (await hasGh()) {
        // eslint-disable-next-line no-console
        console.log(chalk.cyan('Attempting: gh pr create --fill'));
        try {
          const { execFile } = await import('node:child_process');
          const { promisify } = await import('node:util');
          const execFileAsync = promisify(execFile);
          const { stdout } = await execFileAsync('gh', ['pr', 'create', '--fill'], { cwd: t.dir });
          // eslint-disable-next-line no-console
          console.log(String(stdout).trim());
        } catch {
          // eslint-disable-next-line no-console
          console.log(chalk.yellow('⚠ Could not create PR automatically. Create one from the pushed branch.'));
        }
      }
    } catch (e: any) {
      // eslint-disable-next-line no-console
      console.log(chalk.yellow('⚠ Push failed (no auth / no access).'));
      // eslint-disable-next-line no-console
      console.log(String(e?.message ?? e));
      // eslint-disable-next-line no-console
      console.log(`\nSuggested workflow:\n  1) Fork the repo and update your manifest to point at your fork\n  2) Or push manually from: ${t.dir}\n`);
    }
  }
}
