'use client';

/**
 * components/pad/LivePad.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Dedicated Real-Time End-to-End Encrypted (E2EE) Collaborative Scratchpad.
 * Strict monochrome styling matching Obsidian design standards.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import * as React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Users,
  Radio,
  Wifi,
  WifiOff,
  Shield,
  ShieldCheck,
  Camera,
  Copy,
  Check,
  Lock,
  Unlock,
  QrCode,
  Eye,
  PenLine,
  Columns,
  Download,
  RotateCcw,
  Share2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { MarkdownPreview } from '@/components/ui/markdown-preview';
import { useCollab } from '@/hooks/useCollab';
import { SnapshotModal } from '@/components/pad/SnapshotModal';
import { QRCodeSVG } from 'qrcode.react';

interface LivePadProps {
  roomId: string;
  rawKey: Uint8Array;
}

export function LivePad({ roomId, rawKey }: LivePadProps) {
  const [viewMode, setViewMode] = React.useState<'split' | 'write' | 'preview'>('split');
  const [localText, setLocalText] = React.useState('');
  const [isLocked, setIsLocked] = React.useState(false);
  const [showSnapshotModal, setShowSnapshotModal] = React.useState(false);
  const [showQRModal, setShowQRModal] = React.useState(false);
  const [copiedLink, setCopiedLink] = React.useState(false);
  const [lockedNotice, setLockedNotice] = React.useState(false);

  const [isHost, setIsHost] = React.useState(false);

  React.useEffect(() => {
    if (typeof window !== 'undefined') {
      const isHostStored = sessionStorage.getItem(`obsidian_pad_host_${roomId}`) === 'true';
      setIsHost(isHostStored);
    }
  }, [roomId]);

  const handleRemoteLock = React.useCallback((finalText: string) => {
    setIsLocked(true);
    setLockedNotice(true);
    if (finalText) setLocalText(finalText);
  }, []);

  const handleRemoteUnlock = React.useCallback(() => {
    setIsLocked(false);
    setLockedNotice(false);
  }, []);

  const handleRemoteContent = React.useCallback((remoteText: string) => {
    setLocalText(remoteText);
  }, []);

  const {
    isConnected,
    isConnecting,
    isLocalMode,
    collaborators,
    currentUser,
    typingUsers,
    content: syncedText,
    broadcastContent,
    broadcastLock,
    broadcastUnlock,
    broadcastTyping,
  } = useCollab({
    pasteId: roomId,
    rawKey,
    initialContent: '',
    formatter: 'markdown',
    enabled: true,
    onRemoteContent: handleRemoteContent,
    onRemoteLock: handleRemoteLock,
    onRemoteUnlock: handleRemoteUnlock,
  });

  // Keep localText synchronized with inbound remote changes
  React.useEffect(() => {
    if (syncedText && syncedText !== localText) {
      setLocalText(syncedText);
    }
  }, [syncedText]);

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    if (isLocked) return;
    const next = e.target.value;
    setLocalText(next);
    broadcastContent(next);
    broadcastTyping();
  };

  const handleToggleLock = () => {
    if (!isHost) return;
    const nextLocked = !isLocked;
    setIsLocked(nextLocked);
    setLockedNotice(nextLocked);
    if (nextLocked) {
      broadcastLock(localText);
    } else {
      broadcastUnlock();
    }
  };

  const shareUrl = typeof window !== 'undefined' ? window.location.href : '';

  const copyShareLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    } catch {
      // fallback
    }
  };

  const lineCount = localText ? localText.split('\n').length : 1;
  const wordCount = localText.trim() ? localText.trim().split(/\s+/).length : 0;
  const charCount = localText.length;

  return (
    <div className="w-full max-w-6xl mx-auto flex flex-col gap-5 font-mono">
      {/* Top Workspace Header Bar */}
      <div className="rounded-xl border border-border bg-card p-4 sm:p-5 flex flex-col gap-4 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3 border-b border-border">
          {/* Room Status & Presence */}
          <div className="flex items-center gap-3">
            <div className="relative flex h-9 w-9 items-center justify-center rounded-xl bg-foreground text-background shadow-sm">
              <Users className="h-4 w-4" />
              {isConnected && (
                <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
                  <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-400 border-2 border-background" />
                </span>
              )}
            </div>

            <div className="flex flex-col">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-tight text-foreground">
                  Room: {roomId.slice(0, 12)}...
                </span>
                {isHost ? (
                  <Badge variant="outline" className="text-[10px] border-emerald-500/40 text-emerald-400 uppercase font-bold">
                    Host (Owner)
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-[10px] border-border uppercase">
                    Participant
                  </Badge>
                )}
                {isLocked && (
                  <Badge variant="outline" className="text-[10px] border-amber-500/40 text-amber-400 uppercase">
                    Locked (Read-Only)
                  </Badge>
                )}
              </div>
              <p className="text-[10px] text-muted-foreground flex items-center gap-1.5 mt-0.5">
                <ShieldCheck className="h-3.5 w-3.5 text-foreground shrink-0" />
                <span>Zero-Knowledge: End-to-end encrypted peer keystroke synchronization</span>
              </p>
            </div>
          </div>

          {/* Action Tools */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* Invite Button */}
            <Button
              size="sm"
              variant="outline"
              onClick={copyShareLink}
              className="h-8 text-xs font-mono gap-1.5 border-border"
            >
              {copiedLink ? (
                <>
                  <Check className="h-3.5 w-3.5 text-emerald-400" />
                  <span className="text-emerald-400 font-bold">Link Copied</span>
                </>
              ) : (
                <>
                  <Share2 className="h-3.5 w-3.5" />
                  <span>Invite Link</span>
                </>
              )}
            </Button>

            {/* QR Code */}
            <Button
              size="sm"
              variant="outline"
              onClick={() => setShowQRModal(true)}
              className="h-8 text-xs font-mono gap-1.5 border-border"
            >
              <QrCode className="h-3.5 w-3.5" />
              <span>QR</span>
            </Button>

            {/* Lock / Unlock Toggle (Host Only) */}
            {isHost ? (
              <Button
                size="sm"
                variant="outline"
                onClick={handleToggleLock}
                className={`h-8 text-xs font-mono gap-1.5 border-border ${
                  isLocked ? 'bg-amber-500/10 border-amber-500/40 text-amber-400' : ''
                }`}
                title="Only the room host can lock/unlock editing"
              >
                {isLocked ? (
                  <>
                    <Unlock className="h-3.5 w-3.5" />
                    <span>Unlock Room</span>
                  </>
                ) : (
                  <>
                    <Lock className="h-3.5 w-3.5" />
                    <span>Lock Room</span>
                  </>
                )}
              </Button>
            ) : isLocked ? (
              <div className="flex items-center gap-1.5 px-2.5 h-8 rounded-lg border border-amber-500/30 bg-amber-500/10 text-amber-400 text-[10px] font-mono font-bold uppercase">
                <Lock className="h-3 w-3" />
                <span>Locked by Host</span>
              </div>
            ) : null}

            {/* Snapshot to Encrypted Paste */}
            <Button
              size="sm"
              onClick={() => setShowSnapshotModal(true)}
              className="h-8 text-xs font-mono font-bold bg-foreground text-background hover:opacity-90 gap-1.5 shadow-sm"
            >
              <Camera className="h-3.5 w-3.5" />
              <span>Snapshot to Paste</span>
            </Button>
          </div>
        </div>

        {/* Collaborators Active Roster & Typing Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-muted-foreground text-[11px] font-bold uppercase">
              Peers ({collaborators.length}):
            </span>
            <div className="flex items-center gap-1.5 flex-wrap">
              {collaborators.map((c) => {
                const isMe = c.id === currentUser?.id;
                const isTyping = typingUsers.includes(c.id);
                return (
                  <span
                    key={c.id}
                    style={{ borderColor: c.color }}
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono border ${
                      isMe ? 'bg-muted text-foreground font-bold' : 'bg-background text-muted-foreground'
                    }`}
                  >
                    <span
                      className="h-1.5 w-1.5 rounded-full"
                      style={{ backgroundColor: c.color }}
                    />
                    <span>{c.name} {isMe && '(You)'}</span>
                    {isTyping && <span className="animate-pulse text-amber-400">typing...</span>}
                  </span>
                );
              })}
            </div>
          </div>

          {/* View Mode Switcher */}
          <div className="flex items-center gap-1 bg-background p-1 rounded-lg border border-border">
            <button
              type="button"
              onClick={() => setViewMode('split')}
              className={`p-1.5 rounded text-[11px] flex items-center gap-1 transition-colors cursor-pointer ${
                viewMode === 'split' ? 'bg-muted text-foreground font-bold' : 'text-muted-foreground hover:text-foreground'
              }`}
              title="Side-by-side Split View"
            >
              <Columns className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Split</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('write')}
              className={`p-1.5 rounded text-[11px] flex items-center gap-1 transition-colors cursor-pointer ${
                viewMode === 'write' ? 'bg-muted text-foreground font-bold' : 'text-muted-foreground hover:text-foreground'
              }`}
              title="Editor Only"
            >
              <PenLine className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Write</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('preview')}
              className={`p-1.5 rounded text-[11px] flex items-center gap-1 transition-colors cursor-pointer ${
                viewMode === 'preview' ? 'bg-muted text-foreground font-bold' : 'text-muted-foreground hover:text-foreground'
              }`}
              title="Rendered Markdown Preview"
            >
              <Eye className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Preview</span>
            </button>
          </div>
        </div>
      </div>

      {/* Lock Notice Banner: Synchronized across both windows */}
      {isLocked && (
        <motion.div
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-xs text-amber-400 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm"
        >
          <div className="flex items-center gap-2">
            <Lock className="h-4 w-4 shrink-0" />
            <span>
              <strong>Workspace Locked by Host (Read-Only):</strong> Keystrokes are frozen across all participants.
            </span>
          </div>
          {isHost ? (
            <Button
              size="sm"
              variant="outline"
              onClick={handleToggleLock}
              className="h-7 text-xs font-mono border-amber-500/40 text-amber-400 hover:bg-amber-500/20 shrink-0 self-start sm:self-auto gap-1"
            >
              <Unlock className="h-3 w-3" />
              <span>Unlock Workspace</span>
            </Button>
          ) : (
            <span className="text-[10px] text-amber-400/80 italic shrink-0">
              Only the room host can unlock
            </span>
          )}
        </motion.div>
      )}

      {/* Main Workspace Editor Grid */}
      <div className={`grid gap-4 ${viewMode === 'split' ? 'grid-cols-1 lg:grid-cols-2' : 'grid-cols-1'}`}>
        {/* Editor Area */}
        {(viewMode === 'split' || viewMode === 'write') && (
          <div className="rounded-xl border border-border bg-card p-4 flex flex-col gap-3 shadow-sm">
            <div className="flex items-center justify-between pb-2 border-b border-border text-[11px] text-muted-foreground">
              <span className="font-bold uppercase tracking-wider text-foreground flex items-center gap-1.5">
                <PenLine className="h-3.5 w-3.5 text-foreground" />
                <span>Markdown Workspace</span>
              </span>
              <span className={isLocked ? 'text-amber-400 font-bold' : ''}>
                {isLocked ? 'READ ONLY (LOCKED)' : 'SYNCING LIVE'}
              </span>
            </div>

            <textarea
              value={localText}
              onChange={handleTextChange}
              disabled={isLocked}
              placeholder="# Real-Time E2EE Live Pad&#10;&#10;Type here with your team. All keystrokes are encrypted with AES-256-GCM in real time before transmission..."
              className={`w-full min-h-[420px] bg-background rounded-lg border border-border p-4 text-xs sm:text-sm font-mono text-foreground focus:outline-none focus:border-foreground/50 resize-y leading-relaxed ${
                isLocked ? 'opacity-70 cursor-not-allowed bg-muted/20' : ''
              }`}
            />

            {/* Metrics footer */}
            <div className="flex items-center justify-between text-[10px] text-muted-foreground pt-1 border-t border-border/60">
              <span>{lineCount} lines • {wordCount} words • {charCount} characters</span>
              <span>AES-256-GCM Encrypted Channel</span>
            </div>
          </div>
        )}

        {/* Live Preview Area */}
        {(viewMode === 'split' || viewMode === 'preview') && (
          <div className="rounded-xl border border-border bg-card p-4 flex flex-col gap-3 shadow-sm">
            <div className="flex items-center justify-between pb-2 border-b border-border text-[11px] text-muted-foreground">
              <span className="font-bold uppercase tracking-wider text-foreground flex items-center gap-1.5">
                <Eye className="h-3.5 w-3.5 text-foreground" />
                <span>Live Rendered Output</span>
              </span>
              <span>Markdown</span>
            </div>

            <div className="w-full min-h-[420px] bg-background rounded-lg border border-border p-4 text-xs sm:text-sm text-foreground overflow-y-auto leading-relaxed">
              {localText.trim() ? (
                <MarkdownPreview content={localText} />
              ) : (
                <p className="text-muted-foreground/40 italic">Live rendered preview will appear here as you type...</p>
              )}
            </div>

            <div className="flex items-center justify-end text-[10px] text-muted-foreground pt-1 border-t border-border/60">
              <span>Zero Knowledge Rendering</span>
            </div>
          </div>
        )}
      </div>

      {/* QR Code Modal */}
      {showQRModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-6 shadow-2xl font-mono flex flex-col items-center gap-4 text-center">
            <h3 className="text-sm font-bold text-foreground">Scan to Join Live Pad</h3>
            <p className="text-[11px] text-muted-foreground">
              Scan with mobile camera to join this E2EE collaborative room directly.
            </p>

            <div className="p-4 rounded-xl bg-white shadow-md">
              <QRCodeSVG value={shareUrl} size={180} />
            </div>

            <Button
              size="sm"
              variant="outline"
              onClick={() => setShowQRModal(false)}
              className="text-xs font-mono w-full"
            >
              Close
            </Button>
          </div>
        </div>
      )}

      {/* Snapshot to Encrypted Paste Modal */}
      <SnapshotModal
        isOpen={showSnapshotModal}
        onClose={() => setShowSnapshotModal(false)}
        padContent={localText}
      />
    </div>
  );
}
