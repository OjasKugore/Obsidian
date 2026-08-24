'use client';

/**
 * app/api/docs/page.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Interactive Developer Portal:
 *   1. Obsidian CLI Command Reference & Scenarios (from docs/CLI_REFERENCE.md)
 *   2. Zero-Knowledge REST API Specification & cURL Examples
 * ─────────────────────────────────────────────────────────────────────────────
 */

import * as React from 'react';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { AuroraBackground } from '@/components/ui/AuroraBackground';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  BookOpen,
  Copy,
  Check,
  Code2,
  Terminal,
  Shield,
  Key,
  Database,
  Lock,
  Flame,
  Clock,
  Users,
  FolderArchive,
  Cpu,
  Layers,
  Search,
  ExternalLink,
  Info,
} from 'lucide-react';

interface EndpointDoc {
  method: 'GET' | 'POST' | 'DELETE' | 'PUT';
  path: string;
  summary: string;
  description: string;
  rateLimit: string;
  requestBody?: string;
  responseBody: string;
  curlExample: string;
}

interface CliCommandItem {
  purpose: string;
  command: string;
  category: 'Sending' | 'Reading' | 'Identity' | 'Shamir' | 'Repository' | 'Config';
}

const CLI_COMMANDS: CliCommandItem[] = [
  {
    purpose: 'Send a quick secret (burns on read)',
    command: 'npm run dev -- send "my secret password"',
    category: 'Sending',
  },
  {
    purpose: 'Send secret (keeps alive, does not burn)',
    command: 'npm run dev -- send "team wifi pass" --no-burn',
    category: 'Sending',
  },
  {
    purpose: 'Send a file (.env, config, private keys)',
    command: 'npm run dev -- send --file ./database.env',
    category: 'Sending',
  },
  {
    purpose: 'Read & decrypt any paste link',
    command: 'npm run dev -- read "http://localhost:3000/pasteId#key"',
    category: 'Reading',
  },
  {
    purpose: 'Generate personal RSA-2048 identity key',
    command: 'npm run dev -- key generate',
    category: 'Identity',
  },
  {
    purpose: 'Show & copy public key to share with others',
    command: 'npm run dev -- key show --public',
    category: 'Identity',
  },
  {
    purpose: 'Send secret to a specific person (Asymmetric)',
    command: 'npm run dev -- send "classified" --recipient "PASTE_PUBLIC_KEY_HERE"',
    category: 'Sending',
  },
  {
    purpose: 'Create a 2-of-3 Team Quorum (Shamir SSS)',
    command: 'npm run dev -- send "root password" --shares 3 --threshold 2',
    category: 'Shamir',
  },
  {
    purpose: 'Decrypt Shamir paste with 2 shards',
    command: 'npm run dev -- read "<shard1_url>" --shards "<shard2_url>"',
    category: 'Shamir',
  },
  {
    purpose: 'Encrypt & send an entire folder / repository',
    command: 'npm run dev -- repo send ./my-app --recipient "PASTE_PUBLIC_KEY_HERE"',
    category: 'Repository',
  },
  {
    purpose: 'Download & decrypt a whole repository',
    command: 'npm run dev -- repo get "http://localhost:3000/repoId#asym" --output ./my-app',
    category: 'Repository',
  },
  {
    purpose: 'Split a password locally (offline, no server)',
    command: 'npm run dev -- shamir split "super-secret" --shares 3 --threshold 2',
    category: 'Shamir',
  },
  {
    purpose: 'Recombine local shards (offline, no server)',
    command: 'npm run dev -- shamir combine "shard-1-..." "shard-2-..."',
    category: 'Shamir',
  },
  {
    purpose: 'Check current server URL (Default: localhost:3000)',
    command: 'npm run dev -- config get-url',
    category: 'Config',
  },
  {
    purpose: 'Point CLI to a deployed server',
    command: 'npm run dev -- config set-url https://obsidian.domain',
    category: 'Config',
  },
];

