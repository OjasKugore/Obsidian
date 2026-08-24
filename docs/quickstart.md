# Quickstart Guide

This guide sets up the Next.js application in `obsidian/`.

## Prerequisites

- Node.js 20+
- npm
- PostgreSQL database (Neon or Vercel Postgres recommended)

## Install

```bash
cd obsidian
npm install
```

## Environment

Create `obsidian/.env.local` and add the required values:

```env
DATABASE_URL="postgresql://USER:PASSWORD@HOST/DATABASE?sslmode=require"
IP_HMAC_SECRET="GENERATE_A_RANDOM_32_BYTE_SECRET"
```

Never commit `.env.local`. Generate a secret with:

```bash
openssl rand -hex 32
```

The database URL is required for Prisma and paste storage. `IP_HMAC_SECRET` is used for IP rate-limiting.

## Database

Generate the Prisma client and apply the schema:

```bash
npm run db:generate
npm run db:push
```

## Run Locally

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Verify

Run the available checks from `obsidian/`:

### Lint

Run static code analysis:

```bash
npm run lint
```

### Test

Run the unit test suite:

```bash
npm test
```

### Build

Compile and optimize the application for production:

```bash
npm run build
```

### Start

Start the local production server (must run `npm run build` first):

```bash
npm start
```

## Production

For Vercel, import the repository, set the project root to `obsidian/`, add the environment variables above, and deploy. Run Prisma generation during the build and apply production database changes through the deployment workflow.

## Project Structure

- `obsidian/app/` - Next.js routes and API endpoints
- `obsidian/components/` - UI components
- `obsidian/hooks/` - client-side application hooks
- `obsidian/lib/crypto/` - browser encryption and key-management code
- `obsidian/prisma/` - database schema
- `obsidian/tests/` - unit and integration tests
