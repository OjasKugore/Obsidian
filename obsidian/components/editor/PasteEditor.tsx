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
    <div className="w-full max-w-4xl mx-auto flex flex-col gap-4">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        {/* ── Top-Level Mutually Exclusive Recipient Selector ─────────────── */}
        <div className="rounded-xl p-3.5 border border-border/50 bg-card/60 backdrop-blur-md">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div className="flex flex-col">
              <span className="text-xs font-semibold text-foreground tracking-tight">
                Delivery Mode
              </span>
              <span className="text-[11px] text-muted-foreground">
                Choose 1-to-1 recipient encryption or multi-party Shamir threshold quorum
              </span>
            </div>

            {/* Mode Switcher */}
            <div className="grid grid-cols-2 gap-1 p-1 bg-muted/60 rounded-lg border border-border/40">
              <button
                type="button"
                onClick={() => setDeliveryTarget('single')}
                className={`flex items-center justify-center gap-2 px-3.5 py-1.5 rounded-md text-xs font-medium transition-all ${
                  deliveryTarget === 'single'
                    ? 'bg-background text-foreground shadow-sm ring-1 ring-border'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <User className="h-3.5 w-3.5" />
                <span>Single Recipient</span>
              </button>

              <button
                type="button"
                onClick={() => setDeliveryTarget('multiple')}
                className={`flex items-center justify-center gap-2 px-3.5 py-1.5 rounded-md text-xs font-medium transition-all ${
                  deliveryTarget === 'multiple'
                    ? 'bg-background text-foreground shadow-sm ring-1 ring-border'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <Users className="h-3.5 w-3.5" />
                <span>Multiple Recipients</span>
              </button>
            </div>
          </div>
        </div>

        {/* ── Main Editor Card ────────────────────────────────────────────── */}
        <div className="rounded-xl p-4 sm:p-5 border border-border/60 bg-card/80 shadow-lg backdrop-blur-lg transition-all focus-within:border-primary/50">
          {/* Editor Header / Format Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 pb-3 mb-3 border-b border-border/40">
            <div className="flex items-center gap-1 p-1 rounded-lg bg-muted/60 border border-border/40">
              <button
                type="button"
                onClick={() => handleFormatterChange('plaintext')}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-all ${
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
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-all ${
                  formatter === 'markdown'
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <Sparkles className="h-3.5 w-3.5 text-primary" />
                Markdown
              </button>
              <button
                type="button"
                onClick={() => handleFormatterChange('syntaxhighlighting')}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-all ${
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
              <div className="flex items-center gap-1 p-0.5 rounded-md bg-muted/70 border border-border/40 text-xs">
                <button
                  type="button"
                  onClick={() => setEditorTab('write')}
                  className={`flex items-center gap-1 px-2 py-0.5 rounded transition-all font-medium ${
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
                  className={`flex items-center gap-1 px-2 py-0.5 rounded transition-all font-medium ${
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
              <span>&bull;</span>
              <span>{charCount.toLocaleString()} chars</span>
              <span>&bull;</span>
              <span>{(byteCount / 1024).toFixed(1)} KB</span>
            </div>
          </div>

          {/* Text Area vs Live Markdown Preview */}
          <div className="relative">
            {formatter === 'markdown' && editorTab === 'preview' ? (
              <div className="w-full min-h-[260px] p-4 rounded-lg bg-black/40 border border-border/40 overflow-y-auto">
                <MarkdownPreview content={content} />
              </div>
            ) : (
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={
                  formatter === 'markdown'
                    ? '# Confidential Document\n\nWrite your secret notes with Markdown formatting...\n\n- Task items\n- Code blocks `const token = ...`'
                    : 'Paste confidential secrets, API tokens, configuration files, or private notes here...\n\nEverything is encrypted using AES-256-GCM directly inside your browser before transmission.'
                }
                rows={12}
                required
                className="w-full resize-y min-h-[240px] bg-transparent border-0 font-mono text-sm leading-relaxed text-foreground placeholder:text-muted-foreground/40 focus:outline-none"
                spellCheck={false}
                autoFocus
              />
            )}
          </div>

          {/* Bottom info */}
          <div className="flex items-center justify-between pt-3 mt-2 border-t border-border/40 text-xs text-muted-foreground">
            <div className="flex items-center gap-1.5">
              <Shield className="h-3.5 w-3.5 text-primary" />
              <span>SubtleCrypto AES-256-GCM &bull; Client-Side PBKDF2 (100k iterations)</span>
            </div>
            <div className="hidden sm:block text-[11px] font-mono text-muted-foreground/70">
              <kbd className="px-1.5 py-0.5 rounded bg-muted/80 border border-border/60">⌘+Enter</kbd> to encrypt
            </div>
          </div>
        </div>

        {/* ── Mode-Specific Security & Encryption Configuration ─────────────── */}
        <AnimatePresence mode="wait">
          {deliveryTarget === 'single' ? (
            /* ── Single User Configuration: Symmetric vs Asymmetric ─────── */
            <motion.div
              key="single-user-config"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.2 }}
              className="rounded-xl p-4 flex flex-col gap-3 border border-border/50 bg-card/60"
            >
              <div className="flex items-center gap-2 pb-2 border-b border-border/40">
                <User className="h-3.5 w-3.5 text-primary" />
                <span className="text-xs font-semibold uppercase tracking-wider text-foreground">
                  1-to-1 Encryption Channel
                </span>
              </div>

              {/* Sub-mode choices: Symmetric vs Asymmetric */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {/* 1. Symmetric Link Mode */}
                <div
                  onClick={() => setSingleSubMode('symmetric')}
                  className={`p-3 rounded-lg border cursor-pointer transition-all flex flex-col gap-1.5 ${
                    singleSubMode === 'symmetric'
                      ? 'bg-primary/10 border-primary/40'
                      : 'bg-background/40 border-border/40 hover:border-border'
                  }`}
                >
                  <div className="flex items-center gap-2 text-xs font-medium text-foreground">
                    <Key className="h-3.5 w-3.5 text-primary" />
                    <span>Symmetric Key in URL Fragment</span>
                  </div>
                  <p className="text-[11px] text-muted-foreground leading-relaxed">
                    Decryption key stays after the URL hash fragment (<code className="font-mono text-primary/80">#key</code>). Never sent to the server.
                  </p>
                </div>

                {/* 2. Asymmetric RSA-OAEP Mode */}
                <div
                  onClick={() => setSingleSubMode('asymmetric')}
                  className={`p-3 rounded-lg border cursor-pointer transition-all flex flex-col gap-1.5 ${
                    singleSubMode === 'asymmetric'
                      ? 'bg-primary/10 border-primary/40'
                      : 'bg-background/40 border-border/40 hover:border-border'
                  }`}
                >
                  <div className="flex items-center gap-2 text-xs font-medium text-foreground">
                    <ShieldCheck className="h-3.5 w-3.5 text-primary" />
                    <span>Asymmetric RSA-OAEP</span>
                  </div>
                  <p className="text-[11px] text-muted-foreground leading-relaxed">
                    Encrypt specifically for recipient&apos;s RSA Public Key. No decryption key in the URL.
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
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.2 }}
              className="rounded-xl p-4 flex flex-col gap-3 border border-border/50 bg-card/60"
            >
              <div className="flex items-center justify-between pb-2 border-b border-border/40">
                <div className="flex items-center gap-2">
                  <Layers className="h-3.5 w-3.5 text-primary" />
                  <span className="text-xs font-semibold uppercase tracking-wider text-foreground">
                    Shamir&apos;s Secret Sharing Quorum
                  </span>
                </div>
                <span className="text-xs font-mono text-muted-foreground">
                  {threshold}-of-{totalShares} Required
                </span>
              </div>

              {/* Shamir Sliders */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Threshold (k) */}
                <div className="flex flex-col gap-1 p-3 rounded-lg bg-background/50 border border-border/40">
                  <div className="flex items-center justify-between text-xs font-medium text-foreground">
                    <span>Required Threshold (K)</span>
                    <span className="font-mono text-primary font-semibold">{threshold} Shards</span>
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
                <div className="flex flex-col gap-1 p-3 rounded-lg bg-background/50 border border-border/40">
                  <div className="flex items-center justify-between text-xs font-medium text-foreground">
                    <span>Total Shares (N)</span>
                    <span className="font-mono text-primary font-semibold">{totalShares} Shards</span>
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
              <div className="p-2.5 rounded-lg bg-muted/40 border border-border/40 text-xs text-muted-foreground flex items-start gap-2">
                <Info className="h-4 w-4 shrink-0 mt-0.5 text-primary" />
                <span>
                  Any <strong>{threshold}</strong> of the <strong>{totalShares}</strong> generated shard links must be combined by recipients to reconstruct the decryption key. Individual shards reveal zero data.
                </span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Standard Options Bar (Expiry, Burn, Discussion, Submit) ──────── */}
        <div className="rounded-xl p-3.5 sm:p-4 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 border border-border/50 bg-card/70 shadow-md">
          <div className="flex flex-wrap items-center gap-3 sm:gap-4">
            {/* Expiry Selector */}
            <div className="flex items-center gap-2">
              <Clock className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              <label htmlFor="expiry-select" className="text-xs font-medium text-muted-foreground shrink-0">
                Expires in:
              </label>
              <select
                id="expiry-select"
                value={expire}
                onChange={(e) => setExpire(e.target.value as Expiry)}
                className="h-8 rounded-md bg-background border border-border px-2.5 py-1 text-xs font-medium text-foreground focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer"
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

            <div className="h-4 w-[1px] bg-border/60 hidden sm:block" />

            {/* Burn After Reading Toggle (Single user only) */}
            {!isShamir ? (
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={burnAfterReading}
                  onChange={(e) => setBurnAfterReading(e.target.checked)}
                  className="h-3.5 w-3.5 rounded border-border text-primary focus:ring-primary focus:ring-offset-0 bg-background cursor-pointer"
                />
                <div className="flex items-center gap-1.5">
                  <Flame className={`h-3.5 w-3.5 ${burnAfterReading ? 'text-amber-400' : 'text-muted-foreground'}`} />
                  <span className="text-xs font-medium text-foreground">
                    Burn after reading (1 view)
                  </span>
                </div>
              </label>
            ) : (
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <span>Multi-party distribution</span>
              </div>
            )}

            {/* Open Discussion Toggle */}
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={openDiscussion}
                onChange={(e) => setOpenDiscussion(e.target.checked)}
                className="h-3.5 w-3.5 rounded border-border text-primary focus:ring-primary focus:ring-offset-0 bg-background cursor-pointer"
              />
              <div className="flex items-center gap-1.5">
                <MessageSquare className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-xs font-medium text-foreground">
                  Open discussion
                </span>
              </div>
            </label>
          </div>

          {/* Submit Action */}
          <Button
            type="submit"
            size="default"
            disabled={
              !content.trim() ||
              isLoading ||
              (isAsymmetric && !validRecipientKey)
            }
            className="w-full md:w-auto min-w-[180px] font-medium gap-2 transition-all shadow-md h-9 text-xs"
          >
            {isLoading ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                <span>
                  {isShamir
                    ? 'Splitting & Encrypting...'
                    : isAsymmetric
                    ? 'Wrapping Key...'
                    : 'Encrypting...'}
                </span>
              </>
            ) : (
              <>
                {isShamir ? (
                  <Layers className="h-3.5 w-3.5" />
                ) : isAsymmetric ? (
                  <ShieldCheck className="h-3.5 w-3.5" />
                ) : (
                  <Lock className="h-3.5 w-3.5" />
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
          <div className="flex items-center gap-2.5 p-3 rounded-lg border border-destructive/40 bg-destructive/10 text-destructive text-xs">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}
      </form>
    </div>
  );
}
