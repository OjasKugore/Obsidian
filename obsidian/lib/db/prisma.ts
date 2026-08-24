/**
 * lib/db/prisma.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Prisma 7 Client Singleton & Neon Serverless PostgreSQL Driver.
 *
 * Configures the `@prisma/adapter-neon` serverless driver and exports a singleton
 * `prisma` client instance bound to `globalThis` to prevent database connection
 * pool exhaustion during Next.js development hot-reloads.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { PrismaClient } from '@prisma/client';
import { PrismaNeon } from '@prisma/adapter-neon';

// ── PRISMA CLIENT FACTORY & NEON ADAPTER ────────────────────────────

function createPrismaClient(): PrismaClient {
  const connectionString =
    process.env.DATABASE_URL ||
    'postgres://placeholder:placeholder@localhost:5432/placeholder';

  if (!process.env.DATABASE_URL) {
    console.warn(
      '[prisma] DATABASE_URL not set — DB calls will fail at runtime. ' +
        'Add it to .env.local to enable database features.'
    );
  }

  const adapter = new PrismaNeon({ connectionString });

  return new PrismaClient({
    adapter,
    log:
      process.env.NODE_ENV === 'development'
        ? ['query', 'error', 'warn']
        : ['error'],
  });
}

// ── GLOBALTHIS SINGLETON INSTANTIATION ────────────────────────────────

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma: PrismaClient =
  globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

export default prisma;
