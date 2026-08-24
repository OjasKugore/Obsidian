'use client';

/**
 * components/layout/Header.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Main Navigation Header Component.
 * Contains brand logo, quick navigation links, identity key manager modal,
 * dark/light theme switcher, and "New Paste" call-to-action button.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTheme } from 'next-themes';
import { Moon, Sun, Plus, Shield } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { IdentityPanel } from '@/components/header/IdentityPanel';

export function Header() {
  // ── SETUP ──────────────────────────────────────────────────────────────

  // Active URL path location (used to detect if current page is homepage)
  const pathname = usePathname();

  // Dark/Light mode theme state & setter (provided by next-themes)
  const { setTheme, theme, resolvedTheme } = useTheme();

  // Client-side hydration sync flag (prevents SSR theme mismatch flickers)
  const mounted = React.useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  );

  // Computed homepage checker flag (returns true if on '/')
  const isHome = pathname === '/';

  // ── ACTIONS ────────────────────────────────────────────────────────────

  // Toggles active application theme between dark and light modes
  const toggleTheme = () => {
    const current = resolvedTheme || theme;
    setTheme(current === 'dark' ? 'light' : 'dark');
  };

  // ── UI ─────────────────────────────────────────────────────────────────

  return (
    <header className="sticky top-0 z-40 w-full border-b border-border bg-background/95 backdrop-blur-sm transition-colors">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-8">
        {/* Brand Logo & Navigation Links */}
        <div className="flex items-center gap-8">
          {/* Obsidian Brand Logo Link */}
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

          {/* Navigation Links (Explore, Protocol, Security) */}
          <nav className="hidden md:flex items-center gap-2 text-xs font-mono">
            <span className="px-3 py-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/80 transition-all duration-150 cursor-pointer">
              Explore
            </span>
            <span className="px-3 py-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/80 transition-all duration-150 cursor-pointer">
              Protocol
            </span>
            <span className="px-3 py-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/80 transition-all duration-150 cursor-pointer">
              Security
            </span>
          </nav>
        </div>

        {/* Right Tools & Identity Key Manager */}
        <div className="flex items-center gap-2.5">
          {/* Identity Key Management Trigger Panel */}
          <IdentityPanel />

          {/* Dark / Light Theme Toggle Button */}
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

          {/* "New Paste" Button (Shown only when viewing a paste subpage) */}
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
  );
}

export default Header;
