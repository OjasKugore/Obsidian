/**
 * components/ui/badge.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Primitive Badge UI Component.
 *
 * Provides status badges and tags supporting multiple variants: default,
 * secondary, destructive, outline, success, warning, and glow.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

// ── SETUP ──────────────────────────────────────────────────────────────
// Class Variance Authority badge style variant definitions

const badgeVariants = cva(
  'inline-flex items-center rounded border px-2 py-0.5 text-xs font-mono transition-colors focus:outline-none',
  {
    variants: {
      variant: {
        default:
          'border-border bg-foreground text-background font-bold shadow-sm',
        secondary:
          'border-border bg-muted text-foreground',
        destructive:
          'border-destructive/30 bg-destructive/10 text-destructive',
        outline:
          'border-border bg-transparent text-foreground',
        success:
          'border-border bg-muted text-foreground font-semibold',
        warning:
          'border-border bg-muted text-foreground font-semibold',
        glow:
          'border-border bg-muted text-foreground font-bold shadow-sm',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

// ── UI COMPONENT ───────────────────────────────────────────────────────

function Badge({ className, variant, ...props }: BadgeProps) {
  // {/* ── UI ───────────────────────────────────────────────────────────────── */}
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge, badgeVariants };
