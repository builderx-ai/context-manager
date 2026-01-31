import { Command } from 'commander';
import { addSourceToManifest } from '../../core/manifest.js';

export const cmdAdd = new Command('add')
  .description('Add a context source to .context/manifest.yaml')
  .argument('<source>', 'Git URL (e.g. github.com/org/repo@^1.0)')
  .action(async (source) => {
    await addSourceToManifest(process.cwd(), source);
  });
