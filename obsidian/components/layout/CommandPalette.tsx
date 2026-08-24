'use client';

/**
 * components/layout/CommandPalette.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Command Palette (Cmd+K / Ctrl+K) for Obsidian.
 * Instant access to cryptographic actions, live pads, vaults, templates,
 * CLI docs, identity management, and system preferences.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import * as React from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useTheme } from 'next-themes';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search,
  Plus,
  Shield,
  Key,
  Database,
  FileCode,
  Moon,
  Sun,
  Lock,
  QrCode,
  BookOpen,
  X,
  Users,
  Terminal,
  Radio,
  Flame,
  Clock,
  ShieldCheck,
  Fingerprint,
  FolderArchive,
  Layers,
} from 'lucide-react';
import { PASTE_TEMPLATES, TemplateItem } from '@/components/editor/PasteTemplates';

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectTemplate?: (template: TemplateItem) => void;
  onOpenTrustVisualizer?: () => void;
  onOpenQRScanner?: () => void;
}

interface CommandItem {
  id: string;
  title: string;
  category: 'Live Pad' | 'Vault' | 'Actions' | 'Cryptography' | 'Identity' | 'Documentation' | 'Templates' | 'Preferences';
  icon: React.ComponentType<{ className?: string }>;
  shortcut?: string;
  keywords?: string[];
  action: () => void;
}

export function CommandPalette({
  isOpen,
  onClose,
  onSelectTemplate,
  onOpenTrustVisualizer,
  onOpenQRScanner,
}: CommandPaletteProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [query, setQuery] = React.useState('');
  const [selectedIndex, setSelectedIndex] = React.useState(0);
  const inputRef = React.useRef<HTMLInputElement>(null);

  const toggleTheme = React.useCallback(() => {
    const next = (resolvedTheme || theme) === 'dark' ? 'light' : 'dark';
    setTheme(next);
  }, [theme, resolvedTheme, setTheme]);

  // Build comprehensive command list
  const commands: CommandItem[] = React.useMemo(() => {
    const list: CommandItem[] = [
      // ── Live E2EE Pad ───────────────────────────────────────────────────────
      {
        id: 'new-live-pad',
        title: 'Launch New Live E2EE Pad',
        category: 'Live Pad',
        icon: Users,
        shortcut: 'P',
        keywords: ['collab', 'collaboration', 'chat', 'realtime', 'war room', 'pad', 'live', 'sync', 'keystroke'],
        action: () => {
          router.push('/pad');
          onClose();
        },
      },
      {
        id: 'join-live-pad',
        title: 'Join Existing Collaborative Pad',
        category: 'Live Pad',
        icon: Radio,
        keywords: ['join room', 'collab join', 'pad link', 'remote peer'],
        action: () => {
          router.push('/pad');
          onClose();
        },
      },

      // ── Encrypted Vault ─────────────────────────────────────────────────────
      {
        id: 'open-vault',
        title: 'Encrypted Multi-Secret Vault Manager',
        category: 'Vault',
        icon: Database,
        shortcut: 'V',
        keywords: ['vault', 'portfolio', 'kubeconfig', 'passwords', 'credentials', 'multi-secret', 'manifest'],
        action: () => {
          router.push('/vault');
          onClose();
        },
      },
      {
        id: 'create-vault',
        title: 'Create New Multi-Secret Vault',
        category: 'Vault',
        icon: Plus,
        keywords: ['new vault', 'add secrets', 'bundle secrets'],
        action: () => {
          router.push('/vault');
          onClose();
        },
      },

      // ── Core Paste Actions ──────────────────────────────────────────────────
      {
        id: 'new-paste',
        title: 'New Encrypted Paste (Home)',
        category: 'Actions',
        icon: Plus,
        shortcut: 'N',
        keywords: ['create paste', 'new secret', 'drop secret', 'share link', 'home'],
        action: () => {
          if (pathname !== '/') router.push('/');
          onClose();
        },
      },
      {
        id: 'new-burn-paste',
        title: 'Create Burn-After-Reading Paste (1 View)',
        category: 'Actions',
        icon: Flame,
        keywords: ['burn', 'self destruct', '1 view', 'one-time secret'],
        action: () => {
          if (pathname !== '/') router.push('/');
          onClose();
        },
      },
      {
        id: 'scan-qr',
        title: 'Scan QR Code (Camera / File)',
        category: 'Actions',
        icon: QrCode,
        shortcut: 'Q',
        keywords: ['qr code', 'scan', 'camera', 'barcode', 'mobile join'],
        action: () => {
          onOpenQRScanner?.();
          onClose();
        },
      },

      // ── Cryptography & Security ─────────────────────────────────────────────
      {
        id: 'trust-visualizer',
        title: 'Zero-Knowledge Security Architecture & Proofs',
        category: 'Cryptography',
        icon: Shield,
        shortcut: 'S',
        keywords: ['security', 'protocol', 'trust', 'visualizer', 'proof', 'zero knowledge', 'rfc 3986'],
        action: () => {
          onOpenTrustVisualizer?.();
          onClose();
        },
      },
      {
        id: 'shamir-visualizer',
        title: 'Shamir Secret Sharing (SSS) Quorum Math',
        category: 'Cryptography',
        icon: Layers,
        keywords: ['shamir', 'sss', 'quorum', 'k-of-n', 'lagrange', 'polynomial', 'shards', 'gf(2^8)'],
        action: () => {
          onOpenTrustVisualizer?.();
          onClose();
        },
      },
      {
        id: 'rsa-shard-wrapping',
        title: 'RSA Shard Wrapping (Anti-Dealer Backdoor)',
        category: 'Cryptography',
        icon: ShieldCheck,
        keywords: ['dealer', 'backdoor', 'anti-dealer', 'rsa shard', 'encapsulation', 'custodian'],
        action: () => {
          onOpenTrustVisualizer?.();
          onClose();
        },
      },
      {
        id: 'asymmetric-crypto',
        title: 'RSA-OAEP Asymmetric Key Wrapping Model',
        category: 'Cryptography',
        icon: Key,
        keywords: ['rsa-oaep', 'asym', 'public key', 'private key', 'envelope encryption', 'sentinel'],
        action: () => {
          onOpenTrustVisualizer?.();
          onClose();
        },
      },

      // ── Documentation & Developer ───────────────────────────────────────────
      {
        id: 'cli-docs',
        title: 'Obsidian CLI Reference & Commands',
        category: 'Documentation',
        icon: Terminal,
        shortcut: 'C',
        keywords: ['cli', 'command line', 'terminal', 'npm run dev -- send', 'repo send', 'shamir split'],
        action: () => {
          router.push('/api/docs');
          onClose();
        },
      },
      {
        id: 'api-docs',
        title: 'REST API Specification & Swagger',
        category: 'Documentation',
        icon: BookOpen,
        shortcut: 'D',
        keywords: ['api docs', 'rest', 'swagger', 'curl', 'endpoints', 'v2 payload', 'adata'],
        action: () => {
          router.push('/api/docs');
          onClose();
        },
      },

      // ── Preferences ─────────────────────────────────────────────────────────
      {
        id: 'toggle-theme',
        title: `Switch to ${(resolvedTheme || theme) === 'dark' ? 'Light' : 'Dark'} Mode`,
        category: 'Preferences',
        icon: (resolvedTheme || theme) === 'dark' ? Sun : Moon,
        shortcut: 'T',
        keywords: ['theme', 'dark mode', 'light mode', 'appearance', 'color'],
        action: () => {
          toggleTheme();
          onClose();
        },
      },
    ];

    // Add templates if handler available
    if (onSelectTemplate) {
      PASTE_TEMPLATES.forEach((t) => {
        list.push({
          id: `template-${t.id}`,
          title: `Insert Template: ${t.title}`,
          category: 'Templates',
          icon: t.icon,
          keywords: ['template', t.title.toLowerCase(), t.formatter],
          action: () => {
            onSelectTemplate(t);
            onClose();
          },
        });
      });
    }

    return list;
  }, [pathname, router, onClose, onOpenTrustVisualizer, onOpenQRScanner, onSelectTemplate, resolvedTheme, theme, toggleTheme]);

  // Filter commands by search query with keyword matching
  const filteredCommands = React.useMemo(() => {
    if (!query.trim()) return commands;
    const q = query.toLowerCase();
    return commands.filter(
      (c) =>
        c.title.toLowerCase().includes(q) ||
        c.category.toLowerCase().includes(q) ||
        c.keywords?.some((k) => k.toLowerCase().includes(q))
    );
  }, [commands, query]);

  // Reset selected index when query changes
  React.useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  // Focus input on open
  React.useEffect(() => {
    if (isOpen) {
      setQuery('');
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  // Keyboard navigation inside palette
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) =>
        prev < filteredCommands.length - 1 ? prev + 1 : 0
      );
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) =>
        prev > 0 ? prev - 1 : filteredCommands.length - 1
      );
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const selected = filteredCommands[selectedIndex];
      if (selected) {
        selected.action();
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 sm:pt-28 px-4 bg-background/80 backdrop-blur-sm font-mono">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: -10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: -10 }}
          transition={{ duration: 0.15 }}
          className="w-full max-w-xl rounded-2xl border border-border bg-card shadow-2xl overflow-hidden flex flex-col"
        >
          {/* Search Header */}
          <div className="flex items-center gap-3 px-4 py-3.5 border-b border-border bg-muted/40">
            <Search className="h-4 w-4 text-muted-foreground shrink-0" />
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Search commands (e.g. pad, vault, shamir, rsa, cli, scan)..."
              className="w-full bg-transparent text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none"
            />
            {query ? (
              <button
                type="button"
                onClick={() => setQuery('')}
                className="text-muted-foreground hover:text-foreground cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            ) : (
              <kbd className="px-1.5 py-0.5 rounded bg-muted border border-border text-[10px] text-muted-foreground">
                ESC
              </kbd>
            )}
          </div>

          {/* Results List */}
          <div className="max-h-84 overflow-y-auto p-2 flex flex-col gap-1">
            {filteredCommands.length === 0 ? (
              <div className="p-8 text-center text-xs text-muted-foreground">
                No matching commands found for &ldquo;{query}&rdquo;
              </div>
            ) : (
              filteredCommands.map((cmd, idx) => {
                const Icon = cmd.icon;
                const isSelected = idx === selectedIndex;
                return (
                  <button
                    key={cmd.id}
                    type="button"
                    onClick={() => cmd.action()}
                    onMouseEnter={() => setSelectedIndex(idx)}
                    className={`flex items-center justify-between p-2.5 rounded-xl text-left text-xs transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-foreground text-background font-bold shadow-sm'
                        : 'text-foreground hover:bg-muted/70'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className={`p-1.5 rounded-lg ${
                          isSelected
                            ? 'bg-background text-foreground'
                            : 'bg-muted text-muted-foreground'
                        }`}
                      >
                        <Icon className="h-4 w-4 shrink-0" />
                      </div>
                      <span className="truncate">{cmd.title}</span>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <span
                        className={`text-[10px] uppercase tracking-wider ${
                          isSelected
                            ? 'text-background/80 font-normal'
                            : 'text-muted-foreground'
                        }`}
                      >
                        {cmd.category}
                      </span>
                      {cmd.shortcut && (
                        <kbd
                          className={`px-1.5 py-0.5 rounded text-[10px] ${
                            isSelected
                              ? 'bg-background/20 text-background border border-background/30'
                              : 'bg-muted border border-border text-muted-foreground'
                          }`}
                        >
                          {cmd.shortcut}
                        </kbd>
                      )}
                    </div>
                  </button>
                );
              })
            )}
          </div>

          {/* Footer Bar */}
          <div className="px-4 py-2.5 border-t border-border bg-muted/30 flex items-center justify-between text-[11px] text-muted-foreground select-none">
            <div className="flex items-center gap-3">
              <span>↑↓ Navigate</span>
              <span>•</span>
              <span>↵ Select</span>
              <span>•</span>
              <span>ESC Close</span>
            </div>
            <span className="font-semibold text-foreground">Obsidian Command System</span>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}

export default CommandPalette;
