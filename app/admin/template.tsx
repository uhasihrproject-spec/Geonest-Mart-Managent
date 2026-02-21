"use client";

import { motion, AnimatePresence } from "framer-motion";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

// Thin progress bar that tracks route changes
function TopProgressBar({ active }: { active: boolean }) {
  return (
    <AnimatePresence>
      {active && (
        <motion.div
          key="progress"
          className="fixed top-0 left-0 right-0 z-[100] h-[2px] origin-left"
          style={{ background: "linear-gradient(90deg, #c0392b, #e74c3c, #c0392b)" }}
          initial={{ scaleX: 0, opacity: 1 }}
          animate={{ scaleX: [0, 0.4, 0.7, 0.9] }}
          exit={{ scaleX: 1, opacity: 0 }}
          transition={{
            scaleX: { duration: 1.2, ease: [0.4, 0, 0.2, 1] },
            opacity: { duration: 0.25, delay: 0.1 },
          }}
        />
      )}
    </AnimatePresence>
  );
}

// Decorative corner pieces that appear on transition
function CornerAccents({ show }: { show: boolean }) {
  if (!show) return null;
  return (
    <>
      {/* Top left */}
      <motion.div
        className="fixed top-0 left-0 z-[99] pointer-events-none"
        initial={{ opacity: 0 }}
        animate={{ opacity: [0, 0.6, 0] }}
        transition={{ duration: 0.5 }}
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
          <path d="M1 12V1H12" stroke="#c0392b" strokeWidth="1.5" strokeLinecap="round"/>
        </svg>
      </motion.div>
      {/* Bottom right */}
      <motion.div
        className="fixed bottom-0 right-0 z-[99] pointer-events-none"
        initial={{ opacity: 0 }}
        animate={{ opacity: [0, 0.6, 0] }}
        transition={{ duration: 0.5, delay: 0.05 }}
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
          <path d="M23 12V23H12" stroke="#c0392b" strokeWidth="1.5" strokeLinecap="round"/>
        </svg>
      </motion.div>
    </>
  );
}

export default function AdminTemplate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [transitioning, setTransitioning] = useState(false);
  const [key, setKey] = useState(pathname);

  useEffect(() => {
    if (pathname !== key) {
      setTransitioning(true);
      const t = setTimeout(() => {
        setKey(pathname);
        setTransitioning(false);
      }, 80);
      return () => clearTimeout(t);
    }
  }, [pathname]);

  return (
    <>
      <TopProgressBar active={transitioning} />
      <CornerAccents show={transitioning} />

      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={key}
          initial={{ opacity: 0, y: 6, filter: "blur(3px)" }}
          animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          exit={{ opacity: 0, y: -4, filter: "blur(3px)" }}
          transition={{
            duration: 0.22,
            ease: [0.22, 1, 0.36, 1],
          }}
          className="h-full"
        >
          {children}
        </motion.div>
      </AnimatePresence>
    </>
  );
}