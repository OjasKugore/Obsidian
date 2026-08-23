'use client';

import * as React from 'react';
import Link from 'next/link';
import { useTheme } from 'next-themes';
import { Moon, Sun, Lock, PlusCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { IdentityPanel } from '@/components/header/IdentityPanel';

export function Header() {
  const { setTheme, resolvedTheme } = useTheme();
  const mounted = React.useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  );

  const toggleTheme = () => {
    setTheme(resolvedTheme === 'dark' ? 'light' : 'dark');
  };

  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-50 flex items-center justify-between p-4 sm:p-6">
      {/* Minimal Floating Brand Mark */}
      <Link
        href="/"
        className="pointer-events-auto group flex items-center gap-2 px-3 py-1.5 rounded-2xl glass-panel border border-white/10 shadow-lg backdrop-blur-xl transition-transform active:scale-95 hover:border-primary/40"
      >
        <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-gradient-to-tr from-blue-600 to-indigo-500 shadow-sm shadow-blue-500/20">
          <Lock className="h-3 w-3 text-white" />
        </div>
        <span className="text-sm font-semibold tracking-tight text-foreground">
          Obsidian
        </span>
      </Link>

      {/* Floating Action Capsule (New Paste, Key Management, Theme Toggle) */}
      <div className="pointer-events-auto flex items-center gap-2 p-1.5 rounded-2xl glass-panel border border-white/10 shadow-xl backdrop-blur-2xl">
        <Link href="/">
          <Button
            variant="ghost"
            size="sm"
            className="h-8 px-2.5 sm:px-3 text-xs gap-1.5 rounded-xl hover:bg-white/10 text-foreground font-medium"
          >
            <PlusCircle className="h-3.5 w-3.5 text-primary" />
            <span className="hidden sm:inline">New Paste</span>
          </Button>
        </Link>

        {/* Identity key manager panel */}
        <IdentityPanel />

        {/* Theme switcher */}
        {mounted && (
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleTheme}
            className="h-8 w-8 rounded-xl hover:bg-white/10"
            aria-label="Toggle theme"
          >
            {resolvedTheme === 'dark' ? (
              <Sun className="h-3.5 w-3.5 text-amber-400 transition-transform hover:rotate-45" />
            ) : (
              <Moon className="h-3.5 w-3.5 text-slate-700 transition-transform hover:-rotate-12" />
            )}
          </Button>
        )}
      </div>
    </div>
  );
}

export default Header;
