'use client';

import * as React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Header } from '@/components/layout/Header';
import { PasteEditor } from '@/components/editor/PasteEditor';
import { SharePanel } from '@/components/sharing/SharePanel';
import { usePasteEncryption } from '@/hooks/usePasteEncryption';
import { AuroraBackground } from '@/components/ui/AuroraBackground';
import { IntroSplash } from '@/components/ui/IntroSplash';

export default function HomePage() {
  const { encryptAndSubmit, isLoading, error, result, reset } =
    usePasteEncryption();

  const [splashFinished, setSplashFinished] = React.useState(false);

  return (
    <>
      {/* Intro Splash: Fullscreen solid white canvas with black lock -> dark inversion -> Obsidian reveal */}
      {!splashFinished && (
        <IntroSplash onComplete={() => setSplashFinished(true)} />
      )}

      {/* Main Workspace: Only rendered after intro splash sequence finishes */}
      {splashFinished && (
        <AuroraBackground>
          {/* Industrial Top Navbar */}
          <Header />

          {/* Main Content Area */}
          <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-8 py-8 sm:py-10 flex flex-col gap-6">
            {/* Transition container between Editor and SharePanel */}
            <AnimatePresence mode="wait">
              {result ? (
                <SharePanel key="share" result={result} onReset={reset} />
              ) : (
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

          {/* Industrial Monochrome Footer */}
          <footer className="w-full border-t border-border py-6 text-xs font-mono text-muted-foreground bg-muted/20 mt-auto">
            <div className="max-w-6xl mx-auto px-4 sm:px-8 flex flex-col md:flex-row justify-between items-center gap-4">
              <div className="flex items-center gap-3">
                <span className="font-bold text-foreground tracking-wider">OBSIDIAN</span>
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
