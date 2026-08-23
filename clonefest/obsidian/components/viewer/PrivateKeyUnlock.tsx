'use client';

/**
 * components/viewer/PrivateKeyUnlock.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Shown on the viewer page when the URL fragment is "#asym".
 * The user must provide their RSA private key to unwrap the AES key.
 *
 * UX flow:
 *   1. Try IndexedDB first — if an identity key exists, offer one-click unlock
 *   2. Fallback: textarea for manual base64 PKCS8 private key paste
 *   3. "Remember in session" toggle — stashes key in sessionStorage only
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
  /** Called with a valid CryptoKey when the user authenticates */
  onUnlock: (privateKey: CryptoKey) => void;
  /** Error from the outer decryption attempt (wrong key, etc.) */
  decryptError?: string | null;
  /** Whether the parent is currently decrypting after key submission */
  isDecrypting?: boolean;
}

export function PrivateKeyUnlock({
  onUnlock,
  decryptError,
  isDecrypting = false,
}: PrivateKeyUnlockProps) {
  const [identityKey, setIdentityKey] = React.useState<IdentityKeyRecord | null>(null);
  const [isLoadingKey, setIsLoadingKey] = React.useState(true);

  // Manual key input state
  const [manualKeyValue, setManualKeyValue] = React.useState('');
  const [showManualInput, setShowManualInput] = React.useState(false);
  const [showKeyText, setShowKeyText] = React.useState(false);
  const [rememberInSession, setRememberInSession] = React.useState(false);
  const [localError, setLocalError] = React.useState<string | null>(null);
  const [isProcessing, setIsProcessing] = React.useState(false);

  // Load identity key from IndexedDB on mount
  React.useEffect(() => {
    loadIdentityKey()
      .then((record) => {
        setIdentityKey(record);
        setIsLoadingKey(false);
        // If no identity key found, show manual input immediately
        if (!record) setShowManualInput(true);
      })
      .catch(() => {
        setIsLoadingKey(false);
        setShowManualInput(true);
      });

    // Also check if session has a cached key
    const sessionKey = sessionStorage.getItem('obsidian-session-privkey');
    if (sessionKey) {
      setManualKeyValue(sessionKey);
    }
  }, []);

  // ── Use identity key from IndexedDB ────────────────────────────────────────
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

  // ── Use manually pasted key ────────────────────────────────────────────────
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

  const errorToShow = localError || decryptError;
  const busy = isProcessing || isDecrypting;

  // ── Loading state ──────────────────────────────────────────────────────────
  if (isLoadingKey) {
    return (
      <div className="w-full max-w-lg mx-auto flex flex-col items-center gap-4 p-8">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">Checking for stored identity key…</p>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.97 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.35 }}
      className="w-full max-w-xl mx-auto my-8 flex flex-col gap-5"
    >
      {/* Header Card */}
      <div className="glass-panel rounded-3xl p-6 sm:p-8 flex flex-col items-center text-center gap-4 border border-purple-500/30 shadow-2xl shadow-purple-500/10">
        {/* Icon */}
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-purple-500/10 border border-purple-500/30 text-purple-400 shadow-inner">
          <Lock className="h-8 w-8" />
        </div>

        <div className="flex flex-col gap-1">
          <h2 className="text-2xl font-bold text-foreground">Encrypted for You</h2>
          <p className="text-sm text-muted-foreground max-w-sm leading-relaxed">
            This paste was encrypted using <strong>RSA-OAEP key wrapping</strong>. The AES
            decryption key is sealed inside and can only be unlocked with your RSA private key.
          </p>
        </div>

        {/* Security badges */}
        <div className="flex flex-wrap items-center justify-center gap-2 text-[11px] font-medium">
          <span className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-300">
            <ShieldCheck className="h-3 w-3" />
            RSA-2048-OAEP-SHA256
          </span>
          <span className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-300">
            <KeyRound className="h-3 w-3" />
            AES-256-GCM
          </span>
        </div>
      </div>

      {/* Unlock Options */}
      <div className="glass-panel rounded-2xl p-5 flex flex-col gap-4 border border-border/60">

        {/* Option 1: Identity key from IndexedDB */}
        {identityKey && !showManualInput && (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col gap-3"
          >
            <div className="flex items-center gap-2 text-xs font-semibold text-foreground uppercase tracking-wider">
              <UserCircle2 className="h-4 w-4 text-purple-400" />
              Identity Key Found
            </div>

            <div className="flex items-center gap-3 p-3.5 rounded-xl bg-purple-500/10 border border-purple-500/25">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-500/20 text-purple-300 shrink-0">
                <KeyRound className="h-5 w-5" />
              </div>
              <div className="flex flex-col gap-0.5 min-w-0">
                <span className="text-xs font-semibold text-foreground">RSA-2048 Identity Key</span>
                <div className="flex items-center gap-1.5 text-[11px] text-purple-300/80 font-mono">
                  <Fingerprint className="h-3 w-3 shrink-0" />
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
              variant="glow"
              className="w-full gap-2 font-semibold"
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

        {/* Option 2: Manual private key input */}
        {showManualInput && (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col gap-3"
          >
            {identityKey && (
              <button
                type="button"
                onClick={() => setShowManualInput(false)}
                className="flex items-center gap-1.5 text-[11px] text-primary hover:underline self-start"
              >
                ← Use my stored identity key
              </button>
            )}

            <div className="flex items-center justify-between">
              <label
                htmlFor="private-key-textarea"
                className="text-xs font-semibold text-foreground flex items-center gap-2"
              >
                <KeyRound className="h-4 w-4 text-purple-400" />
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

            <div className="relative rounded-xl border border-border/60 bg-background/40 focus-within:border-primary/50 transition-all">
              <textarea
                id="private-key-textarea"
                value={manualKeyValue}
                onChange={(e) => setManualKeyValue(e.target.value)}
                placeholder="Paste your base64-encoded RSA-2048 PKCS8 private key here..."
                rows={6}
                spellCheck={false}
                className={`w-full resize-none bg-transparent border-0 font-mono text-[11px] leading-relaxed text-foreground placeholder:text-muted-foreground/40 focus:outline-none p-3 ${
                  showKeyText ? '' : 'text-transparent [text-shadow:0_0_6px_rgba(255,255,255,0.3)]'
                }`}
                style={!showKeyText ? { WebkitTextSecurity: 'disc' } as React.CSSProperties : undefined}
              />
            </div>

            {/* Remember in session toggle */}
            <label className="flex items-center gap-2.5 cursor-pointer select-none group">
              <input
                type="checkbox"
                id="remember-session-toggle"
                checked={rememberInSession}
                onChange={(e) => setRememberInSession(e.target.checked)}
                className="h-4 w-4 rounded border-border text-primary focus:ring-primary focus:ring-offset-0 bg-background/80 cursor-pointer"
              />
              <div className="flex flex-col">
                <span className="text-xs font-medium text-foreground group-hover:text-primary transition-colors">
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
              variant="glow"
              className="w-full gap-2 font-semibold"
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

        {/* Error display */}
        {errorToShow && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-start gap-2.5 p-3.5 rounded-xl bg-destructive/10 border border-destructive/30 text-destructive text-xs"
          >
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
            <span>{errorToShow}</span>
          </motion.div>
        )}
      </div>

      {/* Security notice */}
      <p className="text-center text-[11px] text-muted-foreground/60 leading-relaxed px-4">
        Your private key never leaves your browser. The AES decryption key is unwrapped in-memory
        using SubtleCrypto and immediately discarded after decryption.
      </p>
    </motion.div>
  );
}
