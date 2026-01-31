import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import fs from 'node:fs/promises';
import { mkTempDir, initGitRepo, writeFile, commitAll, tag } from './helpers.js';
import { resolveWithConstraints } from '../src/core/resolver.js';

test('resolveWithConstraints picks highest satisfying semver tag', async () => {
  const dir = await mkTempDir('ctx-resolver-');
  await initGitRepo(dir);
  await writeFile(dir, 'context.yaml', 'name: base\nversion: 1.0.0\ndepends: []\n');
  await writeFile(dir, 'index.md', '# Base\n');
  await commitAll(dir, 'init');
  await tag(dir, 'v1.0.0');

  await writeFile(dir, 'index.md', '# Base v1.2.0\n');
  await commitAll(dir, 'v1.2');
  await tag(dir, 'v1.2.0');

  const res = await resolveWithConstraints(dir, ['^1.0.0'], null);
  assert.equal(res.version, '1.2.0');
  assert.match(res.checkout, /^v1\.2\.0$/);
});

test('resolveWithConstraints errors on incompatible constraints', async () => {
  const dir = await mkTempDir('ctx-resolver-conflict-');
  await initGitRepo(dir);
  await writeFile(dir, 'context.yaml', 'name: base\nversion: 1.0.0\ndepends: []\n');
  await writeFile(dir, 'index.md', '# Base\n');
  await commitAll(dir, 'init');
  await tag(dir, 'v1.0.0');

  await writeFile(dir, 'index.md', '# Base v2\n');
  await commitAll(dir, 'v2');
  await tag(dir, 'v2.0.0');

  await assert.rejects(() => resolveWithConstraints(dir, ['^1.0.0', '^2.0.0'], null));
});
