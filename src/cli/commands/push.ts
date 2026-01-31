import { Command } from 'commander';
import { push } from '../../core/review.js';

export const cmdPush = new Command('push')
  .description('Commit + push local context changes back to the remote (best-effort)')
  .argument('[url]', 'Context url (omit when using --all)')
  .option('--all', 'Push all modified contexts', false)
  .option('--branch <branch>', 'Branch name (default: ctx/<project>/<timestamp>)')
  .option('--message <message>', 'Commit message (default: Update from <project>)')
  .action(async (url, opts) => {
    await push(process.cwd(), {
      url: url ? String(url) : undefined,
      all: Boolean(opts.all),
      branch: opts.branch ? String(opts.branch) : undefined,
      message: opts.message ? String(opts.message) : undefined
    });
  });
