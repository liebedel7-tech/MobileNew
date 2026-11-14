import React from 'react';
import { motion, useReducedMotion } from 'framer-motion';

interface ScreenTransitionProps {
  screenKey: string;
  children: React.ReactNode;
}

export const ScreenTransition: React.FC<ScreenTransitionProps> = ({
  screenKey,
  children,
}) => {
  const shouldReduceMotion = useReducedMotion();

  return (
    <motion.div
      key={screenKey}
      initial={shouldReduceMotion ? { opacity: 1 } : { opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: shouldReduceMotion ? 0 : 0.18,
        ease: [0.16, 1, 0.3, 1],
      }}
      style={{ willChange: 'transform, opacity' }}
      className="w-full flex-1 flex flex-col min-h-full"
    >
      {children}
    </motion.div>
  );
};
