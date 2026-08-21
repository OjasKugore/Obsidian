'use client';

import * as React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Header } from '@/components/layout/Header';
import { PasteEditor } from '@/components/editor/PasteEditor';
import { SharePanel } from '@/components/sharing/SharePanel';
import { usePasteEncryption } from '@/hooks/usePasteEncryption';
import { ShieldCheck, Cpu, KeyRound, Zap } from 'lucide-react';

export default function HomePage() {
  const { encryptAndSubmit, isLoading, error, result, reset } =
    usePasteEncryption();

  return (
    <div className="min-h-screen flex flex-col bg-background relative overflow-hidden">
      {/* Dynamic Background Accents */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[350px] bg-gradient-to-b from-blue-600/10 via-indigo-600/5 to-transparent blur-3xl pointer-events-none -z-10" />
      <div className="absolute top-1/3 -left-48 w-96 h-96 bg-purple-600/10 rounded-full blur-3xl pointer-events-none -z-10" />
      <div className="absolute top-1/2 -right-48 w-96 h-96 bg-cyan-600/10 rounded-full blur-3xl pointer-events-none -z-10" />

      {/* Persistent Navigation Header */}
      <Header />

      {/* Main Content Area */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 py-6 sm:py-10 flex flex-col gap-8 justify-center">
        {/* Hero Section if in editor mode */}
        {!result && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center max-w-2xl mx-auto flex flex-col items-center gap-2.5"
          >
            <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-foreground">
              Encrypted Pastebin.{' '}
              <span className="text-gradient">Zero-Knowledge.</span>
            </h1>
            <p className="text-xs sm:text-sm text-muted-foreground max-w-lg leading-relaxed">
              Your data is encrypted with <strong>AES-256-GCM</strong> directly in your browser. The decryption key stays in the URL fragment and never touches our servers.
            </p>

            {/* Feature Pills */}
            <div className="flex flex-wrap items-center justify-center gap-2 pt-2 text-[11px] text-muted-foreground font-medium">
              <span className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-muted/60 border border-border/50">
                <ShieldCheck className="h-3 w-3 text-emerald-400" />
                SubtleCrypto Browser AES
              </span>
              <span className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-muted/60 border border-border/50">
                <Cpu className="h-3 w-3 text-blue-400" />
                Web Worker PBKDF2 (100k iters)
              </span>
              <span className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-muted/60 border border-border/50">
                <KeyRound className="h-3 w-3 text-purple-400" />
                #Fragment Key Isolation
              </span>
              <span className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-muted/60 border border-border/50">
                <Zap className="h-3 w-3 text-amber-400" />
                Atomic Burn-on-Read
              </span>
            </div>
          </motion.div>
        )}

        {/* Transition container between Editor and SharePanel */}
        <AnimatePresence mode="wait">
          {result ? (
            <SharePanel key="share" result={result} onReset={reset} />
          ) : (
            <PasteEditor
              key="editor"
              onEncrypt={encryptAndSubmit}
              isLoading={isLoading}
              error={error}
            />
          )}
        </AnimatePresence>
      </main>

      {/* Minimal Footer */}
      <footer className="w-full border-t border-border/30 py-6 text-center text-xs text-muted-foreground">
        <div className="max-w-6xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>Obsidian &bull; Zero-Knowledge Cryptographic Pastebin</span>
          <span className="text-[11px]">
            AES-256-GCM &bull; PBKDF2-SHA256 &bull; Strict Content Security Policy
          </span>
        </div>
      </footer>
    </div>
  );
}
