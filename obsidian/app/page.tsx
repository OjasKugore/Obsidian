'use client';

import * as React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Header } from '@/components/layout/Header';
import { PasteEditor } from '@/components/editor/PasteEditor';
import { SharePanel } from '@/components/sharing/SharePanel';
import { usePasteEncryption } from '@/hooks/usePasteEncryption';
import { AuroraBackground } from '@/components/ui/AuroraBackground';
import { Sparkles } from 'lucide-react';

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
      delayChildren: 0.05,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 14 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.45, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] },
  },
};

export default function HomePage() {
  const { encryptAndSubmit, isLoading, error, result, reset } =
    usePasteEncryption();

  return (
    <AuroraBackground>
      {/* Persistent Navigation Header */}
      <Header />

      {/* Main Staggered Content Area */}
      <main className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 py-6 sm:py-10 flex flex-col gap-6 sm:gap-8 justify-center">
        {!result && (
          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            className="flex flex-col items-center text-center gap-3.5 max-w-2xl mx-auto"
          >
            {/* Minimal Eyebrow Pill */}
            <motion.div variants={itemVariants}>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-medium tracking-wide uppercase bg-primary/10 border border-primary/25 text-primary backdrop-blur-md shadow-sm">
                <Sparkles className="h-3 w-3 text-primary animate-pulse" />
                Zero-Knowledge Cryptographic Vault
              </span>
            </motion.div>

            {/* Girard Editorial Headline */}
            <motion.h1
              variants={itemVariants}
              className="font-girard text-4xl sm:text-5xl lg:text-6xl font-normal tracking-tight text-foreground leading-[1.08] select-none"
            >
              Private notes,{' '}
              <span className="italic text-gradient">unbreakable</span> privacy.
            </motion.h1>

            {/* Concise, Uncluttered Subtitle */}
            <motion.p
              variants={itemVariants}
              className="text-xs sm:text-sm text-muted-foreground max-w-md leading-relaxed font-normal"
            >
              Encrypted in your browser using <strong>AES-256-GCM</strong>. Decryption keys exist only in the link hash and never touch the server.
            </motion.p>
          </motion.div>
        )}

        {/* Transition container between Editor and SharePanel */}
        <AnimatePresence mode="wait">
          {result ? (
            <SharePanel key="share" result={result} onReset={reset} />
          ) : (
            <motion.div
              key="editor-wrap"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -16 }}
              transition={{ duration: 0.4, delay: 0.15 }}
            >
              <PasteEditor
                onEncrypt={encryptAndSubmit}
                isLoading={isLoading}
                error={error}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Minimal Footer */}
      <footer className="w-full border-t border-border/20 py-5 text-center text-xs text-muted-foreground/80 backdrop-blur-sm">
        <div className="max-w-5xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span className="font-girard tracking-wide text-foreground/90">Obsidian &bull; End-to-End Encrypted</span>
          <span className="text-[11px] font-mono text-muted-foreground/70">
            SubtleCrypto AES-256-GCM &bull; 100k PBKDF2 &bull; Client-Side Verification
          </span>
        </div>
      </footer>
    </AuroraBackground>
  );
}
