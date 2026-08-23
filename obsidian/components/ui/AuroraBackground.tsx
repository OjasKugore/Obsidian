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
      {/* Matte background texture with zero top/corner shine or flares */}
      <div
        className="pointer-events-none fixed inset-0 z-0 opacity-100 overflow-hidden"
        aria-hidden="true"
      >
        {/* Subtle micro-dot tactile texture */}
        <div
          className="absolute inset-0 opacity-[0.04] dark:opacity-[0.05] bg-[radial-gradient(#000_1px,transparent_1px)] dark:bg-[radial-gradient(rgba(255,255,240,0.12)_1px,transparent_1px)] [background-size:28px_28px] pointer-events-none"
        />
      </div>

      {/* Foreground Content */}
      <div className="relative z-10 flex min-h-screen flex-col">{children}</div>
    </div>
  );
}

export default AuroraBackground;
