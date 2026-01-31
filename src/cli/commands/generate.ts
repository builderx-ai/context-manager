import { Command } from 'commander';
import { generateAll } from '../../core/generate.js';

export const cmdGenerate = new Command('generate')
  .description('Regenerate tool config files (CLAUDE.md, AGENTS.md, Copilot instructions)')
  .option('--target <target>', 'claude|codex|copilot|all', 'all')
  .action(async (opts) => {
    await generateAll(process.cwd(), { target: String(opts.target || 'all') });
  });
