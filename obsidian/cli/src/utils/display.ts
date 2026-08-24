/**
 * cli/src/utils/display.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Terminal UI utilities — banner, colors, spinners, success/error output.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import chalk from 'chalk';
import ora from 'ora';

// ── Banner ─────────────────────────────────────────────────────────────────────

export function printBanner(): void {
  console.log('');
  console.log(chalk.hex('#9b59b6').bold('  ██████╗ ██████╗ ███████╗██╗██████╗ ██╗ █████╗ ███╗   ██╗'));
  console.log(chalk.hex('#8e44ad').bold('  ██╔═══██╗██╔══██╗██╔════╝██║██╔══██╗██║██╔══██╗████╗  ██║'));
  console.log(chalk.hex('#7d3c98').bold('  ██║   ██║██████╔╝███████╗██║██║  ██║██║███████║██╔██╗ ██║'));
  console.log(chalk.hex('#6c3483').bold('  ██║   ██║██╔══██╗╚════██║██║██║  ██║██║██╔══██║██║╚██╗██║'));
  console.log(chalk.hex('#5b2c6f').bold('  ╚██████╔╝██████╔╝███████║██║██████╔╝██║██║  ██║██║ ╚████║'));
  console.log(chalk.hex('#4a235a').bold('   ╚═════╝ ╚═════╝ ╚══════╝╚═╝╚═════╝ ╚═╝╚═╝  ╚═╝╚═╝  ╚═══╝'));
  console.log('');
  console.log(chalk.gray('  End-to-End Encrypted Pastebin CLI  ') + chalk.hex('#9b59b6')('v1.0.0'));
  console.log(chalk.gray('  ─────────────────────────────────────────────────────'));
  console.log('');
}

// ── Spinner ────────────────────────────────────────────────────────────────────

export function spinner(text: string) {
  return ora({
    text,
    spinner: 'dots',
    color: 'magenta',
    stream: process.stdout,
  }).start();
}

// ── Output helpers ─────────────────────────────────────────────────────────────

export function success(msg: string): void {
  console.log(chalk.green('  ✓ ') + chalk.white(msg));
}

export function error(msg: string): void {
  console.error(chalk.red('  ✗ ') + chalk.white(msg));
}

export function warn(msg: string): void {
  console.warn(chalk.yellow('  ⚠ ') + chalk.white(msg));
}

export function info(msg: string): void {
  console.log(chalk.cyan('  ℹ ') + chalk.white(msg));
}

export function label(key: string, value: string): void {
  console.log(chalk.gray(`  ${key.padEnd(16)}: `) + chalk.white(value));
}

export function divider(): void {
  console.log(chalk.gray('  ─────────────────────────────────────────────────────'));
}

export function box(title: string, lines: string[]): void {
  divider();
  console.log(chalk.hex('#9b59b6').bold(`  ${title}`));
  divider();
  lines.forEach(l => console.log(chalk.white(`  ${l}`)));
  divider();
}

export function shareLink(url: string): void {
  console.log('');
  console.log(chalk.hex('#9b59b6').bold('  🔗 Share Link:'));
  console.log('');
  console.log(chalk.white.underline(`  ${url}`));
  console.log('');
  info('Copy this link — the key is embedded in the # fragment.');
  info('Anyone with this link can decrypt. Keep it secret!');
  console.log('');
}
