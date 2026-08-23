'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

export interface AuroraBackgroundProps extends React.HTMLAttributes<HTMLDivElement> {
  children?: React.ReactNode;
}

export function AuroraBackground({
  children,
  className,
  ...props
}: AuroraBackgroundProps) {
  return (
    <div
      className={cn(
        'relative min-h-screen w-full overflow-x-hidden bg-background text-foreground transition-colors duration-200',
        className
      )}
      {...props}
    >
      {/* Soft textured atmospheric background for Charcoal & Ivory theme */}
      <div
        className="pointer-events-none fixed inset-0 z-0 opacity-100 overflow-hidden"
        aria-hidden="true"
      >
        {/* Soft warm ivory & slate ambient top glow */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1200px] h-[550px] bg-[radial-gradient(ellipse_at_top,rgba(255,255,240,0.05)_0%,rgba(65,85,99,0.18)_40%,transparent_70%)] blur-3xl pointer-events-none" />

        {/* Soft corner atmospheric glow */}
        <div className="absolute bottom-0 right-0 w-[800px] h-[400px] bg-[radial-gradient(circle_at_bottom_right,rgba(255,255,240,0.03)_0%,transparent_60%)] blur-3xl pointer-events-none" />

        {/* Tactile micro-dot texture */}
        <div
          className="absolute inset-0 opacity-[0.04] dark:opacity-[0.06] bg-[radial-gradient(#000_1px,transparent_1px)] dark:bg-[radial-gradient(rgba(255,255,240,0.12)_1px,transparent_1px)] [background-size:28px_28px] pointer-events-none"
        />

        {/* Soft vignette for comfortable eye focus */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_35%,rgba(0,0,0,0.25)_100%)] pointer-events-none" />
      </div>

      {/* Foreground Content */}
      <div className="relative z-10 flex min-h-screen flex-col">{children}</div>
    </div>
  );
}

export default AuroraBackground;
