'use client';

import * as React from 'react';
import Link from 'next/link';
import { useTheme } from 'next-themes';
import { ShieldCheck, Moon, Sun, Lock, PlusCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

export function Header() {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  const toggleTheme = () => {
    setTheme(resolvedTheme === 'dark' ? 'light' : 'dark');
  };

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/80 backdrop-blur-xl transition-colors">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        {/* Brand */}
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="group flex items-center gap-2.5 transition-transform active:scale-95"
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-500 shadow-md shadow-blue-500/20 group-hover:shadow-blue-500/40 transition-shadow">
              <Lock className="h-4 w-4 text-white" />
            </div>
            <div className="flex flex-col">
              <div className="flex items-center gap-2">
                <span className="text-lg font-bold tracking-tight text-foreground">
                  Obsidian
                </span>
                <Badge
                  variant="glow"
                  className="hidden sm:inline-flex text-[10px] px-1.5 py-0 uppercase tracking-widest font-bold"
                >
                  v2 E2EE
                </Badge>
              </div>
              <span className="hidden sm:block text-[11px] text-muted-foreground font-medium">
                Zero-Knowledge Encrypted Pastebin
              </span>
            </div>
          </Link>
        </div>

        {/* Status indicator + Actions */}
        <div className="flex items-center gap-2 sm:gap-3">
          <div className="hidden md:flex items-center gap-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 px-3 py-1 text-xs font-medium text-emerald-400">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <ShieldCheck className="h-3.5 w-3.5" />
            <span>Client-Side AES-GCM</span>
          </div>

          <Link href="/">
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 font-medium border-white/10"
            >
              <PlusCircle className="h-4 w-4 text-primary" />
              <span className="hidden sm:inline">New Paste</span>
            </Button>
          </Link>

          {/* Theme switcher */}
          {mounted && (
            <Button
              variant="glass"
              size="icon"
              onClick={toggleTheme}
              className="h-9 w-9 rounded-xl"
              aria-label="Toggle theme"
            >
              {resolvedTheme === 'dark' ? (
                <Sun className="h-4 w-4 text-amber-400 transition-transform rotate-0 hover:rotate-45" />
              ) : (
                <Moon className="h-4 w-4 text-slate-700 transition-transform rotate-0 hover:-rotate-12" />
              )}
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}
