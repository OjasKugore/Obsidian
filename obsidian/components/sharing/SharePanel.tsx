'use client';

import * as React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import confetti from 'canvas-confetti';
import {
  Check,
  Copy,
  ExternalLink,
  PlusCircle,
  ShieldCheck,
  Key,
  QrCode,
  Trash2,
  ChevronDown,
  ChevronUp,
  Layers,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { EncryptionResult } from '@/hooks/usePasteEncryption';

interface SharePanelProps {
  result: EncryptionResult;
  onReset: () => void;
}

export function SharePanel({ result, onReset }: SharePanelProps) {
  const [copiedIndex, setCopiedIndex] = React.useState<number | null>(null);
  const [copiedAll, setCopiedAll] = React.useState(false);
  const [tokenCopied, setTokenCopied] = React.useState(false);
  const [showDeleteSection, setShowDeleteSection] = React.useState(false);
  const [isDeleting, setIsDeleting] = React.useState(false);
  const [isDeleted, setIsDeleted] = React.useState(false);
  const [deleteError, setDeleteError] = React.useState<string | null>(null);

  // Trigger celebratory confetti on mount
  React.useEffect(() => {
    try {
      confetti({
        particleCount: 50,
        spread: 60,
        origin: { y: 0.65 },
        colors: ['#3b82f6', '#8b5cf6', '#06b6d4'],
      });
    } catch {
      // Confetti fallback
    }
  }, []);

  const copyToClipboard = async (text: string, index: number | 'token' | 'all' = 0) => {
    try {
      await navigator.clipboard.writeText(text);
      if (index === 'token') {
        setTokenCopied(true);
        setTimeout(() => setTokenCopied(false), 2000);
      } else if (index === 'all') {
        setCopiedAll(true);
        setTimeout(() => setCopiedAll(false), 2500);
      } else {
        setCopiedIndex(index);
        setTimeout(() => setCopiedIndex(null), 2500);
      }
    } catch (err) {
      console.error('Failed to copy text: ', err);
    }
  };

  const handleCopyAllShards = () => {
    if (!result.shardUrls) return;
    const allFormatted = result.shardUrls
      .map(
        (s) =>
          `Shard #${s.index} (Threshold: ${result.threshold}-of-${result.totalShares}):\n${s.url}`
      )
      .join('\n\n');
    copyToClipboard(allFormatted, 'all');
  };

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to permanently delete this encrypted paste now?')) {
      return;
    }
    setIsDeleting(true);
    setDeleteError(null);
    try {
      const res = await fetch(`/api/v1/paste/${result.pasteId}?deleteToken=${result.deleteToken}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to delete paste');
      }
      setIsDeleted(true);
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : 'Deletion failed');
    } finally {
      setIsDeleting(false);
    }
  };

  const isShamir = result.isShamir && result.shardUrls && result.shardUrls.length > 0;
  const isAsymmetric = result.isAsymmetric === true;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.96, y: 16 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.96, y: -16 }}
      transition={{ duration: 0.35, ease: 'easeOut' }}
      className="w-full max-w-3xl mx-auto flex flex-col gap-6"
    >
      {/* Main Success Card */}
      <div className="glass-panel rounded-3xl p-6 sm:p-8 flex flex-col gap-6 shadow-2xl relative overflow-hidden border border-blue-500/20">
        {/* Glow accent */}
        <div className="absolute -top-24 -right-24 w-48 h-48 bg-blue-500/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -left-24 w-48 h-48 bg-purple-500/20 rounded-full blur-3xl pointer-events-none" />

        {/* Card Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 shadow-inner">
              {isShamir ? <Layers className="h-6 w-6 text-primary" /> : <ShieldCheck className="h-6 w-6" />}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg sm:text-xl font-bold text-foreground">
                  {isShamir
                    ? 'Threshold Shards Created'
                    : isAsymmetric
                    ? 'Recipient Encrypted Paste Created'
                    : 'Encrypted Paste Ready'}
                </h2>
                <Badge variant="glow" className="text-xs uppercase font-mono tracking-wider">
                  {isShamir ? `${result.threshold}-of-${result.totalShares} SSS` : isAsymmetric ? 'RSA-OAEP' : 'AES-256-GCM'}
                </Badge>
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

          <Button
            variant="outline"
            size="sm"
            onClick={onReset}
            className="text-xs gap-1.5 h-8 border-border/80"
          >
            <PlusCircle className="h-3.5 w-3.5" />
            <span>New Paste</span>
          </Button>
        </div>

        {/* ── Link Display Section ────────────────────────────────────────── */}
        {isShamir ? (
          // ── Multi-Shard SSS Display ──
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Shard Links ({result.shardUrls?.length})
                </span>
                <Badge variant="outline" className="text-[10px] font-mono text-primary border-primary/30">
                  Quorum: {result.threshold} required
                </Badge>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleCopyAllShards}
                className="text-xs h-7 text-primary hover:text-primary/80 gap-1.5"
              >
                {copiedAll ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
                <span>{copiedAll ? 'All Copied' : 'Copy All Links'}</span>
              </Button>
            </div>

            <div className="flex flex-col gap-2.5">
              {result.shardUrls?.map((shard, idx) => (
                <div
                  key={shard.index}
                  className="flex items-center gap-2 p-2.5 rounded-2xl bg-background/60 border border-border/60 hover:border-primary/40 transition-colors"
                >
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary text-xs font-mono font-bold">
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
                      className="h-7 text-xs px-2.5 gap-1 border-border/60"
                    >
                      {copiedIndex === idx ? (
                        <>
                          <Check className="h-3 w-3 text-emerald-400" />
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
                      className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-border/60 bg-background text-muted-foreground hover:text-foreground transition-colors"
                      title="Open shard in new tab"
                    >
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>
                </div>
              ))}
            </div>

            <div className="rounded-2xl bg-primary/5 border border-primary/15 p-4 text-xs text-muted-foreground flex items-start gap-3">
              <div className="p-1.5 rounded-lg bg-primary/10 text-primary shrink-0 mt-0.5">
                <Layers className="h-4 w-4" />
              </div>
              <div className="flex flex-col gap-1">
                <span className="font-semibold text-foreground">How Shamir Secret Sharing Works</span>
                <p className="leading-relaxed text-[11px]">
                  The master encryption key was split into {result.totalShares} cryptographic shares. No single shard contains any information about the original secret. Any {result.threshold} shares combined will reconstruct the key and decrypt the paste.
                </p>
              </div>
            </div>
          </div>
        ) : (
          // ── Single URL Display ──
          <div className="flex flex-col gap-3">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Shareable Link
            </span>
            <div className="flex items-center gap-2 p-2.5 rounded-2xl bg-background/70 border border-primary/30 shadow-inner">
              <input
                type="text"
                readOnly
                value={result.shareUrl}
                className="w-full bg-transparent px-2 text-xs sm:text-sm font-mono text-foreground focus:outline-none truncate selection:bg-primary/30"
              />
              <Button
                variant="glow"
                size="sm"
                onClick={() => copyToClipboard(result.shareUrl, 0)}
                className="shrink-0 text-xs h-8 gap-1.5 font-semibold"
              >
                {copiedIndex === 0 ? (
                  <>
                    <Check className="h-3.5 w-3.5 text-emerald-400" />
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
                className="inline-flex h-8 w-8 items-center justify-center rounded-xl border border-border/80 bg-background text-muted-foreground hover:text-foreground transition-colors shrink-0"
                title="Open in new tab"
              >
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            </div>

            {isAsymmetric ? (
              <div className="rounded-2xl bg-purple-500/5 border border-purple-500/20 p-4 text-xs text-muted-foreground flex items-start gap-3 mt-2">
                <div className="p-1.5 rounded-lg bg-purple-500/10 text-purple-400 shrink-0 mt-0.5">
                  <Key className="h-4 w-4" />
                </div>
                <div className="flex flex-col gap-1">
                  <span className="font-semibold text-foreground">RSA-OAEP Recipient Encryption</span>
                  <p className="leading-relaxed text-[11px]">
                    The AES-256 key is sealed with the recipient&apos;s RSA-2048 public key and stored in{' '}
                    <code className="font-mono bg-purple-500/10 px-1 py-0.5 rounded text-purple-300">adata[4]</code>.
                    The URL ends in <code className="font-mono bg-purple-500/10 px-1 py-0.5 rounded text-purple-300">#asym</code> —{' '}
                    <strong>no decryption key is in the URL</strong>. Only the holder of the matching private key can decrypt.
                  </p>
                </div>
              </div>
            ) : (
              <div className="rounded-2xl bg-blue-500/5 border border-blue-500/15 p-4 text-xs text-muted-foreground flex items-start gap-3 mt-2">
                <div className="p-1.5 rounded-lg bg-blue-500/10 text-blue-400 shrink-0 mt-0.5">
                  <Key className="h-4 w-4" />
                </div>
                <div className="flex flex-col gap-1">
                  <span className="font-semibold text-foreground">Zero-Knowledge Architecture</span>
                  <p className="leading-relaxed text-[11px]">
                    The decryption key <code className="font-mono bg-blue-500/10 px-1 py-0.5 rounded text-blue-300">#{result.rawKeyBase58.slice(0, 8)}...</code> is located after the URL hash fragment. Browsers <strong>never</strong> send hash fragments to web servers, guaranteeing only holders of this link can decrypt your content.
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* QR Code Section */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 rounded-2xl bg-background/40 border border-border/40">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-muted/60 border border-border/50 text-muted-foreground">
              <QrCode className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-semibold text-foreground">Mobile & In-Person Sharing</p>
              <p className="text-[11px] text-muted-foreground">Scan or share this paste directly with mobile devices</p>
            </div>
          </div>
          <Badge variant="outline" className="text-xs text-muted-foreground border-border/60">
            QR Scanner Ready
          </Badge>
        </div>

        {/* Collapsible Delete Token Section */}
        <div className="border-t border-border/40 pt-4 flex flex-col gap-3">
          <button
            type="button"
            onClick={() => setShowDeleteSection(!showDeleteSection)}
            className="flex items-center justify-between text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            <span className="flex items-center gap-1.5 text-destructive/80 font-medium">
              <Trash2 className="h-3.5 w-3.5 text-destructive/70" />
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
                  <div className="p-3 rounded-xl bg-destructive/10 border border-destructive/30 text-destructive text-xs font-medium flex items-center gap-2">
                    <Check className="h-4 w-4 text-emerald-400" />
                    <span>Paste has been permanently destroyed and deleted from server!</span>
                  </div>
                ) : (
                  <>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      If you need to manually destroy this paste immediately before it expires, use this secret deletion token:
                    </p>
                    <div className="flex items-center gap-2 p-2 rounded-xl bg-background/90 border border-border/80">
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
                        className="shrink-0 text-xs h-7"
                      >
                        {tokenCopied ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
                        <span className="ml-1">{tokenCopied ? 'Copied' : 'Copy'}</span>
                      </Button>
                    </div>

                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={handleDelete}
                      disabled={isDeleting}
                      className="w-full text-xs h-8 gap-1.5 font-medium mt-1"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      <span>{isDeleting ? 'Deleting...' : '🗑 Destroy Paste on Server Now'}</span>
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
