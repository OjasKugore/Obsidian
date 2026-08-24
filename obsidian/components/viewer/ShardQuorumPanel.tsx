'use client';

/**
 * components/viewer/ShardQuorumPanel.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Interactive multi-party quorum collection panel.
 * Collects and visualizes Shamir key shards until threshold (K) is satisfied.
 * Strict monochrome styling matching Obsidian design standards.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import * as React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Layers,
  KeyRound,
  Plus,
  CheckCircle2,
  Lock,
  AlertCircle,
  Info,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

interface ShardQuorumPanelProps {
  threshold: number;
  totalShards: number;
  loadedShards: Array<{ index: number; shardString: string }>;
  onAddShard: (shardInput: string) => Promise<{ success: boolean; error?: string }>;
  isDecrypting: boolean;
  error?: string | null;
}

export function ShardQuorumPanel({
  threshold,
  totalShards,
  loadedShards,
  onAddShard,
  isDecrypting,
  error: parentError,
}: ShardQuorumPanelProps) {
  // ── SETUP ──────────────────────────────────────────────────────────────

  // Input field state for entering additional shard tokens or URLs
  const [shardInput, setShardInput] = React.useState('');
  
  // Submission loading state and error message
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [inputError, setInputError] = React.useState<string | null>(null);

  // Set of unique shard indices already collected and loaded into memory
  const loadedSet = React.useMemo(
    () => new Set(loadedShards.map((s) => s.index)),
    [loadedShards]
  );
  
  // Computed progress calculations (current count vs required threshold)
  const currentCount = loadedShards.length;
  const neededCount = Math.max(0, threshold - currentCount);
  const progressPercent = Math.min(100, Math.round((currentCount / threshold) * 100));

  // ── ACTIONS ────────────────────────────────────────────────────────────

  // Validates and ingests new shard token or URL into the quorum pool
  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!shardInput.trim() || isSubmitting) return;

    setIsSubmitting(true);
    setInputError(null);

    try {
      const result = await onAddShard(shardInput.trim());
      if (result.success) {
        setShardInput('');
      } else {
        setInputError(result.error || 'Invalid shard token format or duplicate shard index.');
      }
    } catch (err) {
      setInputError(err instanceof Error ? err.message : 'Failed to parse shard');
    } finally {
      setIsSubmitting(false);
    }
  };

  // ── UI ─────────────────────────────────────────────────────────────────

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.98, y: 12 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ duration: 0.25, ease: 'easeOut' }}
      className="w-full max-w-2xl mx-auto flex flex-col gap-6 font-mono"
    >
      {/* Main Quorum Card Container */}
      <div className="rounded-lg border border-border bg-card p-6 sm:p-8 flex flex-col gap-6 shadow-xl relative overflow-hidden">
        {/* Header Bar */}
        <div className="flex items-start justify-between gap-4 pb-4 border-b border-border">
          <div className="flex items-center gap-3.5">
            <div className="flex h-10 w-10 items-center justify-center rounded bg-muted border border-border text-foreground">
              <Layers className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-bold uppercase tracking-tight text-foreground">
                  Shamir Quorum Required
                </h2>
                <Badge variant="outline" className="text-[10px] font-mono text-muted-foreground border-border">
                  {threshold}-of-{totalShards} SSS
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                This paste is split across distributed key shards. A quorum is needed to unlock.
              </p>
            </div>
          </div>
        </div>

        {/* Quorum Progress Bar & Status Counter */}
        <div className="flex flex-col gap-2.5 p-4 rounded bg-muted/30 border border-border">
          <div className="flex items-center justify-between text-xs">
            <span className="font-bold uppercase tracking-wider text-foreground flex items-center gap-1.5">
              <KeyRound className="h-4 w-4 text-foreground" />
              Collected Shards: <span className="text-foreground">{currentCount}</span> of{' '}
              <span className="text-foreground">{threshold}</span> required
            </span>
            <span className="font-mono text-muted-foreground text-[11px]">
              {progressPercent}% Quorum
            </span>
          </div>

          {/* Animated Quorum Bar */}
          <div className="w-full h-2 rounded bg-muted overflow-hidden relative border border-border">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${progressPercent}%` }}
              transition={{ duration: 0.4, ease: 'easeOut' }}
              className="h-full bg-foreground rounded"
            />
          </div>

          <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-1">
            <span>
              {neededCount === 0
                ? 'Quorum reached. Reconstructing secret...'
                : `Need ${neededCount} more unique shard${neededCount === 1 ? '' : 's'} to reconstruct key`}
            </span>
            <span>Total distributed: {totalShards}</span>
          </div>
        </div>

        {/* Shard Slots Grid Visualizer */}
        <div className="flex flex-col gap-2">
          <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Distributed Shard Slots
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5">
            {Array.from({ length: totalShards }).map((_, i) => {
              const shardIndex = i + 1;
              const isLoaded = loadedSet.has(shardIndex);

              return (
                <div
                  key={shardIndex}
                  className={`flex items-center justify-between p-2.5 rounded border text-xs transition-all ${
                    isLoaded
                      ? 'bg-muted/80 border-foreground/50 text-foreground font-bold'
                      : 'bg-background border-border text-muted-foreground'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    {isLoaded ? (
                      <CheckCircle2 className="h-3.5 w-3.5 text-foreground shrink-0" />
                    ) : (
                      <Lock className="h-3.5 w-3.5 text-muted-foreground/60 shrink-0" />
                    )}
                    <span>
                      Shard #{shardIndex}
                    </span>
                  </div>
                  {isLoaded ? (
                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-muted border border-border text-foreground">
                      Ready
                    </span>
                  ) : (
                    <span className="text-[10px] text-muted-foreground">Empty</span>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Shard Input Form */}
        <form onSubmit={handleAdd} className="flex flex-col gap-3">
          <label
            htmlFor="shard-token-input"
            className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center justify-between"
          >
            <span>Provide Additional Shard</span>
            <span className="text-[11px] font-normal lowercase text-muted-foreground">
              Paste token or full link
            </span>
          </label>

          <div className="flex items-center gap-2">
            <input
              id="shard-token-input"
              type="text"
              value={shardInput}
              onChange={(e) => {
                setShardInput(e.target.value);
                if (inputError) setInputError(null);
              }}
              placeholder="Paste shard token (e.g. shard-2-2-3-...) or full shard URL..."
              disabled={isSubmitting || isDecrypting}
              className="w-full h-10 px-3 rounded bg-background border border-border text-xs font-mono text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-foreground/50 transition-all"
            />
            <Button
              type="submit"
              disabled={!shardInput.trim() || isSubmitting || isDecrypting}
              className="shrink-0 h-10 px-4 gap-1.5 font-bold font-mono text-xs bg-foreground text-background hover:opacity-90"
            >
              <Plus className="h-4 w-4" />
              <span>Add Shard</span>
            </Button>
          </div>

          <AnimatePresence>
            {(inputError || parentError) && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="flex items-center gap-2 p-3 rounded bg-destructive/10 border border-destructive/25 text-destructive text-xs"
              >
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{inputError || parentError}</span>
              </motion.div>
            )}
          </AnimatePresence>
        </form>

        {/* Information Security Banner */}
        <div className="rounded bg-muted/20 border border-border p-3.5 text-xs text-muted-foreground flex items-start gap-3">
          <div className="p-1 rounded bg-muted text-foreground shrink-0 mt-0.5">
            <Info className="h-4 w-4" />
          </div>
          <div className="flex flex-col gap-1">
            <span className="font-bold text-foreground uppercase tracking-wide text-[11px]">
              Mathematical $k$-of-$n$ Information Theoretic Security
            </span>
            <p className="leading-relaxed text-[11px]">
              Shamir&apos;s Secret Sharing guarantees that any group of fewer than{' '}
              <strong className="text-foreground">{threshold}</strong> shards reveals zero
              cryptographic information about the AES decryption key. All reconstruction happens
              locally inside your browser.
            </p>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

export default ShardQuorumPanel;
