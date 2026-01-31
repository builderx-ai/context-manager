import { Command } from 'commander';
import { ensureProjectInitialized, initProject } from '../../core/project.js';

export const cmdInit = new Command('init')
  .description('Initialize a project for context-manager')
  .option('--detect', 'Detect project characteristics (planned; no-op for now)', false)
  .action(async () => {
    // MVP: init only (no context-repo init yet)
    await initProject(process.cwd());
    await ensureProjectInitialized(process.cwd());
  });
