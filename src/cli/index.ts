#!/usr/bin/env node

import { Command } from 'commander';
import { cmdInit } from './commands/init.js';
import { cmdAdd } from './commands/add.js';
import { cmdInstall } from './commands/install.js';
import { cmdGenerate } from './commands/generate.js';
import { cmdDoctor } from './commands/doctor.js';
import { cmdStatus } from './commands/status.js';
import { cmdDiff } from './commands/diff.js';
import { cmdReset } from './commands/reset.js';
import { cmdPush } from './commands/push.js';

const program = new Command();

program
  .name('ctx')
  .description('Context Injector - manage and inject AI coding contexts across projects')
  .version('0.1.0');

program.addCommand(cmdInit);
program.addCommand(cmdAdd);
program.addCommand(cmdInstall);
program.addCommand(cmdGenerate);
program.addCommand(cmdDoctor);
program.addCommand(cmdStatus);
program.addCommand(cmdDiff);
program.addCommand(cmdReset);
program.addCommand(cmdPush);

program.parseAsync(process.argv).catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err?.stack || err);
  process.exitCode = 1;
});
