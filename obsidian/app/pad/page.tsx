'use client';

/**
 * app/pad/page.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Live E2EE Pad Launcher & Room Entrypoint.
 * Allows creating a fresh collaborative room with an ephemeral 256-bit key
 * or joining an existing room via link / key.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { AuroraBackground } from '@/components/ui/AuroraBackground';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Users,
  Plus,
  ArrowRight,
  ShieldCheck,
  Radio,
  Lock,
  Camera,
  FolderArchive,
  Terminal,
} from 'lucide-react';
import { toBase58 } from '@/lib/crypto/cipher';

export default function PadLauncherPage() {
  const router = useRouter();
  const [joinInput, setJoinInput] = React.useState('');
  const [joinError, setJoinError] = React.useState<string | null>(null);

  const handleCreateNewPad = () => {
    // 1. Generate random room ID (16 hex chars)
    const roomIdBytes = new Uint8Array(8);
    crypto.getRandomValues(roomIdBytes);
    const roomId = Array.from(roomIdBytes)
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');

    // 2. Generate 32-byte AES-256 room key
    const rawKey = new Uint8Array(32);
    crypto.getRandomValues(rawKey);
    const keyBase58 = toBase58(rawKey);

    // 3. Mark current user as the Room Host
    if (typeof window !== 'undefined') {
      sessionStorage.setItem(`obsidian_pad_host_${roomId}`, 'true');
    }

    // 4. Route to /pad/[roomId]#[keyBase58]
    router.push(`/pad/${roomId}#${keyBase58}`);
  };

  const handleJoinPad = (e: React.FormEvent) => {
    e.preventDefault();
    setJoinError(null);

    let trimmed = joinInput.trim();
    if (!trimmed) return;

    // Normalize URL without scheme
    if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://') && trimmed.includes('/pad/')) {
      trimmed = 'https://' + trimmed;
    }

    try {
      if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
        const parsed = new URL(trimmed);
        const match = parsed.pathname.match(/\/pad\/([0-9a-fA-F]+)/);
        const hash = parsed.hash || '';
        if (match && hash) {
          router.push(`/pad/${match[1]}${hash}`);
          return;
        }
      }
    } catch {
      // fallback to string extraction
    }

    if (trimmed.includes('#')) {
      const [idPart, hashPart] = trimmed.split('#');
      const cleanId = idPart.replace(/^.*\/pad\//, '').replace(/^\//, '').trim();
      if (cleanId && hashPart) {
        router.push(`/pad/${cleanId}#${hashPart.trim()}`);
        return;
      }
    }

    setJoinError('Please enter a valid room link containing the room ID and #key hash fragment.');
  };

  return (
    <AuroraBackground>
      <Header />

      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-8 py-8 sm:py-10 flex flex-col gap-6 font-mono">
        {/* Left-Aligned Header Bar (Matching /vault & /api/docs) */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-foreground text-background shadow-md">
              <Users className="h-5 w-5 fill-current" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-foreground">
                Live E2EE Scratchpad
              </h1>
              <p className="text-xs text-muted-foreground">
                Real-time, zero-knowledge collaborative war room with client-side encrypted keystroke synchronization
              </p>
            </div>
          </div>
        </div>

        {/* Action Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 w-full">
          {/* Card 1: Launch New Pad */}
          <div className="p-6 rounded-2xl border border-border bg-card flex flex-col justify-between gap-6 shadow-xl relative overflow-hidden">
            <div className="flex flex-col gap-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Instant Session
                </span>
                <Badge variant="outline" className="text-[10px] border-emerald-500/40 text-emerald-400">
                  Zero Setup
                </Badge>
              </div>

              <h2 className="text-base font-bold text-foreground">
                Create New Live Pad
              </h2>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Generates a fresh 256-bit AES room key in the URL hash. Share the link with teammates to begin collaborative editing immediately.
              </p>
            </div>

            <Button
              size="lg"
              onClick={handleCreateNewPad}
              className="w-full font-bold font-mono text-xs bg-foreground text-background hover:opacity-90 gap-2 h-11 shadow-md cursor-pointer"
            >
              <Plus className="h-4 w-4" />
              <span>Launch Live Pad</span>
              <ArrowRight className="h-3.5 w-3.5 ml-auto" />
            </Button>
          </div>

          {/* Card 2: Join Existing Room */}
          <div className="p-6 rounded-2xl border border-border bg-card flex flex-col justify-between gap-6 shadow-xl relative overflow-hidden">
            <div className="flex flex-col gap-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Join Room
                </span>
                <Badge variant="outline" className="text-[10px] border-border">
                  Invited Peer
                </Badge>
              </div>

              <h2 className="text-base font-bold text-foreground">
                Join Existing Pad
              </h2>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Paste an invitation link or room hash received from a collaborator to enter their encrypted workspace.
              </p>
            </div>

            <form onSubmit={handleJoinPad} className="flex flex-col gap-2">
              {joinError && (
                <span className="text-[11px] text-destructive">{joinError}</span>
              )}
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  placeholder="https://.../pad/room#key"
                  value={joinInput}
                  onChange={(e) => setJoinInput(e.target.value)}
                  className="flex-1 h-11 px-3 rounded-lg bg-background border border-border text-xs text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:border-foreground/50"
                />
                <Button
                  type="submit"
                  size="lg"
                  disabled={!joinInput.trim()}
                  className="h-11 px-4 font-mono text-xs font-bold shrink-0"
                >
                  Join
                </Button>
              </div>
            </form>
          </div>
        </div>

        {/* Feature Highlights Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 w-full pt-2">
          <div className="p-4 rounded-xl border border-border bg-background/60 flex flex-col gap-2">
            <div className="flex items-center gap-2 text-xs font-bold text-foreground">
              <ShieldCheck className="h-4 w-4 text-emerald-400" />
              <span>Zero-Knowledge Relay</span>
            </div>
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              Signaling servers relay only high-entropy AES-GCM ciphertexts. The decryption key never leaves browser RAM.
            </p>
          </div>

          <div className="p-4 rounded-xl border border-border bg-background/60 flex flex-col gap-2">
            <div className="flex items-center gap-2 text-xs font-bold text-foreground">
              <Camera className="h-4 w-4 text-foreground" />
              <span>Snapshot to Paste</span>
            </div>
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              Freeze notes into an immutable, burn-after-reading secret or multi-party Shamir quorum with a single click.
            </p>
          </div>

          <div className="p-4 rounded-xl border border-border bg-background/60 flex flex-col gap-2">
            <div className="flex items-center gap-2 text-xs font-bold text-foreground">
              <Radio className="h-4 w-4 text-foreground" />
              <span>Cross-Tab &amp; Remote Sync</span>
            </div>
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              Seamless synchronization across browser tabs via BroadcastChannel and remote teammates via Pusher WSS.
            </p>
          </div>
        </div>
      </main>

      <Footer />
    </AuroraBackground>
  );
}
