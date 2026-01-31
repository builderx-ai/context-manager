import { Command } from 'commander';
import { status } from '../../core/review.js';

export const cmdStatus = new Command('status')
  .description('Show modified contexts (git status)')
  .action(async () => {
    await status(process.cwd());
  });
