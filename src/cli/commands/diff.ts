import { Command } from 'commander';
import { diff } from '../../core/review.js';

export const cmdDiff = new Command('diff')
  .description('Show changes in installed contexts (git diff)')
  .argument('[url]', 'Context url (e.g. github.com/org/repo). If omitted, shows diffs for all dirty contexts')
  .action(async (url) => {
    await diff(process.cwd(), url ? String(url) : undefined);
  });
