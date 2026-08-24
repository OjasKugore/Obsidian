'use client';

/**
 * app/pad/[id]/page.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Active Live E2EE Pad Workspace Room.
 * Extracts the 256-bit AES key from window.location.hash and mounts LivePad.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import * as React from 'react';
import { useParams } from 'next/navigation';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { AuroraBackground } from '@/components/ui/AuroraBackground';
import { LivePad } from '@/components/pad/LivePad';
import { fromBase58 } from '@/lib/crypto/cipher';
import { Button } from '@/components/ui/button';
import { Key, Lock, ShieldAlert, Loader2 } from 'lucide-react';

export default function LivePadRoomPage() {
  const params = useParams();
  const roomId = typeof params?.id === 'string' ? params.id : '';

  const [rawKey, setRawKey] = React.useState<Uint8Array | null>(null);
  const [manualKeyInput, setManualKeyInput] = React.useState('');
  const [keyError, setKeyError] = React.useState<string | null>(null);
  const [isCheckingHash, setIsCheckingHash] = React.useState(true);

  React.useEffect(() => {
    if (typeof window === 'undefined') return;

    const hash = window.location.hash.replace(/^#/, '').trim();
    if (hash) {
      try {
        const decoded = fromBase58(hash);
        if (decoded.length === 32) {
          setRawKey(decoded);
          setIsCheckingHash(false);
          return;
        }
      } catch {
        // Invalid key in hash
      }
    }
    setIsCheckingHash(false);
  }, []);

  const handleManualKeySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setKeyError(null);
    const trimmed = manualKeyInput.trim();

    // Check if user pasted a full URL
    let candidate = trimmed;
    if (candidate.includes('#')) {
      candidate = candidate.split('#')[1];
    }

    try {
      const decoded = fromBase58(candidate);
      if (decoded.length === 32) {
        setRawKey(decoded);
        window.location.hash = candidate;
      } else {
        setKeyError('Room key must be a valid 32-byte Base58 string.');
      }
    } catch {
      setKeyError('Invalid Base58 key. Please check the invite link.');
    }
  };

  return (
    <AuroraBackground>
      <Header />

      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-8 py-8 sm:py-10 flex flex-col gap-6 font-mono">
        {isCheckingHash ? (
          <div className="flex flex-col items-center justify-center min-h-[400px] gap-3 text-muted-foreground">
            <Loader2 className="h-6 w-6 animate-spin" />
            <span className="text-xs">Initializing Encrypted Room...</span>
          </div>
        ) : rawKey ? (
          <LivePad roomId={roomId} rawKey={rawKey} />
        ) : (
          /* Key Required Prompt */
          <div className="max-w-md mx-auto w-full p-6 sm:p-8 rounded-2xl border border-border bg-card shadow-2xl flex flex-col gap-5 text-center items-center my-auto">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-muted text-foreground border border-border shadow-sm">
              <Lock className="h-6 w-6" />
            </div>

            <div className="flex flex-col gap-1">
              <h2 className="text-base font-bold text-foreground">
                Room Encryption Key Required
              </h2>
              <p className="text-xs text-muted-foreground leading-relaxed">
                This collaborative room is protected with client-side AES-256-GCM encryption. The key was omitted from the URL.
              </p>
            </div>

            <form onSubmit={handleManualKeySubmit} className="w-full flex flex-col gap-3">
              {keyError && (
                <div className="p-2.5 rounded bg-destructive/10 border border-destructive/20 text-xs text-destructive">
                  {keyError}
                </div>
              )}

              <input
                type="text"
                placeholder="Paste room key or full invite link..."
                value={manualKeyInput}
                onChange={(e) => setManualKeyInput(e.target.value)}
                className="w-full h-10 px-3 rounded-lg bg-background border border-border text-xs text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:border-foreground/50"
              />

              <Button
                type="submit"
                size="sm"
                disabled={!manualKeyInput.trim()}
                className="w-full h-10 font-bold text-xs bg-foreground text-background hover:opacity-90 gap-1.5"
              >
                <Key className="h-3.5 w-3.5" />
                <span>Unlock &amp; Join Room</span>
              </Button>
            </form>
          </div>
        )}
      </main>

      <Footer />
    </AuroraBackground>
  );
}
