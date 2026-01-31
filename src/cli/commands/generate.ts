import { Command } from 'commander';
import { generateAll } from '../../core/generate.js';

export const cmdGenerate = new Command('generate')
  .description('Regenerate tool config files (CLAUDE.md, AGENTS.md, Copilot instructions, etc.)')
  .option(
    '--agent <type>',
    'AI agent to generate config for (claude|agents|copilot|opencode|kilo|all). Uses manifest preference if not specified.'
  )
  .action(async (opts) => {
    await generateAll(process.cwd(), { target: opts.agent });
  });
