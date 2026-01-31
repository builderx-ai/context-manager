import fs from 'node:fs/promises';
import path from 'node:path';
import YAML from 'yaml';
import chalk from 'chalk';
import { CONTEXT_DIR } from './project.js';

export type Manifest = {
  sources: string[];
  agent?: string;
  overrides?: Record<string, string>;
};

export async function readManifest(projectDir: string): Promise<Manifest> {
  const p = path.join(projectDir, CONTEXT_DIR, 'manifest.yaml');
  const raw = await fs.readFile(p, 'utf8');
  const doc = YAML.parse(raw) ?? {};
  return {
    sources: Array.isArray(doc.sources) ? doc.sources.map(String) : [],
    agent: typeof doc.agent === 'string' ? doc.agent : undefined,
    overrides: doc.overrides && typeof doc.overrides === 'object' ? doc.overrides : undefined
  };
}

export async function writeManifest(projectDir: string, manifest: Manifest): Promise<void> {
  const p = path.join(projectDir, CONTEXT_DIR, 'manifest.yaml');
  const raw = YAML.stringify(manifest);
  await fs.writeFile(p, raw);
}

export async function addSourceToManifest(projectDir: string, source: string): Promise<void> {
  const manifest = await readManifest(projectDir);
  if (manifest.sources.includes(source)) {
    // eslint-disable-next-line no-console
    console.log(chalk.yellow('Already present in manifest.'));
    return;
  }
  manifest.sources.push(source);
  await writeManifest(projectDir, manifest);
  // eslint-disable-next-line no-console
  console.log(chalk.green(`✓ Added to manifest: ${source}`));
  // Hint
  // eslint-disable-next-line no-console
  console.log('Run: ctx install');
}
