#!/usr/bin/env node
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const entry = resolve(__dirname, '../src/index.ts');
const tsxCli = resolve(__dirname, '../node_modules/tsx/dist/cli.mjs');

const child = spawn(
  process.execPath,
  [tsxCli, entry, ...process.argv.slice(2)],
  { stdio: 'inherit', env: process.env }
);

child.on('exit', (code) => {
  process.exit(code ?? 0);
});
