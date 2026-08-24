'use client';

/**
 * components/viewer/PrivateKeyUnlock.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Shown on the viewer page when the URL fragment is "#asym".
 * Prompts the user for their RSA-2048 private key to unwrap the AES key in-browser.
 * Strict monochrome styling matching Obsidian design standards.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import * as React from 'react';
import { motion } from 'framer-motion';
import {
  ShieldCheck,
  KeyRound,
  AlertCircle,
  Loader2,
  Eye,
  EyeOff,
  Lock,
  Fingerprint,
  UserCircle2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { loadIdentityKey } from '@/lib/crypto/keystore';
import { importRSAPrivateKey } from '@/lib/crypto/asymmetric';
import type { IdentityKeyRecord } from '@/lib/crypto/keystore';

interface PrivateKeyUnlockProps {
  onUnlock: (privateKey: CryptoKey) => void;
  decryptError?: string | null;
  isDecrypting?: boolean;
}

export function PrivateKeyUnlock({
  onUnlock,
  decryptError,
  isDecrypting = false,
}: PrivateKeyUnlockProps) {
  // ── SETUP ──────────────────────────────────────────────────────────────

  // Stored identity key record from browser IndexedDB
  const [identityKey, setIdentityKey] = React.useState<IdentityKeyRecord | null>(null);
  const [isLoadingKey, setIsLoadingKey] = React.useState(true);

  // Manual key input & UI visibility state
  const [manualKeyValue, setManualKeyValue] = React.useState<string>(() => {
    if (typeof window !== 'undefined') {
      try {
        return sessionStorage.getItem('obsidian-session-privkey') || '';
      } catch {
        return '';
      }
    }
    return '';
  });
  const [showManualInput, setShowManualInput] = React.useState(false);
  const [showKeyText, setShowKeyText] = React.useState(false);
  const [rememberInSession, setRememberInSession] = React.useState(false);
  const [localError, setLocalError] = React.useState<string | null>(null);
  const [isProcessing, setIsProcessing] = React.useState(false);

  // Loads stored RSA identity key on component mount
  React.useEffect(() => {
    loadIdentityKey()
      .then((record) => {
        setIdentityKey(record);
        setIsLoadingKey(false);
        if (!record) setShowManualInput(true);
      })
      .catch(() => {
        setIsLoadingKey(false);
        setShowManualInput(true);
      });
  }, []);

  // Computed error and busy status flags
  const errorToShow = localError || decryptError;
  const busy = isProcessing || isDecrypting;

  // ── ACTIONS ────────────────────────────────────────────────────────────

  // Unlocks paste using stored IndexedDB identity key
  const handleUseIdentityKey = async () => {
    if (!identityKey) return;
    setIsProcessing(true);
    setLocalError(null);
    try {
      await onUnlock(identityKey.privateKey);
    } catch (err) {
      console.error('[handleUseIdentityKey ERROR]', err);
      setLocalError('Failed to load identity key.');
    } finally {
      setIsProcessing(false);
    }
  };

  // Imports manually pasted RSA private key and triggers unlock
  const handleManualUnlock = async () => {
    const trimmed = manualKeyValue.trim();
    if (!trimmed) {
      setLocalError('Please paste your RSA private key.');
      return;
    }

    setIsProcessing(true);
    setLocalError(null);

    try {
      const privateKey = await importRSAPrivateKey(trimmed);

      if (rememberInSession) {
        sessionStorage.setItem('obsidian-session-privkey', trimmed);
      }

      await onUnlock(privateKey);
    } catch (err) {
      console.error('[handleManualUnlock ERROR]', err);
      setLocalError(
        'Invalid private key format. Please paste a valid base64-encoded RSA-2048 PKCS8 private key.'
      );
    } finally {
      setIsProcessing(false);
    }
  };

  // ── UI ─────────────────────────────────────────────────────────────────

  /* Loading Identity Key State UI */
  if (isLoadingKey) {
    return (
      <div className="w-full max-w-lg mx-auto flex flex-col items-center gap-4 p-8 font-mono">
        <Loader2 className="h-6 w-6 animate-spin text-foreground" />
        <p className="text-xs text-muted-foreground">Checking for stored identity key…</p>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.25 }}
      className="w-full max-w-xl mx-auto my-8 flex flex-col gap-5 font-mono"
    >
      {/* Header Info Card */}
      <div className="rounded-lg border border-border bg-card p-6 sm:p-8 flex flex-col items-center text-center gap-4 shadow-xl">
        <div className="flex h-14 w-14 items-center justify-center rounded bg-muted border border-border text-foreground">
          <Lock className="h-7 w-7 text-foreground" />
        </div>

        <div className="flex flex-col gap-1">
          <h2 className="text-xl font-bold uppercase tracking-tight text-foreground">Encrypted for You</h2>
          <p className="text-xs text-muted-foreground max-w-sm leading-relaxed">
            This paste was encrypted using <strong>RSA-OAEP key wrapping</strong>. The AES
            decryption key is sealed inside and can only be unlocked with your RSA private key.
          </p>
        </div>

        {/* Security Badges */}
        <div className="flex flex-wrap items-center justify-center gap-2 text-[11px] font-mono">
          <span className="flex items-center gap-1 px-2.5 py-1 rounded bg-muted border border-border text-foreground">
            <ShieldCheck className="h-3 w-3 text-foreground" />
            RSA-2048-OAEP
          </span>
          <span className="flex items-center gap-1 px-2.5 py-1 rounded bg-muted border border-border text-foreground">
            <KeyRound className="h-3 w-3 text-foreground" />
            AES-256-GCM
          </span>
        </div>
      </div>

      {/* Unlock Options Container */}
      <div className="rounded-lg border border-border bg-card p-5 flex flex-col gap-4 shadow-xl">
        {/* Option 1: Unlock with stored IndexedDB Identity Key */}
        {identityKey && !showManualInput && (
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col gap-3"
          >
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-foreground">
              <UserCircle2 className="h-4 w-4 text-foreground" />
              Identity Key Found
            </div>

            <div className="flex items-center gap-3 p-3 rounded bg-muted/40 border border-border">
              <div className="flex h-9 w-9 items-center justify-center rounded bg-muted border border-border text-foreground shrink-0">
                <KeyRound className="h-4 w-4" />
              </div>
              <div className="flex flex-col gap-0.5 min-w-0">
                <span className="text-xs font-bold text-foreground">RSA-2048 Identity Key</span>
                <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground font-mono">
                  <Fingerprint className="h-3 w-3 shrink-0 text-foreground" />
                  <span className="truncate">
                    {identityKey.fingerprint.match(/.{1,4}/g)?.join(':') ?? identityKey.fingerprint}
                  </span>
                </div>
                <span className="text-[10px] text-muted-foreground">
                  Generated {new Date(identityKey.createdAt).toLocaleDateString()}
                </span>
              </div>
            </div>

            <Button
              id="unlock-with-identity-key-btn"
              onClick={handleUseIdentityKey}
              disabled={busy}
              className="w-full gap-2 font-bold font-mono text-xs h-9 bg-foreground text-background hover:opacity-90"
            >
              {busy ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Decrypting…
                </>
              ) : (
                <>
                  <Lock className="h-4 w-4" />
                  Unlock with My Identity Key
                </>
              )}
            </Button>

            <button
              type="button"
              onClick={() => setShowManualInput(true)}
              className="text-[11px] text-muted-foreground hover:text-foreground transition-colors text-center"
            >
              Use a different private key instead
            </button>
          </motion.div>
        )}

        {/* Option 2: Unlock with manually pasted RSA Private Key */}
        {showManualInput && (
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col gap-3"
          >
            {identityKey && (
              <button
                type="button"
                onClick={() => setShowManualInput(false)}
                className="flex items-center gap-1.5 text-[11px] text-foreground hover:underline self-start"
              >
                ← Use my stored identity key
              </button>
            )}

            <div className="flex items-center justify-between">
              <label
                htmlFor="private-key-textarea"
                className="text-xs font-bold uppercase tracking-wider text-foreground flex items-center gap-2"
              >
                <KeyRound className="h-4 w-4 text-foreground" />
                Paste Your RSA Private Key
              </label>
              <button
                type="button"
                onClick={() => setShowKeyText(!showKeyText)}
                className="text-[11px] text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
              >
                {showKeyText ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                {showKeyText ? 'Hide' : 'Show'}
              </button>
            </div>

            <div className="relative rounded border border-border bg-background focus-within:border-foreground/50 transition-all">
              <textarea
                id="private-key-textarea"
                value={manualKeyValue}
                onChange={(e) => setManualKeyValue(e.target.value)}
                placeholder="Paste your base64-encoded RSA-2048 PKCS8 private key here..."
                rows={6}
                spellCheck={false}
                className={`w-full resize-none bg-transparent border-0 font-mono text-xs leading-relaxed text-foreground placeholder:text-muted-foreground/40 focus:outline-none p-3 ${
                  showKeyText ? '' : 'text-transparent [text-shadow:0_0_6px_rgba(255,255,255,0.3)]'
                }`}
                style={!showKeyText ? ({ WebkitTextSecurity: 'disc' } as React.CSSProperties) : undefined}
              />
            </div>

            {/* Remember in session checkbox */}
            <label className="flex items-center gap-2.5 cursor-pointer select-none group">
              <input
                type="checkbox"
                id="remember-session-toggle"
                checked={rememberInSession}
                onChange={(e) => setRememberInSession(e.target.checked)}
                className="h-3.5 w-3.5 rounded border-border text-foreground accent-foreground bg-background cursor-pointer"
              />
              <div className="flex flex-col">
                <span className="text-xs font-medium text-foreground">
                  Remember in session
                </span>
                <span className="text-[10px] text-muted-foreground">
                  Stored in sessionStorage only — wiped when the tab closes
                </span>
              </div>
            </label>

            <Button
              id="unlock-with-manual-key-btn"
              onClick={handleManualUnlock}
              disabled={busy || !manualKeyValue.trim()}
              className="w-full gap-2 font-bold font-mono text-xs h-9 bg-foreground text-background hover:opacity-90"
            >
              {busy ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Decrypting…
                </>
              ) : (
                <>
                  <Lock className="h-4 w-4" />
                  Unlock &amp; Decrypt
                </>
              )}
            </Button>
          </motion.div>
        )}

        {/* Error Notification Banner */}
        {errorToShow && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-start gap-2.5 p-3 rounded bg-destructive/10 border border-destructive/25 text-destructive text-xs"
          >
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
            <span>{errorToShow}</span>
          </motion.div>
        )}
      </div>

      {/* Zero-Knowledge Security Notice */}
      <p className="text-center text-[10px] text-muted-foreground leading-relaxed px-4">
        Your private key never leaves your browser. The AES decryption key is unwrapped in-memory
        using SubtleCrypto and immediately discarded after decryption.
      </p>
    </motion.div>
  );
}

export default PrivateKeyUnlock;
