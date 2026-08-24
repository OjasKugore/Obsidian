'use client';

/**
 * components/layout/Header.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Obsidian Top Navigation Bar with Protocol (Trust Visualizer), Vault, Docs,
 * Identity Key Manager, Theme Switcher, QR Scanner, and Command Palette.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTheme } from 'next-themes';
import { AnimatePresence, motion } from 'framer-motion';
import { Moon, Sun, Plus, Shield, QrCode } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { IdentityPanel } from '@/components/header/IdentityPanel';
import { TrustVisualizer } from '@/components/crypto/TrustVisualizer';
import { CommandPalette } from '@/components/layout/CommandPalette';
import { QRScannerModal } from '@/components/qr/QRScannerModal';
import { useKeyboard } from '@/hooks/useKeyboard';

interface HeaderProps {
  onOpenCommandPalette?: () => void;
  onOpenTrustVisualizer?: () => void;
  onOpenQRScanner?: () => void;
}

export function Header({
  onOpenCommandPalette,
  onOpenTrustVisualizer,
  onOpenQRScanner,
}: HeaderProps) {
  const pathname = usePathname();
  const { setTheme, theme, resolvedTheme } = useTheme();
  const [internalTrustVisualizerOpen, setInternalTrustVisualizerOpen] = React.useState(false);
  const [internalCommandPaletteOpen, setInternalCommandPaletteOpen] = React.useState(false);
  const [internalQRScannerOpen, setInternalQRScannerOpen] = React.useState(false);

  const mounted = React.useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  );

  const toggleTheme = () => {
    const current = resolvedTheme || theme;
    setTheme(current === 'dark' ? 'light' : 'dark');
  };

  const isHome = pathname === '/';

  const handleOpenProtocol = () => {
    if (onOpenTrustVisualizer) {
      onOpenTrustVisualizer();
    } else {
      setInternalTrustVisualizerOpen(true);
    }
  };

  const handleOpenCommandPalette = () => {
    if (onOpenCommandPalette) {
      onOpenCommandPalette();
    } else {
      setInternalCommandPaletteOpen(true);
    }
  };

  const handleOpenQRScanner = () => {
    if (onOpenQRScanner) {
      onOpenQRScanner();
    } else {
      setInternalQRScannerOpen(true);
    }
  };

  // Keyboard shortcut fallback for standalone pages
  useKeyboard({
    onOpenCommandPalette: () => handleOpenCommandPalette(),
    onEscape: () => {
      setInternalTrustVisualizerOpen(false);
      setInternalCommandPaletteOpen(false);
      setInternalQRScannerOpen(false);
    },
  });

  return (
    <>
      <header className="sticky top-0 z-40 w-full border-b border-border bg-background/95 backdrop-blur-sm transition-colors">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-8">
          {/* Brand & Nav */}
          <div className="flex items-center gap-6 sm:gap-8">
            <Link
              href="/"
              className="group flex items-center gap-2.5 transition-all duration-150 cursor-pointer"
            >
              <div className="flex h-7 w-7 items-center justify-center rounded bg-foreground text-background font-bold transition-transform duration-200 group-hover:scale-105 shadow-sm">
                <Shield className="h-4 w-4 fill-current text-background" />
              </div>
              <span className="font-[family-name:var(--font-montserrat)] text-xl font-black tracking-tighter text-foreground group-hover:opacity-90 transition-opacity">
                OBSIDIAN
              </span>
            </Link>

            <nav className="hidden md:flex items-center gap-1 text-xs font-mono">
              <button
                type="button"
                onClick={handleOpenProtocol}
                className="px-2.5 py-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/80 transition-all duration-150 cursor-pointer"
              >
                Security
              </button>
              <Link
                href="/vault"
                className={`px-2.5 py-1.5 rounded-lg transition-all duration-150 cursor-pointer ${
                  pathname.startsWith('/vault')
                    ? 'text-foreground bg-muted font-bold'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted/80'
                }`}
              >
                Vault
              </Link>
              <Link
                href="/pad"
                className={`px-2.5 py-1.5 rounded-lg transition-all duration-150 cursor-pointer ${
                  pathname.startsWith('/pad')
                    ? 'text-foreground bg-muted font-bold'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted/80'
                }`}
              >
                Live Pad
              </Link>
              <Link
                href="/api/docs"
                className={`px-2.5 py-1.5 rounded-lg transition-all duration-150 cursor-pointer ${
                  pathname === '/api/docs'
                    ? 'text-foreground bg-muted font-bold'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted/80'
                }`}
              >
                API Docs
              </Link>
            </nav>
          </div>

          {/* Right Tools & Identity */}
          <div className="flex items-center gap-2 sm:gap-2.5">
            {/* QR Scanner Trigger */}
            <button
              type="button"
              onClick={handleOpenQRScanner}
              className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-mono rounded-lg border border-border bg-muted/40 text-muted-foreground hover:text-foreground hover:bg-muted transition-all cursor-pointer"
              title="Scan QR Code (Camera / Image)"
            >
              <QrCode className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Scan QR</span>
            </button>

            {/* Command Palette Trigger */}
            <button
              type="button"
              onClick={handleOpenCommandPalette}
              className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-mono rounded-lg border border-border bg-muted/40 text-muted-foreground hover:text-foreground hover:bg-muted transition-all cursor-pointer"
              title="Open Command Palette (⌘+K)"
            >
              <span>Search</span>
              <kbd className="px-1 py-0.2 rounded bg-background border border-border text-[10px] text-foreground">⌘K</kbd>
            </button>

            {/* Identity key manager panel */}
            <IdentityPanel />

            {/* Theme switcher */}
            {mounted && (
              <Button
                variant="ghost"
                size="icon"
                onClick={toggleTheme}
                className="h-8 w-8 rounded-lg border border-border/60 bg-muted/30 text-muted-foreground hover:text-foreground hover:bg-muted hover:border-foreground/40 hover:scale-105 active:scale-95 transition-all duration-150 cursor-pointer shadow-sm"
                aria-label="Toggle theme"
                id="theme-toggle-btn"
              >
                {resolvedTheme === 'dark' ? (
                  <Sun className="h-4 w-4" />
                ) : (
                  <Moon className="h-4 w-4" />
                )}
              </Button>
            )}

            {/* Create Paste Link - only on view pages */}
            {!isHome && (
              <Link href="/">
                <Button
                  size="sm"
                  className="h-8 px-3.5 text-xs font-semibold bg-foreground text-background hover:opacity-90 hover:scale-[1.02] active:scale-95 gap-1.5 rounded-lg transition-all shadow-md"
                >
                  <Plus className="h-3.5 w-3.5 text-background" />
                  <span>New Paste</span>
                </Button>
              </Link>
            )}
          </div>
        </div>
      </header>

      {/* Internal Modal Overlays for standalone pages (Vault, Viewer, API Docs) */}
      <AnimatePresence>
        {internalTrustVisualizerOpen && (
          <div
            onClick={() => setInternalTrustVisualizerOpen(false)}
            className="fixed inset-0 z-50 flex items-start justify-center p-4 sm:p-6 bg-background/80 backdrop-blur-md overflow-y-auto"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-5xl my-6 sm:my-10"
            >
              <TrustVisualizer onClose={() => setInternalTrustVisualizerOpen(false)} />
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <CommandPalette
        isOpen={internalCommandPaletteOpen}
        onClose={() => setInternalCommandPaletteOpen(false)}
        onOpenTrustVisualizer={() => setInternalTrustVisualizerOpen(true)}
        onOpenQRScanner={() => setInternalQRScannerOpen(true)}
      />

      <QRScannerModal
        isOpen={internalQRScannerOpen}
        onClose={() => setInternalQRScannerOpen(false)}
      />
    </>
  );
}

export default Header;
