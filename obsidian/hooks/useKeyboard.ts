'use client';

/**
 * hooks/useKeyboard.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Global keyboard shortcuts hook for Obsidian.
 * Supports:
 *   - Cmd+K / Ctrl+K : Toggle Command Palette
 *   - Cmd+Enter / Ctrl+Enter : Submit / Encrypt
 *   - Esc : Close active dialogs / modals
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { useEffect } from 'react';

export interface ShortcutHandlers {
  onOpenCommandPalette?: () => void;
  onSubmit?: () => void;
  onEscape?: () => void;
  onToggleTheme?: () => void;
}

export function useKeyboard(handlers: ShortcutHandlers) {
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const isCmdOrCtrl = e.metaKey || e.ctrlKey;

      // Cmd+K / Ctrl+K -> Command Palette
      if (isCmdOrCtrl && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault();
        handlers.onOpenCommandPalette?.();
        return;
      }

      // Cmd+Enter / Ctrl+Enter -> Submit
      if (isCmdOrCtrl && e.key === 'Enter') {
        handlers.onSubmit?.();
        return;
      }

      // Esc -> Escape/Close
      if (e.key === 'Escape') {
        handlers.onEscape?.();
        return;
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handlers]);
}
