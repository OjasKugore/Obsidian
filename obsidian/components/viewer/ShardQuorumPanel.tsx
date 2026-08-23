'use client';

import * as React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  KeyRound,
  CheckCircle2,
  AlertCircle,
  Plus,
  Info,
  Lock,
  Layers,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

interface ShardQuorumPanelProps {
  threshold: number;
  totalShards: number;
  loadedShards: { index: number; shardString: string }[];
  onAddShard: (input: string) => Promise<{ success: boolean; error?: string }>;
  isDecrypting: boolean;
  error: string | null;
}

export function ShardQuorumPanel({
  threshold,
  totalShards,
  loadedShards,
  onAddShard,
  isDecrypting,
  error: parentError,
}: ShardQuorumPanelProps) {
  const [shardInput, setShardInput] = React.useState('');
  const [inputError, setInputError] = React.useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const loadedIndices = new Set(loadedShards.map((s) => s.index));
  const currentCount = loadedShards.length;
  const neededCount = Math.max(0, threshold - currentCount);
  const progressPercent = Math.min(100, Math.round((currentCount / threshold) * 100));

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!shardInput.trim() || isSubmitting) return;

    setInputError(null);
    setIsSubmitting(true);

    try {
      const res = await onAddShard(shardInput.trim());
      if (!res.success) {
        setInputError(res.error || 'Failed to add shard.');
      } else {
        setShardInput('');
      }
    } catch {
      setInputError('An unexpected error occurred while adding the shard.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.97, y: 16 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.97, y: -16 }}
      transition={{ duration: 0.35, ease: 'easeOut' }}
      className="w-full max-w-2xl mx-auto flex flex-col gap-6"
    >
      <div className="glass-panel rounded-3xl p-6 sm:p-8 flex flex-col gap-6 shadow-2xl relative overflow-hidden border border-blue-500/20">
        {/* Ambient background glow */}
        <div className="absolute -top-24 -right-24 w-52 h-52 bg-blue-500/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -left-24 w-52 h-52 bg-purple-500/15 rounded-full blur-3xl pointer-events-none" />

        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-500/10 border border-blue-500/30 text-blue-400 shadow-inner">
              <Layers className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold tracking-tight text-foreground">
                  Shamir Quorum Required
                </h2>
                <Badge variant="glow" className="text-[11px] font-semibold">
                  {threshold}-of-{totalShards} SSS
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                This paste is split across distributed key shards. A quorum is needed to unlock.
              </p>
            </div>
          </div>
        </div>

        {/* Progress Bar & Status */}
        <div className="flex flex-col gap-2.5 p-4 rounded-2xl bg-background/60 border border-border/60">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-foreground flex items-center gap-1.5">
              <KeyRound className="h-4 w-4 text-blue-400" />
              Collected Shards: <span className="text-primary">{currentCount}</span> of{' '}
              <span className="text-foreground">{threshold}</span> required
            </span>
            <span className="font-mono text-muted-foreground text-[11px]">
              {progressPercent}% Quorum
            </span>
          </div>

          {/* Progress bar line */}
          <div className="w-full h-2.5 rounded-full bg-muted/80 overflow-hidden relative">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${progressPercent}%` }}
              transition={{ duration: 0.4, ease: 'easeOut' }}
              className="h-full bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500 rounded-full shadow-[0_0_12px_rgba(59,130,246,0.5)]"
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

        {/* Shard Slots Visualizer */}
        <div className="flex flex-col gap-2">
          <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Distributed Shard Slots
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5">
            {Array.from({ length: totalShards }).map((_, i) => {
              const shardIndex = i + 1;
              const isLoaded = loadedIndices.has(shardIndex);

              return (
                <div
                  key={shardIndex}
                  className={`flex items-center justify-between p-3 rounded-xl border text-xs transition-all ${
                    isLoaded
                      ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-300 shadow-[0_0_15px_-3px_rgba(16,185,129,0.2)]'
                      : 'bg-background/40 border-border/60 text-muted-foreground'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    {isLoaded ? (
                      <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                    ) : (
                      <Lock className="h-4 w-4 text-muted-foreground/60 shrink-0" />
                    )}
                    <span className="font-medium">
                      Shard #{shardIndex}
                    </span>
                  </div>
                  {isLoaded ? (
                    <Badge variant="success" className="text-[9px] py-0 px-1">
                      Ready
                    </Badge>
                  ) : (
                    <span className="text-[10px] text-muted-foreground">Empty</span>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Input Form for Ingesting More Shards */}
        <form onSubmit={handleAdd} className="flex flex-col gap-3">
          <label
            htmlFor="shard-token-input"
            className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center justify-between"
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
              className="w-full h-11 px-3.5 rounded-xl bg-background/80 border border-border/80 text-sm font-mono text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all selection:bg-primary/30"
            />
            <Button
              type="submit"
              variant="glow"
              disabled={!shardInput.trim() || isSubmitting || isDecrypting}
              className="shrink-0 h-11 px-4 gap-1.5 font-semibold"
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
                className="flex items-center gap-2 p-3 rounded-xl bg-destructive/10 border border-destructive/30 text-destructive text-xs"
              >
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{inputError || parentError}</span>
              </motion.div>
            )}
          </AnimatePresence>
        </form>

        {/* Info Callout */}
        <div className="rounded-2xl bg-blue-500/5 border border-blue-500/15 p-4 text-xs text-muted-foreground flex items-start gap-3">
          <div className="p-1.5 rounded-lg bg-blue-500/10 text-blue-400 shrink-0 mt-0.5">
            <Info className="h-4 w-4" />
          </div>
          <div className="flex flex-col gap-1">
            <span className="font-semibold text-foreground">
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
