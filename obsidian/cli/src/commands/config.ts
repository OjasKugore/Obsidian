/**
 * cli/src/commands/config.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * `obsidian config` — Configure the CLI (server URL, etc.)
 *
 * Usage:
 *   obsidian config set-url https://your-server.com
 *   obsidian config show
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { Command } from 'commander';
import { getBaseUrl, setBaseUrl, CLI_DIR, CONFIG_FILE } from '../lib/config.ts';
import { success, label, info, divider } from '../utils/display.ts';
import chalk from 'chalk';

export function makeConfigCommand(): Command {
  const config = new Command('config')
    .description('Manage CLI configuration (server URL, etc.)');

  config
    .command('set-url <url>')
    .description('Set the Obsidian server base URL')
    .action((url: string) => {
      setBaseUrl(url);
      success(`Server URL set to ${url}`);
      info('This URL will be used for all future commands.');
    });

  config
    .command('get-url')
    .description('Print the current server URL')
    .action(() => {
      console.log(getBaseUrl());
    });

  config
    .command('reset')
    .description('Reset server URL to default (http://localhost:3000)')
    .action(() => {
      setBaseUrl('http://localhost:3000');
      success('Server URL reset to http://localhost:3000');
    });

  config
    .command('show')
    .description('Show current CLI configuration')
    .action(() => {
      divider();
      console.log(chalk.hex('#9b59b6').bold('  ⚙️  CLI Configuration'));
      divider();
      label('Server URL',  getBaseUrl());
      label('Config dir',  CLI_DIR);
      label('Config file', CONFIG_FILE);
      divider();
      info('Override URL per-command with --url, or set OBSIDIAN_URL env variable');
      console.log('');
    });

  return config;
}
