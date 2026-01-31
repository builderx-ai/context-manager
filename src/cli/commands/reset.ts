import { Command } from 'commander';
import { reset } from '../../core/review.js';

export const cmdReset = new Command('reset')
  .description('Discard local changes in an installed context')
  .argument('[url]', 'Context url (omit when using --all)')
  .option('--all', 'Reset all installed contexts', false)
  .action(async (url, opts) => {
    await reset(process.cwd(), { url: url ? String(url) : undefined, all: Boolean(opts.all) });
  });
