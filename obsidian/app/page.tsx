'use client';

import * as React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Header } from '@/components/layout/Header';
import { PasteEditor } from '@/components/editor/PasteEditor';
import { SharePanel } from '@/components/sharing/SharePanel';
import { usePasteEncryption } from '@/hooks/usePasteEncryption';
import { AuroraBackground } from '@/components/ui/AuroraBackground';
import { IntroSplash } from '@/components/ui/IntroSplash';
import { ShieldCheck } from 'lucide-react';

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.08,
      delayChildren: 0.04,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 10 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.35, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] },
  },
};

export default function HomePage() {
  const { encryptAndSubmit, isLoading, error, result, reset } =
    usePasteEncryption();

  return (
    <AuroraBackground>
      {/* Intro Splash Animation (White bg -> Lock snap -> Inversion -> Obsidian reveal) */}
      <IntroSplash />

      {/* Floating Header Actions */}
      <Header />

      {/* Main Content Area */}
      <main className="flex-1 max-w-4xl w-full mx-auto px-4 sm:px-6 pt-20 sm:pt-24 pb-12 flex flex-col gap-6 justify-center">
        {!result && (
          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            className="flex flex-col items-center text-center gap-3 max-w-2xl mx-auto w-full"
          >
            {/* Serious, Clean Eyebrow */}
            <motion.div variants={itemVariants}>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-medium tracking-wider uppercase bg-muted/80 border border-border text-muted-foreground font-mono">
                <ShieldCheck className="h-3.5 w-3.5 text-primary" />
                Zero-Knowledge Cryptographic Vault
              </span>
            </motion.div>

            {/* Serious, Professional Headline */}
            <motion.h1
              variants={itemVariants}
              className="text-3xl sm:text-4xl lg:text-5xl font-semibold tracking-tight text-foreground leading-[1.15]"
            >
              End-to-End Encrypted.{' '}
              <span className="text-muted-foreground font-normal">Zero-Knowledge.</span>
            </motion.h1>

            {/* Crisp, Professional Subtitle */}
            <motion.p
              variants={itemVariants}
              className="text-xs sm:text-sm text-muted-foreground max-w-lg leading-relaxed font-normal"
            >
              Data is encrypted with <strong>AES-256-GCM</strong> directly in your browser. Decryption keys exist only in the URL hash fragment and never touch the server.
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
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.3 }}
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

      {/* Clean, Minimalist Footer */}
      <footer className="w-full border-t border-border/40 py-5 text-center text-xs text-muted-foreground font-mono">
        <div className="max-w-4xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>Obsidian &bull; AES-256-GCM Zero-Knowledge Pastebin</span>
          <span className="text-[11px] text-muted-foreground/70">
            PBKDF2-SHA256 &bull; Client-Side Decryption
          </span>
        </div>
      </footer>
    </AuroraBackground>
  );
}
