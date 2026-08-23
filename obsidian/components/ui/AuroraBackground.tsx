'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

export interface AuroraBackgroundProps extends React.HTMLAttributes<HTMLDivElement> {
  children?: React.ReactNode;
  showFlutedGlass?: boolean;
}

export function AuroraBackground({
  children,
  className,
  showFlutedGlass = true,
  ...props
}: AuroraBackgroundProps) {
  // Safely URL-encoded SVG string for the fluted glass refraction effect
  const filterImageHref =
    'data:image/svg+xml,' +
    encodeURIComponent(`
    <svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 1 1' color-interpolation-filters='sRGB'>
      <g>
        <rect width='1' height='1' fill='black' />
        <rect width='1' height='1' fill='url(#red)' style='mix-blend-mode:screen' />
        <rect width='1' height='1' fill='url(#green)' style='mix-blend-mode:screen' />
        <rect width='1' height='1' fill='url(#yellow)' style='mix-blend-mode:screen' />
      </g>
      <defs>
        <radialGradient id='yellow' cx='0' cy='0' r='1' >
          <stop stop-color='yellow' />
          <stop stop-color='yellow' offset='1' stop-opacity='0' />
        </radialGradient>
        <radialGradient id='green' cx='1' cy='0' r='1' >
          <stop stop-color='green' />
          <stop stop-color='green' offset='1' stop-opacity='0' />
        </radialGradient>
        <radialGradient id='red' cx='0' cy='1' r='1' >
          <stop stop-color='red' />
          <stop stop-color='red' offset='1' stop-opacity='0' />
        </radialGradient>
      </defs>
    </svg>
  `);

  return (
    <div
      className={cn(
        'aurora-global-canvas relative min-h-screen w-full overflow-hidden bg-background text-foreground',
        className
      )}
      {...props}
    >
      <style>{`
        .aurora-global-canvas {
          --stripe-color: rgba(7, 11, 20, 0.95);
          --aurora-blur: blur(40px) saturate(160%);
        }
        :is(.light) .aurora-global-canvas {
          --stripe-color: rgba(248, 250, 252, 0.92);
          --aurora-blur: blur(40px) saturate(140%);
        }

        @keyframes smoothAuroraMotion {
          0% {
            background-position: 0% 50%, 0% 50%;
            transform: scale(1) rotate(0deg);
          }
          50% {
            background-position: 100% 50%, 100% 50%;
            transform: scale(1.05) rotate(1.5deg);
          }
          100% {
            background-position: 200% 50%, 200% 50%;
            transform: scale(1) rotate(0deg);
          }
        }

        .aurora-ambient-layer {
          position: fixed;
          inset: -10%;
          width: 120%;
          height: 120%;
          pointer-events: none;
          z-index: 0;
          --stripes: repeating-linear-gradient(
            115deg,
            var(--stripe-color) 0%,
            var(--stripe-color) 8%,
            transparent 12%,
            transparent 15%,
            var(--stripe-color) 20%
          );
          --rainbow: repeating-linear-gradient(
            115deg,
            rgba(59, 130, 246, 0.35) 5%,
            rgba(168, 85, 247, 0.30) 12%,
            rgba(6, 182, 212, 0.25) 20%,
            rgba(236, 72, 153, 0.20) 28%,
            rgba(59, 130, 246, 0.35) 36%
          );
          background-image: var(--stripes), var(--rainbow);
          background-size: 250% 250%, 200% 200%;
          filter: var(--aurora-blur);
          animation: smoothAuroraMotion 45s ease-in-out infinite;
          opacity: 0.85;
          mask-image: radial-gradient(ellipse at 50% 15%, black 45%, transparent 80%);
          -webkit-mask-image: radial-gradient(ellipse at 50% 15%, black 45%, transparent 80%);
        }

        .aurora-ambient-glow {
          position: fixed;
          inset: 0;
          pointer-events: none;
          z-index: 0;
          background: radial-gradient(circle at 50% 0%, rgba(59, 130, 246, 0.15), transparent 60%),
                      radial-gradient(circle at 10% 40%, rgba(147, 51, 234, 0.1), transparent 50%),
                      radial-gradient(circle at 90% 60%, rgba(6, 182, 212, 0.08), transparent 50%);
        }
      `}</style>

      {/* Animated Aurora Layers */}
      <div className="aurora-ambient-layer" aria-hidden="true" />
      <div className="aurora-ambient-glow" aria-hidden="true" />

      {/* Fluted Glass Filter SVG */}
      {showFlutedGlass && (
        <svg
          version="1.1"
          xmlns="http://www.w3.org/2000/svg"
          xmlnsXlink="http://www.w3.org/1999/xlink"
          colorInterpolationFilters="sRGB"
          style={{ position: 'absolute', opacity: 0, height: 0, width: 0, pointerEvents: 'none' }}
          aria-hidden="true"
          focusable="false"
        >
          <filter id="fluted" primitiveUnits="objectBoundingBox">
            <feImage
              x="0"
              y="0"
              result="image_0"
              crossOrigin="anonymous"
              href={filterImageHref}
              preserveAspectRatio="none meet"
              width=".03"
              height="1"
            />
            <feTile in="image_0" result="tile_0" />
            <feGaussianBlur stdDeviation=".0001" edgeMode="none" in="tile_0" result="bar_smoothness" x="0" y="0" />
            <feDisplacementMap
              scale=".08"
              xChannelSelector="R"
              yChannelSelector="G"
              in="SourceGraphic"
              in2="bar_smoothness"
              result="displacement_0"
            />
          </filter>
        </svg>
      )}

      {/* Foreground Content */}
      <div className="relative z-10 flex min-h-screen flex-col">{children}</div>
    </div>
  );
}

export default AuroraBackground;
