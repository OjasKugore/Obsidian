/**
 * components/ui/AuroraHero.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Aurora Hero Banner Component.
 *
 * Renders an animated SVG fluted glass displacement filter and rainbow spectrum
 * gradient overlay for the landing page header banner.
 * ─────────────────────────────────────────────────────────────────────────────
 */

'use client';

import React from 'react';
import { cn } from '@/lib/utils';

export interface AuroraHeroProps extends React.HTMLAttributes<HTMLDivElement> {
  /** The main title text to display with the glass displacement effect. */
  title?: string;
  subtitle?: string;
}

export function AuroraHero({
  title = 'Obsidian',
  subtitle = 'Zero-Knowledge Cryptographic Vault',
  className,
  ...props
}: AuroraHeroProps) {
  // ── SETUP ──────────────────────────────────────────────────────────────
  // Safely URL-encoded SVG string for the fluted glass effect
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

  // {/* ── UI ───────────────────────────────────────────────────────────────── */}
  return (
    <div
      className={cn(
        'aurora-hero-wrapper w-full min-h-[300px] sm:min-h-[360px] relative overflow-hidden rounded-3xl mb-4',
        className
      )}
      {...props}
    >
      <style>{`
        .aurora-hero-wrapper {
          --stripe-color: #000;
          --bg-filter: blur(10px) opacity(60%) saturate(200%);
          background: var(--stripe-color);
          font-family: var(--font-girard), Georgia, serif;
        }
        :is(.dark) .aurora-hero-wrapper {
          --stripe-color: #fff;
          --bg-filter: blur(10px) invert(100%);
        }
        @keyframes smoothBg {
          from { background-position: 50% 50%, 50% 50%; }
          to { background-position: 350% 50%, 350% 50%; }
        }
        .aurora-hero-bg {
          width: 100%;
          height: 100%;
          position: absolute;
          inset: 0;
          --stripes: repeating-linear-gradient(
            100deg, 
            var(--stripe-color) 0%, 
            var(--stripe-color) 7%, 
            transparent 10%, 
            transparent 12%, 
            var(--stripe-color) 16%
          );
          --rainbow: repeating-linear-gradient(
            100deg, 
            #60a5fa 10%, 
            #e879f9 15%, 
            #60a5fa 20%, 
            #5eead4 25%, 
            #60a5fa 30%
          );
          background-image: var(--stripes), var(--rainbow);
          background-size: 300%, 200%;
          background-position: 50% 50%, 50% 50%;
          filter: var(--bg-filter);
          mask-image: radial-gradient(ellipse at 50% 50%, black 60%, transparent 95%);
          -webkit-mask-image: radial-gradient(ellipse at 50% 50%, black 60%, transparent 95%);
        }
        .aurora-hero-bg::after {
          content: "";
          position: absolute;
          inset: 0;
          background-image: var(--stripes), var(--rainbow);
          background-size: 200%, 100%;
          animation: smoothBg 40s linear infinite;
          background-attachment: fixed;
          mix-blend-mode: difference;
        }
        .aurora-content {
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
          display: flex;
          place-content: center;
          place-items: center;
          flex-flow: column;
          gap: 12px;
          text-align: center;
          padding: 2rem 1rem;
          backdrop-filter: contrast(0.9) blur(5px) url(#fluted);
          -webkit-backdrop-filter: contrast(0.9) blur(5px) url(#fluted);
          mix-blend-mode: difference;
          filter: invert(1);
        }
        .h1-scalingSize {
          font-family: var(--font-girard), Georgia, serif;
          font-size: clamp(2.5rem, 6vw, 4.5rem);
          position: relative;
          isolation: isolate;
          font-weight: 700;
          letter-spacing: -0.02em;
          color: white;
        }
        .h1-scalingSize::before {
          content: attr(data-text);
          position: absolute;
          inset: 0;
          background: white;
          text-shadow: 0 0 1px #ffffff;
          background-clip: text;
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          -webkit-mask: linear-gradient(#000 0 0) luminance;
          mask: linear-gradient(#000 0 0) luminance, alpha;
          backdrop-filter: blur(19px) brightness(12.5);
          -webkit-text-stroke: 1px rgba(255,255,255,0.8);
          display: flex;
          align-items: center;
          justify-content: center;
          margin: auto;
          z-index: 1;
          pointer-events: none;
        }
      `}</style>

      {/* Aurora Rainbow Stripes Background */}
      <div className="aurora-hero-bg" aria-hidden="true" />

      {/* Title & Subtitle Container */}
      <div className="aurora-content">
        <h1 className="h1-scalingSize" data-text={title}>
          {title}
        </h1>
        {subtitle && (
          <p className="text-xs sm:text-sm font-sans tracking-wide text-white/90 uppercase font-semibold">
            {subtitle}
          </p>
        )}
      </div>

      {/* SVG Fluted Glass Displacement Filter Definition */}
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
    </div>
  );
}

export default AuroraHero;
