import { Command } from 'commander';
import { ensureProjectInitialized, initProject } from '../../core/project.js';

export const cmdInit = new Command('init')
  .description('Initialize a project for context-manager')
  .option('--detect', 'Detect project characteristics (planned; no-op for now)', false)
  .option(
    '--agent <type>',
    'AI agent to generate config for (claude|agents|copilot|opencode|kilo|all). Default: agents',
    'agents'
  )
  .action(async (opts) => {
    // MVP: init only (no context-repo init yet)
    await initProject(process.cwd(), { agent: opts.agent });
    await ensureProjectInitialized(process.cwd());
  });
