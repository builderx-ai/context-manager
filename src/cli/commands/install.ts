import { Command } from 'commander';
import { installAll } from '../../core/install.js';

export const cmdInstall = new Command('install')
  .description('Install all manifest sources into .context/packages and generate files')
  .option('--frozen', 'Require lock.yaml and do not resolve new versions', false)
  .action(async (opts) => {
    await installAll(process.cwd(), { frozen: Boolean(opts.frozen) });
  });
