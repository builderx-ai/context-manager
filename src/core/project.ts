import fs from 'node:fs/promises';
import path from 'node:path';
import chalk from 'chalk';

export const CONTEXT_DIR = '.context';

export async function ensureProjectInitialized(projectDir: string): Promise<void> {
  const manifestPath = path.join(projectDir, CONTEXT_DIR, 'manifest.yaml');
  await fs.access(manifestPath);
}

export async function initProject(projectDir: string): Promise<void> {
  const ctxDir = path.join(projectDir, CONTEXT_DIR);
  await fs.mkdir(ctxDir, { recursive: true });

  const gitignorePath = path.join(ctxDir, '.gitignore');
  const manifestPath = path.join(ctxDir, 'manifest.yaml');

  // Don't overwrite if exists
  try {
    await fs.access(manifestPath);
  } catch {
    await fs.writeFile(
      manifestPath,
      'sources: []\n\n# generate: optional per-tool config (future)\n# paths: optional output paths (future)\n'
    );
    // eslint-disable-next-line no-console
    console.log(chalk.green('✓ Created .context/manifest.yaml'));
  }

  try {
    await fs.access(gitignorePath);
  } catch {
    await fs.writeFile(gitignorePath, 'lock.yaml\nresolutions.yaml\n');
    // eslint-disable-next-line no-console
    console.log(chalk.green('✓ Created .context/.gitignore'));
  }
}
