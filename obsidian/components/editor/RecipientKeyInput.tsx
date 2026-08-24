'use client';

/**
 * components/editor/RecipientKeyInput.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Input component for asymmetric delivery mode in PasteEditor.
 * Validates RSA-2048 public keys in real-time and computes fingerprints.
 * Strict monochrome styling matching Obsidian design standards.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import * as React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ShieldCheck,
  AlertCircle,
  Fingerprint,
  X,
  KeyRound,
} from 'lucide-react';
import {
  importRSAPublicKey,
  getKeyFingerprint,
} from '@/lib/crypto/asymmetric';
import { loadIdentityKey } from '@/lib/crypto/keystore';

interface RecipientKeyInputProps {
  value: string;
  onChange: (value: string) => void;
  onKeyChange: (importedKeyBase64: string | null) => void;
}

export function RecipientKeyInput({
  value,
  onChange,
  onKeyChange,
}: RecipientKeyInputProps) {
  // ── SETUP ──────────────────────────────────────────────────────────────

  // Key validation state ('idle', 'validating', 'valid', or 'invalid')
  const [validationState, setValidationState] = React.useState<
    'idle' | 'validating' | 'valid' | 'invalid'
  >('idle');

  // Fingerprint string derived from valid imported RSA public key
  const [fingerprint, setFingerprint] = React.useState<string | null>(null);

  // Validation error message text
  const [validationError, setValidationError] = React.useState<string | null>(null);

  // Active user's own identity key status and base64 string (used for self-testing)
  const [hasMyKey, setHasMyKey] = React.useState(false);
  const [myKeyBase64, setMyKeyBase64] = React.useState<string | null>(null);

  // Checks IndexedDB on mount to see if current user has an identity key for quick autofill
  React.useEffect(() => {
    loadIdentityKey().then((key) => {
      if (key) {
        setHasMyKey(true);
        setMyKeyBase64(key.publicKeyBase64);
      }
    });
  }, []);

  // Debounced real-time RSA public key import & fingerprint validation effect
  React.useEffect(() => {
    const timer = setTimeout(async () => {
      const trimmed = value.trim();

      if (!trimmed) {
        setValidationState('idle');
        setFingerprint(null);
        setValidationError(null);
        onKeyChange(null);
        return;
      }

      setValidationState('validating');

      try {
        const cleaned = trimmed
          .replace(/-----BEGIN PUBLIC KEY-----/g, '')
          .replace(/-----END PUBLIC KEY-----/g, '')
          .replace(/\s+/g, '');

        const imported = await importRSAPublicKey(cleaned);
        const fp = await getKeyFingerprint(imported);

        setValidationState('valid');
        setFingerprint(fp);
        setValidationError(null);
        onKeyChange(cleaned);
      } catch (err) {
        setValidationState('invalid');
        setFingerprint(null);
        setValidationError(
          err instanceof Error
            ? err.message
            : 'Invalid RSA-2048 public key format. Paste base64 SPKI or PEM.'
        );
        onKeyChange(null);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [value, onKeyChange]);

  // Computed CSS border style based on key validation status
  const borderClass =
    validationState === 'valid'
      ? 'border-foreground/80'
      : validationState === 'invalid'
      ? 'border-destructive'
      : 'border-border focus-within:border-foreground/50';

  // ── ACTIONS ────────────────────────────────────────────────────────────

  // Fills the input with current user's own public key for self-testing
  const handleUseMyKey = () => {
    if (myKeyBase64) {
      onChange(myKeyBase64);
    }
  };

  // Clears the key input area and resets validation state
  const handleClear = () => {
    onChange('');
    setValidationState('idle');
    setFingerprint(null);
    setValidationError(null);
    onKeyChange(null);
  };

  // ── UI ─────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col gap-3 p-3.5 rounded-lg bg-muted/40 border border-border font-mono">
      {/* Header Row & Quick Autofill Action Button */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs font-bold text-foreground uppercase tracking-wider">
          <ShieldCheck className="h-4 w-4 text-foreground" />
          <span>Recipient&apos;s RSA-2048 Public Key</span>
        </div>

        {hasMyKey && (
          <button
            type="button"
            onClick={handleUseMyKey}
            className="flex items-center gap-1.5 text-[11px] text-muted-foreground hover:text-foreground transition-colors font-mono cursor-pointer"
            title="Fill with my own public key for self-testing"
          >
            <KeyRound className="h-3 w-3" />
            <span>Use my key</span>
          </button>
        )}
      </div>

      {/* Public Key Textarea Input Field */}
      <div className={`relative rounded-lg border bg-background/80 transition-colors ${borderClass}`}>
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Paste recipient's base64 RSA public key (MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8A...)"
          rows={3}
          spellCheck={false}
          className="w-full bg-transparent px-3 py-2.5 text-xs font-mono text-foreground placeholder:text-muted-foreground/50 focus:outline-none resize-none selection:bg-muted"
        />

        {value && (
          <button
            type="button"
            onClick={handleClear}
            className="absolute top-2 right-2 text-muted-foreground hover:text-foreground transition-colors p-1 cursor-pointer"
            title="Clear key"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {/* Validation Status & Fingerprint Feedback Display */}
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
            className="flex items-center gap-2 p-2.5 rounded-lg bg-muted/80 border border-border text-foreground"
          >
            <ShieldCheck className="h-4 w-4 shrink-0 text-foreground" />
            <div className="flex flex-col gap-0.5">
              <span className="text-xs font-bold uppercase tracking-wider">Valid RSA-2048 Public Key</span>
              <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                <Fingerprint className="h-3.5 w-3.5 text-foreground" />
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

      {/* Architecture Hint Note */}
      {validationState === 'idle' && (
        <p className="text-[10px] text-muted-foreground leading-relaxed">
          The AES-256 key is wrapped with this RSA public key. Only the matching private key holder can decrypt.{' '}
          <strong>No key exists in the share URL</strong>.
        </p>
      )}
    </div>
  );
}

export default RecipientKeyInput;
