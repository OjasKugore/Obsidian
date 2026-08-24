'use client';

/**
 * components/editor/PasteTemplates.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Starter Templates for rapid zero-knowledge sharing of secrets, credentials,
 * configs, and sensitive incident responses.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import * as React from 'react';
import {
  Key,
  Terminal,
  AlertOctagon,
  FileCode,
  Lock,
  UserCheck,
  ChevronDown,
} from 'lucide-react';
import type { Formatter } from '@/components/editor/PasteEditor';

export interface TemplateItem {
  id: string;
  title: string;
  category: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  formatter: Formatter;
  content: string;
}

export const PASTE_TEMPLATES: TemplateItem[] = [
  {
    id: 'api-keys',
    title: 'API Keys & Secrets',
    category: 'Credentials',
    description: 'Standardized key exchange for AWS, OpenAI, Stripe & DB URLs',
    icon: Key,
    formatter: 'syntaxhighlighting',
    content: `# Confidential API Credentials
# Created: ${new Date().toISOString().split('T')[0]}
# Burn-after-reading or time-limited access recommended

OPENAI_API_KEY="sk-proj-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
STRIPE_SECRET_KEY="sk_live_51Nxxxxxxxxxxxxxxxxxxxxxxxxxxx"
AWS_ACCESS_KEY_ID="AKIAIOSFODNN7EXAMPLE"
AWS_SECRET_ACCESS_KEY="wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY"

# Primary Production Database
DATABASE_URL="postgres://app_user:s3cr3t_p@ssw0rd@db.neon.tech/production?sslmode=require"
REDIS_URL="rediss://default:token@redis.upstash.io:6379"
`,
  },
  {
    id: 'ssh-key',
    title: 'SSH Keypair / Private Key',
    category: 'Security',
    description: 'OpenSSH Ed25519 or RSA private key delivery',
    icon: Lock,
    formatter: 'syntaxhighlighting',
    content: `-----BEGIN OPENSSH PRIVATE KEY-----
b3BlbnNzaC1rZXktdjEAAAAABG5vbmUAAAAEbm9uZQAAAAAAAAABAAAAMwAAAAtzc2gtZW
QyNTUxOQAAACDb79N8KzH9Z1x+8k2lA7q5qE6k9e7mO2j3u4P5v6Q7RwAAAJB4n3bheJ
924QAAAAtzc2gtZWQyNTUxOQAAACDb79N8KzH9Z1x+8k2lA7q5qE6k9e7mO2j3u4P5v6
Q7RwAAAECp8N5fJ3g6h2u8a9b1c7d3e4f5g6h7i8j9k0l1m2n3o4p5q6r7s8t9u0v1w2
x3y4z5A6B7C8D9E0F1G2H3AAAAE29wZW5zc2gtZGV2LWtleQE=
-----END OPENSSH PRIVATE KEY-----
`,
  },
  {
    id: 'incident-secret',
    title: 'DevOps Incident Access',
    category: 'Incident Response',
    description: 'Emergency rotation keys and temporary root passwords',
    icon: AlertOctagon,
    formatter: 'markdown',
    content: `# 🚨 CRITICAL INCIDENT RESPONSE — EMERGENCY ACCESS KEYS
**Incident ID:** INC-${Date.now().toString().slice(-6)}  
**Severity:** SEV-1  
**Timestamp:** ${new Date().toUTCString()}  

---

### Temporary Break-Glass Credentials
- **Bastion Host IP:** \`10.0.4.12\`
- **Emergency Root User:** \`breakglass-admin\`
- **Temporary Password:** \`${Math.random().toString(36).slice(-10)}!X9#zQ\`
- **MFA Seed (TOTP):** \`JBSWY3DPEHPK3PXP\`

### Vault Unseal Keys (1 of 3 Provided)
\`\`\`
unseal-key-1: a8f9c2d1e4b706351289cf0482173ea651b2c3d4e5f6
\`\`\`

> ⚠️ **Notice:** This paste is set to destroy after 1 reading. Rotate all temporary credentials immediately after incident resolution.
`,
  },
  {
    id: 'env-config',
    title: '.env Configuration Template',
    category: 'Environment',
    description: 'Full application environment variables manifest',
    icon: FileCode,
    formatter: 'syntaxhighlighting',
    content: `# Obsidian Application Environment Manifest
NODE_ENV=production
NEXT_PUBLIC_APP_URL="https://obsidian.domain"

# Authentication & Cryptography
NEXTAUTH_SECRET="7f8b9a1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9"
IP_HMAC_SECRET="0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1"

# Database Connectivity
DATABASE_URL="postgres://postgres:password@ep-cold-pond-123456.us-east-2.aws.neon.tech/neondb?sslmode=require"
UPSTASH_REDIS_REST_URL="https://secure-redis-12345.upstash.io"
UPSTASH_REDIS_REST_TOKEN="AZ1234567890abcdefghijklmnopqrstuvwxyz"

# Real-Time Presence
PUSHER_APP_ID="123456"
PUSHER_KEY="9876543210abcdef"
PUSHER_SECRET="fedcba0987654321"
PUSHER_CLUSTER="us2"
`,
  },
  {
    id: 'medical-pii',
    title: 'Confidential Medical / PII Data',
    category: 'Confidential',
    description: 'HIPAA/GDPR compliant encrypted data exchange format',
    icon: UserCheck,
    formatter: 'markdown',
    content: `# 🔒 CONFIDENTIAL RECORD — PRIVILEGED CLIENT DATA
**Record Ref:** CR-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}  
**Classification:** STRICT CONFIDENTIAL / HIPAA PROTECTED  

---

### Subject Information
- **Subject Identifier:** \`SUBJ-99214\` (Anonymized)
- **Record Hash:** \`e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855\`
- **Special Authorization:** Level 4 Clearance

### Clinical / Case Diagnostic Notes
\`\`\`text
Confidential evaluation details transferred via client-side AES-256-GCM zero-knowledge channel.
The encryption key remains isolated on recipient's end.
\`\`\`

> ⚖️ Unauthorized distribution or storage in unencrypted form is strictly prohibited.
`,
  },
];

interface PasteTemplatesProps {
  onSelectTemplate: (template: TemplateItem) => void;
}

export function PasteTemplates({ onSelectTemplate }: PasteTemplatesProps) {
  const [isOpen, setIsOpen] = React.useState(false);
  const dropdownRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="relative inline-block" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-mono rounded-lg border border-border/80 bg-background/80 hover:bg-muted text-muted-foreground hover:text-foreground transition-all cursor-pointer shadow-sm"
        title="Load a Starter Template"
      >
        <Terminal className="h-3.5 w-3.5 text-foreground" />
        <span>Templates</span>
        <ChevronDown className={`h-3 w-3 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute left-0 mt-1.5 w-72 rounded-xl border border-border bg-card/95 backdrop-blur-md shadow-2xl p-1.5 z-50 flex flex-col gap-1 font-mono animate-in fade-in zoom-in-95 duration-100">
          <div className="px-2 py-1 text-[10px] uppercase font-bold text-muted-foreground tracking-wider border-b border-border/60">
            Starter Templates
          </div>
          <div className="flex flex-col max-h-64 overflow-y-auto">
            {PASTE_TEMPLATES.map((tmpl) => {
              const Icon = tmpl.icon;
              return (
                <button
                  key={tmpl.id}
                  type="button"
                  onClick={() => {
                    onSelectTemplate(tmpl);
                    setIsOpen(false);
                  }}
                  className="flex items-start gap-2.5 p-2 rounded-lg text-left hover:bg-muted/80 transition-colors group cursor-pointer"
                >
                  <div className="p-1 rounded bg-muted border border-border/60 text-foreground group-hover:bg-background shrink-0 mt-0.5">
                    <Icon className="h-3.5 w-3.5" />
                  </div>
                  <div className="flex flex-col min-w-0">
                    <span className="text-xs font-semibold text-foreground truncate">
                      {tmpl.title}
                    </span>
                    <span className="text-[10px] text-muted-foreground line-clamp-1">
                      {tmpl.description}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