const ENDPOINTS: EndpointDoc[] = [
  {
    method: 'POST',
    path: '/api/v1/paste',
    summary: 'Create a new encrypted paste',
    description:
      'Stores a zero-knowledge encrypted paste. Plaintext is encrypted in client browser with AES-256-GCM prior to transmission. Supports Symmetric, Asymmetric RSA-OAEP, Shamir SSS, N-View self-destruct, and Time-Locking.',
    rateLimit: '10 requests per 10s window (HMAC IP hash)',
    requestBody: `{
  "v": 2,
  "ct": "base64_aes_256_gcm_ciphertext",
  "adata": [
    ["16-byte-IV", "8-byte-Salt", 100000, 256, 128, "aes", "gcm", "none"],
    "plaintext", // formatter
    0,           // openDiscussion (0 | 1)
    1,           // burnAfterReading (0 | 1)
    "<rsa_wrapped_aes_key>" // optional adata[4] for asym mode
  ],
  "meta": {
    "expire": "1day", // "5min" | "10min" | "1hour" | "1day" | "1week" | "1month" | "never"
    "burnAfterReading": true,
    "openDiscussion": false,
    "maxViews": 3,              // N-view self destruct (optional)
    "timelockedUntil": "2026-08-25T12:00:00.000Z", // Time-lock (optional)
    "shard": false,             // Shamir SSS shard flag (optional)
    "recipientMode": false      // RSA-OAEP flag (optional)
  }
}`,
    responseBody: `{
  "pasteId": "a1b2c3d4e5f67890", // 16 hex chars (fnv1a64 of ciphertext)
  "deleteToken": "9f8e7d6c5b4a3210..." // HMAC-SHA256 required to DELETE
}`,
    curlExample: `curl -X POST https://obsidian.domain/api/v1/paste \\
  -H "Content-Type: application/json" \\
  -d '{
    "v": 2,
    "ct": "u28KflK8b9...",
    "adata": [["iv","salt",100000,256,128,"aes","gcm","none"],"plaintext",0,1],
    "meta": {"expire": "1day", "burnAfterReading": true}
  }'`,
  },
  {
    method: 'GET',
    path: '/api/v1/paste/{id}',
    summary: 'Retrieve an encrypted paste',
    description:
      'Fetches ciphertext and metadata. Enforces atomic burn-after-reading (deletes on 1st read), N-view view limits, and rejects reads with 423 Locked if timelockedUntil is in the future.',
    rateLimit: '10 requests per 10s window',
    responseBody: `{
  "v": 2,
  "ct": "base64_ciphertext",
  "adata": [...],
  "meta": {
    "createdAt": "2026-08-24T09:00:00.000Z",
    "expiresAt": "2026-08-25T09:00:00.000Z",
    "burnAfterReading": true,
    "openDiscussion": false,
    "maxViews": null,
    "timelockedUntil": null,
    "shard": false,
    "recipientMode": false,
    "views": 1,
    "burnReceipt": {
      "receiptId": "rcpt_a1b2c3d4_1756026000",
      "destroyedAt": "2026-08-24T09:00:01.000Z",
      "reason": "BURN_AFTER_READING",
      "signature": "e3b0c44298fc..."
    }
  }
}`,
    curlExample: `curl -X GET https://obsidian.domain/api/v1/paste/a1b2c3d4e5f67890`,
  },
  {
    method: 'DELETE',
    path: '/api/v1/paste/{id}?deleteToken={token}',
    summary: 'Explicitly delete a paste',
    description:
      'Permanently purges the paste from the database. Requires matching deleteToken provided during creation. Issues a signed cryptographic burn receipt.',
    rateLimit: '5 requests per 10s window',
    responseBody: `{
  "deleted": true,
  "pasteId": "a1b2c3d4e5f67890",
  "burnReceipt": {
    "receiptId": "rcpt_a1b2c3d4_1756026000",
    "destroyedAt": "2026-08-24T09:05:00.000Z",
    "reason": "MANUAL_DELETION",
    "signature": "f2a1b3c4d5e6..."
  }
}`,
    curlExample: `curl -X DELETE "https://obsidian.domain/api/v1/paste/a1b2c3d4e5f67890" \\
  -H "Content-Type: application/json" \\
  -d '{"deleteToken": "9f8e7d6c5b4a3210..."}'`,
  },
  {
    method: 'POST',
    path: '/api/v1/receipt/{id}',
    summary: 'Verify signed cryptographic burn receipt',
    description:
      'Cryptographically validates HMAC-SHA256 signature on a deletion receipt and checks if the paste record is absent from the database (Proof-of-Absence).',
    rateLimit: '20 requests per 10s window',
    requestBody: `{
  "receipt": {
    "receiptId": "rcpt_a1b2c3d4_1756026000",
    "destroyedAt": "2026-08-24T09:00:01.000Z",
    "reason": "BURN_AFTER_READING",
    "signature": "e3b0c44298fc..."
  }
}`,
    responseBody: `{
  "verified": true,
  "proofOfAbsence": true,
  "message": "Burn receipt verified. Paste record is confirmed purged from storage."
}`,
    curlExample: `curl -X POST https://obsidian.domain/api/v1/receipt/a1b2c3d4e5f67890 \\
  -H "Content-Type: application/json" \\
  -d '{"receipt": {"receiptId": "...", "destroyedAt": "...", "signature": "..."}}'`,
  },
];

