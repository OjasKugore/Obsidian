'use client';

/**
 * components/ui/IntroSplash.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Complete, isolated fullscreen lock screen intro animation:
 * 1. Initial screen is 100% solid pure white (#ffffff) with large black open lock.
 * 2. Lock shackle snaps down into locked position with spring physics.
 * 3. Canvas and lock smoothly invert colors (dark #09090b, white lock).
 * 4. "OBSIDIAN" typography fades in smoothly below the lock.
 * 5. Overlay smoothly fades out and transitions into the workspace.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import * as React from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface IntroSplashProps {
  onComplete: () => void;
}

export function IntroSplash({ onComplete }: IntroSplashProps) {
  const [stage, setStage] = React.useState<
    'enter' | 'lock' | 'invert' | 'text' | 'exit' | 'done'
  >('enter');

  React.useEffect(() => {
    // Lock scrolling on document body during intro
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const t1 = setTimeout(() => setStage('lock'), 700);
    const t2 = setTimeout(() => setStage('invert'), 1300);
    const t3 = setTimeout(() => setStage('text'), 1800);
    const t4 = setTimeout(() => setStage('exit'), 2900);
    const t5 = setTimeout(() => {
      setStage('done');
      document.body.style.overflow = originalOverflow;
      onComplete();
    }, 3450);

    return () => {
      document.body.style.overflow = originalOverflow;
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
    <AnimatePresence mode="wait">
      {!isExiting && (
        <motion.div
          key="intro-splash-screen"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          className="fixed inset-0 z-[9999999] w-screen h-screen min-h-[100dvh] flex flex-col items-center justify-center select-none overflow-hidden bg-white"
          style={{
            backgroundColor: isInverted ? '#36454F' : '#ffffff',
            transition: 'background-color 0.6s cubic-bezier(0.16, 1, 0.3, 1)',
          }}
        >
          <div className="flex flex-col items-center justify-center gap-7">
            {/* Padlock Graphic - Large, Sharp & Modern Vector */}
            <motion.div
              initial={{ opacity: 0, scale: 0.88, y: 8 }}
              animate={{
                opacity: 1,
                scale: 1,
                y: stage === 'lock' ? [0, 5, -1.5, 0] : 0,
              }}
              transition={{
                opacity: { duration: 0.45, ease: 'easeOut' },
                scale: { duration: 0.45, ease: 'easeOut' },
                y: { duration: 0.28, ease: 'easeInOut' },
              }}
              className="relative flex items-center justify-center"
            >
              <svg
                width="130"
                height="130"
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                className="overflow-visible drop-shadow-sm"
              >
                {/* Shackle: starts open/raised, then snaps down into locked position */}
                <motion.path
                  d="M 6.8 11.5 V 7 C 6.8 4.128 9.128 1.8 12 1.8 C 14.872 1.8 17.2 4.128 17.2 7 V 11.5"
                  stroke={isInverted ? '#FFFFF0' : '#36454F'}
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  initial={{ y: -9 }}
                  animate={{
                    y: isLocked ? 0 : -9,
                    stroke: isInverted ? '#FFFFF0' : '#36454F',
                  }}
                  transition={{
                    y: {
                      type: 'spring',
                      stiffness: 480,
                      damping: 20,
                    },
                    stroke: { duration: 0.55, ease: 'easeInOut' },
                  }}
                />

                {/* Padlock Body */}
                <motion.rect
                  x="3.5"
                  y="10.5"
                  width="17"
                  height="12"
                  rx="3.5"
                  fill={isInverted ? '#FFFFF0' : '#36454F'}
                  animate={{
                    fill: isInverted ? '#FFFFF0' : '#36454F',
                  }}
                  transition={{
                    fill: { duration: 0.55, ease: 'easeInOut' },
                  }}
                />

                {/* Keyhole Silhouette */}
                <motion.circle
                  cx="12"
                  cy="15.2"
                  r="1.35"
                  fill={isInverted ? '#36454F' : '#ffffff'}
                  animate={{
                    fill: isInverted ? '#36454F' : '#ffffff',
                  }}
                  transition={{
                    fill: { duration: 0.55, ease: 'easeInOut' },
                  }}
                />
                <motion.path
                  d="M 12 16.2 V 18.8"
                  stroke={isInverted ? '#36454F' : '#ffffff'}
                  strokeWidth="1.7"
                  strokeLinecap="round"
                  animate={{
                    stroke: isInverted ? '#36454F' : '#ffffff',
                  }}
                  transition={{
                    stroke: { duration: 0.55, ease: 'easeInOut' },
                  }}
                />
              </svg>
            </motion.div>

            {/* "OBSIDIAN" Typography - Bold Modern Montserrat in Warm Ivory */}
            <div className="h-12 flex items-center justify-center overflow-hidden">
              <motion.span
                initial={{ opacity: 0, y: 14, filter: 'blur(6px)' }}
                animate={{
                  opacity: showText ? 1 : 0,
                  y: showText ? 0 : 14,
                  filter: showText ? 'blur(0px)' : 'blur(6px)',
                }}
                transition={{
                  duration: 0.7,
                  ease: [0.16, 1, 0.3, 1],
                }}
                className="font-[family-name:var(--font-montserrat)] text-2xl sm:text-3xl font-black tracking-tighter uppercase text-[#FFFFF0] drop-shadow-sm"
              >
                OBSIDIAN
              </motion.span>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default IntroSplash;
