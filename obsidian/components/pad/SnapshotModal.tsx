'use client';

/**
 * components/pad/SnapshotModal.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Modal to snapshot and freeze a Live Pad session into an immutable,
 * end-to-end encrypted paste with custom expiration and burn policies.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import * as React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  Camera,
  Shield,
  Key,
  Copy,
  Check,
  ExternalLink,
  Flame,
  Clock,
  Loader2,
  Users,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { usePasteEncryption } from '@/hooks/usePasteEncryption';
import type { Expiry } from '@/lib/api/schemas';

interface SnapshotModalProps {
  isOpen: boolean;
  onClose: () => void;
  padContent: string;
}

export function SnapshotModal({ isOpen, onClose, padContent }: SnapshotModalProps) {
  const { encryptAndSubmit, isLoading, error, result, reset } = usePasteEncryption();

  const [formatter, setFormatter] = React.useState<'plaintext' | 'markdown' | 'syntaxhighlighting'>('markdown');
  const [expire, setExpire] = React.useState<Expiry>('1day');
  const [burnAfterReading, setBurnAfterReading] = React.useState(true);
  const [copiedLink, setCopiedLink] = React.useState(false);
  const [copiedToken, setCopiedToken] = React.useState(false);

  React.useEffect(() => {
    if (isOpen) {
      reset();
      setCopiedLink(false);
      setCopiedToken(false);
    }
  }, [isOpen, reset]);

  const handleCreateSnapshot = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!padContent.trim() || isLoading) return;

    await encryptAndSubmit(padContent, {
      formatter,
      expire,
      burnAfterReading,
      openDiscussion: false,
    });
  };

  const copyText = async (text: string, type: 'link' | 'token') => {
    try {
      await navigator.clipboard.writeText(text);
      if (type === 'link') {
        setCopiedLink(true);
        setTimeout(() => setCopiedLink(false), 2000);
      } else {
        setCopiedToken(true);
        setTimeout(() => setCopiedToken(false), 2000);
      }
    } catch {
      // fallback
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 8 }}
        className="w-full max-w-lg rounded-2xl border border-border bg-card p-6 shadow-2xl font-mono flex flex-col gap-5 relative overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border pb-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-foreground text-background">
              <Camera className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-foreground">
                Snapshot to Encrypted Paste
              </h2>
              <p className="text-[11px] text-muted-foreground">
                Freeze current live pad text into an immutable secret drop
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded text-muted-foreground hover:text-foreground cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Form or Result */}
        {!result ? (
          <form onSubmit={handleCreateSnapshot} className="flex flex-col gap-4">
            {error && (
              <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-xs text-destructive">
                {error}
              </div>
            )}

            {/* Content preview pill */}
            <div className="p-3 rounded-lg bg-background border border-border flex items-center justify-between text-xs text-muted-foreground">
              <span>Payload Size:</span>
              <span className="font-bold text-foreground font-mono">
                {padContent.length} chars ({new TextEncoder().encode(padContent).length} bytes)
              </span>
            </div>

            {/* Expiration selection */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-muted-foreground uppercase">
                Expiration
              </label>
              <select
                value={expire}
                onChange={(e) => setExpire(e.target.value as Expiry)}
                className="w-full h-9 rounded-lg bg-background border border-border px-3 text-xs font-mono text-foreground focus:outline-none"
              >
                <option value="5min">5 Minutes</option>
                <option value="10min">10 Minutes</option>
                <option value="1hour">1 Hour</option>
                <option value="1day">1 Day</option>
                <option value="1week">1 Week</option>
                <option value="1month">1 Month</option>
                <option value="never">Never (Persistent)</option>
              </select>
            </div>

            {/* Burn after reading checkbox */}
            <div className="p-3 rounded-lg bg-background border border-border flex items-center justify-between">
              <div className="flex flex-col">
                <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                  <Flame className="h-3.5 w-3.5 text-foreground" />
                  <span>Burn After 1 View</span>
                </span>
                <span className="text-[10px] text-muted-foreground">
                  Permanently deletes from server database upon first read
                </span>
              </div>
              <input
                type="checkbox"
                checked={burnAfterReading}
                onChange={(e) => setBurnAfterReading(e.target.checked)}
                className="h-4 w-4 accent-foreground cursor-pointer"
              />
            </div>

            {/* Format selection */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-muted-foreground uppercase">
                Format
              </label>
              <select
                value={formatter}
                onChange={(e) => setFormatter(e.target.value as any)}
                className="w-full h-9 rounded-lg bg-background border border-border px-3 text-xs font-mono text-foreground focus:outline-none"
              >
                <option value="markdown">Markdown</option>
                <option value="plaintext">Plain Text</option>
                <option value="syntaxhighlighting">Source Code</option>
              </select>
            </div>

            {/* Submit Button */}
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={onClose}
                className="text-xs font-mono"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={isLoading || !padContent.trim()}
                className="text-xs font-mono font-bold bg-foreground text-background hover:opacity-90 gap-1.5"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    <span>Encrypting...</span>
                  </>
                ) : (
                  <>
                    <Shield className="h-3.5 w-3.5" />
                    <span>Create Encrypted Snapshot</span>
                  </>
                )}
              </Button>
            </div>
          </form>
        ) : (
          /* Snapshot Created Success View */
          <div className="flex flex-col gap-4">
            <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-400 font-bold flex items-center gap-2">
              <Check className="h-4 w-4" />
              <span>Snapshot Created &amp; Encrypted Successfully!</span>
            </div>

            {/* Shareable Link */}
            <div className="flex flex-col gap-1">
              <span className="text-[10px] font-bold uppercase text-muted-foreground">
                Immutable Share Link (#key in fragment)
              </span>
              <div className="flex items-center gap-2 p-2 rounded-lg bg-background border border-border">
                <input
                  type="text"
                  readOnly
                  value={result.shareUrl}
                  className="w-full bg-transparent text-xs font-mono text-foreground focus:outline-none truncate"
                />
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => copyText(result.shareUrl, 'link')}
                  className="h-7 text-xs gap-1 shrink-0"
                >
                  {copiedLink ? (
                    <>
                      <Check className="h-3 w-3 text-emerald-400" />
                      <span className="text-emerald-400">Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy className="h-3 w-3" />
                      <span>Copy</span>
                    </>
                  )}
                </Button>
                <a
                  href={result.shareUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              </div>
            </div>

            {/* Delete Token */}
            <div className="flex flex-col gap-1">
              <span className="text-[10px] font-bold uppercase text-muted-foreground">
                Admin Deletion Token
              </span>
              <div className="flex items-center gap-2 p-2 rounded-lg bg-background border border-border">
                <input
                  type="text"
                  readOnly
                  value={result.deleteToken}
                  className="w-full bg-transparent text-xs font-mono text-muted-foreground focus:outline-none truncate"
                />
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => copyText(result.deleteToken, 'token')}
                  className="h-7 text-xs gap-1 shrink-0"
                >
                  {copiedToken ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
                </Button>
              </div>
            </div>

            <div className="flex justify-end pt-2 border-t border-border">
              <Button
                type="button"
                size="sm"
                onClick={onClose}
                className="text-xs font-mono bg-foreground text-background hover:opacity-90"
              >
                Done
              </Button>
            </div>
          </div>
        )}
      </motion.div>
    </div>
  );
}
