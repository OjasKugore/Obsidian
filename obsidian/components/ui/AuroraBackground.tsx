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
      {/* Subtle monochrome ambient depth (no colored tints) */}
      <div
        className="pointer-events-none fixed inset-0 z-0 opacity-100"
        aria-hidden="true"
      >
        {/* Subtle radial ambient highlight */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[450px] bg-[radial-gradient(ellipse_at_top,rgba(255,255,255,0.03)_0%,transparent_70%)] dark:bg-[radial-gradient(ellipse_at_top,rgba(255,255,255,0.03)_0%,transparent_70%)] blur-2xl pointer-events-none" />

        {/* Subtle grid pattern */}
        <div
          className="absolute inset-0 opacity-[0.03] dark:opacity-[0.03] bg-[radial-gradient(#000_1px,transparent_1px)] dark:bg-[radial-gradient(#fff_1px,transparent_1px)] [background-size:24px_24px] pointer-events-none"
        />

        {/* Subtle vignette */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_0%,rgba(0,0,0,0.03)_100%)] dark:bg-[radial-gradient(ellipse_at_center,transparent_0%,rgba(0,0,0,0.4)_100%)] pointer-events-none" />
      </div>

      {/* Foreground Content */}
      <div className="relative z-10 flex min-h-screen flex-col">{children}</div>
    </div>
  );
}

export default AuroraBackground;
