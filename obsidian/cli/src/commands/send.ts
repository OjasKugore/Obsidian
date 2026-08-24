/**
 * cli/src/commands/send.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * `obsidian send` — Encrypt text or a file and upload as a paste.
 * Supports:
 *   - Single-user Symmetric (AES-256-GCM)
 *   - Single-user Asymmetric (RSA-OAEP with recipient public key)
 *   - Multi-user Threshold Quorum (Shamir Secret Sharing GF(2^8))
 *
 * Usage:
 *   obsidian send "my secret text"
 *   obsidian send --file ./secrets.txt
 *   obsidian send "message" --burn
 *   obsidian send "message" --recipient <pubkey-base64>
 *   obsidian send "classified team doc" --shares 3 --threshold 2
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { Command } from 'commander';
import { readFileSync } from 'fs';
import { aesEncrypt, toBase58, importRSAPublicKey, wrapAESKey } from '../lib/crypto.ts';
import { splitKey } from '../lib/shamir.ts';
import { createPaste, buildUrl } from '../lib/api.ts';
import { spinner, success, error, label, divider, shareLink, info, warn } from '../utils/display.ts';
import chalk from 'chalk';

export function makeSendCommand(): Command {
  return new Command('send')
    .description('Encrypt and upload a paste from text or file')
    .argument('[text]', 'Text to encrypt (or use --file)')
    .option('-f, --file <path>', 'Read plaintext from a file instead')
    .option('--burn', 'Burn after reading (default: true)', true)
    .option('--no-burn', 'Do NOT burn after reading (paste persists)')
    .option('--discussion', 'Enable encrypted comments on this paste')
    .option('--recipient <pubkey>', 'RSA public key (base64) for asymmetric mode')
    .option('--shamir', 'Enable Shamir Secret Sharing (default 2-of-3 threshold quorum)')
    .option('-n, --shares <number>', 'Total number of Shamir shares to generate (2-255)')
    .option('-k, --threshold <number>', 'Minimum Shamir shares required to decrypt (2-255)')
    .option('--url <baseUrl>', 'Override the Obsidian server URL')
    .option('--silent', 'Only print the URL(s) (no other output)')
    .action(async (text: string | undefined, opts: {
      file?: string;
      burn: boolean;
      discussion: boolean;
      recipient?: string;
      shamir?: boolean;
      shares?: string;
      threshold?: string;
      url?: string;
      silent: boolean;
    }) => {
      try {
        // ── 0. Parse Shamir parameters ─────────────────────────────────────
        let isShamir = !!opts.shamir || !!opts.shares || !!opts.threshold;
        let totalShares = opts.shares ? parseInt(opts.shares, 10) : 3;
        let threshold = opts.threshold ? parseInt(opts.threshold, 10) : 2;

        if (isShamir) {
          if (opts.recipient) {
            error('Cannot combine Asymmetric mode (--recipient) with Shamir Secret Sharing (--shares/--threshold).');
            process.exit(1);
          }
          if (Number.isNaN(totalShares) || totalShares < 2 || totalShares > 255) {
            error('Total shares (--shares, -n) must be an integer between 2 and 255.');
            process.exit(1);
          }
          if (Number.isNaN(threshold) || threshold < 2 || threshold > totalShares) {
            error(`Threshold (--threshold, -k) must be between 2 and total shares (${totalShares}).`);
            process.exit(1);
          }
        }

        // ── 1. Read plaintext ──────────────────────────────────────────────
        let plaintext: string;

        if (opts.file) {
          plaintext = readFileSync(opts.file, 'utf-8');
          if (!opts.silent) info(`Reading from file: ${opts.file}`);
        } else if (text) {
          plaintext = text;
        } else {
          // Read from stdin
          const chunks: Buffer[] = [];
          for await (const chunk of process.stdin) chunks.push(chunk as Buffer);
          plaintext = Buffer.concat(chunks).toString('utf-8');
          if (!plaintext.trim()) {
            error('No text provided. Pass text as argument, --file, or pipe via stdin.');
            process.exit(1);
          }
          if (!opts.silent) info('Reading from stdin...');
        }

        if (!opts.silent) {
          divider();
          console.log(chalk.hex('#9b59b6').bold('  📤 Encrypting paste...'));
          divider();
        }

        const spin = opts.silent ? null : spinner('Encrypting with AES-256-GCM...');

        // ── 2. Encrypt ─────────────────────────────────────────────────────
        // If Shamir is enabled, burn-after-reading should be false by default so multiple members can fetch
        const effectiveBurn = isShamir ? false : opts.burn;

        const result = await aesEncrypt(plaintext, {
          burnAfterReading: effectiveBurn,
          openDiscussion:   opts.discussion,
        });

        spin?.succeed('Encrypted');

        // ── 3. Asymmetric mode: wrap AES key with RSA public key ───────────
        let wrappedKey: string | undefined;
        if (opts.recipient) {
          const wrappingSpin = opts.silent ? null : spinner('Wrapping key with recipient RSA public key...');
          try {
            const pubKey = await importRSAPublicKey(opts.recipient);
            wrappedKey = await wrapAESKey(result.rawKey, pubKey);
            (result.adata as unknown[]).push(wrappedKey);
            wrappingSpin?.succeed('Key wrapped with RSA-OAEP');
          } catch {
            wrappingSpin?.fail('Invalid recipient public key');
            error('Could not parse recipient public key. Make sure it is a valid base64 SPKI string.');
            process.exit(1);
          }
        }

        // ── 4. Upload ──────────────────────────────────────────────────────
        const uploadSpin = opts.silent ? null : spinner('Uploading to server...');
        const paste = await createPaste({
          v: 2,
          ct: result.ciphertext,
          adata: result.adata,
          meta: {
            expire: '1day',
            openDiscussion: opts.discussion,
            burnAfterReading: effectiveBurn,
            recipientMode: !!opts.recipient,
            shard: isShamir,
            shardIndex: isShamir ? 1 : undefined,
            shardTotal: isShamir ? totalShares : undefined,
          },
        });
        uploadSpin?.succeed('Uploaded');

        // ── 5. Build URLs & Output ─────────────────────────────────────────
        if (isShamir) {
          // Split raw 32-byte AES key into N shards with threshold K
          const shards = splitKey(result.rawKey, totalShares, threshold);
          const shardUrls = shards.map(s => buildUrl(paste.pasteId, s));

          if (opts.silent) {
            shardUrls.forEach(u => console.log(u));
            return;
          }

          console.log('');
          label('Paste ID',    paste.pasteId);
          label('Mode',        `👥 Shamir Secret Sharing (${threshold}-of-${totalShares} Quorum)`);
          label('Burn After',  'No (Multi-user quorum access enabled)');
          label('Discussion',  opts.discussion ? 'Enabled' : 'Disabled');

          console.log('');
          divider();
          console.log(chalk.hex('#9b59b6').bold(`  🧩 Generated ${totalShares} Shard Links (Any ${threshold} required to decrypt):`));
          divider();
          console.log('');

          shardUrls.forEach((url, i) => {
            console.log(chalk.cyan.bold(`  [Shard #${i + 1} of ${totalShares}]`));
            console.log(chalk.white.underline(`  ${url}`));
            console.log('');
          });

          info(`Distribute one shard link to each of the ${totalShares} team members.`);
          info(`Any ${threshold} members can combine their shards to reconstruct and decrypt the paste.`);
          console.log('');
          success(`Shamir ${threshold}-of-${totalShares} quorum paste created successfully!`);

        } else {
          // Standard Single-user Symmetric or Asymmetric
          const fragment = opts.recipient ? 'asym' : toBase58(result.rawKey);
          const url = buildUrl(paste.pasteId, fragment);

          if (opts.silent) {
            console.log(url);
            return;
          }

          console.log('');
          label('Paste ID',    paste.pasteId);
          label('Mode',        opts.recipient ? '🔐 Asymmetric (RSA-OAEP)' : '🔑 Symmetric (AES-256-GCM)');
          label('Burn After',  effectiveBurn ? 'Yes' : 'No');
          label('Discussion',  opts.discussion ? 'Enabled' : 'Disabled');

          shareLink(url);

          if (opts.recipient) {
            success('Encrypted for specific recipient — only they can decrypt with their private key.');
          }
        }

      } catch (err: unknown) {
        error((err instanceof Error) ? err.message : String(err));
        process.exit(1);
      }
    });
}
