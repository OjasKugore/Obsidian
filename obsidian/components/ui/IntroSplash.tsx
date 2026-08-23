'use client';

import * as React from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface IntroSplashProps {
  onComplete?: () => void;
}

export function IntroSplash({ onComplete }: IntroSplashProps) {
  // Stages:
  // 'enter'  (0.0s - 0.8s): pure white canvas, large black open lock appears
  // 'lock'   (0.8s - 1.4s): lock shackle snaps shut with spring physics
  // 'invert' (1.4s - 2.0s): bg transitions to #09090b, lock transitions to white
  // 'text'   (2.0s - 3.4s): "OBSIDIAN" typography smoothly emerges below the lock
  // 'exit'   (3.4s - 4.1s): overlay fades out cleanly
  // 'done'   (4.1s+): unmounted
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
    }, 4100);

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
    <AnimatePresence>
      {!isExiting && (
        <motion.div
          key="intro-splash-screen"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
          className="fixed inset-0 z-[99999] w-screen h-screen flex flex-col items-center justify-center select-none"
          style={{
            backgroundColor: isInverted ? '#09090b' : '#ffffff',
            transition: 'background-color 0.65s cubic-bezier(0.16, 1, 0.3, 1)',
          }}
        >
          <div className="flex flex-col items-center justify-center gap-7">
            {/* Padlock Graphic - Large, Sharp & Modern */}
            <motion.div
              initial={{ opacity: 0, scale: 0.82, y: 12 }}
              animate={{
                opacity: 1,
                scale: 1,
                y: stage === 'lock' ? [0, 5, -1.5, 0] : 0,
              }}
              transition={{
                opacity: { duration: 0.6, ease: 'easeOut' },
                scale: { duration: 0.6, ease: 'easeOut' },
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
                  stroke={isInverted ? '#ffffff' : '#000000'}
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  initial={{ y: -9 }}
                  animate={{
                    y: isLocked ? 0 : -9,
                    stroke: isInverted ? '#ffffff' : '#000000',
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
                  cy="15.2"
                  r="1.35"
                  fill={isInverted ? '#09090b' : '#ffffff'}
                  animate={{
                    fill: isInverted ? '#09090b' : '#ffffff',
                  }}
                  transition={{
                    fill: { duration: 0.55, ease: 'easeInOut' },
                  }}
                />
                <motion.path
                  d="M 12 16.2 V 18.8"
                  stroke={isInverted ? '#09090b' : '#ffffff'}
                  strokeWidth="1.7"
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

            {/* "OBSIDIAN" Typography - Bold, Refined Modern Sans */}
            <div className="h-10 flex items-center justify-center overflow-hidden">
              <motion.span
                initial={{ opacity: 0, y: 14, filter: 'blur(8px)' }}
                animate={{
                  opacity: showText ? 1 : 0,
                  y: showText ? 0 : 14,
                  filter: showText ? 'blur(0px)' : 'blur(8px)',
                }}
                transition={{
                  duration: 0.85,
                  ease: [0.16, 1, 0.3, 1],
                }}
                className="font-sans text-xl sm:text-2xl font-black tracking-[0.35em] uppercase text-white/95"
              >
                Obsidian
              </motion.span>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default IntroSplash;
