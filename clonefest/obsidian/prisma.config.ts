/**
 * prisma.config.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Prisma 7 configuration file.
 * Connection URLs moved here from schema.prisma (breaking change in Prisma 7).
 *
 * NOTE: The Neon serverless adapter is passed to PrismaClient in lib/db/prisma.ts,
 * not here. This file only sets the datasource URL for Prisma Migrate / Studio.
 *
 * References:
 *   https://pris.ly/d/config-datasource
 *   https://pris.ly/d/prisma7-client-config
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { defineConfig } from 'prisma/config';
import dotenv from 'dotenv';
import path from 'path';

// Ensure .env.local is loaded for Prisma CLI
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
dotenv.config();

export default defineConfig({
  datasource: {
    url: process.env.DATABASE_URL ?? 'postgresql://localhost:5432/obsidian',
  },
});

