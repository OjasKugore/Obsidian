/**
 * components/ui/button.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Primitive Button UI Component.
 *
 * Supports polymorphic Radix Slot rendering, focus rings, active press scaling,
 * and variants: default, glow, destructive, outline, secondary, ghost, glass, and link.
 * ─────────────────────────────────────────────────────────────────────────────
 */

'use client';

import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

// ── SETUP ──────────────────────────────────────────────────────────────
// Class Variance Authority button variant and size definitions

const buttonVariants = cva(
  'inline-flex items-center justify-center whitespace-nowrap rounded-lg text-sm font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 active:scale-[0.98]',
  {
    variants: {
      variant: {
        default:
          'bg-primary text-primary-foreground shadow-md hover:bg-primary/90 hover:shadow-lg',
        glow:
          'bg-foreground text-background font-bold shadow-md hover:opacity-90 border border-foreground/20',
        destructive:
          'bg-destructive text-destructive-foreground hover:bg-destructive/90 shadow-sm',
        outline:
          'border border-border/80 bg-background/50 backdrop-blur-sm hover:bg-accent hover:text-accent-foreground',
        secondary:
          'bg-secondary text-secondary-foreground hover:bg-secondary/80',
        ghost:
          'hover:bg-accent/80 hover:text-accent-foreground',
        glass:
          'bg-white/10 dark:bg-white/5 border border-white/10 text-foreground backdrop-blur-md hover:bg-white/15 dark:hover:bg-white/10 shadow-sm',
        link:
          'text-primary underline-offset-4 hover:underline',
      },
      size: {
        default: 'h-10 px-4 py-2',
        sm: 'h-8 rounded-md px-3 text-xs',
        lg: 'h-12 rounded-xl px-6 text-base font-semibold',
        icon: 'h-9 w-9 rounded-lg',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

// ── BUTTON COMPONENT ───────────────────────────────────────────────────

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    // ── SETUP ──────────────────────────────────────────────────────────────
    // Resolve underlying DOM element or Radix Slot
    const Comp = asChild ? Slot : 'button';

    // {/* ── UI ───────────────────────────────────────────────────────────────── */}
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = 'Button';

export { Button, buttonVariants };
