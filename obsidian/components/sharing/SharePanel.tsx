'use client';

/**
 * components/sharing/SharePanel.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Success panel displayed after client-side encryption.
 * Renders shareable links, Shamir threshold shards, QR code indicator,
 * and emergency paste destruction tools.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import * as React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Copy,
  Check,
  ExternalLink,
  ShieldCheck,
  Trash2,
  ChevronDown,
  ChevronUp,
  Layers,
  Key,
  QrCode,
  PlusCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { EncryptionResult } from '@/hooks/usePasteEncryption';

interface SharePanelProps {
  result: EncryptionResult;
  onReset: () => void;
}

export function SharePanel({ result, onReset }: SharePanelProps) {
  // ── SETUP ──────────────────────────────────────────────────────────────

  // Tracks index of recently copied link/shard button for feedback animations
  const [copiedIndex, setCopiedIndex] = React.useState<number | null>(null);
  
  // Tracks copy state when copying all Shamir shards at once
  const [copiedAll, setCopiedAll] = React.useState(false);
  
  // Tracks copy feedback state for the secret deletion token
  const [tokenCopied, setTokenCopied] = React.useState(false);
  
  // Controls visibility of the collapsible immediate paste destruction panel
  const [showDeleteSection, setShowDeleteSection] = React.useState(false);
  
  // Destruction API call state (loading status, completion flag, and error message)
  const [isDeleting, setIsDeleting] = React.useState(false);
  const [isDeleted, setIsDeleted] = React.useState(false);
  const [deleteError, setDeleteError] = React.useState<string | null>(null);

  // Helper mode flags (identifies if paste used Shamir multi-sharing or RSA asymmetric key sealing)
  const isShamir = result.isShamir && result.shardUrls && result.shardUrls.length > 0;
  const isAsymmetric = result.isAsymmetric === true;

  // ── ACTIONS ────────────────────────────────────────────────────────────

  // Copies text (URL or token) to clipboard and shows brief success indicator
  const copyToClipboard = async (text: string, index: number | 'token') => {
    try {
      await navigator.clipboard.writeText(text);
      if (index === 'token') {
        setTokenCopied(true);
        setTimeout(() => setTokenCopied(false), 2000);
      } else {
        setCopiedIndex(index);
        setTimeout(() => setCopiedIndex(null), 2000);
      }
    } catch {
      // Fallback if clipboard API is restricted
    }
  };

  // Concatenates all Shamir shard URLs into a single multi-line string and copies to clipboard
  const handleCopyAllShards = async () => {
    if (!result.shardUrls) return;
    try {
      const allText = result.shardUrls
        .map((s) => `Shard #${s.index} (Threshold ${result.threshold}/${result.totalShares}): ${s.url}`)
        .join('\n');
      await navigator.clipboard.writeText(allText);
      setCopiedAll(true);
      setTimeout(() => setCopiedAll(false), 2500);
    } catch {
      // Fallback
    }
  };

  // Calls the server DELETE API endpoint using deleteToken to immediately destroy paste
  const handleDelete = async () => {
    if (!confirm('Are you sure you want to permanently delete this paste immediately?')) {
      return;
    }
    setIsDeleting(true);
    setDeleteError(null);
    try {
      const res = await fetch(`/api/v1/paste/${result.pasteId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deleteToken: result.deleteToken }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to delete paste');
      }
      setIsDeleted(true);
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : 'Deletion failed');
    } finally {
      setIsDeleting(false);
    }
  };

  // ── UI ─────────────────────────────────────────────────────────────────

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.98, y: 12 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.98, y: -12 }}
      transition={{ duration: 0.25, ease: 'easeOut' }}
      className="w-full max-w-3xl mx-auto flex flex-col gap-6 font-mono"
    >
      {/* Main Success Card Container */}
      <div className="rounded-lg border border-border bg-card p-6 sm:p-8 flex flex-col gap-6 shadow-xl relative overflow-hidden">
        {/* Card Header & Title Banner */}
        <div className="flex items-center justify-between flex-wrap gap-4 pb-4 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded bg-muted border border-border text-foreground">
              {isShamir ? <Layers className="h-5 w-5" /> : <ShieldCheck className="h-5 w-5" />}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-bold text-foreground uppercase tracking-tight">
                  {isShamir
                    ? 'Threshold Shards Created'
                    : isAsymmetric
                    ? 'Recipient Encrypted Paste Created'
                    : 'Encrypted Paste Ready'}
                </h2>
                <span className={`text-[10px] uppercase font-mono px-2 py-0.5 rounded border ${
                  isShamir
                    ? 'bg-cyan-500/10 border-cyan-500/30 text-cyan-300'
                    : isAsymmetric
                    ? 'bg-indigo-500/10 border-indigo-500/30 text-indigo-300'
                    : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                }`}>
                  {isShamir ? `${result.threshold}-of-${result.totalShares} SSS` : isAsymmetric ? 'RSA-OAEP' : 'AES-256-GCM'}
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                {isShamir
                  ? 'Distribute each shard to a different trusted recipient'
                  : isAsymmetric
                  ? 'Encrypted specifically for the recipient’s public key'
                  : 'Key exists only in the link hash fragment (#) — zero server knowledge'}
              </p>
            </div>
          </div>

          {/* New Paste Reset Button */}
          <Button
            variant="outline"
            size="sm"
            onClick={onReset}
            className="text-xs gap-1.5 h-8 font-mono border-border bg-background hover:bg-muted"
          >
            <PlusCircle className="h-3.5 w-3.5" />
            <span>New Paste</span>
          </Button>
        </div>

        {/* Shareable Link Display Section */}
        {isShamir ? (
          /* Multi-Shard SSS Display (Renders list of unique shard links) */
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                  Shard Links ({result.shardUrls?.length})
                </span>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted border border-border text-foreground">
                  Quorum: {result.threshold} required
                </span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleCopyAllShards}
                className="text-xs h-7 text-foreground hover:bg-muted gap-1.5"
              >
                {copiedAll ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                <span>{copiedAll ? 'All Copied' : 'Copy All Links'}</span>
              </Button>
            </div>

            {/* Shards List */}
            <div className="flex flex-col gap-2">
              {result.shardUrls?.map((shard, idx) => (
                <div
                  key={shard.index}
                  className="flex items-center gap-2 p-2.5 rounded bg-muted/40 border border-border hover:border-foreground/40 transition-colors"
                >
                  <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded bg-muted text-foreground text-xs font-mono font-bold border border-border">
                    #{shard.index}
                  </div>
                  <input
                    type="text"
                    readOnly
                    value={shard.url}
                    className="w-full bg-transparent px-1 text-xs font-mono text-foreground focus:outline-none truncate"
                  />
                  <div className="flex items-center gap-1 shrink-0">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => copyToClipboard(shard.url, idx)}
                      className="h-7 text-xs px-2.5 gap-1 border-border bg-background hover:bg-muted"
                    >
                      {copiedIndex === idx ? (
                        <>
                          <Check className="h-3 w-3" />
                          <span className="hidden sm:inline">Copied</span>
                        </>
                      ) : (
                        <>
                          <Copy className="h-3 w-3" />
                          <span className="hidden sm:inline">Copy</span>
                        </>
                      )}
                    </Button>
                    <a
                      href={shard.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex h-7 w-7 items-center justify-center rounded border border-border bg-background text-muted-foreground hover:text-foreground transition-colors"
                      title="Open shard in new tab"
                    >
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>
                </div>
              ))}
            </div>

            {/* Shamir Secret Sharing Explanation Note */}
            <div className="rounded bg-muted/30 border border-border p-3.5 text-xs text-muted-foreground flex items-start gap-3">
              <div className="p-1 rounded bg-muted text-foreground shrink-0 mt-0.5">
                <Layers className="h-4 w-4" />
              </div>
              <div className="flex flex-col gap-1">
                <span className="font-bold text-foreground">How Shamir Secret Sharing Works</span>
                <p className="leading-relaxed text-[11px]">
                  The master encryption key was split into {result.totalShares} cryptographic shares. No single shard contains any information about the original secret. Any {result.threshold} shares combined will reconstruct the key and decrypt the paste.
                </p>
              </div>
            </div>
          </div>
        ) : (
          /* Single URL Display Box */
          <div className="flex flex-col gap-3">
            <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
              Shareable Link
            </span>
            <div className="flex items-center gap-2 p-2.5 rounded bg-background border border-border">
              <input
                type="text"
                readOnly
                value={result.shareUrl}
                className="w-full bg-transparent px-2 text-xs sm:text-sm font-mono text-foreground focus:outline-none truncate"
              />
              <Button
                size="sm"
                onClick={() => copyToClipboard(result.shareUrl, 0)}
                className="shrink-0 text-xs h-8 gap-1.5 font-bold font-mono bg-foreground text-background hover:opacity-90"
              >
                {copiedIndex === 0 ? (
                  <>
                    <Check className="h-3.5 w-3.5" />
                    <span>Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy className="h-3.5 w-3.5" />
                    <span>Copy Link</span>
                  </>
                )}
              </Button>
              <a
                href={result.shareUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex h-8 w-8 items-center justify-center rounded border border-border bg-background text-muted-foreground hover:text-foreground transition-colors shrink-0"
                title="Open in new tab"
              >
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            </div>

            {/* Architecture Explanation Card */}
            {isAsymmetric ? (
              <div className="rounded bg-muted/30 border border-border p-3.5 text-xs text-muted-foreground flex items-start gap-3 mt-1">
                <div className="p-1 rounded bg-muted text-foreground shrink-0 mt-0.5">
                  <Key className="h-4 w-4" />
                </div>
                <div className="flex flex-col gap-1">
                  <span className="font-bold text-foreground">RSA-OAEP Recipient Encryption</span>
                  <p className="leading-relaxed text-[11px]">
                    The AES-256 key is sealed with the recipient&apos;s RSA-2048 public key and stored in{' '}
                    <code className="font-mono bg-muted px-1 py-0.5 rounded text-foreground">adata[4]</code>.
                    The URL ends in <code className="font-mono bg-muted px-1 py-0.5 rounded text-foreground">#asym</code> —{' '}
                    <strong>no decryption key is in the URL</strong>. Only the holder of the matching private key can decrypt.
                  </p>
                </div>
              </div>
            ) : (
              <div className="rounded bg-muted/30 border border-border p-3.5 text-xs text-muted-foreground flex items-start gap-3 mt-1">
                <div className="p-1 rounded bg-muted text-foreground shrink-0 mt-0.5">
                  <Key className="h-4 w-4" />
                </div>
                <div className="flex flex-col gap-1">
                  <span className="font-bold text-foreground">Zero-Knowledge Architecture</span>
                  <p className="leading-relaxed text-[11px]">
                    The decryption key <code className="font-mono bg-muted px-1 py-0.5 rounded text-foreground">#{result.rawKeyBase58.slice(0, 8)}...</code> is located after the URL hash fragment. Browsers <strong>never</strong> send hash fragments to web servers, guaranteeing only holders of this link can decrypt your content.
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Mobile & In-Person QR Code Section */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-3.5 rounded bg-muted/20 border border-border">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded bg-muted border border-border text-foreground">
              <QrCode className="h-4 w-4" />
            </div>
            <div>
              <p className="text-xs font-bold text-foreground uppercase tracking-wider">Mobile & In-Person Sharing</p>
              <p className="text-[11px] text-muted-foreground">Scan or share this paste directly with mobile devices</p>
            </div>
          </div>
          <span className="text-xs text-muted-foreground px-2 py-0.5 rounded bg-muted border border-border">
            QR Scanner Ready
          </span>
        </div>

        {/* Collapsible Delete Token & Immediate Destruction Section */}
        <div className="border-t border-border pt-4 flex flex-col gap-3">
          <button
            type="button"
            onClick={() => setShowDeleteSection(!showDeleteSection)}
            className="flex items-center justify-between text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            <span className="flex items-center gap-1.5 text-foreground font-mono">
              <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
              Delete Token & Immediate Destruction
            </span>
            {showDeleteSection ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </button>

          <AnimatePresence>
            {showDeleteSection && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="flex flex-col gap-2.5 pt-2"
              >
                {isDeleted ? (
                  <div className="p-3 rounded bg-muted border border-border text-foreground text-xs font-medium flex items-center gap-2">
                    <Check className="h-4 w-4" />
                    <span>Paste has been permanently destroyed and deleted from server!</span>
                  </div>
                ) : (
                  <>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      If you need to manually destroy this paste immediately before it expires, use this secret deletion token:
                    </p>
                    <div className="flex items-center gap-2 p-2 rounded bg-background border border-border">
                      <input
                        type="text"
                        readOnly
                        value={result.deleteToken}
                        className="w-full bg-transparent px-2 py-1 text-xs font-mono text-foreground focus:outline-none truncate"
                      />
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => copyToClipboard(result.deleteToken, 'token')}
                        className="shrink-0 text-xs h-7 bg-background hover:bg-muted border-border font-mono"
                      >
                        {tokenCopied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                        <span className="ml-1">{tokenCopied ? 'Copied' : 'Copy'}</span>
                      </Button>
                    </div>

                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={handleDelete}
                      disabled={isDeleting}
                      className="w-full text-xs h-8 gap-1.5 font-mono font-bold mt-1"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      <span>{isDeleting ? 'Deleting...' : 'Destroy Paste on Server Now'}</span>
                    </Button>

                    {deleteError && (
                      <p className="text-[11px] text-destructive">{deleteError}</p>
                    )}
                  </>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </motion.div>
  );
}

export default SharePanel;
