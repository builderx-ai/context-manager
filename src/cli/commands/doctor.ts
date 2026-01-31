import { Command } from 'commander';
import { doctor } from '../../core/doctor.js';

export const cmdDoctor = new Command('doctor')
  .description('Health checks for .context/ install + lock integrity')
  .option('--fix', 'Attempt to auto-fix common issues', false)
  .action(async (opts) => {
    await doctor(process.cwd(), { fix: Boolean(opts.fix) });
  });
