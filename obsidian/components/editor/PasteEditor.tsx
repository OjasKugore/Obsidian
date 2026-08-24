'use client';

/**
 * components/editor/PasteEditor.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Primary Paste Editor Component.
 * Pure, rich layered charcoal, graphite, and slate grey tones.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import * as React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Shield,
  Loader2,
  Copy,
  Check,
  Download,
  AlertCircle,
  Eye,
  PenLine,
  Key,
  Users,
  User,
  Info,
  ShieldCheck,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { MarkdownPreview } from '@/components/ui/markdown-preview';
import { RecipientKeyInput } from '@/components/editor/RecipientKeyInput';
import type { EncryptionOptions, EncryptionResult } from '@/hooks/usePasteEncryption';
import type { Expiry } from '@/lib/api/schemas';

export type Formatter = 'plaintext' | 'markdown' | 'syntaxhighlighting';

interface PasteEditorProps {
  onEncrypt: (
    plaintext: string,
    options?: EncryptionOptions
  ) => Promise<EncryptionResult | null>;
  isLoading: boolean;
  error: string | null;
}

export function PasteEditor({ onEncrypt, isLoading, error }: PasteEditorProps) {
  // ── SETUP ──────────────────────────────────────────────────────────────

  // Editor text & format state (holds the typed text, selected syntax/format, and write/preview mode)
  const [content, setContent] = React.useState('');
  const [formatter, setFormatter] = React.useState<Formatter>('plaintext');
  const [editorTab, setEditorTab] = React.useState<'write' | 'preview'>('write');

  // Recipient & key delivery options (switches between single recipient and multi-user secret sharing)
  const [deliveryTarget, setDeliveryTarget] = React.useState<'single' | 'multiple'>('single');
  const [singleSubMode, setSingleSubMode] = React.useState<'symmetric' | 'asymmetric'>('symmetric');
  const [recipientPublicKey, setRecipientPublicKey] = React.useState('');
  const [validRecipientKey, setValidRecipientKey] = React.useState<string | null>(null);

  // Shamir secret sharing quorum config (sets minimum required key shares vs total generated shares)
  const [threshold, setThreshold] = React.useState<number>(2);
  const [totalShares, setTotalShares] = React.useState<number>(3);

  // Expiration & security toggles (handles expiration timers, burn-after-reading, and discussion threads)
  const [expire, setExpire] = React.useState<Expiry>('1day');
  const [burnAfterReading, setBurnAfterReading] = React.useState(false);
  const [openDiscussion, setOpenDiscussion] = React.useState(false);

  // Temporary UI state (tracks whether copy button was recently clicked)
  const [copied, setCopied] = React.useState(false);

  // Computed mode flags (quick checks to see if asymmetric encryption or Shamir sharing is active)
  const isAsymmetric = deliveryTarget === 'single' && singleSubMode === 'asymmetric';
  const isShamir = deliveryTarget === 'multiple';

  // Real-time text metrics (calculates line count, character count, and file size in KB)
  const lineCount = React.useMemo(
    () => (content ? content.split('\n').length : 1),
    [content]
  );
  const charCount = content.length;
  const byteCount = React.useMemo(
    () => new TextEncoder().encode(content).length,
    [content]
  );

  // ── ACTIONS ────────────────────────────────────────────────────────────

  // Changes active format (Plain text, Markdown, or Code)
  const handleFormatterChange = (next: Formatter) => {
    setFormatter(next);
    if (next !== 'markdown') {
      setEditorTab('write');
    }
  };

  // Copies editor text directly to the system clipboard
  const handleCopy = async () => {
    if (!content) return;
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy: ', err);
    }
  };

  // Triggers browser download of editor content as a text file
  const handleDownload = () => {
    if (!content) return;
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `obsidian-paste-${Date.now()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Clears the editor text area and resets view
  const handleClear = () => {
    setContent('');
    setEditorTab('write');
  };

  // Submits paste data and configuration options to the encryption engine
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim() || isLoading) return;

    await onEncrypt(content, {
      formatter,
      expire,
      burnAfterReading: isShamir ? false : burnAfterReading,
      openDiscussion,
      isShamir,
      threshold: isShamir ? threshold : undefined,
      totalShares: isShamir ? totalShares : undefined,
      recipientPublicKey: isAsymmetric ? validRecipientKey || undefined : undefined,
      isAsymmetric,
    });
  };

  // Keyboard shortcut handler (Cmd/Ctrl + Enter to trigger submission)
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  // Adjusts Shamir threshold count while keeping threshold <= total shares
  const handleThresholdChange = (val: number) => {
    setThreshold(val);
    if (val > totalShares) {
      setTotalShares(val);
    }
  };

  // Adjusts total Shamir shares count while keeping total shares >= threshold
  const handleTotalSharesChange = (val: number) => {
    setTotalShares(val);
    if (val < threshold) {
      setThreshold(val);
    }
  };

  // Dynamic tab label generator based on selected format
  const getFilename = () => {
    if (formatter === 'markdown') return 'DOCUMENT.MD';
    if (formatter === 'syntaxhighlighting') return 'SOURCE.CODE';
    return 'UNTITLED.TXT';
  };

  // ── UI ─────────────────────────────────────────────────────────────────

  return (
    <form onSubmit={handleSubmit} className="w-full flex flex-col gap-6 font-mono">
      {/* Page Header Title */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-3 border-b border-border/80">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
            New Paste
          </h1>
          <p className="text-xs text-muted-foreground mt-1">
            End-to-end client-side AES-256-GCM encrypted storage.
          </p>
        </div>
      </div>

      {/* Main Grid Layout (Left: Editor Window, Right: Security Sidebar) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column - Code Editor Window */}
        <div className="lg:col-span-8 flex flex-col border border-border/80 rounded-xl overflow-hidden bg-card/90 shadow-xl soft-shadow focus-within:border-foreground/40 transition-all">
          {/* Editor Top Toolbar & Format Selector */}
          <div className="h-10 border-b border-border flex items-center px-4 justify-between bg-muted/60 select-none">
            {/* Window Controls & Active Filename */}
            <div className="flex items-center gap-3">
              <div className="flex gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-muted-foreground/30 border border-border/60" />
                <span className="w-2.5 h-2.5 rounded-full bg-muted-foreground/30 border border-border/60" />
                <span className="w-2.5 h-2.5 rounded-full bg-muted-foreground/30 border border-border/60" />
              </div>
              <span className="text-[11px] font-mono font-semibold tracking-wider text-muted-foreground uppercase">
                {getFilename()}
              </span>
            </div>

            {/* Format Buttons (Plain / Markdown / Code) */}
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1 bg-background/80 p-0.5 rounded border border-border">
                <button
                  type="button"
                  onClick={() => handleFormatterChange('plaintext')}
                  className={`px-2 py-0.5 text-[10px] font-mono rounded transition-colors cursor-pointer ${formatter === 'plaintext'
                      ? 'bg-muted text-foreground font-bold shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                    }`}
                >
                  Plain
                </button>
                <button
                  type="button"
                  onClick={() => handleFormatterChange('markdown')}
                  className={`px-2 py-0.5 text-[10px] font-mono rounded transition-colors cursor-pointer ${formatter === 'markdown'
                      ? 'bg-muted text-foreground font-bold shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                    }`}
                >
                  Markdown
                </button>
                <button
                  type="button"
                  onClick={() => handleFormatterChange('syntaxhighlighting')}
                  className={`px-2 py-0.5 text-[10px] font-mono rounded transition-colors cursor-pointer ${formatter === 'syntaxhighlighting'
                      ? 'bg-muted text-foreground font-bold shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                    }`}
                >
                  Code
                </button>
              </div>

              {/* Write / Preview Tab Switcher for Markdown */}
              {formatter === 'markdown' && (
                <div className="flex items-center gap-1 bg-background/80 p-0.5 rounded border border-border">
                  <button
                    type="button"
                    onClick={() => setEditorTab('write')}
                    className={`px-1.5 py-0.5 text-[10px] font-mono rounded cursor-pointer ${editorTab === 'write' ? 'bg-muted text-foreground font-bold shadow-sm' : 'text-muted-foreground'
                      }`}
                  >
                    <PenLine className="h-3 w-3 inline mr-1" />
                    Write
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditorTab('preview')}
                    className={`px-1.5 py-0.5 text-[10px] font-mono rounded cursor-pointer ${editorTab === 'preview' ? 'bg-muted text-foreground font-bold shadow-sm' : 'text-muted-foreground'
                      }`}
                  >
                    <Eye className="h-3 w-3 inline mr-1" />
                    Preview
                  </button>
                </div>
              )}

              {/* Copy & Download Quick Action Buttons */}
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <button
                  type="button"
                  onClick={handleCopy}
                  title="Copy text"
                  className="p-1 hover:text-foreground transition-colors cursor-pointer"
                >
                  {copied ? <Check className="h-3.5 w-3.5 text-foreground" /> : <Copy className="h-3.5 w-3.5" />}
                </button>
                <button
                  type="button"
                  onClick={handleDownload}
                  title="Download file"
                  className="p-1 hover:text-foreground transition-colors cursor-pointer"
                >
                  <Download className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          </div>

          {/* Editor Canvas (Line Numbers & Textarea) */}
          <div className="flex flex-grow min-h-[440px] relative overflow-hidden bg-card">
            {/* Line Numbers Sidebar Gutter */}
            <div className="w-12 shrink-0 bg-muted/40 border-r border-border py-4 flex flex-col items-end pr-2.5 text-muted-foreground/70 font-mono text-xs select-none">
              {Array.from({ length: Math.max(lineCount, 16) }).map((_, i) => (
                <div key={i} className="leading-relaxed">
                  {i < lineCount ? i + 1 : ''}
                </div>
              ))}
            </div>

            {/* Text Input Canvas / Markdown Preview Render */}
            <div className="flex-1 relative bg-card">
              {formatter === 'markdown' && editorTab === 'preview' ? (
                <div className="w-full h-full min-h-[440px] p-4 text-foreground overflow-y-auto">
                  <MarkdownPreview content={content} />
                </div>
              ) : (
                <textarea
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="// Paste or type your secure code, API keys, credentials, or confidential notes here...&#10;// Everything is encrypted client-side using AES-256-GCM before transmission."
                  rows={18}
                  required
                  spellCheck={false}
                  autoFocus
                  className="w-full h-full min-h-[440px] bg-transparent text-foreground font-mono text-xs sm:text-sm p-4 leading-relaxed focus:outline-none border-none resize-none whitespace-pre placeholder:text-muted-foreground/50 selection:bg-muted"
                />
              )}
            </div>
          </div>

          {/* Status Bar (Lines, Characters, Bytes Counter) */}
          <div className="h-8 border-t border-border bg-muted/60 px-4 flex items-center justify-between text-[11px] font-mono text-muted-foreground select-none">
            <div className="flex items-center gap-3">
              <span>{lineCount} {lineCount === 1 ? 'line' : 'lines'}</span>
              <span>&bull;</span>
              <span>{charCount} chars</span>
              <span>&bull;</span>
              <span>{(byteCount / 1024).toFixed(1)} KB</span>
            </div>
            <div className="hidden sm:flex items-center gap-1.5 text-muted-foreground">
              <kbd className="px-1.5 py-0.5 rounded bg-muted border border-border text-[10px] text-foreground font-mono">⌘+Enter</kbd>
              <span>to encrypt</span>
            </div>
          </div>
        </div>

        {/* Right Column - Delivery & Security Sidebar */}
        <div className="lg:col-span-4 flex flex-col gap-4">
          <div className="border border-border/80 rounded-xl p-4 bg-card/90 flex flex-col gap-4 shadow-xl soft-shadow">
            {/* Sidebar Header */}
            <div className="flex items-center justify-between pb-2 border-b border-border">
              <div className="flex items-center gap-2">
                <Shield className="h-4 w-4 text-foreground" />
                <span className="font-mono text-xs font-bold uppercase tracking-wider text-foreground">
                  Delivery Mode
                </span>
              </div>
            </div>

            {/* Single vs Multiple Recipients Mode Switcher */}
            <div className="grid grid-cols-2 gap-1 p-1 bg-background/80 rounded-lg border border-border">
              <button
                type="button"
                onClick={() => setDeliveryTarget('single')}
                className={`flex items-center justify-center gap-1.5 py-1.5 rounded text-xs font-mono transition-all cursor-pointer ${deliveryTarget === 'single'
                    ? 'bg-muted text-foreground font-bold shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                  }`}
              >
                <User className="h-3.5 w-3.5" />
                <span>Single</span>
              </button>

              <button
                type="button"
                onClick={() => setDeliveryTarget('multiple')}
                className={`flex items-center justify-center gap-1.5 py-1.5 rounded text-xs font-mono transition-all cursor-pointer ${deliveryTarget === 'multiple'
                    ? 'bg-muted text-foreground font-bold shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                  }`}
              >
                <Users className="h-3.5 w-3.5" />
                <span>Multiple</span>
              </button>
            </div>

            {/* Delivery Mode Configuration Controls */}
            <AnimatePresence mode="wait">
              {deliveryTarget === 'single' ? (
                /* Single Mode - Symmetric URL Hash vs Asymmetric RSA Key Options */
                <motion.div
                  key="sidebar-single"
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  className="flex flex-col gap-3"
                >
                  <div className="flex flex-col gap-2">
                    {/* Symmetric URL Hash Card */}
                    <div
                      onClick={() => setSingleSubMode('symmetric')}
                      className={`p-3 rounded-lg border cursor-pointer transition-all flex flex-col gap-1 ${singleSubMode === 'symmetric'
                          ? 'bg-muted/80 border-foreground/50 shadow-sm'
                          : 'bg-muted/30 border-border hover:border-border/80 hover:bg-muted/50'
                        }`}
                    >
                      <div className="flex items-center gap-2 text-xs font-mono font-medium text-foreground">
                        <Key className="h-3.5 w-3.5 text-foreground" />
                        <span>Symmetric URL Hash</span>
                      </div>
                      <p className="text-[11px] font-mono text-muted-foreground leading-relaxed">
                        Key remains in <code className="text-foreground">#fragment</code>. Direct decryption link.
                      </p>
                    </div>

                    {/* RSA Public Key Card */}
                    <div
                      onClick={() => setSingleSubMode('asymmetric')}
                      className={`p-3 rounded-lg border cursor-pointer transition-all flex flex-col gap-1 ${singleSubMode === 'asymmetric'
                          ? 'bg-muted/80 border-foreground/50 shadow-sm'
                          : 'bg-muted/30 border-border hover:border-border/80 hover:bg-muted/50'
                        }`}
                    >
                      <div className="flex items-center gap-2 text-xs font-mono font-medium text-foreground">
                        <ShieldCheck className="h-3.5 w-3.5 text-foreground" />
                        <span>RSA-OAEP Public Key</span>
                      </div>
                      <p className="text-[11px] font-mono text-muted-foreground leading-relaxed">
                        Encrypted for recipient&apos;s key. No key in URL.
                      </p>
                    </div>
                  </div>

                  {/* Recipient Public Key Input Field */}
                  {singleSubMode === 'asymmetric' && (
                    <RecipientKeyInput
                      value={recipientPublicKey}
                      onChange={setRecipientPublicKey}
                      onKeyChange={setValidRecipientKey}
                    />
                  )}
                </motion.div>
              ) : (
                /* Multiple Mode - Shamir Threshold Sliders (N-of-K) */
                <motion.div
                  key="sidebar-multi"
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  className="flex flex-col gap-3"
                >
                  {/* Minimum Threshold Slider */}
                  <div className="p-3 rounded-lg border border-border bg-background/60 flex flex-col gap-2">
                    <div className="flex items-center justify-between text-xs font-mono">
                      <span className="text-muted-foreground">Threshold (K):</span>
                      <span className="text-foreground font-bold">{threshold} Shards</span>
                    </div>
                    <input
                      type="range"
                      min={2}
                      max={10}
                      value={threshold}
                      onChange={(e) => handleThresholdChange(parseInt(e.target.value, 10))}
                      className="w-full h-1.5 bg-muted rounded appearance-none cursor-pointer accent-foreground"
                    />
                    <p className="text-[10px] font-mono text-muted-foreground">
                      Minimum shards required to reconstruct secret
                    </p>
                  </div>

                  {/* Total Shares Slider */}
                  <div className="p-3 rounded-lg border border-border bg-background/60 flex flex-col gap-2">
                    <div className="flex items-center justify-between text-xs font-mono">
                      <span className="text-muted-foreground">Total Shares (N):</span>
                      <span className="text-foreground font-bold">{totalShares} Shards</span>
                    </div>
                    <input
                      type="range"
                      min={2}
                      max={10}
                      value={totalShares}
                      onChange={(e) => handleTotalSharesChange(parseInt(e.target.value, 10))}
                      className="w-full h-1.5 bg-muted rounded appearance-none cursor-pointer accent-foreground"
                    />
                    <p className="text-[10px] font-mono text-muted-foreground">
                      Total unique shard links generated
                    </p>
                  </div>

                  {/* Shamir Summary Note */}
                  <div className="p-2.5 rounded-lg bg-muted/40 border border-border text-[11px] font-mono text-muted-foreground flex items-start gap-2">
                    <Info className="h-3.5 w-3.5 text-foreground shrink-0 mt-0.5" />
                    <span>Any {threshold} of {totalShares} shares combined decrypt the paste.</span>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <div className="h-[1px] bg-border" />

            {/* Expiration & Security Toggles Section */}
            <div className="flex flex-col gap-3">
              {/* Expiration Dropdown */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground">
                  Expiration
                </label>
                <select
                  value={expire}
                  onChange={(e) => setExpire(e.target.value as Expiry)}
                  className="w-full h-9 rounded-lg bg-background/80 border border-border px-3 text-xs font-mono text-foreground focus:outline-none focus:border-foreground/50 cursor-pointer shadow-sm"
                >
                  <option value="5min">5 Minutes</option>
                  <option value="10min">10 Minutes</option>
                  <option value="1hour">1 Hour</option>
                  <option value="1day">1 Day (Default)</option>
                  <option value="1week">1 Week</option>
                  <option value="1month">1 Month</option>
                  <option value="never">Never (Persistent)</option>
                </select>
              </div>

              {/* Burn After Reading Toggle */}
              {!isShamir && (
                <label className="flex items-center gap-2 cursor-pointer select-none py-1">
                  <input
                    type="checkbox"
                    checked={burnAfterReading}
                    onChange={(e) => setBurnAfterReading(e.target.checked)}
                    className="h-4 w-4 rounded bg-background border-border text-foreground accent-foreground focus:ring-0 cursor-pointer"
                  />
                  <span className="text-xs font-mono text-foreground">
                    Burn after reading (1 view)
                  </span>
                </label>
              )}

              {/* Open Discussion Toggle */}
              <label className="flex items-center gap-2 cursor-pointer select-none py-1">
                <input
                  type="checkbox"
                  checked={openDiscussion}
                  onChange={(e) => setOpenDiscussion(e.target.checked)}
                  className="h-4 w-4 rounded bg-background border-border text-foreground accent-foreground focus:ring-0 cursor-pointer"
                />
                <span className="text-xs font-mono text-foreground">
                  Open discussion
                </span>
              </label>
            </div>

            {/* Error Banner */}
            {error && (
              <div className="p-2.5 rounded bg-destructive/10 border border-destructive/25 text-destructive text-xs font-mono flex items-center gap-2">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* Primary Action Buttons (Encrypt Submit & Clear) */}
            <div className="flex flex-col gap-2 pt-2 border-t border-border">
              <Button
                type="submit"
                disabled={
                  !content.trim() ||
                  isLoading ||
                  (isAsymmetric && !validRecipientKey)
                }
                className="w-full h-11 font-mono font-bold text-xs bg-foreground text-background hover:opacity-90 gap-2 rounded-lg transition-all shadow-md"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin text-background" />
                    <span>Encrypting...</span>
                  </>
                ) : (
                  <>
                    <Shield className="h-4 w-4 text-background fill-current" />
                    <span>
                      {isShamir
                        ? `Secure Paste (${threshold}/${totalShares})`
                        : isAsymmetric
                          ? 'Secure Paste for Recipient'
                          : 'Secure Paste'}
                    </span>
                  </>
                )}
              </Button>

              <button
                type="button"
                onClick={handleClear}
                disabled={!content || isLoading}
                className="w-full py-2 text-center text-xs font-mono text-muted-foreground hover:text-foreground transition-colors disabled:opacity-30 cursor-pointer"
              >
                Clear Editor
              </button>
            </div>
          </div>
        </div>
      </div>
    </form>
  );
}

export default PasteEditor;
