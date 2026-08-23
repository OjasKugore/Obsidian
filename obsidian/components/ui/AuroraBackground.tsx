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
        'relative min-h-screen w-full overflow-x-hidden bg-[#09090b] text-[#f4f4f5]',
        className
      )}
      {...props}
    >
      {/* Subtle, static, high-trust ambient gradients (no looping animations) */}
      <div
        className="pointer-events-none fixed inset-0 z-0 opacity-100"
        aria-hidden="true"
      >
        {/* Top subtle blue-indigo highlight */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[420px] bg-gradient-to-b from-blue-600/8 via-indigo-600/4 to-transparent blur-3xl pointer-events-none" />

        {/* Subtle grid pattern */}
        <div
          className="absolute inset-0 opacity-[0.02] bg-[radial-gradient(#fff_1px,transparent_1px)] [background-size:24px_24px] pointer-events-none"
        />

        {/* Vignette border */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_0%,rgba(9,9,11,0.6)_100%)] pointer-events-none" />
      </div>

      {/* Foreground Content */}
      <div className="relative z-10 flex min-h-screen flex-col">{children}</div>
    </div>
  );
}

export default AuroraBackground;
