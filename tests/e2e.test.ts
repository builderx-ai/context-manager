import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import YAML from 'yaml';
import { mkTempDir, initGitRepo, writeFile, commitAll, tag, runCtx } from './helpers.js';

async function readYaml(p: string): Promise<any> {
  const raw = await fs.readFile(p, 'utf8');
  return YAML.parse(raw);
}

test('e2e: install resolves depends, writes lock, frozen install works', async () => {
  const base = await mkTempDir('ctx-e2e-');
  const repoB = path.join(base, 'ctx-b');
  const repoA = path.join(base, 'ctx-a');
  const project = path.join(base, 'project');

  // Context B
  await fs.mkdir(repoB, { recursive: true });
  await initGitRepo(repoB);
  await writeFile(repoB, 'context.yaml', 'name: ctx-b\nversion: 1.0.0\ndepends: []\n');
  await writeFile(repoB, 'index.md', '# Context B\n');
  await commitAll(repoB, 'init b');
  await tag(repoB, 'v1.0.0');

  // Context A depends on B
  await fs.mkdir(repoA, { recursive: true });
  await initGitRepo(repoA);
  await writeFile(repoA, 'context.yaml', `name: ctx-a\nversion: 1.0.0\ndepends:\n  - ${repoB}@^1.0.0\n`);
  await writeFile(repoA, 'index.md', '# Context A\n');
  await commitAll(repoA, 'init a');
  await tag(repoA, 'v1.0.0');

  // Project
  await fs.mkdir(project, { recursive: true });
  await initGitRepo(project);

  await runCtx(['init'], project);
  await runCtx(['add', `${repoA}@^1.0.0`], project);
  await runCtx(['install'], project);

  const lockPath = path.join(project, '.context', 'lock.yaml');
  const lock = await readYaml(lockPath);
  assert.equal(lock.version, 1);
  const urls = lock.resolved.map((r: any) => r.url).sort();
  assert.deepEqual(urls, [repoA, repoB].sort());

  // Generated files
  await fs.access(path.join(project, 'CLAUDE.md'));
  await fs.access(path.join(project, 'AGENTS.md'));
  await fs.access(path.join(project, '.github', 'copilot-instructions.md'));

  // Frozen install should succeed
  await runCtx(['install', '--frozen'], project);
});
