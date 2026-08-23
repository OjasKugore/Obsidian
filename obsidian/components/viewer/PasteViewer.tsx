'use client';

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

  const [copied, setCopied] = React.useState(false);
  const [viewMode, setViewMode] = React.useState<'formatted' | 'raw'>('formatted');
  const [isCollabEditing, setIsCollabEditing] = React.useState(false);
  const [isLocked, setIsLocked] = React.useState(false);
  const [isFinalizing, setIsFinalizing] = React.useState(false);
  const [finalizedNotice, setFinalizedNotice] = React.useState(false);

  const canCollab = Boolean(plaintext && rawKey && !isAsymmetric && !isBurned);

  const {
    isConnected: isCollabConnected,
    isConnecting: isCollabConnecting,
    isLocalMode,
    collaborators,
    currentUser,
    typingUsers,
    content: liveText,
    broadcastContent,
    broadcastTyping,
    disconnect: disconnectCollab,
  } = useCollab({
    pasteId,
    rawKey,
    initialContent: plaintext || '',
    formatter,
    isAsymmetric,
    enabled: canCollab && !isLocked,
  });

  const displayText = isCollabConnected && liveText ? liveText : (plaintext || '');

  const handleLockAndFinalize = async () => {
    if (!rawKey || isFinalizing) return;
    try {
      setIsFinalizing(true);
      // 1. Re-encrypt current collaborative displayText locally with the rawKey
      const enc = await encrypt(displayText, formatter, {
        burnAfterReading: false,
        openDiscussion: meta?.openDiscussion ?? true,
        customKey: rawKey,
      });

      // 2. Persist updated ciphertext to DB
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

  // ── Loading & Decrypting State ──────────────────────────────────────────────
  if (isLoading || (isDecrypting && !isQuorumNeeded)) {
    return (
      <div className="w-full max-w-3xl mx-auto flex flex-col items-center justify-center min-h-[400px] p-8">
        <motion.div
          animate={{ scale: [1, 1.05, 1], rotate: [0, 5, -5, 0] }}
          transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
          className="flex h-20 w-20 items-center justify-center rounded-3xl bg-blue-500/10 border border-blue-500/30 text-blue-400 shadow-[0_0_40px_-5px_rgba(59,130,246,0.3)] mb-6"
        >
          <Lock className="h-10 w-10" />
        </motion.div>
        <h2 className="text-xl font-bold text-foreground mb-2">
          {isDecrypting ? 'Decrypting Secret...' : 'Retrieving Ciphertext...'}
        </h2>
        <p className="text-xs text-muted-foreground max-w-md text-center">
          Running PBKDF2-SHA256 &amp; AES-256-GCM in your browser using SubtleCrypto.
        </p>
      </div>
    );
  }

  // ── Shamir Quorum Panel (When more shards are required) ─────────────────────
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

  // ── Asymmetric RSA-OAEP: awaiting private key ────────────────────────────────
  if (isAsymmetric && isAwaitingPrivateKey) {
    return (
      <PrivateKeyUnlock
        onUnlock={decryptWithPrivateKey}
        decryptError={error}
        isDecrypting={isDecrypting}
      />
    );
  }

  // ── 404 / Burned After Reading State ────────────────────────────────────────
  if (!plaintext && (isBurned || (error && error.includes('burned')))) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-2xl mx-auto my-8 p-6 sm:p-8 rounded-3xl glass-panel border border-amber-500/30 flex flex-col items-center text-center shadow-2xl"
      >
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-400 mb-5 shadow-inner">
          <Flame className="h-8 w-8" />
        </div>
        <h2 className="text-2xl font-bold text-foreground mb-2">
          This Paste Has Been Burned
        </h2>
        <p className="text-sm text-muted-foreground max-w-md mb-6 leading-relaxed">
          This secret was configured to <strong>burn after reading</strong>. It has been permanently and atomically wiped from the server database upon its initial view.
        </p>
        <div className="flex items-center gap-3">
          <Link href="/">
            <Button variant="glow" className="gap-2">
              <PlusCircle className="h-4 w-4" />
              Create a New Paste
            </Button>
          </Link>
        </div>
      </motion.div>
    );
  }

  // ── Time-Locked State ───────────────────────────────────────────────────────
  if (isTimeLocked) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-2xl mx-auto my-8 p-6 sm:p-8 rounded-3xl glass-panel border border-blue-500/30 flex flex-col items-center text-center shadow-2xl"
      >
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-500/10 border border-blue-500/30 text-blue-400 mb-5">
          <Clock className="h-8 w-8" />
        </div>
        <h2 className="text-2xl font-bold text-foreground mb-2">
          Paste is Time-Locked
        </h2>
        <p className="text-sm text-muted-foreground max-w-md mb-6 leading-relaxed">
          The author set a cryptographic time-lock on this paste. It cannot be decrypted until{' '}
          <strong className="text-foreground font-mono">
            {timelockedUntil ? new Date(timelockedUntil).toLocaleString() : 'the scheduled time'}
          </strong>.
        </p>
        <Link href="/">
          <Button variant="outline">Back to Home</Button>
        </Link>
      </motion.div>
    );
  }

  // ── Error State ─────────────────────────────────────────────────────────────
  if (error) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-2xl mx-auto my-8 p-6 sm:p-8 rounded-3xl glass-panel border border-destructive/40 flex flex-col items-center text-center shadow-2xl"
      >
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-destructive/10 border border-destructive/30 text-destructive mb-5">
          <AlertTriangle className="h-8 w-8" />
        </div>
        <h2 className="text-2xl font-bold text-foreground mb-2">
          Decryption Failed
        </h2>
        <p className="text-sm text-muted-foreground max-w-md mb-6 leading-relaxed">
          {error}
        </p>
        <Link href="/">
          <Button variant="outline">Create a New Paste</Button>
        </Link>
      </motion.div>
    );
  }

  // ── Success / Decrypted State ───────────────────────────────────────────────
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="w-full max-w-4xl mx-auto flex flex-col gap-4 animate-decrypt-reveal"
    >
      {/* Asymmetric RSA-OAEP success banner if applicable */}
      {isAsymmetric && (
        <div className="flex items-center justify-between gap-3 p-3.5 rounded-2xl bg-purple-500/10 border border-purple-500/25 text-purple-300 text-xs font-medium">
          <div className="flex items-center gap-2">
            <KeyRound className="h-4 w-4 shrink-0 text-purple-400" />
            <span>
              <strong>RSA-OAEP Unlocked:</strong> The AES-256 key was unwrapped using your RSA-2048 private key. Decryption completed in-browser.
            </span>
          </div>
          <Badge variant="outline" className="shrink-0 text-[10px] border-purple-500/40 text-purple-300">
            Asymmetric
          </Badge>
        </div>
      )}

      {/* Shamir Quorum Banner if applicable */}
      {isShamir && (
        <div className="flex items-center justify-between gap-3 p-3.5 rounded-2xl bg-blue-500/10 border border-blue-500/25 text-blue-300 text-xs font-medium">
          <div className="flex items-center gap-2">
            <Layers className="h-4 w-4 shrink-0 text-blue-400" />
            <span>
              <strong>Quorum Satisfied ({threshold}-of-{totalShards} SSS):</strong> All required key shards have been collected and verified. The AES key was reconstructed in-memory.
            </span>
          </div>
          <Badge variant="glow" className="shrink-0 text-[10px]">
            Reconstructed
          </Badge>
        </div>
      )}

      {/* Burn Notice Banner if applicable */}
      {meta?.burnAfterReading && (
        <div className="flex items-center justify-between gap-3 p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/25 text-amber-400 text-xs font-medium">
          <div className="flex items-center gap-2">
            <Flame className="h-4 w-4 shrink-0 animate-pulse" />
            <span>
              <strong>1-Time View:</strong> This paste has just been permanently deleted from the database. Reloading this page will return a 404.
            </span>
          </div>
          <Badge variant="warning" className="shrink-0 text-[10px]">
            Deleted
          </Badge>
        </div>
      )}

      {/* Real-Time E2EE Collaboration Bar */}
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

      {/* Finalized Sealed Notice */}
      {finalizedNotice && (
        <div className="flex items-center justify-between gap-3 p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/25 text-emerald-300 text-xs font-medium">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 shrink-0 text-emerald-400" />
            <span>
              <strong>Sealed to Database:</strong> Collaborative edits have been re-encrypted with your AES key and permanently saved to the server. The live room is now locked.
            </span>
          </div>
          <Badge variant="outline" className="shrink-0 text-[10px] border-emerald-500/40 text-emerald-300">
            Finalized
          </Badge>
        </div>
      )}

      {/* Main Content Card */}
      <div className="glass-panel rounded-3xl p-5 sm:p-7 flex flex-col gap-4 shadow-2xl relative overflow-hidden">
        {/* Viewer Toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-border/40">
          <div className="flex items-center gap-2">
            <Badge variant="glow" className="text-xs capitalize font-semibold gap-1.5 py-1 px-3">
              <ShieldCheck className="h-3.5 w-3.5 text-blue-400" />
              Decrypted: {formatter}
            </Badge>

            {formatter === 'markdown' && !isCollabEditing && (
              <div className="flex items-center rounded-lg bg-muted/60 p-0.5 border border-border/40 text-xs">
                <button
                  type="button"
                  onClick={() => setViewMode('formatted')}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-md transition-all ${
                    viewMode === 'formatted'
                      ? 'bg-background text-foreground shadow-sm font-medium'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <Sparkles className="h-3 w-3 text-purple-400" />
                  Rendered
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('raw')}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-md transition-all ${
                    viewMode === 'raw'
                      ? 'bg-background text-foreground shadow-sm font-medium'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <FileText className="h-3 w-3" />
                  Raw
                </button>
              </div>
            )}

            {canCollab && !isLocked && (
              <Button
                variant={isCollabEditing ? 'glow' : 'outline'}
                size="sm"
                onClick={() => setIsCollabEditing((prev) => !prev)}
                className="h-8 text-xs gap-1.5 font-medium"
              >
                <Edit3 className="h-3.5 w-3.5" />
                <span>{isCollabEditing ? 'Reading View' : 'Live Collab Edit'}</span>
              </Button>
            )}
          </div>

          {/* Right Action Bar */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground hidden sm:inline">
              {displayText.split('\n').length} {displayText.split('\n').length === 1 ? 'line' : 'lines'} • {displayText.length.toLocaleString()} chars
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={copyToClipboard}
              className="gap-1.5 font-medium border-border/80"
            >
              {copied ? (
                <>
                  <Check className="h-3.5 w-3.5 text-emerald-400" />
                  <span>Copied</span>
                </>
              ) : (
                <>
                  <Copy className="h-3.5 w-3.5" />
                  <span>Copy Text</span>
                </>
              )}
            </Button>
          </div>
        </div>

        {/* Content Display: Collaborative Edit vs Rendered vs Raw */}
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
              className="w-full min-h-[220px] rounded-2xl bg-black/50 border border-primary/40 p-4 font-mono text-sm leading-relaxed text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/40 selection:bg-primary/30 resize-y"
            />
            <p className="text-[11px] text-muted-foreground flex items-center justify-between">
              <span>⚡ Edits are encrypted and broadcast to all connected peers in real-time.</span>
              <span className="font-mono text-[10px] text-emerald-400">Live Sync Ready</span>
            </p>
          </div>
        ) : formatter === 'markdown' && viewMode === 'formatted' ? (
          <div className="relative rounded-2xl bg-black/40 border border-white/5 p-5 sm:p-6 overflow-x-auto min-h-[140px]">
            <MarkdownPreview content={displayText} />
          </div>
        ) : (
          <div className="relative rounded-2xl bg-black/40 border border-white/5 p-4 sm:p-5 overflow-x-auto min-h-[140px]">
            <pre className="font-mono text-sm leading-relaxed text-foreground whitespace-pre-wrap break-words selection:bg-primary/30">
              {displayText}
            </pre>
          </div>
        )}

        {/* Metadata Footer */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 text-xs text-muted-foreground border-t border-border/30">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <Clock className="h-3.5 w-3.5" />
              {meta?.createdAt ? new Date(meta.createdAt).toLocaleString() : 'Just now'}
            </span>
            {meta?.views !== undefined && (
              <span className="flex items-center gap-1">
                <Eye className="h-3.5 w-3.5" />
                View #{meta.views}
              </span>
            )}
          </div>
          <Link href="/" className="text-primary hover:underline flex items-center gap-1">
            <PlusCircle className="h-3.5 w-3.5" />
            Create another paste
          </Link>
        </div>
      </div>

      {/* End-to-End Encrypted Comment Thread */}
      {meta?.openDiscussion && rawKey && (
        <CommentSection pasteId={pasteId} rawKey={rawKey} />
      )}
    </motion.div>
  );
}
