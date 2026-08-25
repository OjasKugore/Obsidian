#!/usr/bin/env node
/**
 * cli/src/index.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Obsidian CLI — entry point.
 * Registers all commands and handles top-level flags.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { Command } from 'commander';
import { printBanner } from './utils/display.ts';
import { makeSendCommand }   from './commands/send.ts';
import { makeReadCommand }   from './commands/read.ts';
import { makeKeyCommand }    from './commands/key.ts';
import { makeRepoCommand }   from './commands/repo.ts';
import { makeShamirCommand } from './commands/shamir.ts';
import { makeConfigCommand } from './commands/config.ts';

const program = new Command();

program
  .name('obsidian')
  .description('E2E encrypted pastebin CLI — send, receive, and manage encrypted pastes')
  .version('1.0.0')
  .hook('preAction', (thisCommand) => {
    // Print banner unless --silent or piping output
    const isSilent = process.argv.includes('--silent');
    const isPiped  = !process.stdout.isTTY;
    if (!isSilent && !isPiped) {
      printBanner();
    }
  });

program.addCommand(makeSendCommand());
program.addCommand(makeReadCommand());
program.addCommand(makeKeyCommand());
program.addCommand(makeRepoCommand());
program.addCommand(makeShamirCommand());
program.addCommand(makeConfigCommand());

// ── Global examples ────────────────────────────────────────────────────────

program.addHelpText('after', `
Examples:
  # Single-User Symmetric:
  $ obsidian send "my secret message" --burn
  $ obsidian read "https://localhost:3000/abc123#keyBase58"

  # Single-User Asymmetric (RSA-OAEP):
  $ obsidian key generate
  $ obsidian key show --public
  $ obsidian send "confidential" --recipient <pubkey-base64>
  $ obsidian read "https://localhost:3000/abc123#asym"

  # Multi-User Threshold Quorum (Shamir Secret Sharing):
  $ obsidian send "executive board decision" --shares 3 --threshold 2
  $ obsidian read "<shardUrl1>" --shards "<shardUrl2>"
  $ obsidian shamir split "super-secret" --shares 5 --threshold 3
  $ obsidian shamir combine "<shard1>" "<shard2>" "<shard3>"

  # Whole Repository Sharing:
  $ obsidian repo send ./my-project --recipient <pubkey>
  $ obsidian repo get <url> --output ./recovered
`);

program.parse(process.argv);
