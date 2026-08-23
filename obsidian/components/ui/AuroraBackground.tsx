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
        'aurora-stage relative min-h-screen w-full overflow-x-hidden text-foreground bg-[#050811] dark:bg-[#050811] light:bg-[#f8fafc]',
        className
      )}
      {...props}
    >
      {/* Vivid Dynamic Aurora Spheres & Wave Curtain */}
      <div className="aurora-sphere-1" aria-hidden="true" />
      <div className="aurora-sphere-2" aria-hidden="true" />
      <div className="aurora-sphere-3" aria-hidden="true" />
      <div className="aurora-sphere-4" aria-hidden="true" />
      <div className="aurora-curtain" aria-hidden="true" />

      {/* Foreground Content */}
      <div className="relative z-10 flex min-h-screen flex-col">{children}</div>
    </div>
  );
}

export default AuroraBackground;
