'use client';

/**
 * components/viewer/PasteViewer.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Decrypted Paste Viewer Component.
 * Immutable, zero-knowledge reader with Shamir quorum assembly,
 * private key unlock, burn receipts, and encrypted discussions.
 * Strict monochrome styling matching Obsidian design standards.
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
  KeyRound,
  FileCheck,
  Receipt,
  ShieldAlert,
} from 'lucide-react';
import { usePasteDecryption } from '@/hooks/usePasteDecryption';
import { ShardQuorumPanel } from '@/components/viewer/ShardQuorumPanel';
import { PrivateKeyUnlock } from '@/components/viewer/PrivateKeyUnlock';
import { CommentSection } from '@/components/viewer/CommentSection';
import { MarkdownPreview } from '@/components/ui/markdown-preview';
import { CodeViewer } from '@/components/ui/CodeViewer';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

function TimeLockCountdown({
  timelockedUntil,
  onExpire,
}: {
  timelockedUntil: string | null;
  onExpire: () => void;
}) {
  const [timeLeft, setTimeLeft] = React.useState<{
    days: number;
    hours: number;
    minutes: number;
    seconds: number;
  }>({ days: 0, hours: 0, minutes: 0, seconds: 0 });

  React.useEffect(() => {
    if (!timelockedUntil) return;
    const target = new Date(timelockedUntil).getTime();

    const updateTimer = () => {
      const diff = target - Date.now();
      if (diff <= 0) {
        setTimeLeft({ days: 0, hours: 0, minutes: 0, seconds: 0 });
        onExpire();
        return;
      }
      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
      const minutes = Math.floor((diff / (1000 * 60)) % 60);
      const seconds = Math.floor((diff / 1000) % 60);
      setTimeLeft({ days, hours, minutes, seconds });
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [timelockedUntil, onExpire]);

  return (
    <div className="grid grid-cols-4 gap-2 my-4 w-full max-w-xs">
      <div className="flex flex-col items-center p-2.5 rounded-xl bg-background border border-border">
        <span className="text-xl font-black text-foreground">{timeLeft.days}</span>
        <span className="text-[10px] text-muted-foreground uppercase font-bold">Days</span>
      </div>
      <div className="flex flex-col items-center p-2.5 rounded-xl bg-background border border-border">
        <span className="text-xl font-black text-foreground">{String(timeLeft.hours).padStart(2, '0')}</span>
        <span className="text-[10px] text-muted-foreground uppercase font-bold">Hours</span>
      </div>
      <div className="flex flex-col items-center p-2.5 rounded-xl bg-background border border-border">
        <span className="text-xl font-black text-foreground">{String(timeLeft.minutes).padStart(2, '0')}</span>
        <span className="text-[10px] text-muted-foreground uppercase font-bold">Mins</span>
      </div>
      <div className="flex flex-col items-center p-2.5 rounded-xl bg-background border border-border">
        <span className="text-xl font-black text-foreground">{String(timeLeft.seconds).padStart(2, '0')}</span>
        <span className="text-[10px] text-muted-foreground uppercase font-bold">Secs</span>
      </div>
    </div>
  );
}

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
    refetch,
  } = usePasteDecryption(pasteId, true);

  const [copied, setCopied] = React.useState(false);
  const [viewMode, setViewMode] = React.useState<'formatted' | 'raw'>('formatted');
  const [showReceiptModal, setShowReceiptModal] = React.useState(false);
  const [receiptVerificationState, setReceiptVerificationState] = React.useState<{
    loading: boolean;
    verified?: boolean;
    proofOfAbsence?: boolean;
    message?: string;
  } | null>(null);

  const handleVerifyReceipt = async () => {
    if (!meta?.burnReceipt) return;
    setReceiptVerificationState({ loading: true });
    try {
      const res = await fetch(`/api/v1/receipt/${pasteId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ receipt: meta.burnReceipt }),
      });
      const data = await res.json();
      setReceiptVerificationState({
        loading: false,
        verified: data.verified,
        proofOfAbsence: data.proofOfAbsence,
        message: data.message,
      });
    } catch (err) {
      setReceiptVerificationState({
        loading: false,
        verified: false,
        message: 'Verification request failed.',
      });
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
      <div className="w-full max-w-3xl mx-auto flex flex-col items-center justify-center min-h-[400px] p-8 font-mono">
        <motion.div
          animate={{ scale: [1, 1.04, 1], rotate: [0, 3, -3, 0] }}
          transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
          className="flex h-16 w-16 items-center justify-center rounded-lg bg-muted border border-border text-foreground shadow-lg mb-6"
        >
          <Lock className="h-8 w-8 text-foreground" />
        </motion.div>
        <div className="flex items-center gap-2">
          <span className="text-base font-bold text-foreground">
            {isLoading ? 'Fetching Encrypted Ciphertext...' : 'Decrypting in Client Memory...'}
          </span>
        </div>
        <p className="text-xs text-muted-foreground mt-2 max-w-md text-center leading-relaxed">
          Retrieving blind payload and decrypting locally with WebCrypto AES-256-GCM.
        </p>
      </div>
    );
  }

  // ── Multi-Party Shamir Quorum Required ──────────────────────────────────────
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

  // ── Asymmetric RSA-OAEP Private Key Required ────────────────────────────────
  if (!plaintext && isAwaitingPrivateKey) {
    return (
      <PrivateKeyUnlock
        onUnlock={decryptWithPrivateKey}
        isDecrypting={isDecrypting}
        decryptError={error}
      />
    );
  }

  // ── Time-Locked Paste ───────────────────────────────────────────────────────
  if (isTimeLocked) {
    return (
      <div className="w-full max-w-lg mx-auto flex flex-col items-center justify-center min-h-[400px] p-6 text-center font-mono">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-400 mb-4">
          <Clock className="h-7 w-7" />
        </div>
        <h2 className="text-lg font-bold text-foreground">Time-Locked Secret</h2>
        <p className="text-xs text-muted-foreground mt-1 max-w-sm leading-relaxed">
          This paste has been sealed with a cryptographic time-lock policy and cannot be accessed before the unlock timestamp.
        </p>

        <TimeLockCountdown
          timelockedUntil={timelockedUntil}
          onExpire={() => refetch()}
        />

        <div className="p-3 rounded-lg bg-muted/40 border border-border text-[11px] text-muted-foreground text-left max-w-sm w-full">
          <div className="flex justify-between">
            <span>Unlock Timestamp:</span>
            <span className="text-foreground font-bold font-mono">
              {timelockedUntil ? new Date(timelockedUntil).toLocaleString() : 'N/A'}
            </span>
          </div>
        </div>
      </div>
    );
  }

  // ── Burned / Expired / 404 State ───────────────────────────────────────────
  if (isBurned || (error && !plaintext)) {
    return (
      <div className="w-full max-w-lg mx-auto flex flex-col items-center justify-center min-h-[400px] p-6 text-center font-mono">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-400 mb-4">
          <Flame className="h-7 w-7" />
        </div>
        <h2 className="text-lg font-bold text-foreground">Secret Destroyed or Unavailable</h2>
        <p className="text-xs text-muted-foreground mt-1 max-w-sm leading-relaxed">
          {error || 'This paste does not exist, reached its maximum view limit, or was burned immediately after reading.'}
        </p>

        <Link
          href="/"
          className="mt-6 inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-foreground text-background text-xs font-bold font-mono hover:opacity-90 transition-opacity"
        >
          <PlusCircle className="h-4 w-4" />
          <span>Create New Encrypted Paste</span>
        </Link>
      </div>
    );
  }

  const viewsRemaining = meta?.maxViews ? meta.maxViews - (meta.views || 0) : null;
  const isBurnOnRead = meta?.burnAfterReading === true;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.98, y: 12 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ duration: 0.25, ease: 'easeOut' }}
      className="w-full max-w-4xl mx-auto flex flex-col gap-6 font-mono"
    >
      {/* Burn-After-Reading Alert Banner */}
      {isBurnOnRead && (
        <div className="flex items-center justify-between gap-3 p-3.5 rounded-lg bg-rose-500/10 border border-rose-500/25 text-rose-400 text-xs">
          <div className="flex items-center gap-2">
            <Flame className="h-4 w-4 shrink-0 text-rose-400" />
            <span>
              <strong>Burned After Reading:</strong> This secret has been permanently purged from server memory. It cannot be reloaded.
            </span>
          </div>
          <Badge variant="outline" className="shrink-0 text-[10px] border-rose-500/40 text-rose-400">
            Destroyed
          </Badge>
        </div>
      )}

      {/* Multi-View Remaining Counter Banner */}
      {!isBurnOnRead && meta?.maxViews && viewsRemaining !== null ? (
        <div className="flex items-center justify-between gap-3 p-3.5 rounded-lg bg-purple-500/10 border border-purple-500/25 text-purple-300 text-xs">
          <div className="flex items-center gap-2">
            <Eye className="h-4 w-4 shrink-0 text-purple-400" />
            <span>
              <strong>Limited View Policy:</strong>{' '}
              {viewsRemaining <= 0 ? (
                <span>This was the final view. The paste is now scheduled for permanent destruction.</span>
              ) : (
                <span>
                  {viewsRemaining} {viewsRemaining === 1 ? 'view' : 'views'} remaining before permanent deletion.
                </span>
              )}
            </span>
          </div>
          <Badge variant="outline" className="shrink-0 text-[10px] border-purple-500/30 text-purple-300">
            {meta.views}/{meta.maxViews} Views
          </Badge>
        </div>
      ) : null}

      {/* Main Content Card */}
      <div className="rounded-xl border border-border bg-card p-5 sm:p-7 flex flex-col gap-4 shadow-xl relative overflow-hidden">
        {/* Viewer Toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-border">
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-emerald-500/10 border border-emerald-500/25 text-xs text-emerald-300 font-bold uppercase">
              <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
              <span>Decrypted: {formatter}</span>
            </div>

            {formatter === 'markdown' && (
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
                  <Eye className="h-3 w-3 text-foreground" />
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
          </div>

          {/* Right Action Bar */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground hidden sm:inline">
              {plaintext ? plaintext.split('\n').length : 0} lines • {plaintext ? plaintext.length.toLocaleString() : 0} chars
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

        {/* Content Display: Rendered vs Raw */}
        {formatter === 'markdown' && viewMode === 'formatted' ? (
          <div className="relative rounded bg-background border border-border p-5 sm:p-6 overflow-x-auto min-h-[140px] text-foreground leading-relaxed">
            <MarkdownPreview content={plaintext || ''} />
          </div>
        ) : formatter === 'syntaxhighlighting' && viewMode === 'formatted' ? (
          <CodeViewer code={plaintext || ''} />
        ) : (
          <div className="relative rounded bg-background border border-border p-4 sm:p-5 overflow-x-auto min-h-[140px]">
            <pre className="font-mono text-xs sm:text-sm leading-relaxed text-foreground whitespace-pre-wrap break-words">
              {plaintext || ''}
            </pre>
          </div>
        )}

        {/* Metadata Footer */}
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
            {meta?.burnReceipt && (
              <button
                type="button"
                onClick={() => setShowReceiptModal(true)}
                className="text-amber-400 hover:underline flex items-center gap-1 cursor-pointer font-semibold"
              >
                <Receipt className="h-3.5 w-3.5" />
                <span>View Burn Receipt</span>
              </button>
            )}
          </div>
          <Link href="/" className="text-foreground hover:underline flex items-center gap-1">
            <PlusCircle className="h-3.5 w-3.5" />
            Create another paste
          </Link>
        </div>
      </div>

      {/* Burn Receipt Verification Modal */}
      {showReceiptModal && meta?.burnReceipt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-lg rounded-2xl border border-border bg-card p-6 shadow-2xl flex flex-col gap-4 font-mono text-xs"
          >
            <div className="flex items-center justify-between pb-2 border-b border-border">
              <div className="flex items-center gap-2">
                <Receipt className="h-4 w-4 text-amber-400" />
                <span className="font-bold text-foreground">Cryptographic Proof of Destruction</span>
              </div>
              <Button size="sm" variant="ghost" onClick={() => setShowReceiptModal(false)} className="h-7 text-xs">
                Close
              </Button>
            </div>

            <div className="flex flex-col gap-2 p-3 rounded-xl bg-background border border-border">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Receipt ID:</span>
                <span className="text-foreground font-mono font-bold">{meta.burnReceipt.receiptId}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Destroyed At:</span>
                <span className="text-foreground font-mono">{new Date(meta.burnReceipt.destroyedAt).toUTCString()}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Reason:</span>
                <Badge variant="outline" className="text-[10px] border-amber-500/40 text-amber-300">
                  {meta.burnReceipt.reason}
                </Badge>
              </div>
              <div className="flex flex-col gap-1 mt-1">
                <span className="text-muted-foreground text-[10px]">HMAC-SHA256 Server Signature:</span>
                <code className="text-[10px] text-foreground p-1.5 rounded bg-muted/60 break-all">
                  {meta.burnReceipt.signature}
                </code>
              </div>
            </div>

            {receiptVerificationState && (
              <div
                className={`p-3 rounded-xl border text-xs leading-relaxed ${
                  receiptVerificationState.verified
                    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                    : 'bg-destructive/10 border-destructive/30 text-destructive'
                }`}
              >
                {receiptVerificationState.loading ? (
                  <span>Verifying cryptographic signature on server...</span>
                ) : (
                  <span>{receiptVerificationState.message}</span>
                )}
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
              <Button
                variant="outline"
                size="sm"
                onClick={handleVerifyReceipt}
                className="font-mono text-xs"
              >
                Verify Signature &amp; Absence
              </Button>
              <Button
                size="sm"
                onClick={() => {
                  navigator.clipboard.writeText(JSON.stringify(meta.burnReceipt, null, 2));
                  setCopied(true);
                  setTimeout(() => setCopied(false), 2000);
                }}
                className="font-mono text-xs bg-foreground text-background"
              >
                Copy Receipt JSON
              </Button>
            </div>
          </motion.div>
        </div>
      )}

      {/* End-to-End Encrypted Comment Thread */}
      {meta?.openDiscussion && rawKey && (
        <CommentSection pasteId={pasteId} rawKey={rawKey} />
      )}
    </motion.div>
  );
}

export default PasteViewer;
