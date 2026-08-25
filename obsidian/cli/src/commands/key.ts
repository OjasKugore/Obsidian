/**
 * cli/src/commands/key.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * `obsidian key` — RSA identity key management.
 *
 * Subcommands:
 *   obsidian key generate         Generate and save a new RSA keypair
 *   obsidian key show             Show fingerprint and public key
 *   obsidian key show --public    Print public key base64 (shareable)
 *   obsidian key export           Export private key to file
 *   obsidian key import <file>    Import private key from file
 *   obsidian key delete           Delete identity key from disk
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { Command } from 'commander';
import { writeFileSync, readFileSync } from 'fs';
import { generateAndSaveIdentityKey, loadIdentityKey, getIdentityRecord, deleteIdentityKey, hasIdentityKey } from '../lib/keystore.ts';
import { importRSAPrivateKey, importRSAPublicKey, getKeyFingerprint, exportPublicKeyBase64 } from '../lib/crypto.ts';
import { IDENTITY_FILE } from '../lib/config.ts';
import { spinner, success, error, label, info, divider, warn } from '../utils/display.ts';
import chalk from 'chalk';

function formatFingerprint(fp: string): string {
  // Format as: a3f8:b2c1:d4e5:f6a7
  return fp.match(/.{4}/g)?.join(':') ?? fp;
}

export function makeKeyCommand(): Command {
  const key = new Command('key')
    .description('Manage your RSA identity key for asymmetric encryption');

  // ── key generate ──────────────────────────────────────────────────────────
  key
    .command('generate')
    .description('Generate a new RSA-2048 identity keypair and save locally')
    .option('--force', 'Overwrite existing key without prompting')
    .action(async (opts: { force: boolean }) => {
      if (hasIdentityKey() && !opts.force) {
        warn('An identity key already exists at ' + IDENTITY_FILE);
        warn('Use --force to overwrite it (you will lose the old key!)');
        process.exit(1);
      }

      divider();
      console.log(chalk.hex('#9b59b6').bold('  🔑 Generating RSA-2048 Identity Key...'));
      divider();

      const spin = spinner('Generating RSA-2048-OAEP keypair...');
      const record = await generateAndSaveIdentityKey();
      spin.succeed('Keypair generated and saved');

      console.log('');
      label('Fingerprint', formatFingerprint(record.fingerprint));
      label('Saved to',    IDENTITY_FILE);
      label('Created at',  record.createdAt);
      console.log('');
      success('Identity key generated! Share your public key with senders:');
      console.log('');
      info('Run `obsidian key show --public` to get your public key.');
      console.log('');
    });

  // ── key show ──────────────────────────────────────────────────────────────
  key
    .command('show')
    .description('Show your identity key fingerprint and public key')
    .option('--public', 'Print the raw base64 public key (shareable with senders)')
    .option('--private', 'Print the raw base64 private key (KEEP SECRET!)')
    .action(async (opts: { public: boolean; private: boolean }) => {
      const record = getIdentityRecord();
      if (!record) {
        error('No identity key found. Run `obsidian key generate` first.');
        process.exit(1);
      }

      if (opts.public) {
        // Just print the raw public key for piping/copying
        console.log(record.publicKeyBase64);
        return;
      }

      if (opts.private) {
        warn('⚠️  DANGER: This is your PRIVATE KEY. Never share it!');
        warn('It decrypts all pastes sent to you. Keep it secret!');
        console.log('');
        console.log(record.privateKeyBase64);
        return;
      }

      divider();
      console.log(chalk.hex('#9b59b6').bold('  🔑 Identity Key'));
      divider();
      label('Fingerprint', formatFingerprint(record.fingerprint));
      label('Created',     record.createdAt);
      label('Stored at',   IDENTITY_FILE);
      divider();
      console.log('');
      console.log(chalk.gray('  Public Key (share with senders):'));
      console.log('');
      console.log(chalk.cyan(record.publicKeyBase64.slice(0, 60) + '...'));
      console.log('');
      info('Run `obsidian key show --public` to print full public key');
      console.log('');
    });

  // ── key export ────────────────────────────────────────────────────────────
  key
    .command('export')
    .description('Export your private key to a file (for backup)')
    .option('-o, --output <path>', 'Output file path', 'obsidian-private-key.b64')
    .action(async (opts: { output: string }) => {
      const record = getIdentityRecord();
      if (!record) {
        error('No identity key found. Run `obsidian key generate` first.');
        process.exit(1);
      }

      writeFileSync(opts.output, record.privateKeyBase64, 'utf-8');
      success(`Private key exported to ${opts.output}`);
      warn('Keep this file PRIVATE. Anyone with it can decrypt your pastes!');
    });

  // ── key import ────────────────────────────────────────────────────────────
  key
    .command('import <file>')
    .description('Import a private key from file (restores identity)')
    .action(async (file: string) => {
      const spin = spinner('Validating private key...');
      try {
        const keyData = readFileSync(file, 'utf-8').trim()
          .replace(/-----BEGIN PRIVATE KEY-----/g, '')
          .replace(/-----END PRIVATE KEY-----/g, '')
          .replace(/\s/g, '');

        const privateKey  = await importRSAPrivateKey(keyData);
        // We need the public key from the private key... derive via generate was the old approach
        // For import, we can only store what we have. We need the public key for fingerprint.
        // Since PKCS8 doesn't embed public key in Web Crypto, ask user to also provide public key.
        spin.fail('Private key import requires the corresponding public key');
        error('Web Crypto cannot derive a public key from a private key alone.');
        info('Instead, restore your full identity.json backup from your secured storage,');
        info('or regenerate your key with `obsidian key generate`.');
        process.exit(1);
      } catch (err: unknown) {
        spin.fail('Import failed');
        error((err instanceof Error) ? err.message : String(err));
        process.exit(1);
      }
    });

  // ── key delete ────────────────────────────────────────────────────────────
  key
    .command('delete')
    .description('Delete your identity key from disk')
    .option('--yes', 'Skip confirmation')
    .action(async (opts: { yes: boolean }) => {
      if (!hasIdentityKey()) {
        info('No identity key to delete.');
        return;
      }

      if (!opts.yes) {
        warn('This will permanently delete your identity key!');
        warn('You will NOT be able to decrypt existing asymmetric pastes sent to you.');
        warn('Run with --yes to confirm.');
        process.exit(1);
      }

      deleteIdentityKey();
      success('Identity key deleted from ' + IDENTITY_FILE);
    });

  return key;
}