export default function ApiDocsPage() {
  const [activeTab, setActiveTab] = React.useState<'cli' | 'rest'>('cli');
  const [cliFilter, setCliFilter] = React.useState('');
  const [copiedIndex, setCopiedIndex] = React.useState<number | string | null>(null);

  const handleCopy = (text: string, id: number | string) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(id);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const filteredCli = CLI_COMMANDS.filter(
    (c) =>
      c.purpose.toLowerCase().includes(cliFilter.toLowerCase()) ||
      c.command.toLowerCase().includes(cliFilter.toLowerCase()) ||
      c.category.toLowerCase().includes(cliFilter.toLowerCase())
  );

  return (
    <AuroraBackground>
      <Header />

      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-8 py-8 sm:py-10 flex flex-col gap-6 font-mono">
        {/* Page Title & Navigation Switcher */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-foreground text-background shadow-md">
              <Terminal className="h-5 w-5 fill-current" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-foreground">
                Developer Portal
              </h1>
              <p className="text-xs text-muted-foreground">
                CLI Command Reference, Zero-Knowledge Wire Spec &amp; REST Endpoints
              </p>
            </div>
          </div>

          {/* Tab switcher: CLI vs REST API */}
          <div className="flex items-center gap-1 bg-card p-1 rounded-xl border border-border text-xs">
            <button
              type="button"
              onClick={() => setActiveTab('cli')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all cursor-pointer font-bold ${
                activeTab === 'cli'
                  ? 'bg-muted text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Terminal className="h-3.5 w-3.5" />
              <span>Obsidian CLI</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('rest')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all cursor-pointer font-bold ${
                activeTab === 'rest'
                  ? 'bg-muted text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Code2 className="h-3.5 w-3.5" />
              <span>REST API Spec</span>
            </button>
          </div>
        </div>

        {/* ── TAB 1: OBSIDIAN CLI REFERENCE ───────────────────────────────────── */}
        {activeTab === 'cli' && (
          <div className="flex flex-col gap-6">
            {/* Quick Setup Card */}
            <div className="p-5 rounded-xl border border-border bg-card flex flex-col gap-3 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-foreground flex items-center gap-2">
                  <Cpu className="h-4 w-4 text-foreground" />
                  <span>Setup &amp; First Run</span>
                </span>
                <Badge variant="outline" className="text-[10px] border-emerald-500/40 text-emerald-400">
                  Node.js / TypeScript CLI
                </Badge>
              </div>

              <p className="text-xs text-muted-foreground leading-relaxed">
                The Obsidian CLI brings client-side AES-256-GCM, RSA-OAEP, Shamir Secret Sharing, and repository packaging directly to your command line.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <div className="flex flex-col gap-1 p-3 rounded bg-background border border-border">
                  <span className="text-[10px] font-bold text-muted-foreground">1. Install Dependencies:</span>
                  <div className="flex items-center justify-between text-xs text-foreground font-mono">
                    <code>cd obsidian/cli &amp;&amp; npm install</code>
                    <button
                      type="button"
                      onClick={() => handleCopy('cd obsidian/cli && npm install', 'setup-1')}
                      className="p-1 hover:text-foreground text-muted-foreground cursor-pointer"
                    >
                      {copiedIndex === 'setup-1' ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                    </button>
                  </div>
                </div>

                <div className="flex flex-col gap-1 p-3 rounded bg-background border border-border">
                  <span className="text-[10px] font-bold text-muted-foreground">2. View Help &amp; Commands:</span>
                  <div className="flex items-center justify-between text-xs text-foreground font-mono">
                    <code>npm run dev -- --help</code>
                    <button
                      type="button"
                      onClick={() => handleCopy('npm run dev -- --help', 'setup-2')}
                      className="p-1 hover:text-foreground text-muted-foreground cursor-pointer"
                    >
                      {copiedIndex === 'setup-2' ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                    </button>
                  </div>
                </div>
              </div>

              <div className="p-2.5 rounded bg-muted/40 border border-border text-[11px] text-muted-foreground flex items-start gap-2">
                <Info className="h-3.5 w-3.5 text-foreground shrink-0 mt-0.5" />
                <span><strong>Shell Tip:</strong> Always wrap URLs and public keys in quotes <code>&quot; &quot;</code> so shells do not misinterpret <code>#</code> or <code>=</code> characters.</span>
              </div>
            </div>

            {/* Quick Command Cheat Sheet */}
            <div className="flex flex-col gap-3 p-5 rounded-xl border border-border bg-card shadow-sm">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-border">
                <span className="text-xs font-bold uppercase tracking-wider text-foreground">
                  Command Cheat Sheet ({filteredCli.length})
                </span>
                <div className="relative w-full sm:w-64">
                  <Search className="h-3.5 w-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <input
                    type="text"
                    placeholder="Search commands or purpose..."
                    value={cliFilter}
                    onChange={(e) => setCliFilter(e.target.value)}
                    className="w-full h-8 pl-8 pr-2.5 rounded bg-background border border-border text-xs text-foreground placeholder:text-muted-foreground/40 focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-2">
                {filteredCli.map((item, idx) => (
                  <div
                    key={idx}
                    className="p-3 rounded-lg bg-background border border-border flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                  >
                    <div className="flex flex-col gap-0.5">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-[9px] px-1.5 py-0 border-border uppercase">
                          {item.category}
                        </Badge>
                        <span className="font-bold text-foreground">{item.purpose}</span>
                      </div>
                      <code className="text-muted-foreground font-mono text-[11px] mt-0.5">
                        {item.command}
                      </code>
                    </div>

                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleCopy(item.command, `cli-${idx}`)}
                      className="h-7 text-xs gap-1.5 shrink-0"
                    >
                      {copiedIndex === `cli-${idx}` ? (
                        <>
                          <Check className="h-3 w-3 text-emerald-400" />
                          <span className="text-emerald-400 font-bold">Copied</span>
                        </>
                      ) : (
                        <>
                          <Copy className="h-3 w-3" />
                          <span>Copy</span>
                        </>
                      )}
                    </Button>
                  </div>
                ))}
              </div>
            </div>

            {/* Scenario Deep Dives */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Scenario 1: Symmetric */}
              <div className="p-4 rounded-xl border border-border bg-card flex flex-col gap-2.5">
                <div className="flex items-center gap-2 text-xs font-bold text-foreground">
                  <Key className="h-4 w-4" />
                  <span>Scenario 1: Standard Symmetric Sharing</span>
                </div>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  Encrypts content with client-side AES-256-GCM. Returns a share link with the key isolated in the <code>#fragment</code>.
                </p>
                <pre className="p-2.5 rounded bg-background border border-border text-[10px] text-foreground overflow-x-auto leading-relaxed">
{`# Send secret (burns on read):
npm run dev -- send "sk_live_998822334455"

# Send from file without burning:
npm run dev -- send --file ./secrets.env --no-burn

# Read & decrypt link:
npm run dev -- read "http://localhost:3000/pasteId#key"`}
                </pre>
              </div>

              {/* Scenario 2: Asymmetric RSA */}
              <div className="p-4 rounded-xl border border-border bg-card flex flex-col gap-2.5">
                <div className="flex items-center gap-2 text-xs font-bold text-foreground">
                  <Shield className="h-4 w-4" />
                  <span>Scenario 2: Asymmetric (RSA-OAEP)</span>
                </div>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  Wraps AES key with recipient&apos;s public key. The URL carries <code>#asym</code> (0 keys in URL). Only recipient can decrypt.
                </p>
                <pre className="p-2.5 rounded bg-background border border-border text-[10px] text-foreground overflow-x-auto leading-relaxed">
{`# 1. Recipient generates & shows public key:
npm run dev -- key generate
npm run dev -- key show --public

# 2. Sender encrypts for recipient:
npm run dev -- send "Confidential" --recipient "<SPKI_KEY>"

# 3. Recipient reads with private key:
npm run dev -- read "http://localhost:3000/pasteId#asym"`}
                </pre>
              </div>

              {/* Scenario 3: Shamir SSS */}
              <div className="p-4 rounded-xl border border-border bg-card flex flex-col gap-2.5">
                <div className="flex items-center gap-2 text-xs font-bold text-foreground">
                  <Users className="h-4 w-4" />
                  <span>Scenario 3: Multi-Party Quorum (Shamir SSS)</span>
                </div>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  Splits master key into N polynomial shards. Any K custodians combine shards to reconstruct the master secret.
                </p>
                <pre className="p-2.5 rounded bg-background border border-border text-[10px] text-foreground overflow-x-auto leading-relaxed">
{`# Create 2-of-3 quorum paste:
npm run dev -- send "Root Key" --shares 3 --threshold 2

# Decrypt when holding 2 shards:
npm run dev -- read "<shard1_url>" --shards "<shard2_url>"`}
                </pre>
              </div>

              {/* Scenario 4: Whole Repo / Folder */}
              <div className="p-4 rounded-xl border border-border bg-card flex flex-col gap-2.5">
                <div className="flex items-center gap-2 text-xs font-bold text-foreground">
                  <FolderArchive className="h-4 w-4" />
                  <span>Scenario 4: Whole-Repository Sharing</span>
                </div>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  Securely packages, compresses (respecting <code>.gitignore</code>), encrypts, and downloads entire folders.
                </p>
                <pre className="p-2.5 rounded bg-background border border-border text-[10px] text-foreground overflow-x-auto leading-relaxed">
{`# Encrypt & send entire repository:
npm run dev -- repo send ./my-project --recipient "<KEY>"

# Download, decrypt & extract folder:
npm run dev -- repo get "http://localhost:3000/repoId#asym" --output ./recovered`}
                </pre>
              </div>
            </div>
          </div>
        )}

        {/* ── TAB 2: REST API SPECIFICATION ───────────────────────────────────── */}
        {activeTab === 'rest' && (
          <div className="flex flex-col gap-6">
            {/* Overview Card */}
            <div className="p-5 rounded-xl border border-border bg-card flex flex-col gap-2.5 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-foreground flex items-center gap-2">
                  <Code2 className="h-4 w-4 text-foreground" />
                  <span>Obsidian Zero-Knowledge REST Specification</span>
                </span>
                <Badge variant="outline" className="text-[10px] border-emerald-500/40 text-emerald-400">
                  OpenAPI / Swagger 3.1
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Obsidian uses the <strong>PrivateBin v2 JSON Wire Format</strong> with authenticated AES-256-GCM data arrays (<code>adata</code>) and blind storage. All encryption and key generation must execute on the client before transmitting data to these endpoints.
              </p>
            </div>

            {/* Endpoints List */}
            <div className="flex flex-col gap-4">
              {ENDPOINTS.map((ep, idx) => (
                <div
                  key={idx}
                  className="rounded-xl border border-border bg-card p-5 sm:p-6 flex flex-col gap-4 shadow-sm"
                >
                  {/* Endpoint Header */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-border">
                    <div className="flex items-center gap-2.5">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-black uppercase font-mono ${
                          ep.method === 'POST'
                            ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                            : ep.method === 'GET'
                            ? 'bg-blue-500/15 text-blue-400 border border-blue-500/30'
                            : 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
                        }`}
                      >
                        {ep.method}
                      </span>
                      <code className="text-sm font-bold text-foreground font-mono">
                        {ep.path}
                      </code>
                    </div>

                    <span className="text-[10px] text-muted-foreground font-mono">
                      Rate Limit: {ep.rateLimit}
                    </span>
                  </div>

                  {/* Summary & Description */}
                  <div className="flex flex-col gap-1">
                    <h3 className="text-xs font-bold text-foreground">{ep.summary}</h3>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      {ep.description}
                    </p>
                  </div>

                  {/* Request & Response Bodies */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                    {ep.requestBody && (
                      <div className="flex flex-col gap-1">
                        <span className="text-[10px] font-bold text-muted-foreground uppercase">
                          Request Body (JSON)
                        </span>
                        <pre className="p-3 rounded-xl bg-background border border-border text-[10px] text-muted-foreground overflow-x-auto leading-relaxed max-h-56 font-mono">
                          {ep.requestBody}
                        </pre>
                      </div>
                    )}

                    <div className="flex flex-col gap-1">
                      <span className="text-[10px] font-bold text-muted-foreground uppercase">
                        Response Body (JSON)
                      </span>
                      <pre className="p-3 rounded-xl bg-background border border-border text-[10px] text-muted-foreground overflow-x-auto leading-relaxed max-h-56 font-mono">
                        {ep.responseBody}
                      </pre>
                    </div>
                  </div>

                  {/* Live cURL copy bar */}
                  <div className="flex items-center justify-between gap-3 p-2.5 rounded-xl bg-background border border-border">
                    <code className="text-[10px] text-foreground truncate flex-1 font-mono">
                      {ep.curlExample.split('\n')[0]} ...
                    </code>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleCopy(ep.curlExample, `rest-${idx}`)}
                      className="h-7 text-xs gap-1.5 shrink-0"
                    >
                      {copiedIndex === `rest-${idx}` ? (
                        <>
                          <Check className="h-3 w-3 text-emerald-400" />
                          <span className="text-emerald-400 font-bold">Copied</span>
                        </>
                      ) : (
                        <>
                          <Copy className="h-3 w-3" />
                          <span>Copy cURL</span>
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>

      <Footer />
    </AuroraBackground>
  );
}
