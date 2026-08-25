/**
 * cli/src/utils/archive.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Repo archiving utilities — tar.gz creation and extraction.
 * Supports .gitignore-style exclusions.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { createWriteStream, createReadStream, readFileSync, existsSync } from 'fs';
import { join, relative, resolve } from 'path';
import { tmpdir } from 'os';
import { randomBytes } from 'crypto';

// ── Collect files respecting .gitignore-style patterns ───────────────────────

const DEFAULT_EXCLUDES = [
  'node_modules',
  '.next',
  '.git',
  'dist',
  'build',
  'out',
  '.DS_Store',
  'Thumbs.db',
  '*.log',
  'coverage',
  '.env.local',
  '.env.production',
];

function matchPattern(filePath: string, pattern: string): boolean {
  // Simple glob: supports * and directory name matches
  if (pattern.includes('*')) {
    const re = new RegExp('^' + pattern.replace(/\./g, '\\.').replace(/\*/g, '[^/]*') + '$');
    const base = filePath.split('/').pop() ?? '';
    return re.test(base);
  }
  // Directory or file name match
  return filePath === pattern || filePath.startsWith(pattern + '/') || filePath.split('/').includes(pattern);
}

function readGitignore(dir: string): string[] {
  const gitignorePath = join(dir, '.gitignore');
  if (!existsSync(gitignorePath)) return [];
  return readFileSync(gitignorePath, 'utf-8')
    .split('\n')
    .map(l => l.trim())
    .filter(l => l && !l.startsWith('#'));
}

async function collectFiles(
  dir: string,
  baseDir: string,
  excludes: string[],
  gitignorePatterns: string[]
): Promise<string[]> {
  const { readdirSync, statSync } = await import('fs');
  const results: string[] = [];

  const entries = readdirSync(dir);
  for (const entry of entries) {
    const fullPath = join(dir, entry);
    const relPath  = relative(baseDir, fullPath).replace(/\\/g, '/');

    // Check exclusions
    const allPatterns = [...excludes, ...gitignorePatterns, ...DEFAULT_EXCLUDES];
    const excluded = allPatterns.some(p => matchPattern(relPath, p));
    if (excluded) continue;

    const stat = statSync(fullPath);
    if (stat.isDirectory()) {
      const sub = await collectFiles(fullPath, baseDir, excludes, gitignorePatterns);
      results.push(...sub);
    } else {
      results.push(fullPath);
    }
  }

  return results;
}

// ── Create tar.gz archive ─────────────────────────────────────────────────────

export interface ArchiveResult {
  archivePath: string;
  fileCount: number;
  sizeBytes: number;
}

export async function createArchive(
  sourceDir: string,
  extraExcludes: string[] = []
): Promise<ArchiveResult> {
  const tar = await import('tar');
  const absDir = resolve(sourceDir);
  const gitignorePatterns = readGitignore(absDir);

  const files = await collectFiles(absDir, absDir, extraExcludes, gitignorePatterns);
  const relFiles = files.map(f => relative(absDir, f).replace(/\\/g, '/'));

  const archivePath = join(tmpdir(), `obsidian-repo-${randomBytes(8).toString('hex')}.tar.gz`);

  await tar.create(
    { gzip: true, file: archivePath, cwd: absDir },
    relFiles
  );

  const { statSync } = await import('fs');
  const sizeBytes = statSync(archivePath).size;

  return { archivePath, fileCount: files.length, sizeBytes };
}

// ── Extract tar.gz archive ────────────────────────────────────────────────────

export async function extractArchive(archivePath: string, destDir: string): Promise<void> {
  const tar = await import('tar');
  const { mkdirSync } = await import('fs');
  mkdirSync(destDir, { recursive: true });
  await tar.extract({ file: archivePath, cwd: destDir });
}

// ── Format size ───────────────────────────────────────────────────────────────

export function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}
