/**
 * lib/db/prisma.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Prisma 7 client singleton — compatible with both Node.js and Edge Runtime.
 *
 * Prisma 7 requires the Neon adapter to be passed directly to PrismaClient
 * instead of being configured in schema.prisma.
 *
 * The globalThis singleton pattern prevents connection exhaustion during
 * Next.js hot reloads in development.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { PrismaClient } from '@prisma/client';
import { PrismaNeon } from '@prisma/adapter-neon';

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

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma: PrismaClient =
  globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

export default prisma;
