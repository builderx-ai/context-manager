import fs from 'node:fs/promises';
import path from 'node:path';
import chalk from 'chalk';

export const CONTEXT_DIR = '.context';

export async function ensureProjectInitialized(projectDir: string): Promise<void> {
  const manifestPath = path.join(projectDir, CONTEXT_DIR, 'manifest.yaml');
  await fs.access(manifestPath);
}

export async function initProject(projectDir: string, opts?: { agent?: string }): Promise<void> {
  const ctxDir = path.join(projectDir, CONTEXT_DIR);
  await fs.mkdir(ctxDir, { recursive: true });

  const gitignorePath = path.join(ctxDir, '.gitignore');
  const manifestPath = path.join(ctxDir, 'manifest.yaml');

  // Don't overwrite if exists
  try {
    await fs.access(manifestPath);
  } catch {
    const agent = opts?.agent || 'agents';
    const manifestContent = `# Context Manager Manifest
# Specifies which contexts to install and which AI agent configs to generate

sources: []

# AI agent preference (default: agents)
# Options: claude, agents, copilot, opencode, kilo, all
# - claude: Generate CLAUDE.md only
# - agents: Generate AGENTS.md only (default, works with most AI coding tools)
# - copilot: Generate .github/copilot-instructions.md only
# - opencode: Generate opencode.md only
# - kilo: Generate kilo.md only
# - all: Generate all supported agent configs
agent: ${agent}
`;
    await fs.writeFile(manifestPath, manifestContent);
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
