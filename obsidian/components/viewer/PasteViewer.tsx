'use client';

/**
 * components/viewer/PasteViewer.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Decrypted Paste Viewer Component.
 * Strict monochrome styling matching Obsidian design standards.
 * Handles client-side decryption, real-time collaboration, Shamir quorum assembly,
 * time-locks, and burn-after-reading destruction states.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import * as React from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  Lock,
  Flame,
  Copy,
  Check,
  ShieldCheck,
  AlertTriangle,
  FileText,
  Clock,
  PlusCircle,
  Eye,
  Layers,
  Sparkles,
  KeyRound,
  Edit3,
} from 'lucide-react';
import { usePasteDecryption } from '@/hooks/usePasteDecryption';
import { useCollab } from '@/hooks/useCollab';
import { encrypt } from '@/lib/crypto/cipher';
import { ShardQuorumPanel } from '@/components/viewer/ShardQuorumPanel';
import { PrivateKeyUnlock } from '@/components/viewer/PrivateKeyUnlock';
import { CommentSection } from '@/components/viewer/CommentSection';
import { CollabIndicator } from '@/components/collab/CollabIndicator';
import { MarkdownPreview } from '@/components/ui/markdown-preview';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

interface PasteViewerProps {
  pasteId: string;
}

export function PasteViewer({ pasteId }: PasteViewerProps) {
  // ── SETUP ──────────────────────────────────────────────────────────────

  // Custom hook managing decryption pipeline, state flags, and keys
  const {
    plaintext,
    formatter,
    meta,
    rawKey,
    isLoading,
    isDecrypting,
    error,
    isBurned,
    isTimeLocked,
    timelockedUntil,
    isShamir,
    threshold,
    totalShards,
    loadedShards,
    isQuorumNeeded,
    addShard,
    isAsymmetric,
    isAwaitingPrivateKey,
    decryptWithPrivateKey,
  } = usePasteDecryption(pasteId, true);

  // UI state for copy feedback indicator
  const [copied, setCopied] = React.useState(false);
  
  // Render mode state (formatted markdown preview vs raw code text)
  const [viewMode, setViewMode] = React.useState<'formatted' | 'raw'>('formatted');
  
  // Real-time collaborative editing state and finalized lock flags
  const [isCollabEditing, setIsCollabEditing] = React.useState(false);
  const [isLocked, setIsLocked] = React.useState(false);
  const [isFinalizing, setIsFinalizing] = React.useState(false);
  const [finalizedNotice, setFinalizedNotice] = React.useState(false);

  // Boolean flag enabling live collaborative editing (requires decrypted plaintext, key, and active room)
  const canCollab = Boolean(plaintext && rawKey && !isAsymmetric && !isBurned);

  // Callback handler triggered when a remote peer locks the paste session
  const handleRemoteLock = React.useCallback(() => {
    setIsLocked(true);
    setIsCollabEditing(false);
  }, []);

  // Real-time E2EE collaboration hook (handles WebSocket/Pusher connection & delta synchronization)
  const {
    isConnected: isCollabConnected,
    isConnecting: isCollabConnecting,
    isLocalMode,
    collaborators,
    currentUser,
    typingUsers,
    content: liveText,
    broadcastContent,
    broadcastLock,
    broadcastTyping,
    disconnect: disconnectCollab,
  } = useCollab({
    pasteId,
    rawKey,
    initialContent: plaintext || '',
    formatter,
    isAsymmetric,
    enabled: canCollab && !isLocked,
    onRemoteLock: handleRemoteLock,
  });

  // Display text picker (shows real-time collaborative edits if connected, else static decrypted plaintext)
  const displayText = isCollabConnected && liveText ? liveText : (plaintext || '');

  // ── ACTIONS ────────────────────────────────────────────────────────────

  // Finalizes and locks collaborative paste, re-encrypts updated text, and persists to DB
  const handleLockAndFinalize = async () => {
    if (!rawKey || isFinalizing) return;
    try {
      setIsFinalizing(true);
      
      // Broadcast lock event immediately to all connected peers
      broadcastLock(displayText);

      // Re-encrypt updated text with rawKey
      const enc = await encrypt(displayText, formatter, {
        burnAfterReading: false,
        openDiscussion: meta?.openDiscussion ?? true,
        customKey: rawKey,
      });

      // Persist updated ciphertext to DB
      const res = await fetch(`/api/v1/paste/${pasteId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          v: 2,
          ct: enc.ciphertext,
          adata: enc.adata,
        }),
      });

      if (!res.ok) {
        throw new Error('Failed to persist finalized paste');
      }

      setIsLocked(true);
      setIsCollabEditing(false);
      setFinalizedNotice(true);
      disconnectCollab();
    } catch (err) {
      console.error('[handleLockAndFinalize]', err);
    } finally {
      setIsFinalizing(false);
    }
  };

  // Copies decrypted plaintext directly to the system clipboard
  const copyToClipboard = async () => {
    if (!plaintext) return;
    try {
      await navigator.clipboard.writeText(plaintext);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy: ', err);
    }
  };

  // ── UI ─────────────────────────────────────────────────────────────────

  /* Loading & Decrypting State UI */
  if (isLoading || (isDecrypting && !isQuorumNeeded)) {
    return (
      <div className="w-full max-w-3xl mx-auto flex flex-col items-center justify-center min-h-[400px] p-8 font-mono">
        <motion.div
          animate={{ scale: [1, 1.04, 1], rotate: [0, 3, -3, 0] }}
          transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
          className="flex h-16 w-16 items-center justify-center rounded-lg bg-muted border border-border text-foreground shadow-lg mb-6"
        >
          <Lock className="h-8 w-8 text-foreground" />
        </motion.div>
        <h2 className="text-lg font-bold text-foreground mb-2 uppercase tracking-wide">
          {isDecrypting ? 'Decrypting Secret...' : 'Retrieving Ciphertext...'}
        </h2>
        <p className="text-xs text-muted-foreground max-w-md text-center">
          Running PBKDF2-SHA256 &amp; AES-256-GCM in your browser using SubtleCrypto.
        </p>
      </div>
    );
  }

  /* Shamir Quorum Collection UI (When more shards are needed) */
  if (!plaintext && isQuorumNeeded) {
    return (
      <ShardQuorumPanel
        threshold={threshold}
        totalShards={totalShards}
        loadedShards={loadedShards}
        onAddShard={addShard}
        isDecrypting={isDecrypting}
        error={error}
      />
    );
  }

  /* RSA-OAEP Asymmetric Private Key Prompt UI */
  if (isAsymmetric && isAwaitingPrivateKey) {
    return (
      <PrivateKeyUnlock
        onUnlock={decryptWithPrivateKey}
        decryptError={error}
        isDecrypting={isDecrypting}
      />
    );
  }

  /* Burn-After-Reading Destruction UI */
  if (!plaintext && (isBurned || (error && error.includes('burned')))) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-2xl mx-auto my-8 p-6 sm:p-8 rounded-lg border border-border bg-card flex flex-col items-center text-center shadow-xl font-mono"
      >
        <div className="flex h-14 w-14 items-center justify-center rounded bg-muted border border-border text-foreground mb-5">
          <Flame className="h-7 w-7 text-foreground" />
        </div>
        <h2 className="text-xl font-bold text-foreground mb-2 uppercase tracking-wide">
          This Paste Has Been Burned
        </h2>
        <p className="text-xs text-muted-foreground max-w-md mb-6 leading-relaxed">
          This secret was configured to <strong>burn after reading</strong>. It has been permanently wiped from the server database upon its initial view.
        </p>
        <div className="flex items-center gap-3">
          <Link href="/">
            <Button className="gap-2 font-mono text-xs font-bold bg-foreground text-background hover:opacity-90">
              <PlusCircle className="h-4 w-4" />
              Create a New Paste
            </Button>
          </Link>
        </div>
      </motion.div>
    );
  }

  /* Time-Locked Paste UI */
  if (isTimeLocked) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-2xl mx-auto my-8 p-6 sm:p-8 rounded-lg border border-border bg-card flex flex-col items-center text-center shadow-xl font-mono"
      >
        <div className="flex h-14 w-14 items-center justify-center rounded bg-muted border border-border text-foreground mb-5">
          <Clock className="h-7 w-7 text-foreground" />
        </div>
        <h2 className="text-xl font-bold text-foreground mb-2 uppercase tracking-wide">
          Paste is Time-Locked
        </h2>
        <p className="text-xs text-muted-foreground max-w-md mb-6 leading-relaxed">
          The author set a cryptographic time-lock on this paste. It cannot be decrypted until{' '}
          <strong className="text-foreground font-mono">
            {timelockedUntil ? new Date(timelockedUntil).toLocaleString() : 'the scheduled time'}
          </strong>.
        </p>
        <Link href="/">
          <Button variant="outline" className="font-mono text-xs">Back to Home</Button>
        </Link>
      </motion.div>
    );
  }

  /* Decryption Failure Error UI */
  if (error) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-2xl mx-auto my-8 p-6 sm:p-8 rounded-lg border border-destructive/30 bg-card flex flex-col items-center text-center shadow-xl font-mono"
      >
        <div className="flex h-14 w-14 items-center justify-center rounded bg-destructive/10 border border-destructive/25 text-destructive mb-5">
          <AlertTriangle className="h-7 w-7 text-destructive" />
        </div>
        <h2 className="text-xl font-bold text-destructive mb-2 uppercase tracking-wide">
          Decryption Failed
        </h2>
        <p className="text-xs text-muted-foreground max-w-md mb-6 leading-relaxed">
          {error}
        </p>
        <Link href="/">
          <Button variant="outline" className="font-mono text-xs">Create a New Paste</Button>
        </Link>
      </motion.div>
    );
  }

  /* Decrypted Paste Viewer & Real-time Editor Main UI */
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="w-full max-w-4xl mx-auto flex flex-col gap-4 font-mono"
    >
      {/* Asymmetric RSA-OAEP Key Unlocked Banner */}
      {isAsymmetric && (
        <div className="flex items-center justify-between gap-3 p-3.5 rounded-lg bg-indigo-500/10 border border-indigo-500/25 text-indigo-300 text-xs">
          <div className="flex items-center gap-2">
            <KeyRound className="h-4 w-4 shrink-0 text-indigo-400" />
            <span>
              <strong>RSA-OAEP Unlocked:</strong> AES-256 key unwrapped with your RSA private key in-browser.
            </span>
          </div>
          <Badge variant="outline" className="shrink-0 text-[10px] border-indigo-500/30 text-indigo-300">
            Asymmetric
          </Badge>
        </div>
      )}

      {/* Shamir Quorum Reconstructed Banner */}
      {isShamir && (
        <div className="flex items-center justify-between gap-3 p-3.5 rounded-lg bg-cyan-500/10 border border-cyan-500/25 text-cyan-300 text-xs">
          <div className="flex items-center gap-2">
            <Layers className="h-4 w-4 shrink-0 text-cyan-400" />
            <span>
              <strong>Quorum Satisfied ({threshold}-of-{totalShards} SSS):</strong> All required shards collected and verified. Key reconstructed in-memory.
            </span>
          </div>
          <Badge variant="outline" className="shrink-0 text-[10px] border-cyan-500/30 text-cyan-300">
            Reconstructed
          </Badge>
        </div>
      )}

      {/* Burn-After-Reading Alert Banner */}
      {meta?.burnAfterReading && (
        <div className="flex items-center justify-between gap-3 p-3.5 rounded-lg bg-amber-500/10 border border-amber-500/25 text-amber-300 text-xs">
          <div className="flex items-center gap-2">
            <Flame className="h-4 w-4 shrink-0 text-amber-400 animate-pulse" />
            <span>
              <strong>1-Time View:</strong> This paste was permanently destroyed from the server database upon opening.
            </span>
          </div>
          <Badge variant="outline" className="shrink-0 text-[10px] border-amber-500/30 text-amber-300">
            Burned
          </Badge>
        </div>
      )}

      {/* Real-Time E2EE Collaboration Status Bar */}
      {canCollab && (
        <CollabIndicator
          isConnected={isCollabConnected}
          isConnecting={isCollabConnecting}
          isLocalMode={isLocalMode}
          collaborators={collaborators}
          currentUser={currentUser}
          typingUsers={typingUsers}
          isLocked={isLocked}
          onLockPaste={handleLockAndFinalize}
        />
      )}

      {/* Finalized Paste Locked Banner */}
      {finalizedNotice && (
        <div className="flex items-center justify-between gap-3 p-3.5 rounded-lg bg-emerald-500/10 border border-emerald-500/25 text-emerald-300 text-xs">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 shrink-0 text-emerald-400" />
            <span>
              <strong>Sealed:</strong> Edits re-encrypted and permanently saved. Live session locked.
            </span>
          </div>
          <Badge variant="outline" className="shrink-0 text-[10px] border-emerald-500/30 text-emerald-300">
            Finalized
          </Badge>
        </div>
      )}

      {/* Main Decrypted Code / Document Card */}
      <div className="rounded-xl border border-border/80 bg-card/95 p-5 sm:p-7 flex flex-col gap-4 shadow-xl soft-shadow relative overflow-hidden">
        {/* Viewer Top Toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-border">
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-emerald-500/10 border border-emerald-500/25 text-xs text-emerald-300 font-bold uppercase">
              <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
              <span>Decrypted: {formatter}</span>
            </div>

            {/* Markdown Rendered / Raw View Switcher */}
            {formatter === 'markdown' && !isCollabEditing && (
              <div className="flex items-center rounded bg-background p-0.5 border border-border text-xs">
                <button
                  type="button"
                  onClick={() => setViewMode('formatted')}
                  className={`flex items-center gap-1 px-2 py-0.5 rounded transition-all text-xs font-mono ${
                    viewMode === 'formatted'
                      ? 'bg-muted text-foreground font-bold'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <Sparkles className="h-3 w-3 text-foreground" />
                  Rendered
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('raw')}
                  className={`flex items-center gap-1 px-2 py-0.5 rounded transition-all text-xs font-mono ${
                    viewMode === 'raw'
                      ? 'bg-muted text-foreground font-bold'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <FileText className="h-3 w-3 text-foreground" />
                  Raw
                </button>
              </div>
            )}

            {/* Live Collab Editing View Toggle */}
            {canCollab && !isLocked && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsCollabEditing((prev) => !prev)}
                className="h-7 text-xs gap-1.5 font-mono border-border bg-background hover:bg-muted"
              >
                <Edit3 className="h-3.5 w-3.5 text-foreground" />
                <span>{isCollabEditing ? 'Reading View' : 'Live Collab Edit'}</span>
              </Button>
            )}
          </div>

          {/* Line Counter & Copy Action Button */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground hidden sm:inline">
              {displayText.split('\n').length} {displayText.split('\n').length === 1 ? 'line' : 'lines'} • {displayText.length.toLocaleString()} chars
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={copyToClipboard}
              className="gap-1.5 font-mono text-xs h-8 border-border bg-background hover:bg-muted"
            >
              {copied ? (
                <>
                  <Check className="h-3.5 w-3.5 text-foreground" />
                  <span>Copied</span>
                </>
              ) : (
                <>
                  <Copy className="h-3.5 w-3.5 text-foreground" />
                  <span>Copy Text</span>
                </>
              )}
            </Button>
          </div>
        </div>

        {/* Content View Canvas (Collaborative Editor vs Rendered Markdown vs Raw Text) */}
        {isCollabEditing ? (
          <div className="flex flex-col gap-2">
            <textarea
              value={displayText}
              onChange={(e) => {
                broadcastContent(e.target.value);
                broadcastTyping();
              }}
              onKeyDown={() => broadcastTyping()}
              placeholder="Type to collaborate in real-time..."
              className="w-full min-h-[240px] rounded bg-background border border-border p-4 font-mono text-xs sm:text-sm leading-relaxed text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:border-foreground/50 resize-y"
            />
            <p className="text-[11px] text-muted-foreground flex items-center justify-between">
              <span>Edits are encrypted and broadcast to all connected peers in real-time.</span>
              <span className="font-mono text-[10px] text-foreground">Live Sync Ready</span>
            </p>
          </div>
        ) : formatter === 'markdown' && viewMode === 'formatted' ? (
          <div className="relative rounded bg-background/50 border border-border p-5 sm:p-6 overflow-x-auto min-h-[140px] text-foreground">
            <MarkdownPreview content={displayText} />
          </div>
        ) : (
          <div className="relative rounded bg-background/50 border border-border p-4 sm:p-5 overflow-x-auto min-h-[140px]">
            <pre className="font-mono text-xs sm:text-sm leading-relaxed text-foreground whitespace-pre-wrap break-words">
              {displayText}
            </pre>
          </div>
        )}

        {/* Footer Metadata Info Bar */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 text-xs text-muted-foreground border-t border-border">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <Clock className="h-3.5 w-3.5 text-foreground" />
              {meta?.createdAt ? new Date(meta.createdAt).toLocaleString() : 'Just now'}
            </span>
            {meta?.views !== undefined && (
              <span className="flex items-center gap-1">
                <Eye className="h-3.5 w-3.5 text-foreground" />
                View #{meta.views}
              </span>
            )}
          </div>
          <Link href="/" className="text-foreground hover:underline flex items-center gap-1">
            <PlusCircle className="h-3.5 w-3.5" />
            Create another paste
          </Link>
        </div>
      </div>

      {/* End-to-End Encrypted Comment Thread Section */}
      {meta?.openDiscussion && rawKey && (
        <CommentSection pasteId={pasteId} rawKey={rawKey} />
      )}
    </motion.div>
  );
}

export default PasteViewer;
