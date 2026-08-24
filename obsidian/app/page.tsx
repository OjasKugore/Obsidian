'use client';

import * as React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { PasteEditor } from '@/components/editor/PasteEditor';
import { SharePanel } from '@/components/sharing/SharePanel';
import { CommandPalette } from '@/components/layout/CommandPalette';
import { TrustVisualizer } from '@/components/crypto/TrustVisualizer';
import { QRScannerModal } from '@/components/qr/QRScannerModal';
import { usePasteEncryption } from '@/hooks/usePasteEncryption';
import { useKeyboard } from '@/hooks/useKeyboard';
import { AuroraBackground } from '@/components/ui/AuroraBackground';
import { IntroSplash } from '@/components/ui/IntroSplash';

export default function HomePage() {
  const { encryptAndSubmit, isLoading, error, result, reset } =
    usePasteEncryption();

  const [splashFinished, setSplashFinished] = React.useState(false);
  const [commandPaletteOpen, setCommandPaletteOpen] = React.useState(false);
  const [trustVisualizerOpen, setTrustVisualizerOpen] = React.useState(false);
  const [qrScannerOpen, setQrScannerOpen] = React.useState(false);

  const handleOpenTrustVisualizer = () => {
    setTrustVisualizerOpen(true);
    setTimeout(() => {
      const el = document.getElementById('trust-visualizer-section');
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      } else {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    }, 60);
  };

  // Global keyboard shortcuts hook
  useKeyboard({
    onOpenCommandPalette: () => setCommandPaletteOpen((prev) => !prev),
    onEscape: () => {
      setCommandPaletteOpen(false);
      setTrustVisualizerOpen(false);
      setQrScannerOpen(false);
    },
  });

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
          <Header
            onOpenCommandPalette={() => setCommandPaletteOpen(true)}
            onOpenTrustVisualizer={handleOpenTrustVisualizer}
            onOpenQRScanner={() => setQrScannerOpen(true)}
          />

          {/* Main Content Area */}
          <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-8 py-8 sm:py-10 flex flex-col gap-6">
            {/* Trust Visualizer Expanded Modal if opened */}
            <AnimatePresence>
              {trustVisualizerOpen && (
                <div
                  onClick={() => setTrustVisualizerOpen(false)}
                  className="fixed inset-0 z-50 flex items-start justify-center p-4 sm:p-6 bg-background/80 backdrop-blur-md overflow-y-auto font-mono"
                >
                  <motion.div
                    id="trust-visualizer-section"
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    onClick={(e) => e.stopPropagation()}
                    className="w-full max-w-5xl my-6 sm:my-10"
                  >
                    <TrustVisualizer onClose={() => setTrustVisualizerOpen(false)} />
                  </motion.div>
                </div>
              )}
            </AnimatePresence>

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

          {/* Command Palette (⌘+K) */}
          <CommandPalette
            isOpen={commandPaletteOpen}
            onClose={() => setCommandPaletteOpen(false)}
            onOpenTrustVisualizer={handleOpenTrustVisualizer}
            onOpenQRScanner={() => setQrScannerOpen(true)}
          />

          {/* Camera / File QR Scanner Modal */}
          <QRScannerModal
            isOpen={qrScannerOpen}
            onClose={() => setQrScannerOpen(false)}
          />

          {/* Universal Footer with active Security, Protocol, and GitHub links */}
          <Footer onOpenTrustVisualizer={handleOpenTrustVisualizer} />
        </AuroraBackground>
      )}
    </>
  );
}
