'use client';

/**
 * components/editor/RecipientKeyInput.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Public key input panel for the Asymmetric RSA-OAEP mode.
 *
 * Features:
 *   - Textarea to paste raw base64 RSA-2048 SPKI public key
 *   - Live validation on blur: attempts importRSAPublicKey()
 *   - Shows SHA-256 fingerprint (first 8 bytes, 16 hex chars) on valid key
 *   - "Use My Key" shortcut to load the user's own public key from IndexedDB
 *     (useful for testing or self-addressed pastes)
 * ─────────────────────────────────────────────────────────────────────────────
 */

import * as React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ShieldCheck,
  AlertCircle,
  ClipboardPaste,
  Fingerprint,
  UserCircle2,
  X,
} from 'lucide-react';
import { importRSAPublicKey, getKeyFingerprint } from '@/lib/crypto/asymmetric';
import { loadIdentityKey } from '@/lib/crypto/keystore';

interface RecipientKeyInputProps {
  /** Called when the user enters a valid public key */
  onKeyChange: (publicKeyBase64: string | null) => void;
  /** The current value (controlled) */
  value: string;
  /** Setter for the current textarea value */
  onChange: (value: string) => void;
}

export function RecipientKeyInput({
  onKeyChange,
  value,
  onChange,
}: RecipientKeyInputProps) {
  const [validationState, setValidationState] = React.useState<
    'idle' | 'validating' | 'valid' | 'invalid'
  >('idle');
  const [fingerprint, setFingerprint] = React.useState<string | null>(null);
  const [validationError, setValidationError] = React.useState<string | null>(null);

  // Automatically validate whenever `value` changes (with microtask delay to prevent render cycles)
  React.useEffect(() => {
    const trimmed = value.trim();
    if (!trimmed) {
      setValidationState('idle');
      setFingerprint(null);
      setValidationError(null);
      onKeyChange(null);
      return;
    }

    let cancelled = false;
    setValidationState('validating');

    (async () => {
      try {
        const pubKey = await importRSAPublicKey(trimmed);
        const fp = await getKeyFingerprint(pubKey);
        if (!cancelled) {
          setFingerprint(fp);
          setValidationState('valid');
          setValidationError(null);
          onKeyChange(trimmed);
        }
      } catch {
        if (!cancelled) {
          setValidationState('invalid');
          setFingerprint(null);
          setValidationError(
            'Invalid public key. Paste a valid RSA-2048 SPKI key in base64 format.'
          );
          onKeyChange(null);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [value, onKeyChange]);

  const handleLoadOwnKey = async () => {
    try {
      const record = await loadIdentityKey();
      if (record) {
        onChange(record.publicKeyBase64);
      }
    } catch {
      // silently ignore if no identity key
    }
  };

  // ── Clear ──────────────────────────────────────────────────────────────────

  const handleClear = () => {
    onChange('');
    setValidationState('idle');
    setFingerprint(null);
    setValidationError(null);
    onKeyChange(null);
  };

  // ── Border color by state ──────────────────────────────────────────────────

  const borderClass =
    validationState === 'valid'
      ? 'border-emerald-500/60 ring-1 ring-emerald-500/30'
      : validationState === 'invalid'
      ? 'border-destructive/60 ring-1 ring-destructive/30'
      : 'border-border/60 focus-within:border-primary/50';

  return (
    <div className="flex flex-col gap-3 p-4 rounded-xl bg-background/60 border border-border/60">
      {/* Header row */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs font-semibold text-foreground">
          <ShieldCheck className="h-4 w-4 text-purple-400" />
          <span>Recipient&apos;s RSA-2048 Public Key</span>
        </div>

        {/* Load own key shortcut */}
        <button
          type="button"
          onClick={handleLoadOwnKey}
          className="flex items-center gap-1.5 text-[11px] text-muted-foreground hover:text-primary transition-colors font-medium"
        >
          <UserCircle2 className="h-3.5 w-3.5" />
          Use My Key
        </button>
      </div>

      {/* Textarea */}
      <div className={`relative rounded-xl border bg-background/40 transition-all ${borderClass}`}>
        <textarea
          id="recipient-public-key"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={
            'Paste the recipient\'s base64 RSA-2048 public key here...\n\n' +
            'Example:\nMIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA...'
          }
          rows={5}
          spellCheck={false}
          className="w-full resize-none bg-transparent border-0 font-mono text-[11px] leading-relaxed text-foreground placeholder:text-muted-foreground/40 focus:outline-none p-3 pr-8"
        />

        {/* Clear button */}
        {value && (
          <button
            type="button"
            onClick={handleClear}
            className="absolute top-2 right-2 text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Paste from clipboard helper */}
      <button
        type="button"
        onClick={async () => {
          try {
            const text = await navigator.clipboard.readText();
            onChange(text);
          } catch {
            // clipboard read permission denied — user can paste manually
          }
        }}
        className="flex items-center gap-1.5 self-start text-[11px] text-muted-foreground hover:text-primary transition-colors font-medium"
      >
        <ClipboardPaste className="h-3.5 w-3.5" />
        Paste from Clipboard
      </button>

      {/* Validation feedback */}
      <AnimatePresence mode="wait">
        {validationState === 'validating' && (
          <motion.div
            key="validating"
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="flex items-center gap-2 text-xs text-muted-foreground"
          >
            <span className="animate-pulse">Validating key…</span>
          </motion.div>
        )}

        {validationState === 'valid' && fingerprint && (
          <motion.div
            key="valid"
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="flex items-center gap-2 p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/25 text-emerald-400"
          >
            <ShieldCheck className="h-4 w-4 shrink-0" />
            <div className="flex flex-col gap-0.5">
              <span className="text-xs font-semibold">Valid RSA-2048 Public Key</span>
              <div className="flex items-center gap-1.5 text-[11px] text-emerald-300/80">
                <Fingerprint className="h-3 w-3" />
                <span className="font-mono">
                  {fingerprint.match(/.{1,4}/g)?.join(':') ?? fingerprint}
                </span>
              </div>
            </div>
          </motion.div>
        )}

        {validationState === 'invalid' && validationError && (
          <motion.div
            key="invalid"
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="flex items-center gap-2 p-2.5 rounded-lg bg-destructive/10 border border-destructive/25 text-destructive text-xs"
          >
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{validationError}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* How it works hint */}
      {validationState === 'idle' && (
        <p className="text-[11px] text-muted-foreground/70 leading-relaxed">
          The AES-256 encryption key will be wrapped using this RSA-2048 public key and stored in{' '}
          <code className="font-mono text-purple-400">adata[4]</code>. Only the holder of the
          matching private key can decrypt.{' '}
          <strong>No decryption key appears in the share URL</strong> — the URL ends in{' '}
          <code className="font-mono text-purple-300">#asym</code>.
        </p>
      )}
    </div>
  );
}
