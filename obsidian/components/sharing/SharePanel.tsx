'use client';

import * as React from 'react';
import { motion } from 'framer-motion';
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
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { EncryptionResult } from '@/hooks/usePasteEncryption';

interface SharePanelProps {
  result: EncryptionResult;
  onReset: () => void;
}

export function SharePanel({ result, onReset }: SharePanelProps) {
  const [copied, setCopied] = React.useState(false);
  const [tokenCopied, setTokenCopied] = React.useState(false);
  const [showDeleteSection, setShowDeleteSection] = React.useState(false);

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
      // Confetti fallback (e.g. test environment)
    }
  }, []);

  const copyToClipboard = async (text: string, isToken: boolean = false) => {
    try {
      await navigator.clipboard.writeText(text);
      if (isToken) {
        setTokenCopied(true);
        setTimeout(() => setTokenCopied(false), 2000);
      } else {
        setCopied(true);
        setTimeout(() => setCopied(false), 2500);
      }
    } catch (err) {
      console.error('Failed to copy text: ', err);
    }
  };

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
              <ShieldCheck className="h-6 w-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
                Paste Encrypted & Stored
                <Badge variant="success" className="text-[11px]">Active</Badge>
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Paste ID: <span className="font-mono text-primary font-medium">{result.pasteId}</span>
              </p>
            </div>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={onReset}
            className="gap-1.5 text-xs font-medium border-border/80"
          >
            <PlusCircle className="h-3.5 w-3.5" />
            New Paste
          </Button>
        </div>

        {/* Share Link Box */}
        <div className="flex flex-col gap-2">
          <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center justify-between">
            <span>Encrypted Share Link</span>
            <span className="text-[11px] font-normal lowercase text-emerald-400 flex items-center gap-1">
              <Key className="h-3 w-3" /> Key in #hash fragment
            </span>
          </label>
          <div className="flex items-center gap-2 p-2 rounded-2xl bg-background/80 border border-border/80 focus-within:border-primary/60 focus-within:ring-2 focus-within:ring-primary/20 transition-all">
            <input
              type="text"
              readOnly
              value={result.shareUrl}
              onClick={(e) => (e.target as HTMLInputElement).select()}
              className="w-full bg-transparent px-3 py-2 text-sm font-mono text-foreground focus:outline-none truncate selection:bg-primary/30"
            />
            <Button
              variant={copied ? 'default' : 'glow'}
              size="default"
              onClick={() => copyToClipboard(result.shareUrl)}
              className="shrink-0 gap-1.5 font-semibold transition-all px-4"
            >
              {copied ? (
                <>
                  <Check className="h-4 w-4 text-emerald-300" />
                  <span>Copied!</span>
                </>
              ) : (
                <>
                  <Copy className="h-4 w-4" />
                  <span>Copy Link</span>
                </>
              )}
            </Button>
            <a
              href={result.shareUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="hidden sm:inline-flex"
            >
              <Button variant="glass" size="icon" title="Open in new tab">
                <ExternalLink className="h-4 w-4 text-muted-foreground" />
              </Button>
            </a>
          </div>
        </div>

        {/* Security Explanation Callout */}
        <div className="rounded-2xl bg-blue-500/5 border border-blue-500/15 p-4 text-xs text-muted-foreground flex items-start gap-3">
          <div className="p-1.5 rounded-lg bg-blue-500/10 text-blue-400 shrink-0 mt-0.5">
            <Key className="h-4 w-4" />
          </div>
          <div className="flex flex-col gap-1">
            <span className="font-semibold text-foreground">Zero-Knowledge Architecture</span>
            <p className="leading-relaxed">
              The decryption key <code className="font-mono bg-blue-500/10 px-1 py-0.5 rounded text-blue-300">#{result.rawKeyBase58.slice(0, 8)}...</code> is located after the URL hash fragment. Browsers <strong>never</strong> send hash fragments to web servers, guaranteeing only holders of this link can decrypt your content.
            </p>
          </div>
        </div>

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
            QR Scanner Available in Phase 4
          </Badge>
        </div>

        {/* Collapsible Delete Token Section */}
        <div className="border-t border-border/40 pt-4 flex flex-col gap-3">
          <button
            type="button"
            onClick={() => setShowDeleteSection(!showDeleteSection)}
            className="flex items-center justify-between text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            <span className="flex items-center gap-1.5">
              <Trash2 className="h-3.5 w-3.5 text-destructive/70" />
              Delete Token & API Management
            </span>
            {showDeleteSection ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </button>

          {showDeleteSection && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="flex flex-col gap-2.5 pt-2"
            >
              <p className="text-xs text-muted-foreground leading-relaxed">
                If you ever need to manually delete this paste before it expires, use your unique authorization token:
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
                  onClick={() => copyToClipboard(result.deleteToken, true)}
                  className="shrink-0 text-xs h-7"
                >
                  {tokenCopied ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
                  <span className="ml-1">{tokenCopied ? 'Copied' : 'Copy'}</span>
                </Button>
              </div>
            </motion.div>
          )}
        </div>
      </div>
    </motion.div>
  );
}
