'use client';

/**
 * components/layout/Footer.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Universal Industrial Footer for Obsidian:
 *   - Security (Opens Zero-Knowledge Trust Visualizer)
 *   - Protocol (Opens Trust Visualizer)
 *   - GitHub (External link to repository)
 * ─────────────────────────────────────────────────────────────────────────────
 */

import * as React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ExternalLink } from 'lucide-react';
import { TrustVisualizer } from '@/components/crypto/TrustVisualizer';

interface FooterProps {
  onOpenTrustVisualizer?: () => void;
}

export function Footer({ onOpenTrustVisualizer }: FooterProps) {
  const [trustVisualizerOpen, setTrustVisualizerOpen] = React.useState(false);

  const handleOpenProtocol = () => {
    if (onOpenTrustVisualizer) {
      onOpenTrustVisualizer();
    } else {
      setTrustVisualizerOpen(true);
    }
  };

  return (
    <>
      <footer className="w-full border-t border-border py-6 text-xs font-mono text-muted-foreground bg-muted/20 mt-auto">
        <div className="max-w-6xl mx-auto px-4 sm:px-8 flex flex-col md:flex-row justify-between items-center gap-4">
          {/* Brand and Copyright */}
          <div className="flex items-center gap-3">
            <span className="font-[family-name:var(--font-montserrat)] font-black text-sm tracking-tight text-foreground">
              OBSIDIAN
            </span>
            <span>&bull;</span>
            <span>© 2026 OBSIDIAN. ZERO-KNOWLEDGE &amp; PERSISTENT.</span>
          </div>

          {/* Active Navigation Actions */}
          <nav className="flex items-center gap-6">
            <button
              type="button"
              onClick={handleOpenProtocol}
              className="hover:text-foreground transition-colors cursor-pointer"
            >
              Security
            </button>

            <a
              href="https://github.com/OjasKugore/PrivateBinRevamp"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-foreground transition-colors flex items-center gap-1 cursor-pointer"
            >
              <span>GitHub</span>
              <ExternalLink className="h-3 w-3" />
            </a>
          </nav>
        </div>
      </footer>

      {/* Trust Visualizer Modal if triggered from standalone page footer */}
      <AnimatePresence>
        {trustVisualizerOpen && (
          <div
            onClick={() => setTrustVisualizerOpen(false)}
            className="fixed inset-0 z-50 flex items-start justify-center p-4 sm:p-6 bg-background/80 backdrop-blur-md overflow-y-auto font-mono"
          >
            <motion.div
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
    </>
  );
}

export default Footer;
