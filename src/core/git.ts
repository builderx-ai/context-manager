import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

export async function git(cwd: string, args: string[]): Promise<{ stdout: string; stderr: string }>{
  const { stdout, stderr } = await execFileAsync('git', args, { cwd });
  return { stdout: String(stdout ?? ''), stderr: String(stderr ?? '') };
}

export async function gitIsRepo(cwd: string): Promise<boolean> {
  try {
    await git(cwd, ['rev-parse', '--is-inside-work-tree']);
    return true;
  } catch {
    return false;
  }
}

export async function ensureGitRepo(cwd: string): Promise<void> {
  const ok = await gitIsRepo(cwd);
  if (!ok) {
    throw new Error('Not a git repository. Initialize git first (git init) before using ctx.');
  }
}
