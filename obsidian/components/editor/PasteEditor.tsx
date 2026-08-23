'use client';

import * as React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Lock,
  Flame,
  Clock,
  Code2,
  FileText,
  Sparkles,
  AlertCircle,
  Loader2,
  MessageSquare,
  Shield,
  Layers,
  Info,
  User,
  Users,
  Key,
  ShieldCheck,
  Eye,
  PenLine,
} from 'lucide-react';
import { MarkdownPreview } from '@/components/ui/markdown-preview';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { RecipientKeyInput } from '@/components/editor/RecipientKeyInput';
import type { Expiry } from '@/lib/api/schemas';
import type { EncryptionOptions, EncryptionResult } from '@/hooks/usePasteEncryption';

type DeliveryTarget = 'single' | 'multiple';
type SingleUserSubMode = 'symmetric' | 'asymmetric';

interface PasteEditorProps {
  onEncrypt: (
    plaintext: string,
    options: EncryptionOptions
  ) => Promise<EncryptionResult | null>;
  isLoading: boolean;
  error: string | null;
}

export function PasteEditor({ onEncrypt, isLoading, error }: PasteEditorProps) {
  const [content, setContent] = React.useState('');
  const [formatter, setFormatter] =
    React.useState<'plaintext' | 'markdown' | 'syntaxhighlighting'>('plaintext');
  const [expire, setExpire] = React.useState<Expiry>('1day');
  const [burnAfterReading, setBurnAfterReading] = React.useState(true);
  const [openDiscussion, setOpenDiscussion] = React.useState(false);

  // Editor mode for markdown: 'write' vs 'preview'
  const [editorTab, setEditorTab] = React.useState<'write' | 'preview'>('write');

  // Top-level mutually exclusive delivery mode: 'single' vs 'multiple'
  const [deliveryTarget, setDeliveryTarget] = React.useState<DeliveryTarget>('single');
  // Single user sub-mode: 'symmetric' (active) vs 'asymmetric'
  const [singleSubMode, setSingleSubMode] = React.useState<SingleUserSubMode>('symmetric');

  // Asymmetric RSA-OAEP recipient public key
  const [recipientPublicKey, setRecipientPublicKey] = React.useState('');
  const [validRecipientKey, setValidRecipientKey] = React.useState<string | null>(null);

  // Shamir Secret Sharing state (active when deliveryTarget === 'multiple')
  const [threshold, setThreshold] = React.useState(2);
  const [totalShares, setTotalShares] = React.useState(3);

  const isShamir = deliveryTarget === 'multiple';
  const isAsymmetric = deliveryTarget === 'single' && singleSubMode === 'asymmetric';

  const lineCount = content ? content.split('\n').length : 1;
  const charCount = content.length;
  const byteCount = new TextEncoder().encode(content).length;

  const handleFormatterChange = (newFormatter: 'plaintext' | 'markdown' | 'syntaxhighlighting') => {
    setFormatter(newFormatter);
    if (newFormatter !== 'markdown') {
      setEditorTab('write');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim() || isLoading) return;

    // Guard: asymmetric mode requires a validated recipient key
    if (isAsymmetric && !validRecipientKey) {
      return;
    }

    await onEncrypt(content, {
      formatter,
      expire,
      burnAfterReading: isShamir ? false : burnAfterReading,
      openDiscussion,
      isShamir,
      threshold,
      totalShares,
      isAsymmetric,
      recipientPublicKey: isAsymmetric ? (validRecipientKey ?? '') : undefined,
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const handleThresholdChange = (val: number) => {
    setThreshold(val);
    if (val > totalShares) {
      setTotalShares(val);
    }
  };

  const handleTotalSharesChange = (val: number) => {
    setTotalShares(val);
    if (val < threshold) {
      setThreshold(val);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -12 }}
      transition={{ duration: 0.35, ease: 'easeOut' }}
      className="w-full max-w-4xl mx-auto flex flex-col gap-5"
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
        {/* ── Top-Level Mutually Exclusive Recipient Selector ─────────────── */}
        <div className="glass-panel rounded-3xl p-3 sm:p-4.5 border border-primary/20 bg-background/60 shadow-xl backdrop-blur-xl">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div className="flex flex-col">
              <span className="font-girard text-sm sm:text-base font-normal tracking-wide text-foreground">
                Delivery Target
              </span>
              <span className="text-[11px] text-muted-foreground">
                Select 1:1 individual encryption or multi-party threshold quorum
              </span>
            </div>

            {/* Mutually Exclusive Mode Toggle Buttons */}
            <div className="grid grid-cols-2 gap-1.5 p-1 bg-muted/70 rounded-2xl border border-border/60">
              {/* Single Recipient Option */}
              <button
                type="button"
                onClick={() => setDeliveryTarget('single')}
                className={`flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
                  deliveryTarget === 'single'
                    ? 'bg-background text-foreground shadow-md ring-1 ring-primary/30 text-primary'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <User className="h-4 w-4" />
                <span>Single Recipient</span>
              </button>

              {/* Multiple Recipients Option */}
              <button
                type="button"
                onClick={() => setDeliveryTarget('multiple')}
                className={`flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
                  deliveryTarget === 'multiple'
                    ? 'bg-background text-foreground shadow-md ring-1 ring-primary/30 text-primary'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <Users className="h-4 w-4" />
                <span>Multiple Recipients</span>
              </button>
            </div>
          </div>
        </div>

        {/* ── Main Editor Card ────────────────────────────────────────────── */}
        <div className="glass-panel rounded-3xl p-5 sm:p-7 border border-primary/20 bg-background/70 shadow-2xl backdrop-blur-2xl transition-all duration-300 focus-within:ring-2 focus-within:ring-primary/40 focus-within:shadow-[0_0_40px_-5px_rgba(59,130,246,0.25)]">
          {/* Editor Header / Format Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 pb-3.5 mb-3 border-b border-border/40">
            <div className="flex items-center gap-1.5 p-1 rounded-2xl bg-muted/70 border border-border/50">
              <button
                type="button"
                onClick={() => handleFormatterChange('plaintext')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-all ${
                  formatter === 'plaintext'
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <FileText className="h-3.5 w-3.5" />
                Plain Text
              </button>
              <button
                type="button"
                onClick={() => handleFormatterChange('markdown')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-all ${
                  formatter === 'markdown'
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <Sparkles className="h-3.5 w-3.5 text-purple-400" />
                Markdown
              </button>
              <button
                type="button"
                onClick={() => handleFormatterChange('syntaxhighlighting')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-all ${
                  formatter === 'syntaxhighlighting'
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <Code2 className="h-3.5 w-3.5 text-blue-400" />
                Source Code
              </button>
            </div>

            {/* Markdown Write / Preview Toggle */}
            {formatter === 'markdown' && (
              <div className="flex items-center gap-1 p-0.5 rounded-xl bg-muted/70 border border-border/60 text-xs">
                <button
                  type="button"
                  onClick={() => setEditorTab('write')}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg transition-all font-medium ${
                    editorTab === 'write'
                      ? 'bg-background text-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <PenLine className="h-3 w-3" />
                  <span>Write</span>
                </button>
                <button
                  type="button"
                  onClick={() => setEditorTab('preview')}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg transition-all font-medium ${
                    editorTab === 'preview'
                      ? 'bg-background text-primary shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <Eye className="h-3 w-3" />
                  <span>Preview</span>
                </button>
              </div>
            )}

            {/* Quick counters */}
            <div className="flex items-center gap-2 text-xs text-muted-foreground font-mono">
              <span>{lineCount} {lineCount === 1 ? 'line' : 'lines'}</span>
              <span>•</span>
              <span>{charCount.toLocaleString()} chars</span>
              <span>•</span>
              <span>{(byteCount / 1024).toFixed(1)} KB</span>
            </div>
          </div>

          {/* Text Area vs Live Markdown Preview */}
          <div className="relative">
            {formatter === 'markdown' && editorTab === 'preview' ? (
              <div className="w-full min-h-[260px] p-4 rounded-2xl bg-black/40 border border-white/5 overflow-y-auto">
                <MarkdownPreview content={content} />
              </div>
            ) : (
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={
                  formatter === 'markdown'
                    ? '# Confidential Document\n\nWrite your secret notes with **Markdown** formatting...\n\n- [x] Tasks & Checklists\n- Supports tables, links, and code blocks `const secret = ...`\n\nClick the **Preview** tab above to view rendered output.'
                    : 'Paste or type confidential secrets, API keys, credentials, or private notes here...\n\nEverything is encrypted using AES-256-GCM directly inside your browser before transmission.'
                }
                rows={13}
                required
                className="w-full resize-y min-h-[260px] bg-transparent border-0 font-mono text-sm leading-relaxed text-foreground placeholder:text-muted-foreground/45 focus:outline-none"
                spellCheck={false}
                autoFocus
              />
            )}
          </div>

          {/* Bottom helper info */}
          <div className="flex items-center justify-between pt-3.5 mt-2 border-t border-border/30 text-xs text-muted-foreground">
            <div className="flex items-center gap-1.5">
              <Shield className="h-3.5 w-3.5 text-blue-400" />
              <span>SubtleCrypto AES-256-GCM &bull; Client-Side PBKDF2</span>
            </div>
            <div className="hidden sm:block text-[11px] font-mono">
              Press <kbd className="px-1.5 py-0.5 rounded bg-muted/80 border border-border/60">⌘+Enter</kbd> to encrypt
            </div>
          </div>
        </div>

        {/* ── Mode-Specific Security & Encryption Configuration ─────────────── */}
        <AnimatePresence mode="wait">
          {deliveryTarget === 'single' ? (
            /* ── Single User Configuration: Symmetric vs Asymmetric ─────── */
            <motion.div
              key="single-user-config"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
              className="glass-panel rounded-3xl p-4 sm:p-5 flex flex-col gap-4 border border-primary/20 bg-background/60"
            >
              <div className="flex items-center justify-between flex-wrap gap-2 pb-2 border-b border-border/40">
                <div className="flex items-center gap-2">
                  <User className="h-4 w-4 text-primary" />
                  <span className="font-girard text-sm font-normal tracking-wide text-foreground">
                    1:1 Encryption Channel
                  </span>
                </div>
                <Badge variant="glow" className="text-[10px]">
                  Direct Delivery
                </Badge>
              </div>

              {/* Sub-mode choices: Symmetric vs Asymmetric */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* 1. Symmetric Link Mode */}
                <div
                  onClick={() => setSingleSubMode('symmetric')}
                  className={`p-3.5 rounded-2xl border cursor-pointer transition-all flex flex-col gap-2 ${
                    singleSubMode === 'symmetric'
                      ? 'bg-primary/10 border-primary/50 ring-1 ring-primary/30'
                      : 'bg-background/40 border-border/60 hover:border-border'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-xs font-semibold text-foreground">
                      <Key className="h-4 w-4 text-blue-400" />
                      <span>Symmetric Key in #Fragment</span>
                    </div>
                    <Badge variant="success" className="text-[9px] py-0 px-1.5">
                      Standard
                    </Badge>
                  </div>
                  <p className="text-[11px] text-muted-foreground leading-relaxed">
                    Decryption key stays in the URL fragment (<code className="font-mono text-blue-300">#key</code>). Never sent to the server. Recipient opens link to decrypt instantly.
                  </p>
                </div>

                {/* 2. Asymmetric RSA-OAEP Mode */}
                <div
                  onClick={() => setSingleSubMode('asymmetric')}
                  className={`p-3.5 rounded-2xl border cursor-pointer transition-all flex flex-col gap-2 ${
                    singleSubMode === 'asymmetric'
                      ? 'bg-purple-500/10 border-purple-500/40 ring-1 ring-purple-500/30'
                      : 'bg-background/40 border-border/60 hover:border-border'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-xs font-semibold text-foreground">
                      <ShieldCheck className="h-4 w-4 text-purple-400" />
                      <span>Asymmetric RSA-OAEP</span>
                    </div>
                    <Badge variant="outline" className="text-[9px] py-0 px-1.5 border-purple-500/50 text-purple-300">
                      Zero-URL-Key
                    </Badge>
                  </div>
                  <p className="text-[11px] text-muted-foreground leading-relaxed">
                    Encrypt specifically for recipient&apos;s RSA Public Key. Only the matching private key in their browser can unlock the AES key.
                  </p>
                </div>
              </div>

              {/* Asymmetric mode: recipient key input */}
              <AnimatePresence>
                {singleSubMode === 'asymmetric' && (
                  <motion.div
                    key="asym-input"
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden"
                  >
                    <RecipientKeyInput
                      value={recipientPublicKey}
                      onChange={setRecipientPublicKey}
                      onKeyChange={setValidRecipientKey}
                    />
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          ) : (
            /* ── Multiple Users Configuration: Shamir SSS Quorum ─────────── */
            <motion.div
              key="multi-user-config"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
              className="glass-panel rounded-3xl p-4 sm:p-5 flex flex-col gap-4 border border-blue-500/30 bg-background/60"
            >
              <div className="flex items-center justify-between flex-wrap gap-2 pb-2 border-b border-border/40">
                <div className="flex items-center gap-2">
                  <Layers className="h-4 w-4 text-primary" />
                  <span className="font-girard text-sm font-normal tracking-wide text-foreground">
                    Shamir&apos;s Secret Sharing Quorum
                  </span>
                </div>
                <Badge variant="glow" className="text-[10px]">
                  {threshold}-of-{totalShares} Quorum
                </Badge>
              </div>

              {/* Shamir Sliders */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Threshold (k) */}
                <div className="flex flex-col gap-1.5 p-3.5 rounded-2xl bg-background/60 border border-border/60">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-foreground">
                      Required Threshold ($K$)
                    </span>
                    <Badge variant="glow" className="font-mono text-[11px]">
                      {threshold} Shards
                    </Badge>
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    Minimum shards required to reconstruct and decrypt
                  </p>
                  <input
                    type="range"
                    min={2}
                    max={10}
                    value={threshold}
                    onChange={(e) => handleThresholdChange(parseInt(e.target.value, 10))}
                    className="w-full h-1.5 bg-muted rounded-lg appearance-none cursor-pointer accent-primary mt-1"
                  />
                  <div className="flex justify-between text-[10px] text-muted-foreground font-mono px-0.5">
                    <span>2</span>
                    <span>4</span>
                    <span>6</span>
                    <span>8</span>
                    <span>10</span>
                  </div>
                </div>

                {/* Total Shares (n) */}
                <div className="flex flex-col gap-1.5 p-3.5 rounded-2xl bg-background/60 border border-border/60">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-foreground">
                      Total Shares ($N$)
                    </span>
                    <Badge variant="glow" className="font-mono text-[11px]">
                      {totalShares} Shards
                    </Badge>
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    Total unique shard links generated to distribute
                  </p>
                  <input
                    type="range"
                    min={2}
                    max={10}
                    value={totalShares}
                    onChange={(e) => handleTotalSharesChange(parseInt(e.target.value, 10))}
                    className="w-full h-1.5 bg-muted rounded-lg appearance-none cursor-pointer accent-primary mt-1"
                  />
                  <div className="flex justify-between text-[10px] text-muted-foreground font-mono px-0.5">
                    <span>2</span>
                    <span>4</span>
                    <span>6</span>
                    <span>8</span>
                    <span>10</span>
                  </div>
                </div>
              </div>

              {/* Quorum Explanation */}
              <div className="p-3 rounded-2xl bg-blue-500/10 border border-blue-500/20 text-xs text-blue-300 flex items-start gap-2.5">
                <Info className="h-4 w-4 shrink-0 mt-0.5 text-blue-400" />
                <span>
                  Any <strong>{threshold}</strong> of the <strong>{totalShares}</strong> generated shard links must be combined by recipients to reconstruct the decryption key. Individual shards reveal zero data.
                </span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Standard Options Bar (Expiry, Burn, Discussion, Submit) ──────── */}
        <div className="glass-panel rounded-3xl p-4 sm:p-5 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 border border-primary/20 bg-background/70 shadow-xl backdrop-blur-2xl">
          <div className="flex flex-wrap items-center gap-3 sm:gap-4">
            {/* Expiry Selector */}
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-blue-400 shrink-0" />
              <label htmlFor="expiry-select" className="text-xs font-medium text-muted-foreground shrink-0">
                Expires in:
              </label>
              <select
                id="expiry-select"
                value={expire}
                onChange={(e) => setExpire(e.target.value as Expiry)}
                className="h-9 rounded-xl bg-background/90 border border-border/80 px-2.5 py-1 text-xs font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-primary cursor-pointer"
              >
                <option value="5min">5 minutes</option>
                <option value="10min">10 minutes</option>
                <option value="1hour">1 hour</option>
                <option value="1day">1 day (Default)</option>
                <option value="1week">1 week</option>
                <option value="1month">1 month</option>
                <option value="never">Never (Persistent)</option>
              </select>
            </div>

            <div className="h-5 w-[1px] bg-border/60 hidden sm:block" />

            {/* Burn After Reading Toggle (Single user only) */}
            {!isShamir ? (
              <label className="flex items-center gap-2 cursor-pointer select-none group">
                <input
                  type="checkbox"
                  checked={burnAfterReading}
                  onChange={(e) => setBurnAfterReading(e.target.checked)}
                  className="h-4 w-4 rounded border-border text-primary focus:ring-primary focus:ring-offset-0 bg-background/80 cursor-pointer"
                />
                <div className="flex items-center gap-1.5">
                  <Flame className={`h-4 w-4 transition-colors ${burnAfterReading ? 'text-amber-400' : 'text-muted-foreground'}`} />
                  <span className="text-xs font-medium text-foreground group-hover:text-primary transition-colors">
                    Burn after reading
                  </span>
                </div>
                {burnAfterReading && (
                  <Badge variant="warning" className="text-[10px] py-0 px-1.5">
                    1 view
                  </Badge>
                )}
              </label>
            ) : (
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Badge variant="outline" className="text-[10px]">
                  Multi-shard access
                </Badge>
              </div>
            )}

            {/* Open Discussion Toggle */}
            <label className="flex items-center gap-2 cursor-pointer select-none group">
              <input
                type="checkbox"
                checked={openDiscussion}
                onChange={(e) => setOpenDiscussion(e.target.checked)}
                className="h-4 w-4 rounded border-border text-primary focus:ring-primary focus:ring-offset-0 bg-background/80 cursor-pointer"
              />
              <div className="flex items-center gap-1.5">
                <MessageSquare className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
                <span className="text-xs font-medium text-foreground group-hover:text-primary transition-colors">
                  Open discussion
                </span>
              </div>
            </label>
          </div>

          {/* Submit Action */}
          <Button
            type="submit"
            size="lg"
            variant="glow"
            disabled={
              !content.trim() ||
              isLoading ||
              (isAsymmetric && !validRecipientKey)
            }
            className="w-full md:w-auto min-w-[200px] font-semibold gap-2 transition-all shadow-lg rounded-2xl h-11"
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>
                  {isShamir
                    ? 'Splitting & Encrypting...'
                    : isAsymmetric
                    ? 'Wrapping Key & Encrypting...'
                    : 'Encrypting & Storing...'}
                </span>
              </>
            ) : (
              <>
                {isShamir ? (
                  <Layers className="h-4 w-4" />
                ) : isAsymmetric ? (
                  <ShieldCheck className="h-4 w-4" />
                ) : (
                  <Lock className="h-4 w-4" />
                )}
                <span>
                  {isShamir
                    ? `Encrypt & Split (${threshold}/${totalShares})`
                    : isAsymmetric
                    ? 'Encrypt for Recipient'
                    : 'Encrypt & Share'}
                </span>
              </>
            )}
          </Button>
        </div>

        {/* Error Alert */}
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-2.5 p-4 rounded-2xl border border-destructive/40 bg-destructive/10 text-destructive text-sm"
          >
            <AlertCircle className="h-5 w-5 shrink-0" />
            <span>{error}</span>
          </motion.div>
        )}
      </form>
    </motion.div>
  );
}
