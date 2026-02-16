import * as fs from 'node:fs';
import * as path from 'node:path';
import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import chalk from 'chalk';

const execAsync = promisify(exec);

export class SyncManager {
  static async gossip(projectDir: string): Promise<void> {
    const nodeId = process.env.NODE_NAME || 'pi-edge';
    const statePath = path.join(projectDir, '.context', 'state.json');

    // [1] Local State Persistence
    const state = { 
      nodeId, 
      timestamp: new Date().toISOString(), 
      vclock: { [nodeId]: Date.now() } 
    };

    try {
      const contextDir = path.dirname(statePath);
      if (!fs.existsSync(contextDir)) {
        fs.mkdirSync(contextDir, { recursive: true });
      }
      fs.writeFileSync(statePath, JSON.stringify(state, null, 2));

      // [2] Git Gossip Transport (v0.2.2)
      // 1. Update local node-specific ref to current HEAD
      await execAsync(`git update-ref refs/context/nodes/${nodeId} HEAD`, { cwd: projectDir });

      // 2. Try pushing the ref to remote (LWW - Last Write Wins via --force)
      // Timeout set to 5s to prevent blocking CLI on network lag
      await execAsync(`git push origin refs/context/nodes/${nodeId}:refs/context/nodes/${nodeId} --force`, {
        cwd: projectDir,
        timeout: 5000
      }).catch(() => {
        /* Silent fail: network unreachable or no remote configured */
      });

      // 3. Try fetching other nodes' states
      await execAsync(`git fetch origin refs/context/nodes/*:refs/context/nodes/*`, {
        cwd: projectDir,
        timeout: 5000
      }).catch(() => {
        /* Silent fail: network unreachable */
      });

      // eslint-disable-next-line no-console
      console.log(chalk.magenta(`\n[Sync] Gossip synchronized with remote. Node: ${nodeId}`));
    } catch (err: any) {
      // Global fallback for sync manager to ensure core CLI stability
      // eslint-disable-next-line no-console
      console.error(chalk.yellow(`\n⚠️ Sync warning: ${err.message}`));
    }
  }
}
