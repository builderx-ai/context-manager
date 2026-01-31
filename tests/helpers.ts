import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { createRequire } from 'node:module';

const execFileAsync = promisify(execFile);

export async function sh(cmd: string, args: string[], cwd: string): Promise<{ stdout: string; stderr: string }>{
  const { stdout, stderr } = await execFileAsync(cmd, args, { cwd });
  return { stdout: String(stdout ?? ''), stderr: String(stderr ?? '') };
}

export async function mkTempDir(prefix: string): Promise<string> {
  const base = await fs.mkdtemp(path.join(os.tmpdir(), prefix));
  return base;
}

export async function initGitRepo(dir: string): Promise<void> {
  await sh('git', ['init'], dir);
  await sh('git', ['config', 'user.email', 'test@example.com'], dir);
  await sh('git', ['config', 'user.name', 'Test'], dir);
}

export async function commitAll(dir: string, msg: string): Promise<string> {
  await sh('git', ['add', '-A'], dir);
  await sh('git', ['commit', '-m', msg], dir);
  const { stdout } = await sh('git', ['rev-parse', 'HEAD'], dir);
  return stdout.trim();
}

export async function tag(dir: string, name: string): Promise<void> {
  await sh('git', ['tag', name], dir);
}

export async function writeFile(dir: string, rel: string, content: string): Promise<void> {
  const p = path.join(dir, rel);
  await fs.mkdir(path.dirname(p), { recursive: true });
  await fs.writeFile(p, content);
}

export async function runCtx(args: string[], cwd: string): Promise<{ stdout: string; stderr: string }>{
  // Run the TS CLI entrypoint.
  const entry = path.join(process.cwd(), 'src', 'cli', 'index.ts');

  // Make --import independent of the temp project's node_modules.
  const require = createRequire(import.meta.url);
  const tsxImport = require.resolve('tsx');

  return sh('node', ['--import', tsxImport, entry, ...args], cwd);
}
