/**
 * cli/src/commands/shamir.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * `obsidian shamir` — Standalone Shamir's Secret Sharing toolkit.
 *
 * Commands:
 *   obsidian shamir split <secret> --shares 3 --threshold 2
 *   obsidian shamir combine <shard1> <shard2> ...
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { Command } from 'commander';
import { splitKey, combineShards, parseShard, extractShardFromUrl } from '../lib/shamir.ts';
import { spinner, success, error, label, divider, info } from '../utils/display.ts';
import chalk from 'chalk';

export function makeShamirCommand(): Command {
  const shamir = new Command('shamir')
    .description('Shamir Secret Sharing (SSS) cryptographic toolkit for multi-party secrets');

  // ── split ─────────────────────────────────────────────────────────────────
  shamir
    .command('split <secret>')
    .description('Split a raw secret or password into N mathematical shards (k-of-n quorum)')
    .option('-n, --shares <number>', 'Total number of shares to generate (2-255)', '3')
    .option('-k, --threshold <number>', 'Minimum number of shares required to reconstruct (2-255)', '2')
    .option('--json', 'Output shards as a JSON array')
    .action((secret: string, opts: { shares: string; threshold: string; json: boolean }) => {
      try {
        const totalShares = parseInt(opts.shares, 10);
        const threshold = parseInt(opts.threshold, 10);

        if (Number.isNaN(totalShares) || totalShares < 2 || totalShares > 255) {
          error('Total shares (--shares, -n) must be an integer between 2 and 255.');
          process.exit(1);
        }
        if (Number.isNaN(threshold) || threshold < 2 || threshold > totalShares) {
          error(`Threshold (--threshold, -k) must be between 2 and total shares (${totalShares}).`);
          process.exit(1);
        }

        const secretBytes = new TextEncoder().encode(secret);
        const shards = splitKey(secretBytes, totalShares, threshold);

        if (opts.json) {
          console.log(JSON.stringify(shards, null, 2));
          return;
        }

        divider();
        console.log(chalk.hex('#9b59b6').bold(`  🧩 Shamir Secret Split (${threshold}-of-${totalShares} Quorum)`));
        divider();
        console.log('');
        label('Threshold (k)', `${threshold} shares required`);
        label('Total Shares (n)', `${totalShares} shares generated`);
        console.log('');

        shards.forEach((shard, idx) => {
          console.log(chalk.cyan.bold(`  Shard #${idx + 1}:`));
          console.log(chalk.white(`  ${shard}`));
          console.log('');
        });

        info(`To reconstruct, supply any ${threshold} shards to: obsidian shamir combine <shard1> <shard2>`);
        console.log('');
        success('Secret split successfully.');

      } catch (err: unknown) {
        error((err instanceof Error) ? err.message : String(err));
        process.exit(1);
      }
    });

  // ── combine ───────────────────────────────────────────────────────────────
  shamir
    .command('combine [shards...]')
    .description('Reconstruct a secret from k or more Shamir shards')
    .action((shards: string[] | undefined) => {
      try {
        if (!shards || shards.length === 0) {
          error('No shards provided. Pass at least k shard strings: obsidian shamir combine <shard1> <shard2> ...');
          process.exit(1);
        }

        const cleanShards: string[] = [];
        for (const s of shards) {
          const extracted = extractShardFromUrl(s) ?? s.trim();
          if (parseShard(extracted)) {
            cleanShards.push(extracted);
          } else {
            error(`Invalid shard format: ${s}`);
            process.exit(1);
          }
        }

        const spin = spinner(`Reconstructing secret from ${cleanShards.length} shards...`);
        const reconstructedBytes = combineShards(cleanShards);
        spin.succeed('Lagrange interpolation complete');

        const reconstructedText = new TextDecoder().decode(reconstructedBytes);

        divider();
        console.log(chalk.hex('#9b59b6').bold('  🎉 Reconstructed Secret:'));
        divider();
        console.log(chalk.white(reconstructedText));
        divider();
        success('Secret successfully recovered from quorum.');
        console.log('');

      } catch (err: unknown) {
        error((err instanceof Error) ? err.message : String(err));
        process.exit(1);
      }
    });

  return shamir;
}
