/**
 * cli/src/commands/read.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * `obsidian read` — Fetch and decrypt a paste from a URL.
 * Supports:
 *   - Symmetric pastes (URL#base58Key)
 *   - Asymmetric pastes (URL#asym with local RSA identity key or --private-key)
 *   - Shamir Secret Sharing pastes (URL#shard-k-i-n-hex with quorum reconstruction)
 *
 * Usage:
 *   obsidian read https://localhost:3000/abc123#keyBase58
 *   obsidian read https://localhost:3000/abc123#asym
 *   obsidian read https://localhost:3000/abc123#shard-2-1-3-... --shards https://localhost:3000/abc123#shard-2-2-3-...
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { Command } from 'commander';
import { readFileSync } from 'fs';
import { aesDecrypt, fromBase58, importRSAPrivateKey, unwrapAESKey } from '../lib/crypto.ts';
import { parseShard, combineShards, extractShardFromUrl } from '../lib/shamir.ts';
import { fetchPaste, parseObsidianUrl } from '../lib/api.ts';
import { loadIdentityKey } from '../lib/keystore.ts';
import { spinner, success, error, label, divider, info, warn } from '../utils/display.ts';
import chalk from 'chalk';

export function makeReadCommand(): Command {
  return new Command('read')
    .description('Fetch and decrypt a paste from an Obsidian URL')
    .argument('<url>', 'Full Obsidian paste URL (including #key or #shard fragment)')
    .argument('[extraShards...]', 'Additional shard URLs or shard strings to reach quorum')
    .option('-s, --shards <shards...>', 'Additional shard URLs or shard strings for Shamir quorum')
    .option('--private-key <path>', 'Path to PKCS8 private key file (.pem or base64) for asymmetric pastes')
    .option('--raw', 'Print only the decrypted content (no metadata)')
    .action(async (
      url: string,
      extraShards: string[] | undefined,
      opts: { shards?: string[]; privateKey?: string; raw: boolean }
    ) => {
      try {
        const { id, fragment } = parseObsidianUrl(url);
        const isAsym = fragment === 'asym';
        const primaryShard = parseShard(fragment);
        const isShamir = primaryShard !== null;

        if (!opts.raw) {
          divider();
          console.log(chalk.hex('#9b59b6').bold('  📥 Decrypting paste...'));
          divider();
        }

        // ── 1. Fetch from server ───────────────────────────────────────────
        const fetchSpin = opts.raw ? null : spinner(`Fetching paste ${id}...`);
        const paste = await fetchPaste(id);
        fetchSpin?.succeed('Fetched');

        // ── 2. Resolve decryption key ──────────────────────────────────────
        let rawKey!: Uint8Array;
        let modeLabel = '🔑 Symmetric (AES-256-GCM)';

        if (isAsym) {
          modeLabel = '🔐 Asymmetric (RSA-OAEP)';
          const decryptSpin = opts.raw ? null : spinner('Resolving RSA private key...');

          const wrappedKey = (paste.adata as unknown[])[4] as string | undefined;
          if (!wrappedKey) {
            decryptSpin?.fail('No wrapped key found in paste adata');
            error('This paste has no wrapped key. It may not be an asymmetric paste.');
            process.exit(1);
          }

          let privateKey!: CryptoKey;

          if (opts.privateKey) {
            const keyData = readFileSync(opts.privateKey, 'utf-8').trim();
            const base64 = keyData
              .replace(/-----BEGIN PRIVATE KEY-----/g, '')
              .replace(/-----END PRIVATE KEY-----/g, '')
              .replace(/\s/g, '');
            privateKey = await importRSAPrivateKey(base64);
            decryptSpin?.succeed('Private key loaded from file');
          } else {
            const identity = await loadIdentityKey();
            if (!identity) {
              decryptSpin?.fail('No identity key found');
              error('No identity key found. Run `obsidian key generate` or provide --private-key <path>.');
              process.exit(1);
            }
            privateKey = identity.privateKey;
            decryptSpin?.succeed(`Using identity key (fingerprint: ${identity.fingerprint})`);
          }

          const unwrapSpin = opts.raw ? null : spinner('Unwrapping AES key with RSA private key...');
          try {
            rawKey = await unwrapAESKey(wrappedKey, privateKey);
            unwrapSpin?.succeed('AES key unwrapped');
          } catch {
            unwrapSpin?.fail('RSA unwrap failed');
            error('Could not unwrap the key — wrong private key or corrupted paste.');
            process.exit(1);
          }

        } else if (isShamir || paste.meta?.shard) {
          // ── Shamir Secret Sharing Quorum Mode ────────────────────────────
          const allInputs: string[] = [];
          if (fragment) allInputs.push(fragment);
          if (extraShards && extraShards.length > 0) allInputs.push(...extraShards);
          if (opts.shards && opts.shards.length > 0) allInputs.push(...opts.shards);

          // Extract and deduplicate valid shards
          const shardMap = new Map<number, string>();
          for (const input of allInputs) {
            const extracted = extractShardFromUrl(input);
            if (extracted) {
              const parsed = parseShard(extracted);
              if (parsed) {
                shardMap.set(parsed.index, extracted);
              }
            }
          }

          const collectedShards = Array.from(shardMap.values());
          const firstParsed = collectedShards.length > 0 ? parseShard(collectedShards[0]) : primaryShard;
          const threshold = firstParsed?.threshold ?? 2;
          const totalShares = firstParsed?.total ?? paste.meta?.shardTotal ?? 3;

          modeLabel = `👥 Shamir Secret Sharing (${threshold}-of-${totalShares} Quorum)`;

          if (collectedShards.length < threshold) {
            if (opts.raw) {
              process.exit(1);
            }
            console.log('');
            divider();
            console.log(chalk.yellow.bold(`  🔒 Shamir Quorum Required (${collectedShards.length}/${threshold} shards provided)`));
            divider();
            console.log('');
            info(`This paste was encrypted using Shamir Secret Sharing.`);
            info(`It requires a quorum of at least ${threshold} team member shards to decrypt.`);
            console.log('');
            label('Paste ID', id);
            label('Threshold (k)', `${threshold} shards needed`);
            label('Provided', `${collectedShards.length} shard(s) [Shard #${Array.from(shardMap.keys()).join(', Shard #')}]`);
            console.log('');
            console.log(chalk.cyan.bold('  To decrypt, supply the remaining shard URL(s):'));
            console.log(chalk.white(`  obsidian read "${url}" --shards "<second-shard-url>"`));
            console.log('');
            return;
          }

          const combineSpin = opts.raw ? null : spinner(`Reconstructing AES key from ${collectedShards.length} shards...`);
          try {
            rawKey = combineShards(collectedShards);
            combineSpin?.succeed(`Lagrange interpolation complete — AES-256 key recovered`);
          } catch (err: unknown) {
            combineSpin?.fail('Shamir reconstruction failed');
            error((err instanceof Error) ? err.message : String(err));
            process.exit(1);
          }

        } else {
          // Symmetric: key is in the URL fragment as base58
          if (!fragment) {
            error('No key fragment in URL. The URL must end with #<key>');
            process.exit(1);
          }
          try {
            rawKey = fromBase58(fragment);
          } catch {
            error('Could not decode key from URL fragment. Make sure the full URL (including #key) was copied.');
            process.exit(1);
          }
        }

        // ── 3. Decrypt ─────────────────────────────────────────────────────
        const decSpin = opts.raw ? null : spinner('Decrypting payload with AES-256-GCM...');
        let plaintext!: string;
        try {
          plaintext = await aesDecrypt(paste.ct, paste.adata as unknown[], rawKey);
          decSpin?.succeed('Decrypted successfully');
        } catch {
          decSpin?.fail('Decryption failed');
          error('Decryption failed — key mismatch or corrupted content.');
          process.exit(1);
        }

        // ── 4. Output ──────────────────────────────────────────────────────
        if (opts.raw) {
          process.stdout.write(plaintext);
          return;
        }

        console.log('');
        label('Paste ID', id);
        label('Mode',     modeLabel);
        divider();
        console.log(chalk.hex('#9b59b6').bold('  📄 Decrypted Content:'));
        divider();
        console.log(chalk.white(plaintext));
        divider();
        success('Content decrypted successfully.');
        console.log('');

      } catch (err: unknown) {
        error((err instanceof Error) ? err.message : String(err));
        process.exit(1);
      }
    });
}
