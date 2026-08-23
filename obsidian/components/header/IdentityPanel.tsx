'use client';

/**
 * components/header/IdentityPanel.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Key icon in the header that opens a modal for RSA identity key management.
 *
 * Features:
 *   - Shows key icon with status indicator (has key / no key)
 *   - Modal: "Generate My Identity Key" — RSA-2048 opt-in
 *   - "📋 Copy My Public Key" — copies base64 SPKI to clipboard
 *   - Shows SHA-256 fingerprint
 *   - "🗑 Regenerate Key" — with warning dialog
 *   - Auto-loads existing key from IndexedDB on mount
 * ─────────────────────────────────────────────────────────────────────────────
 */

import * as React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  KeyRound,
  X,
  Copy,
  Check,
  Loader2,
  RefreshCw,
  AlertTriangle,
  Fingerprint,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  loadIdentityKey,
  generateAndSaveIdentityKey,
  exportIdentityPrivateKeyBase64,
  purgeKeys,
  type IdentityKeyRecord,
} from '@/lib/crypto/keystore';

export function IdentityPanel() {
  const [isOpen, setIsOpen] = React.useState(false);
  const [identityKey, setIdentityKey] = React.useState<IdentityKeyRecord | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [isGenerating, setIsGenerating] = React.useState(false);
  const [copied, setCopied] = React.useState(false);
  const [copiedPriv, setCopiedPriv] = React.useState(false);
  const [showRegenerateConfirm, setShowRegenerateConfirm] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // Load identity key on mount
  React.useEffect(() => {
    loadIdentityKey()
      .then((record) => {
        setIdentityKey(record);
        setIsLoading(false);
      })
      .catch(() => setIsLoading(false));
  }, []);

  // ── Generate key ─────────────────────────────────────────────────────────

  const handleGenerate = async () => {
    setIsGenerating(true);
    setError(null);
    try {
      const record = await generateAndSaveIdentityKey();
      setIdentityKey(record);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate key.');
    } finally {
      setIsGenerating(false);
      setShowRegenerateConfirm(false);
    }
  };

  // ── Copy public key ───────────────────────────────────────────────────────

  const handleCopyPublicKey = async () => {
    if (!identityKey) return;
    try {
      await navigator.clipboard.writeText(identityKey.publicKeyBase64);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError('Failed to copy to clipboard.');
    }
  };

  // ── Copy private key ──────────────────────────────────────────────────────

  const handleCopyPrivateKey = async () => {
    try {
      const privKeyBase64 = await exportIdentityPrivateKeyBase64();
      if (privKeyBase64) {
        await navigator.clipboard.writeText(privKeyBase64);
        setCopiedPriv(true);
        setTimeout(() => setCopiedPriv(false), 2000);
      }
    } catch {
      setError('Failed to copy private key.');
    }
  };

  // ── Purge / Regenerate ────────────────────────────────────────────────────

  const handlePurgeAndRegenerate = async () => {
    setIsGenerating(true);
    setError(null);
    try {
      await purgeKeys();
      const record = await generateAndSaveIdentityKey();
      setIdentityKey(record);
      setShowRegenerateConfirm(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to regenerate key.');
    } finally {
      setIsGenerating(false);
    }
  };

  // ── Formatted fingerprint ─────────────────────────────────────────────────

  const formattedFp = identityKey
    ? identityKey.fingerprint.match(/.{1,4}/g)?.join(':') ?? identityKey.fingerprint
    : null;

  const hasKey = !!identityKey && !isLoading;

  return (
    <>
      {/* Header button */}
      <button
        id="identity-panel-btn"
        type="button"
        onClick={() => setIsOpen(true)}
        className="relative flex h-9 w-9 items-center justify-center rounded-xl border border-border/60 bg-background/60 hover:bg-background/80 hover:border-primary/40 transition-all group"
        aria-label="Identity key settings"
        title="RSA Identity Key"
      >
        <KeyRound className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
        {/* Status dot */}
        <span
          className={`absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-background transition-colors ${
            isLoading
              ? 'bg-muted-foreground/30'
              : hasKey
              ? 'bg-emerald-500'
              : 'bg-amber-500'
          }`}
        />
      </button>

      {/* Backdrop */}
      <AnimatePresence>
        {isOpen && (
          <>
            <motion.div
              key="backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsOpen(false)}
              className="fixed inset-0 z-50 bg-background/70 backdrop-blur-sm"
            />

            {/* Modal */}
            <motion.div
              key="modal"
              initial={{ opacity: 0, scale: 0.95, y: -8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: -8 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
              className="fixed top-20 right-4 sm:right-6 z-50 w-full max-w-sm"
            >
              <div className="glass-panel rounded-2xl border border-border/70 shadow-2xl shadow-black/50 overflow-hidden">
                {/* Modal header */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-border/40">
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-purple-500/15 border border-purple-500/25 text-purple-400">
                      <KeyRound className="h-4 w-4" />
                    </div>
                    <div className="flex flex-col">
                      <span className="text-sm font-semibold text-foreground">Identity Key</span>
                      <span className="text-[10px] text-muted-foreground">RSA-2048 OAEP</span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsOpen(false)}
                    className="text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                {/* Modal body */}
                <div className="p-5 flex flex-col gap-4">
                  {isLoading ? (
                    <div className="flex items-center justify-center py-6">
                      <Loader2 className="h-6 w-6 animate-spin text-primary" />
                    </div>
                  ) : hasKey ? (
                    // ── Key Exists ─────────────────────────────────────────
                    <AnimatePresence mode="wait">
                      {showRegenerateConfirm ? (
                        <motion.div
                          key="confirm"
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          className="flex flex-col gap-3"
                        >
                          <div className="flex items-start gap-2.5 p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/25 text-amber-400 text-xs">
                            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                            <span>
                              <strong>Warning:</strong> Regenerating your identity key will make all
                              existing pastes encrypted for your old key <strong>permanently unreadable</strong>.
                              This cannot be undone.
                            </span>
                          </div>
                          <div className="flex gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setShowRegenerateConfirm(false)}
                              className="flex-1 text-xs"
                            >
                              Cancel
                            </Button>
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={handlePurgeAndRegenerate}
                              disabled={isGenerating}
                              className="flex-1 text-xs gap-1.5"
                            >
                              {isGenerating ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <RefreshCw className="h-3.5 w-3.5" />
                              )}
                              Regenerate
                            </Button>
                          </div>
                        </motion.div>
                      ) : (
                        <motion.div
                          key="keyinfo"
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          className="flex flex-col gap-3"
                        >
                          {/* Key info card */}
                          <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/25 flex flex-col gap-2">
                            <div className="flex items-center gap-2">
                              <ShieldCheck className="h-4 w-4 text-emerald-400 shrink-0" />
                              <span className="text-xs font-semibold text-emerald-300">
                                Identity Key Active
                              </span>
                              <Badge variant="success" className="text-[9px] py-0 px-1.5 ml-auto">
                                RSA-2048
                              </Badge>
                            </div>
                            <div className="flex items-center gap-1.5 text-[11px] text-emerald-300/80 font-mono">
                              <Fingerprint className="h-3 w-3 shrink-0" />
                              <span className="truncate">{formattedFp}</span>
                            </div>
                            <span className="text-[10px] text-muted-foreground">
                              Created {new Date(identityKey!.createdAt).toLocaleDateString()}
                            </span>
                          </div>

                          {/* Copy buttons */}
                          <div className="flex flex-col gap-2">
                            <Button
                              id="copy-public-key-btn"
                              variant="outline"
                              size="sm"
                              onClick={handleCopyPublicKey}
                              className="w-full gap-2 text-xs font-semibold border-border/80"
                            >
                              {copied ? (
                                <>
                                  <Check className="h-3.5 w-3.5 text-emerald-400" />
                                  Public Key Copied!
                                </>
                              ) : (
                                <>
                                  <Copy className="h-3.5 w-3.5" />
                                  Copy My Public Key
                                </>
                              )}
                            </Button>

                            <Button
                              id="copy-private-key-btn"
                              variant="ghost"
                              size="sm"
                              onClick={handleCopyPrivateKey}
                              className="w-full gap-2 text-xs font-medium text-purple-300 hover:text-purple-200 hover:bg-purple-500/10 border border-purple-500/20"
                            >
                              {copiedPriv ? (
                                <>
                                  <Check className="h-3.5 w-3.5 text-emerald-400" />
                                  Private Key Copied!
                                </>
                              ) : (
                                <>
                                  <KeyRound className="h-3.5 w-3.5 text-purple-400" />
                                  Copy My Private Key
                                </>
                              )}
                            </Button>
                          </div>

                          <p className="text-[10px] text-muted-foreground leading-relaxed">
                            Share your public key with anyone who wants to send you an encrypted
                            paste. Your private key stays in this browser only.
                          </p>

                          {/* Regenerate */}
                          <button
                            type="button"
                            onClick={() => setShowRegenerateConfirm(true)}
                            className="flex items-center gap-1.5 text-[11px] text-muted-foreground hover:text-destructive transition-colors"
                          >
                            <RefreshCw className="h-3 w-3" />
                            Regenerate key (destroys old key)
                          </button>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  ) : (
                    // ── No Key Yet ─────────────────────────────────────────
                    <div className="flex flex-col gap-4">
                      <div className="flex flex-col items-center text-center gap-3 py-2">
                        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 border border-primary/25 text-primary">
                          <Sparkles className="h-7 w-7" />
                        </div>
                        <div className="flex flex-col gap-1">
                          <span className="text-sm font-semibold text-foreground">
                            No Identity Key Yet
                          </span>
                          <p className="text-[11px] text-muted-foreground leading-relaxed">
                            Generate an RSA-2048 keypair. Your public key can be shared with senders;
                            your private key never leaves this browser.
                          </p>
                        </div>
                      </div>

                      <Button
                        id="generate-identity-key-btn"
                        variant="glow"
                        size="sm"
                        onClick={handleGenerate}
                        disabled={isGenerating}
                        className="w-full gap-2 font-semibold"
                      >
                        {isGenerating ? (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Generating RSA-2048…
                          </>
                        ) : (
                          <>
                            <KeyRound className="h-4 w-4" />
                            Generate My Identity Key
                          </>
                        )}
                      </Button>
                    </div>
                  )}

                  {/* Error */}
                  {error && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="flex items-center gap-2 p-2.5 rounded-lg bg-destructive/10 border border-destructive/25 text-destructive text-xs"
                    >
                      <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                      <span>{error}</span>
                    </motion.div>
                  )}
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
