'use client';

/**
 * components/collab/CollabIndicator.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Real-time collaboration status bar for E2EE live editing.
 * Strict monochrome styling matching Obsidian design standards.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import * as React from 'react';
import {
  Users,
  Wifi,
  WifiOff,
  ShieldCheck,
  Lock,
  Sparkles,
  Radio,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { Collaborator } from '@/hooks/useCollab';

interface CollabIndicatorProps {
  isConnected: boolean;
  isConnecting: boolean;
  isLocalMode?: boolean;
  collaborators: Collaborator[];
  currentUser: Collaborator | null;
  typingUsers: string[];
  onLockPaste?: () => void;
  isLocked?: boolean;
}

export function CollabIndicator({
  isConnected,
  isConnecting,
  isLocalMode = false,
  collaborators,
  currentUser,
  typingUsers,
  onLockPaste,
  isLocked = false,
}: CollabIndicatorProps) {
  // ── SETUP ──────────────────────────────────────────────────────────────

  // Computed active collaborators count (ensures minimum display count of 1 for self)
  const activeCount = Math.max(1, collaborators.length);

  // ── UI ─────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-border bg-card p-3 font-mono shadow-sm transition-all min-h-[64px] justify-center">
      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* Left: Connection Status & Encryption Mode Badge */}
        <div className="flex items-center gap-2.5">
          {/* Connection Status Icon Indicator */}
          <div className="relative flex h-7 w-7 shrink-0 items-center justify-center rounded bg-muted border border-border text-foreground">
            {isConnected ? (
              <>
                <Radio className="h-3.5 w-3.5 text-foreground" />
                <span className="absolute -top-0.5 -right-0.5 flex h-2 w-2">
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-foreground" />
                </span>
              </>
            ) : isConnecting ? (
              <Wifi className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
            ) : (
              <WifiOff className="h-3.5 w-3.5 text-muted-foreground" />
            )}
          </div>

          {/* Connection Status Title & Protocol Badge */}
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-tight text-foreground">
                {isLocked
                  ? 'Paste Finalized (Read-Only)'
                  : isConnected
                  ? 'E2EE Live Collaboration Active'
                  : isConnecting
                  ? 'Connecting to Encrypted Room...'
                  : 'Live Collab Disconnected'}
              </span>
              <Badge
                variant="outline"
                className="hidden sm:inline-flex text-[10px] px-1.5 py-0 uppercase tracking-wider font-mono"
              >
                {isLocalMode ? 'Local Relay' : 'Pusher WSS'}
              </Badge>
            </div>
            <p className="text-[10px] text-muted-foreground flex items-center gap-1">
              <ShieldCheck className="h-3 w-3 text-foreground shrink-0 inline" />
              <span>All keystrokes AES-256-GCM encrypted in browser</span>
            </p>
          </div>
        </div>

        {/* Right: Active Collaborator Avatars, Peer Count & Lock Action */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Active Collaborator Avatar Stack */}
          <div className="flex items-center -space-x-1.5 py-0.5">
            {collaborators.length > 0 ? (
              collaborators.slice(0, 5).map((collab) => (
                <div
                  key={collab.id}
                  title={`${collab.name}${collab.id === currentUser?.id ? ' (You)' : ''}`}
                  className="relative flex h-6 w-6 items-center justify-center rounded-full border border-border bg-muted text-[10px] font-bold text-foreground shadow-sm transition-transform hover:scale-110 hover:z-10 cursor-pointer"
                >
                  {collab.name.charAt(0).toUpperCase()}
                </div>
              ))
            ) : (
              <div
                title={currentUser?.name || 'You'}
                className="flex h-6 w-6 items-center justify-center rounded-full border border-border bg-muted text-[10px] font-bold text-foreground shadow-sm"
              >
                {currentUser?.name ? currentUser.name.charAt(0).toUpperCase() : 'Y'}
              </div>
            )}

            {collaborators.length > 5 && (
              <div className="flex h-6 w-6 items-center justify-center rounded-full border border-border bg-muted text-[9px] font-bold text-muted-foreground">
                +{collaborators.length - 5}
              </div>
            )}
          </div>

          {/* Active Peer Count Badge */}
          <div className="flex items-center gap-1 text-[11px] text-muted-foreground font-mono bg-background px-2 py-0.5 rounded border border-border shrink-0">
            <Users className="h-3 w-3 text-foreground" />
            <span>{activeCount} {activeCount === 1 ? 'peer' : 'peers'}</span>
          </div>

          {/* Lock & Finalize Paste Button */}
          {onLockPaste && !isLocked && (
            <Button
              size="sm"
              variant="outline"
              onClick={onLockPaste}
              className="h-7 text-xs gap-1.5 font-mono border-border bg-background hover:bg-muted text-foreground shrink-0"
            >
              <Lock className="h-3 w-3" />
              <span>Lock & Finalize</span>
            </Button>
          )}
        </div>
      </div>

      {/* Typing Indicator Bar */}
      {typingUsers.length > 0 && (
        <div className="flex items-center gap-2 pt-1 border-t border-border text-[10px] text-muted-foreground font-mono">
          <Sparkles className="h-3 w-3 text-foreground shrink-0" />
          <span>
            {typingUsers.length === 1
              ? `${typingUsers[0]} is typing...`
              : `${typingUsers.join(', ')} are typing...`}
          </span>
        </div>
      )}
    </div>
  );
}

export default CollabIndicator;
