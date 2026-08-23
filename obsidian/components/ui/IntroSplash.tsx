'use client';

import * as React from 'react';
import { motion } from 'framer-motion';

interface IntroSplashProps {
  onComplete?: () => void;
}

export function IntroSplash({ onComplete }: IntroSplashProps) {
  // Stages:
  // 'enter'  (0.0s - 0.8s): pure white bg, black open lock appears
  // 'lock'   (0.8s - 1.4s): lock shackle snaps shut
  // 'invert' (1.4s - 2.0s): bg turns #09090b, lock turns white
  // 'text'   (2.0s - 3.4s): "Obsidian" text fades in below lock
  // 'exit'   (3.4s - 4.2s): overlay fades out smoothly
  // 'done'   (4.2s+): unmounted
  const [stage, setStage] = React.useState<
    'enter' | 'lock' | 'invert' | 'text' | 'exit' | 'done'
  >('enter');

  React.useEffect(() => {
    const t1 = setTimeout(() => setStage('lock'), 800);
    const t2 = setTimeout(() => setStage('invert'), 1400);
    const t3 = setTimeout(() => setStage('text'), 2000);
    const t4 = setTimeout(() => setStage('exit'), 3400);
    const t5 = setTimeout(() => {
      setStage('done');
      onComplete?.();
    }, 4200);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      clearTimeout(t4);
      clearTimeout(t5);
    };
  }, [onComplete]);

  if (stage === 'done') return null;

  const isInverted = stage === 'invert' || stage === 'text' || stage === 'exit';
  const isLocked = stage !== 'enter';
  const showText = stage === 'text' || stage === 'exit';
  const isExiting = stage === 'exit';

  return (
    <motion.div
      key="intro-splash-overlay"
      initial={{ opacity: 1, backgroundColor: '#ffffff' }}
      animate={{
        backgroundColor: isInverted ? '#09090b' : '#ffffff',
        opacity: isExiting ? 0 : 1,
      }}
      transition={{
        backgroundColor: { duration: 0.65, ease: [0.16, 1, 0.3, 1] },
        opacity: { duration: 0.75, ease: [0.16, 1, 0.3, 1] },
      }}
      className="fixed inset-0 z-[99999] w-screen h-screen flex flex-col items-center justify-center select-none pointer-events-auto"
      style={{
        pointerEvents: isExiting ? 'none' : 'auto',
      }}
    >
      {/* Center Lock + Brand Text Column */}
      <div className="flex flex-col items-center justify-center gap-6">
        {/* Padlock Graphic */}
        <motion.div
          initial={{ opacity: 0, scale: 0.8, y: 10 }}
          animate={{
            opacity: 1,
            scale: 1,
            y: stage === 'lock' ? [0, 4, -1, 0] : 0,
          }}
          transition={{
            opacity: { duration: 0.6, ease: 'easeOut' },
            scale: { duration: 0.6, ease: 'easeOut' },
            y: { duration: 0.28, ease: 'easeInOut' },
          }}
          className="relative flex items-center justify-center"
        >
          <svg
            width="80"
            height="80"
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className="overflow-visible"
          >
            {/* Shackle: starts open/raised, then snaps down into locked position */}
            <motion.path
              d="M 7 11 V 7 C 7 4.238 9.238 2 12 2 C 14.762 2 17 4.238 17 7 V 11"
              stroke={isInverted ? '#ffffff' : '#000000'}
              strokeWidth="2.4"
              strokeLinecap="round"
              strokeLinejoin="round"
              initial={{ y: -8 }}
              animate={{
                y: isLocked ? 0 : -8,
                stroke: isInverted ? '#ffffff' : '#000000',
              }}
              transition={{
                y: {
                  type: 'spring',
                  stiffness: 450,
                  damping: 22,
                },
                stroke: { duration: 0.55, ease: 'easeInOut' },
              }}
            />

            {/* Padlock Body */}
            <motion.rect
              x="4"
              y="10"
              width="16"
              height="12"
              rx="3.5"
              fill={isInverted ? '#ffffff' : '#000000'}
              animate={{
                fill: isInverted ? '#ffffff' : '#000000',
              }}
              transition={{
                fill: { duration: 0.55, ease: 'easeInOut' },
              }}
            />

            {/* Keyhole Silhouette */}
            <motion.circle
              cx="12"
              cy="14.8"
              r="1.3"
              fill={isInverted ? '#09090b' : '#ffffff'}
              animate={{
                fill: isInverted ? '#09090b' : '#ffffff',
              }}
              transition={{
                fill: { duration: 0.55, ease: 'easeInOut' },
              }}
            />
            <motion.path
              d="M 12 15.8 V 18.2"
              stroke={isInverted ? '#09090b' : '#ffffff'}
              strokeWidth="1.6"
              strokeLinecap="round"
              animate={{
                stroke: isInverted ? '#09090b' : '#ffffff',
              }}
              transition={{
                stroke: { duration: 0.55, ease: 'easeInOut' },
              }}
            />
          </svg>
        </motion.div>

        {/* "Obsidian" Typography: fades in smoothly and gradually below the lock */}
        <div className="h-10 flex items-center justify-center overflow-hidden">
          <motion.span
            initial={{ opacity: 0, y: 12, filter: 'blur(8px)' }}
            animate={{
              opacity: showText ? 1 : 0,
              y: showText ? 0 : 12,
              filter: showText ? 'blur(0px)' : 'blur(8px)',
            }}
            transition={{
              duration: 0.9,
              ease: [0.16, 1, 0.3, 1],
            }}
            className="font-mono text-lg sm:text-xl font-semibold tracking-[0.3em] uppercase text-white/95 drop-shadow-[0_2px_12px_rgba(0,0,0,0.8)]"
          >
            Obsidian
          </motion.span>
        </div>
      </div>
    </motion.div>
  );
}

export default IntroSplash;
