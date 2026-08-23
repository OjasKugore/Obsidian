'use client';

import * as React from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface IntroSplashProps {
  onComplete?: () => void;
}

export function IntroSplash({ onComplete }: IntroSplashProps) {
  const [visible, setVisible] = React.useState(true);
  const [mounted, setMounted] = React.useState(true);

  React.useEffect(() => {
    // 3.8s total duration: allows all SVG animation steps to play cleanly, then fades out
    const fadeTimer = setTimeout(() => {
      setVisible(false);
    }, 3800);

    const doneTimer = setTimeout(() => {
      setMounted(false);
      onComplete?.();
    }, 4600);

    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(doneTimer);
    };
  }, [onComplete]);

  if (!mounted) return null;

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          key="intro-splash-screen"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          className="fixed inset-0 z-[99999] flex items-center justify-center bg-[#FFFFFF] select-none"
        >
          <div className="w-full h-full max-w-4xl max-h-screen p-8 flex items-center justify-center">
            <div className="w-full h-full max-w-[500px] max-h-[500px] flex items-center justify-center">
              <svg
                viewBox="0 0 100 100"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                className="w-full h-full"
              >
                {/* Background transition rect */}
                <rect width="100" height="100" fill="#FFFFFF" id="bg">
                  <animate
                    attributeName="fill"
                    from="#FFFFFF"
                    to="#0A0A0A"
                    begin="2s"
                    dur="0.5s"
                    fill="freeze"
                    id="bgAnim"
                  />
                </rect>

                <g transform="translate(50, 50)">
                  {/* Lock Group */}
                  <g id="lock-group">
                    {/* Lock Shackle */}
                    <path
                      d="M-15 -10 V-25 A15 15 0 0 1 15 -25 V-10"
                      stroke="#0A0A0A"
                      strokeWidth="6"
                      strokeLinecap="round"
                      id="shackle"
                    >
                      <animateTransform
                        attributeName="transform"
                        type="translate"
                        from="0,0"
                        to="0,8"
                        begin="1.5s"
                        dur="0.3s"
                        calcMode="spline"
                        keySplines="0.42 0 0.58 1"
                        fill="freeze"
                        id="shackleAnim"
                      />
                      <animate
                        attributeName="stroke"
                        from="#0A0A0A"
                        to="#FFFFFF"
                        begin="2s"
                        dur="0.5s"
                        fill="freeze"
                      />
                    </path>

                    {/* Lock Body */}
                    <rect
                      x="-20"
                      y="-10"
                      width="40"
                      height="30"
                      rx="4"
                      fill="#0A0A0A"
                      id="body"
                    >
                      <animate
                        attributeName="fill"
                        from="#0A0A0A"
                        to="#FFFFFF"
                        begin="2s"
                        dur="0.5s"
                        fill="freeze"
                      />
                    </rect>

                    {/* Keyhole */}
                    <circle cx="0" cy="5" r="3" fill="#FFFFFF">
                      <animate
                        attributeName="fill"
                        from="#FFFFFF"
                        to="#0A0A0A"
                        begin="2s"
                        dur="0.5s"
                        fill="freeze"
                      />
                    </circle>

                    {/* Exit Animation for the whole lock */}
                    <animateTransform
                      attributeName="transform"
                      type="scale"
                      from="1"
                      to="0"
                      begin="2.5s"
                      dur="0.4s"
                      calcMode="spline"
                      keySplines="0.4 0 0.2 1"
                      fill="freeze"
                    />
                    <animate
                      attributeName="opacity"
                      from="1"
                      to="0"
                      begin="2.5s"
                      dur="0.4s"
                      fill="freeze"
                    />
                  </g>

                  {/* Text Group (Hidden initially) */}
                  <g id="text-group" opacity="0">
                    <text
                      x="0"
                      y="5"
                      fill="#FFFFFF"
                      fontFamily="sans-serif"
                      fontSize="14"
                      fontWeight="bold"
                      letterSpacing="2"
                      textAnchor="middle"
                    >
                      OBSIDIAN
                    </text>
                    <animate
                      attributeName="opacity"
                      from="0"
                      to="1"
                      begin="2.8s"
                      dur="0.8s"
                      calcMode="spline"
                      keySplines="0.4 0 0.2 1"
                      fill="freeze"
                      id="textFadeIn"
                    />
                    <animateTransform
                      attributeName="transform"
                      type="translate"
                      from="0,10"
                      to="0,0"
                      begin="2.8s"
                      dur="0.8s"
                      calcMode="spline"
                      keySplines="0.4 0 0.2 1"
                      fill="freeze"
                    />
                  </g>
                </g>
              </svg>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default IntroSplash;
