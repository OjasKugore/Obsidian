/**
 * cli/src/commands/repo.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * `obsidian repo` — Encrypt and upload/download entire repositories.
 *
 * Subcommands:
 *   obsidian repo send <path>               Tar.gz, encrypt, upload
 *   obsidian repo send <path> --recipient   RSA-wrapped for specific recipient
 *   obsidian repo get  <url>  --output dir  Download and decrypt repo archive
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { Command } from 'commander';
import { readFileSync, unlinkSync } from 'fs';
import { aesEncrypt, aesDecrypt, toBase58, fromBase58, importRSAPublicKey, wrapAESKey, importRSAPrivateKey, unwrapAESKey } from '../lib/crypto.ts';
import { createPaste, fetchPaste, parseObsidianUrl, buildUrl } from '../lib/api.ts';
import { loadIdentityKey } from '../lib/keystore.ts';
import { createArchive, extractArchive, formatSize } from '../utils/archive.ts';
import { spinner, success, error, label, divider, shareLink, info } from '../utils/display.ts';
import { join } from 'path';
import { tmpdir, homedir } from 'os';
import { randomBytes } from 'crypto';
import chalk from 'chalk';

const MAX_REPO_BYTES = 10 * 1024 * 1024; // 10 MB safety limit

export function makeRepoCommand(): Command {
  const repo = new Command('repo')
    .description('Encrypt and share whole repositories');

  // ── repo send ─────────────────────────────────────────────────────────────
  repo
    .command('send <path>')
    .description('Archive, encrypt, and upload a repository')
    .option('--recipient <pubkey>', 'RSA public key (base64) — asymmetric mode')
    .option('--exclude <patterns...>', 'Additional patterns to exclude (e.g. dist .cache)')
    .option('--no-burn', 'Do not burn paste after reading')
    .option('--silent', 'Print only the share URL')
    .action(async (repoPath: string, opts: {
      recipient?: string;
      exclude?: string[];
      burn: boolean;
      silent: boolean;
    }) => {
      try {
        if (!opts.silent) {
          divider();
          console.log(chalk.hex('#9b59b6').bold('  📦 Archiving & Encrypting Repository...'));
          divider();
        }

        // ── 1. Create tar.gz archive ───────────────────────────────────────
        const archiveSpin = opts.silent ? null : spinner('Scanning and archiving files...');
        let archive!: Awaited<ReturnType<typeof createArchive>>;
        try {
          archive = await createArchive(repoPath, opts.exclude ?? []);
          archiveSpin?.succeed(
            `Archived ${archive.fileCount} files (${formatSize(archive.sizeBytes)})`
          );
        } catch (err: unknown) {
          archiveSpin?.fail('Archiving failed');
          error((err instanceof Error) ? err.message : String(err));
          process.exit(1);
        }

        if (archive.sizeBytes > MAX_REPO_BYTES) {
          unlinkSync(archive.archivePath);
          error(`Repository archive is ${formatSize(archive.sizeBytes)} — exceeds 10 MB limit.`);
          info('Tip: Use --exclude to skip large directories (e.g. --exclude dist .cache)');
          process.exit(1);
        }

        // ── 2. Read archive bytes and convert to base64 string for encryption
        const archiveBytes = readFileSync(archive.archivePath);
        const archiveB64   = archiveBytes.toString('base64');

        // Wrap as a special JSON payload so we know it's a repo on extraction
        const repoPayload = JSON.stringify({
          __obsidian_repo__: true,
          filename: repoPath.split(/[\\/]/).pop() ?? 'repo',
          fileCount: archive.fileCount,
          sizeBytes: archive.sizeBytes,
          data: archiveB64,
        });

        // ── 3. Encrypt ─────────────────────────────────────────────────────
        const encSpin = opts.silent ? null : spinner('Encrypting with AES-256-GCM...');
        const result = await aesEncrypt(repoPayload, {
          burnAfterReading: opts.burn,
          openDiscussion:   false,
        });
        encSpin?.succeed('Encrypted');

        // Cleanup temp archive
        try { unlinkSync(archive.archivePath); } catch { /* ignore */ }

        // ── 4. Asymmetric wrapping ─────────────────────────────────────────
        let wrappedKey: string | undefined;
        if (opts.recipient) {
          const wrapSpin = opts.silent ? null : spinner('Wrapping key with RSA public key...');
          try {
            const pubKey = await importRSAPublicKey(opts.recipient);
            wrappedKey = await wrapAESKey(result.rawKey, pubKey);
            (result.adata as unknown[]).push(wrappedKey);
            wrapSpin?.succeed('Key wrapped with RSA-OAEP');
          } catch {
            wrapSpin?.fail('Invalid recipient public key');
            error('Could not parse recipient public key.');
            process.exit(1);
          }
        }

        // ── 5. Upload ──────────────────────────────────────────────────────
        const uploadSpin = opts.silent ? null : spinner('Uploading encrypted archive...');
        const paste = await createPaste({
          v: 2,
          ct: result.ciphertext,
          adata: result.adata,
          meta: {
            expire: '1week',
            burnAfterReading: opts.burn,
            recipientMode: !!opts.recipient,
          },
        });
        uploadSpin?.succeed('Uploaded');

        const fragment = opts.recipient ? 'asym' : toBase58(result.rawKey);
        const url = buildUrl(paste.pasteId, fragment);

        if (opts.silent) {
          console.log(url);
          return;
        }

        console.log('');
        label('Paste ID',   paste.pasteId);
        label('Files',      String(archive.fileCount));
        label('Size',       formatSize(archive.sizeBytes));
        label('Mode',       opts.recipient ? '🔐 Asymmetric (RSA-OAEP)' : '🔑 Symmetric');
        label('Burn After', opts.burn ? 'Yes' : 'No');

        shareLink(url);
        info('Recipient can restore with: obsidian repo get <url> --output ./project');
        console.log('');

      } catch (err: unknown) {
        error((err instanceof Error) ? err.message : String(err));
        process.exit(1);
      }
    });

  // ── repo get ──────────────────────────────────────────────────────────────
  repo
    .command('get <url>')
    .description('Download and decrypt a repository paste')
    .option('-o, --output <dir>', 'Output directory to extract into', join(homedir(), 'Downloads'))
    .option('--private-key <path>', 'Path to private key file for asymmetric pastes')
    .action(async (url: string, opts: { output: string; privateKey?: string }) => {
      try {
        divider();
        console.log(chalk.hex('#9b59b6').bold('  📥 Downloading & Decrypting Repository...'));
        divider();

        const { id, fragment } = parseObsidianUrl(url);
        const isAsym = fragment === 'asym';

        // ── 1. Fetch paste ─────────────────────────────────────────────────
        const fetchSpin = spinner(`Fetching paste ${id}...`);
        const paste = await fetchPaste(id);
        fetchSpin.succeed('Fetched');

        // ── 2. Resolve key ─────────────────────────────────────────────────
        let rawKey!: Uint8Array;
        if (isAsym) {
          const wrappedKey = (paste.adata as unknown[])[4] as string | undefined;
          if (!wrappedKey) {
            error('No wrapped key in paste adata.');
            process.exit(1);
          }

          let privateKey!: CryptoKey;
          if (opts.privateKey) {
            const keyData = readFileSync(opts.privateKey, 'utf-8').trim()
              .replace(/-----BEGIN PRIVATE KEY-----/g, '')
              .replace(/-----END PRIVATE KEY-----/g, '')
              .replace(/\s/g, '');
            privateKey = await importRSAPrivateKey(keyData);
          } else {
            const identity = await loadIdentityKey();
            if (!identity) {
              error('No identity key found. Run `obsidian key generate` or provide --private-key.');
              process.exit(1);
            }
            privateKey = identity.privateKey;
          }

          const unwrapSpin = spinner('Unwrapping AES key...');
          try {
            rawKey = await unwrapAESKey(wrappedKey, privateKey);
            unwrapSpin.succeed('AES key unwrapped');
          } catch {
            unwrapSpin.fail('RSA unwrap failed');
            error('Wrong private key or corrupted paste.');
            process.exit(1);
          }
        } else {
          rawKey = fromBase58(fragment);
        }

        // ── 3. Decrypt ─────────────────────────────────────────────────────
        const decSpin = spinner('Decrypting...');
        let plaintext!: string;
        try {
          plaintext = await aesDecrypt(paste.ct, paste.adata as unknown[], rawKey);
          decSpin.succeed('Decrypted');
        } catch {
          decSpin.fail('Decryption failed');
          error('Wrong key or corrupted content.');
          process.exit(1);
        }

        // ── 4. Parse and extract repo ──────────────────────────────────────
        let repoPayload: { __obsidian_repo__: boolean; filename: string; fileCount: number; sizeBytes: number; data: string };
        try {
          repoPayload = JSON.parse(plaintext);
        } catch {
          error('Decrypted content is not a valid repo paste.');
          info('Use `obsidian read` to read plain text pastes.');
          process.exit(1);
        }

        if (!repoPayload.__obsidian_repo__) {
          error('This paste is not a repo archive. Use `obsidian read` instead.');
          process.exit(1);
        }

        const extractSpin = spinner(`Extracting ${repoPayload.fileCount} files to ${opts.output}...`);
        const archivePath = join(tmpdir(), `obsidian-extract-${randomBytes(8).toString('hex')}.tar.gz`);

        try {
          const archiveBuffer = Buffer.from(repoPayload.data, 'base64');
          const { writeFileSync } = await import('fs');
          writeFileSync(archivePath, archiveBuffer);
          await extractArchive(archivePath, opts.output);
          unlinkSync(archivePath);
          extractSpin.succeed(`Extracted to ${opts.output}`);
        } catch (err: unknown) {
          extractSpin.fail('Extraction failed');
          error((err instanceof Error) ? err.message : String(err));
          process.exit(1);
        }

        console.log('');
        label('Paste ID',  id);
        label('Files',     String(repoPayload.fileCount));
        label('Size',      formatSize(repoPayload.sizeBytes));
        label('Extracted', opts.output);
        divider();
        success('Repository extracted and decrypted successfully!');
        console.log('');

      } catch (err: unknown) {
        error((err instanceof Error) ? err.message : String(err));
        process.exit(1);
      }
    });

  return repo;
}
