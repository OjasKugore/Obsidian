'use client';

/**
 * app/page.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Main Obsidian Application Home Page.
 * Controls the IntroSplash animation phase, client-side encryption state,
 * and renders either PasteEditor or SharePanel.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import * as React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Header } from '@/components/layout/Header';
import { PasteEditor } from '@/components/editor/PasteEditor';
import { SharePanel } from '@/components/sharing/SharePanel';
import { usePasteEncryption } from '@/hooks/usePasteEncryption';
import { AuroraBackground } from '@/components/ui/AuroraBackground';
import { IntroSplash } from '@/components/ui/IntroSplash';

export default function HomePage() {
  // ── SETUP ──────────────────────────────────────────────────────────────

  // Encryption execution hook (manages submission state, errors, and output result)
  const { encryptAndSubmit, isLoading, error, result, reset } =
    usePasteEncryption();

  // Intro splash sequence completion flag
  const [splashFinished, setSplashFinished] = React.useState(false);

  // ── UI ─────────────────────────────────────────────────────────────────

  return (
    <>
      {/* Intro Splash Animation (Plays on initial landing) */}
      {!splashFinished && (
        <IntroSplash onComplete={() => setSplashFinished(true)} />
      )}

      {/* Main Workspace (Revealed after intro splash finishes) */}
      {splashFinished && (
        <AuroraBackground>
          {/* Top Header Navigation Bar */}
          <Header />

          {/* Main Workspace Layout (Editor vs Share Success Panel) */}
          <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-8 py-8 sm:py-10 flex flex-col gap-6">
            <AnimatePresence mode="wait">
              {result ? (
                /* Encryption Success Result Panel */
                <SharePanel key="share" result={result} onReset={reset} />
              ) : (
                /* Primary Encrypted Paste Creation Editor */
                <motion.div
                  key="editor-wrap"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.25 }}
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

          {/* Footer Bar */}
          <footer className="w-full border-t border-border py-6 text-xs font-mono text-muted-foreground bg-muted/20 mt-auto">
            <div className="max-w-6xl mx-auto px-4 sm:px-8 flex flex-col md:flex-row justify-between items-center gap-4">
              <div className="flex items-center gap-3">
                <span className="font-[family-name:var(--font-montserrat)] font-black text-sm tracking-tight text-foreground">OBSIDIAN</span>
                <span>&bull;</span>
                <span>© 2026 OBSIDIAN. ENCRYPTED & PERSISTENT.</span>
              </div>

              <nav className="flex items-center gap-6">
                <span className="hover:text-foreground transition-colors cursor-pointer">Security</span>
                <span className="hover:text-foreground transition-colors cursor-pointer">Protocol</span>
                <span className="hover:text-foreground transition-colors cursor-pointer">GitHub</span>
                <span className="hover:text-foreground transition-colors cursor-pointer">Status</span>
              </nav>
            </div>
          </footer>
        </AuroraBackground>
      )}
    </>
  );
}
