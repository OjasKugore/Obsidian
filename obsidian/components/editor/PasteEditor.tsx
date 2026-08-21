'use client';

import * as React from 'react';
import { motion } from 'framer-motion';
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
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { Expiry } from '@/lib/api/schemas';
import type { EncryptionOptions, EncryptionResult } from '@/hooks/usePasteEncryption';

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

  const lineCount = content ? content.split('\n').length : 1;
  const charCount = content.length;
  const byteCount = new TextEncoder().encode(content).length;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim() || isLoading) return;

    await onEncrypt(content, {
      formatter,
      expire,
      burnAfterReading,
      openDiscussion,
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Support Cmd+Enter / Ctrl+Enter to submit
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -12 }}
      transition={{ duration: 0.3 }}
      className="w-full max-w-4xl mx-auto"
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        {/* Main Editor Card */}
        <div className="glass-panel rounded-2xl p-4 sm:p-6 transition-all duration-300 focus-within:ring-2 focus-within:ring-primary/40 focus-within:shadow-[0_0_30px_-5px_rgba(59,130,246,0.25)]">
          {/* Editor Header / Format Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 pb-3 mb-3 border-b border-border/40">
            <div className="flex items-center gap-1.5 p-1 rounded-xl bg-muted/60 border border-border/40">
              <button
                type="button"
                onClick={() => setFormatter('plaintext')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
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
                onClick={() => setFormatter('markdown')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
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
                onClick={() => setFormatter('syntaxhighlighting')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  formatter === 'syntaxhighlighting'
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <Code2 className="h-3.5 w-3.5 text-blue-400" />
                Source Code
              </button>
            </div>

            {/* Quick badges */}
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span>{lineCount} {lineCount === 1 ? 'line' : 'lines'}</span>
              <span>•</span>
              <span>{charCount.toLocaleString()} chars</span>
              <span>•</span>
              <span>{(byteCount / 1024).toFixed(1)} KB</span>
            </div>
          </div>

          {/* Text Area */}
          <div className="relative">
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Paste or write your confidential secret, token, code snippet, or private notes here...&#10;&#10;Everything is encrypted using AES-256-GCM directly in your browser with SubtleCrypto before being transmitted."
              rows={14}
              required
              className="w-full resize-y min-h-[260px] bg-transparent border-0 font-mono text-sm leading-relaxed text-foreground placeholder:text-muted-foreground/50 focus:outline-none"
              spellCheck={false}
              autoFocus
            />
          </div>

          {/* Bottom helper info */}
          <div className="flex items-center justify-between pt-3 mt-2 border-t border-border/30 text-xs text-muted-foreground">
            <div className="flex items-center gap-1.5">
              <Shield className="h-3.5 w-3.5 text-blue-400" />
              <span>PBKDF2-SHA256 (100k iters) &bull; Zero Server Knowledge</span>
            </div>
            <div className="hidden sm:block text-[11px]">
              Press <kbd className="px-1.5 py-0.5 rounded bg-muted border border-border/60 font-mono">⌘+Enter</kbd> to encrypt
            </div>
          </div>
        </div>

        {/* Options Bar */}
        <div className="glass-panel rounded-2xl p-4 sm:p-5 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
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
                className="h-9 rounded-lg bg-background/80 border border-border/80 px-2.5 py-1 text-xs font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-primary cursor-pointer"
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

            {/* Burn After Reading Toggle */}
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
                  1 view only
                </Badge>
              )}
            </label>

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
            disabled={!content.trim() || isLoading}
            className="w-full md:w-auto min-w-[200px] font-semibold gap-2 transition-all shadow-lg"
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Encrypting & Storing...</span>
              </>
            ) : (
              <>
                <Lock className="h-4 w-4" />
                <span>Encrypt & Share</span>
              </>
            )}
          </Button>
        </div>

        {/* Error Alert */}
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-2.5 p-4 rounded-xl border border-destructive/40 bg-destructive/10 text-destructive text-sm"
          >
            <AlertCircle className="h-5 w-5 shrink-0" />
            <span>{error}</span>
          </motion.div>
        )}
      </form>
    </motion.div>
  );
}
