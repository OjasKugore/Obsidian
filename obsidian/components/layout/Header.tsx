'use client';

import * as React from 'react';
import Link from 'next/link';
import { useTheme } from 'next-themes';
import { Moon, Sun, Plus, Shield } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { IdentityPanel } from '@/components/header/IdentityPanel';

export function Header() {
  const { setTheme, theme, resolvedTheme } = useTheme();
  const mounted = React.useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  );

  const toggleTheme = () => {
    const current = resolvedTheme || theme;
    setTheme(current === 'dark' ? 'light' : 'dark');
  };

  return (
    <header className="sticky top-0 z-40 w-full border-b border-border bg-background/90 backdrop-blur-md transition-colors">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-8">
        {/* Brand & Nav */}
        <div className="flex items-center gap-8">
          <Link
            href="/"
            className="flex items-center gap-2.5 transition-transform active:scale-95"
          >
            <div className="flex h-7 w-7 items-center justify-center rounded bg-foreground text-background font-bold">
              <Shield className="h-4 w-4 fill-current text-background" />
            </div>
            <span className="font-mono text-lg font-bold tracking-tight text-foreground">
              OBSIDIAN
            </span>
          </Link>

          <nav className="hidden md:flex items-center gap-6 text-xs font-mono text-muted-foreground">
            <span className="hover:text-foreground transition-colors cursor-pointer">Explore</span>
            <span className="hover:text-foreground transition-colors cursor-pointer">Protocol</span>
            <span className="hover:text-foreground transition-colors cursor-pointer">Security</span>
          </nav>
        </div>

        {/* Right Tools & Identity */}
        <div className="flex items-center gap-3">
          {/* Identity key manager panel */}
          <IdentityPanel />

          {/* Theme switcher */}
          {mounted && (
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleTheme}
              className="h-8 w-8 rounded text-muted-foreground hover:text-foreground hover:bg-muted"
              aria-label="Toggle theme"
              id="theme-toggle-btn"
            >
              {resolvedTheme === 'dark' ? (
                <Sun className="h-4 w-4 transition-transform hover:rotate-45" />
              ) : (
                <Moon className="h-4 w-4 transition-transform hover:-rotate-12" />
              )}
            </Button>
          )}

          {/* Create Paste Link */}
          <Link href="/">
            <Button
              size="sm"
              className="h-8 px-3.5 text-xs font-semibold bg-foreground text-background hover:opacity-90 gap-1.5 rounded transition-all"
            >
              <Plus className="h-3.5 w-3.5 text-background" />
              <span>Create Paste</span>
            </Button>
          </Link>
        </div>
      </div>
    </header>
  );
}

export default Header;
