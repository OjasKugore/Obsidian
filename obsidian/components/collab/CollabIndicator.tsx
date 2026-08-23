'use client';

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
  const activeCount = Math.max(1, collaborators.length);

  return (
    <div className="flex flex-col gap-2 rounded-2xl border border-primary/20 bg-gradient-to-r from-primary/10 via-background/80 to-purple-500/10 p-3.5 backdrop-blur-xl shadow-lg shadow-primary/5 transition-all min-h-[68px] justify-center">
      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* Left: Connection Status & Mode Badge */}
        <div className="flex items-center gap-2.5">
          <div className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-primary/20 text-primary">
            {isConnected ? (
              <>
                <Radio className="h-4 w-4 text-emerald-400" />
                <span className="absolute -top-0.5 -right-0.5 flex h-2.5 w-2.5">
                  <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500 ring-2 ring-background" />
                </span>
              </>
            ) : isConnecting ? (
              <Wifi className="h-4 w-4 animate-spin text-amber-400" />
            ) : (
              <WifiOff className="h-4 w-4 text-muted-foreground" />
            )}
          </div>

          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold tracking-tight text-foreground">
                {isLocked
                  ? 'Paste Finalized (Read-Only)'
                  : isConnected
                  ? 'E2EE Live Collaboration Active'
                  : isConnecting
                  ? 'Connecting to Encrypted Room...'
                  : 'Live Collab Disconnected'}
              </span>
              <Badge
                variant="glow"
                className="hidden sm:inline-flex text-[10px] px-1.5 py-0 uppercase tracking-wider font-mono"
              >
                {isLocalMode ? 'Local Relay' : 'Pusher WSS'}
              </Badge>
            </div>
            <p className="text-[11px] text-muted-foreground flex items-center gap-1">
              <ShieldCheck className="h-3 w-3 text-emerald-400 shrink-0 inline" />
              <span>All keystrokes & awareness signals AES-256-GCM encrypted in browser</span>
            </p>
          </div>
        </div>

        {/* Right: Collaborator Avatars & Action */}
        <div className="flex items-center gap-2.5 shrink-0">
          {/* Avatar stack */}
          <div className="flex items-center -space-x-2 py-0.5">
            {collaborators.length > 0 ? (
              collaborators.slice(0, 5).map((collab) => (
                <div
                  key={collab.id}
                  title={`${collab.name}${collab.id === currentUser?.id ? ' (You)' : ''}`}
                  className="relative flex h-7 w-7 items-center justify-center rounded-full border-2 border-background text-[11px] font-bold text-white shadow-sm transition-transform hover:scale-110 hover:z-10 cursor-pointer"
                  style={{ backgroundColor: collab.color }}
                >
                  {collab.name.charAt(0)}
                </div>
              ))
            ) : (
              <div
                title={currentUser?.name || 'You'}
                className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-background bg-blue-600 text-[11px] font-bold text-white shadow-sm"
              >
                {currentUser?.name ? currentUser.name.charAt(0) : 'Y'}
              </div>
            )}

            {collaborators.length > 5 && (
              <div className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-background bg-muted text-[10px] font-bold text-muted-foreground">
                +{collaborators.length - 5}
              </div>
            )}
          </div>

          <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-mono bg-background/50 px-2 py-1 rounded-lg border border-border/40 shrink-0">
            <Users className="h-3.5 w-3.5 text-primary" />
            <span>{activeCount} {activeCount === 1 ? 'peer' : 'peers'}</span>
          </div>

          {onLockPaste && !isLocked && (
            <Button
              size="sm"
              variant="outline"
              onClick={onLockPaste}
              className="h-7 text-xs gap-1.5 border-amber-500/30 hover:border-amber-500/60 hover:bg-amber-500/10 text-amber-300 shrink-0"
            >
              <Lock className="h-3 w-3" />
              <span>Lock & Finalize</span>
            </Button>
          )}
        </div>
      </div>

      {/* Stable Typing Indicator Bar (Does not cause height jumps) */}
      {typingUsers.length > 0 && (
        <div className="flex items-center gap-2 pt-1 border-t border-border/30 text-[11px] text-primary font-medium animate-in fade-in duration-200">
          <Sparkles className="h-3 w-3 text-amber-400 shrink-0" />
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
