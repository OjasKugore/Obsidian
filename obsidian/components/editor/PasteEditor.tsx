'use client';

import * as React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Shield,
  User,
  Users,
  Key,
  ShieldCheck,
  Copy,
  Download,
  Check,
  AlertCircle,
  Loader2,
  Info,
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

  // Markdown write/preview toggle
  const [editorTab, setEditorTab] = React.useState<'write' | 'preview'>('write');

  // Delivery Target: Single vs Multiple
  const [deliveryTarget, setDeliveryTarget] = React.useState<DeliveryTarget>('single');
  const [singleSubMode, setSingleSubMode] = React.useState<SingleUserSubMode>('symmetric');

  // Asymmetric RSA-OAEP public key
  const [recipientPublicKey, setRecipientPublicKey] = React.useState('');
  const [validRecipientKey, setValidRecipientKey] = React.useState<string | null>(null);

  // Shamir Secret Sharing parameters
  const [threshold, setThreshold] = React.useState(2);
  const [totalShares, setTotalShares] = React.useState(3);

  // Copy feedback
  const [copied, setCopied] = React.useState(false);

  const isShamir = deliveryTarget === 'multiple';
  const isAsymmetric = deliveryTarget === 'single' && singleSubMode === 'asymmetric';

  const lines = content ? content.split('\n') : [''];
  const lineCount = lines.length;
  const charCount = content.length;
  const byteCount = new TextEncoder().encode(content).length;

  const handleFormatterChange = (newFormatter: 'plaintext' | 'markdown' | 'syntaxhighlighting') => {
    setFormatter(newFormatter);
    if (newFormatter !== 'markdown') {
      setEditorTab('write');
    }
  };

  const handleCopy = async () => {
    if (!content) return;
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore
    }
  };

  const handleDownload = () => {
    if (!content) return;
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = formatter === 'markdown' ? 'paste.md' : 'paste.txt';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleClear = () => {
    if (content && confirm('Are you sure you want to clear the editor?')) {
      setContent('');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim() || isLoading) return;

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

  const getFilename = () => {
    if (formatter === 'markdown') return 'DOCUMENT.MD';
    if (formatter === 'syntaxhighlighting') return 'SOURCE.CODE';
    return 'UNTITLED.TXT';
  };

  return (
    <form onSubmit={handleSubmit} className="w-full flex flex-col gap-6">
      {/* ── Headline Row ─────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-2 border-b border-[#27272a]">
        <div>
          <h1 className="font-mono text-2xl sm:text-3xl font-bold tracking-tight text-white">
            New Paste
          </h1>
          <p className="text-xs font-mono text-[#8e9192] mt-1">
            End-to-end client-side AES-256-GCM encrypted storage.
          </p>
        </div>

        <div className="flex items-center gap-2 text-xs font-mono text-[#8e9192]">
          <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
          <span>Zero-Knowledge Vault Active</span>
        </div>
      </div>

      {/* ── Main Two-Column Layout: Code Canvas + Delivery Sidebar ────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* ── Left Column: Code Editor Canvas (8 Cols) ───────────────────── */}
        <div className="lg:col-span-8 flex flex-col border border-[#27272a] rounded-lg overflow-hidden bg-[#131313] shadow-2xl focus-within:border-white/40 transition-colors">
          {/* Window Chrome Header */}
          <div className="h-10 border-b border-[#27272a] flex items-center px-4 justify-between bg-[#1b1c1c] select-none">
            {/* Mac-style Window Dots + Filename */}
            <div className="flex items-center gap-3">
              <div className="flex gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-[#353535] border border-white/5" />
                <span className="w-2.5 h-2.5 rounded-full bg-[#353535] border border-white/5" />
                <span className="w-2.5 h-2.5 rounded-full bg-[#353535] border border-white/5" />
              </div>
              <span className="text-[11px] font-mono font-semibold tracking-wider text-[#8e9192] uppercase">
                {getFilename()}
              </span>
            </div>

            {/* Format Selector + Tools */}
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1 bg-[#131313] p-0.5 rounded border border-[#27272a]">
                <button
                  type="button"
                  onClick={() => handleFormatterChange('plaintext')}
                  className={`px-2 py-0.5 text-[10px] font-mono rounded transition-colors ${
                    formatter === 'plaintext'
                      ? 'bg-[#27272a] text-white'
                      : 'text-[#8e9192] hover:text-white'
                  }`}
                >
                  Plain
                </button>
                <button
                  type="button"
                  onClick={() => handleFormatterChange('markdown')}
                  className={`px-2 py-0.5 text-[10px] font-mono rounded transition-colors ${
                    formatter === 'markdown'
                      ? 'bg-[#27272a] text-white'
                      : 'text-[#8e9192] hover:text-white'
                  }`}
                >
                  Markdown
                </button>
                <button
                  type="button"
                  onClick={() => handleFormatterChange('syntaxhighlighting')}
                  className={`px-2 py-0.5 text-[10px] font-mono rounded transition-colors ${
                    formatter === 'syntaxhighlighting'
                      ? 'bg-[#27272a] text-white'
                      : 'text-[#8e9192] hover:text-white'
                  }`}
                >
                  Code
                </button>
              </div>

              {formatter === 'markdown' && (
                <div className="flex items-center gap-1 bg-[#131313] p-0.5 rounded border border-[#27272a]">
                  <button
                    type="button"
                    onClick={() => setEditorTab('write')}
                    className={`px-1.5 py-0.5 text-[10px] font-mono rounded ${
                      editorTab === 'write' ? 'bg-[#27272a] text-white' : 'text-[#8e9192]'
                    }`}
                  >
                    <PenLine className="h-3 w-3 inline mr-1" />
                    Write
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditorTab('preview')}
                    className={`px-1.5 py-0.5 text-[10px] font-mono rounded ${
                      editorTab === 'preview' ? 'bg-[#27272a] text-white' : 'text-[#8e9192]'
                    }`}
                  >
                    <Eye className="h-3 w-3 inline mr-1" />
                    Preview
                  </button>
                </div>
              )}

              <div className="flex items-center gap-1.5 text-[#8e9192]">
                <button
                  type="button"
                  onClick={handleCopy}
                  title="Copy text"
                  className="p-1 hover:text-white transition-colors"
                >
                  {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                </button>
                <button
                  type="button"
                  onClick={handleDownload}
                  title="Download file"
                  className="p-1 hover:text-white transition-colors"
                >
                  <Download className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          </div>

          {/* Editor Body with Line Numbers */}
          <div className="flex flex-grow min-h-[440px] relative overflow-hidden bg-[#131313]">
            {/* Line Numbers Gutter */}
            <div className="w-12 shrink-0 bg-[#0e0e0e] border-r border-[#27272a] py-4 flex flex-col items-end pr-2 text-[#444748] font-mono text-xs select-none">
              {Array.from({ length: Math.max(lineCount, 16) }).map((_, i) => (
                <div key={i} className="leading-relaxed">
                  {i < lineCount ? i + 1 : ''}
                </div>
              ))}
            </div>

            {/* Content Area */}
            <div className="flex-1 relative">
              {formatter === 'markdown' && editorTab === 'preview' ? (
                <div className="w-full h-full min-h-[440px] p-4 text-white overflow-y-auto">
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
                  className="w-full h-full min-h-[440px] bg-transparent text-white font-mono text-xs sm:text-sm p-4 leading-relaxed focus:outline-none border-none resize-none whitespace-pre placeholder:text-[#444748]"
                />
              )}
            </div>
          </div>

          {/* Canvas Bottom Status Bar */}
          <div className="h-8 border-t border-[#27272a] bg-[#1b1c1c] px-4 flex items-center justify-between text-[11px] font-mono text-[#8e9192] select-none">
            <div className="flex items-center gap-3">
              <span>{lineCount} {lineCount === 1 ? 'line' : 'lines'}</span>
              <span>&bull;</span>
              <span>{charCount} chars</span>
              <span>&bull;</span>
              <span>{(byteCount / 1024).toFixed(1)} KB</span>
            </div>
            <div className="hidden sm:flex items-center gap-1.5 text-[#8e9192]">
              <kbd className="px-1 py-0.5 rounded bg-[#27272a] border border-[#353535] text-[10px] text-white">⌘+Enter</kbd>
              <span>to encrypt</span>
            </div>
          </div>
        </div>

        {/* ── Right Column: Delivery & Security Sidebar (4 Cols) ─────────── */}
        <div className="lg:col-span-4 flex flex-col gap-4">
          {/* Sidebar Card */}
          <div className="border border-[#27272a] rounded-lg p-4 bg-[#1b1c1c] flex flex-col gap-4 shadow-xl">
            {/* Sidebar Title */}
            <div className="flex items-center justify-between pb-2 border-b border-[#27272a]">
              <div className="flex items-center gap-2">
                <Shield className="h-4 w-4 text-white" />
                <span className="font-mono text-xs font-bold uppercase tracking-wider text-white">
                  Delivery Mode
                </span>
              </div>
            </div>

            {/* Mode Switcher Pills */}
            <div className="grid grid-cols-2 gap-1 p-1 bg-[#131313] rounded border border-[#27272a]">
              <button
                type="button"
                onClick={() => setDeliveryTarget('single')}
                className={`flex items-center justify-center gap-1.5 py-1.5 rounded text-xs font-mono transition-all ${
                  deliveryTarget === 'single'
                    ? 'bg-[#27272a] text-white font-bold'
                    : 'text-[#8e9192] hover:text-white'
                }`}
              >
                <User className="h-3.5 w-3.5" />
                <span>Single</span>
              </button>

              <button
                type="button"
                onClick={() => setDeliveryTarget('multiple')}
                className={`flex items-center justify-center gap-1.5 py-1.5 rounded text-xs font-mono transition-all ${
                  deliveryTarget === 'multiple'
                    ? 'bg-[#27272a] text-white font-bold'
                    : 'text-[#8e9192] hover:text-white'
                }`}
              >
                <Users className="h-3.5 w-3.5" />
                <span>Multiple</span>
              </button>
            </div>

            {/* Mode Specific Configurations */}
            <AnimatePresence mode="wait">
              {deliveryTarget === 'single' ? (
                /* Single User Configuration */
                <motion.div
                  key="sidebar-single"
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  className="flex flex-col gap-3"
                >
                  <div className="flex flex-col gap-2">
                    {/* Symmetric Fragment */}
                    <div
                      onClick={() => setSingleSubMode('symmetric')}
                      className={`p-2.5 rounded border cursor-pointer transition-all flex flex-col gap-1 ${
                        singleSubMode === 'symmetric'
                          ? 'bg-[#27272a]/60 border-white/40'
                          : 'bg-[#131313] border-[#27272a] hover:border-[#353535]'
                      }`}
                    >
                      <div className="flex items-center gap-2 text-xs font-mono font-medium text-white">
                        <Key className="h-3.5 w-3.5 text-white" />
                        <span>Symmetric URL Hash</span>
                      </div>
                      <p className="text-[11px] font-mono text-[#8e9192] leading-relaxed">
                        Key remains in <code className="text-white">#fragment</code>. Direct decryption link.
                      </p>
                    </div>

                    {/* Asymmetric RSA-OAEP */}
                    <div
                      onClick={() => setSingleSubMode('asymmetric')}
                      className={`p-2.5 rounded border cursor-pointer transition-all flex flex-col gap-1 ${
                        singleSubMode === 'asymmetric'
                          ? 'bg-[#27272a]/60 border-white/40'
                          : 'bg-[#131313] border-[#27272a] hover:border-[#353535]'
                      }`}
                    >
                      <div className="flex items-center gap-2 text-xs font-mono font-medium text-white">
                        <ShieldCheck className="h-3.5 w-3.5 text-white" />
                        <span>RSA-OAEP Public Key</span>
                      </div>
                      <p className="text-[11px] font-mono text-[#8e9192] leading-relaxed">
                        Encrypted for recipient&apos;s key. No key in URL.
                      </p>
                    </div>
                  </div>

                  {/* Asymmetric key input */}
                  {singleSubMode === 'asymmetric' && (
                    <RecipientKeyInput
                      value={recipientPublicKey}
                      onChange={setRecipientPublicKey}
                      onKeyChange={setValidRecipientKey}
                    />
                  )}
                </motion.div>
              ) : (
                /* Multiple Users Shamir Quorum Configuration */
                <motion.div
                  key="sidebar-multi"
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  className="flex flex-col gap-3"
                >
                  <div className="p-2.5 rounded border border-[#27272a] bg-[#131313] flex flex-col gap-2">
                    <div className="flex items-center justify-between text-xs font-mono">
                      <span className="text-[#8e9192]">Threshold (K):</span>
                      <span className="text-white font-bold">{threshold} Shards</span>
                    </div>
                    <input
                      type="range"
                      min={2}
                      max={10}
                      value={threshold}
                      onChange={(e) => handleThresholdChange(parseInt(e.target.value, 10))}
                      className="w-full h-1 bg-[#27272a] rounded appearance-none cursor-pointer accent-white"
                    />
                    <p className="text-[10px] font-mono text-[#8e9192]">
                      Minimum shards required to reconstruct secret
                    </p>
                  </div>

                  <div className="p-2.5 rounded border border-[#27272a] bg-[#131313] flex flex-col gap-2">
                    <div className="flex items-center justify-between text-xs font-mono">
                      <span className="text-[#8e9192]">Total Shares (N):</span>
                      <span className="text-white font-bold">{totalShares} Shards</span>
                    </div>
                    <input
                      type="range"
                      min={2}
                      max={10}
                      value={totalShares}
                      onChange={(e) => handleTotalSharesChange(parseInt(e.target.value, 10))}
                      className="w-full h-1 bg-[#27272a] rounded appearance-none cursor-pointer accent-white"
                    />
                    <p className="text-[10px] font-mono text-[#8e9192]">
                      Total unique shard links generated
                    </p>
                  </div>

                  <div className="p-2 rounded bg-[#131313] border border-[#27272a] text-[11px] font-mono text-[#8e9192] flex items-start gap-2">
                    <Info className="h-3.5 w-3.5 text-white shrink-0 mt-0.5" />
                    <span>Any {threshold} of {totalShares} shares combined decrypt the paste.</span>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <div className="h-[1px] bg-[#27272a]" />

            {/* ── Security & Expiry Controls ──────────────────────────────── */}
            <div className="flex flex-col gap-3">
              {/* Expiration dropdown */}
              <div className="flex flex-col gap-1">
                <label className="text-[11px] font-mono uppercase tracking-wider text-[#8e9192]">
                  Expiration
                </label>
                <select
                  value={expire}
                  onChange={(e) => setExpire(e.target.value as Expiry)}
                  className="w-full h-8 rounded bg-[#131313] border border-[#27272a] px-2 text-xs font-mono text-white focus:outline-none focus:border-white/50 cursor-pointer"
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
                    className="h-3.5 w-3.5 rounded bg-[#131313] border-[#27272a] text-white focus:ring-0 cursor-pointer"
                  />
                  <span className="text-xs font-mono text-white">
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
                  className="h-3.5 w-3.5 rounded bg-[#131313] border-[#27272a] text-white focus:ring-0 cursor-pointer"
                />
                <span className="text-xs font-mono text-white">
                  Open discussion
                </span>
              </label>
            </div>

            {/* Error Display */}
            {error && (
              <div className="p-2.5 rounded bg-red-950/30 border border-red-800/50 text-red-300 text-xs font-mono flex items-center gap-2">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* Action Row */}
            <div className="flex flex-col gap-2 pt-2 border-t border-[#27272a]">
              <Button
                type="submit"
                disabled={
                  !content.trim() ||
                  isLoading ||
                  (isAsymmetric && !validRecipientKey)
                }
                className="w-full h-10 font-mono font-bold text-xs bg-white text-black hover:bg-neutral-200 gap-2 rounded transition-all shadow-md"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin text-black" />
                    <span>Encrypting...</span>
                  </>
                ) : (
                  <>
                    <Shield className="h-4 w-4 text-black fill-black" />
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
                className="w-full py-1.5 text-center text-xs font-mono text-[#8e9192] hover:text-white transition-colors disabled:opacity-30 cursor-pointer"
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
