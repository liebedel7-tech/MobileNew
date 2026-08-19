import React from 'react';
import { motion, AnimatePresence } from 'motion/react';

interface ScreenTransitionProps {
  screenKey: string;
  children: React.ReactNode;
}

const pageVariants = {
  initial: {
    opacity: 0,
    y: 6,
    scale: 0.995,
  },
  animate: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      duration: 0.22,
      ease: [0.16, 1, 0.3, 1], // Flutter Material 3 standard decelerate curve
    },
  },
  exit: {
    opacity: 0,
    y: -4,
    scale: 0.995,
    transition: {
      duration: 0.15,
      ease: 'easeIn',
    },
  },
};

export const ScreenTransition: React.FC<ScreenTransitionProps> = ({
  screenKey,
  children,
}) => {
  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={screenKey}
        variants={pageVariants}
        initial="initial"
        animate="animate"
        exit="exit"
        className="w-full flex-1 flex flex-col"
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
};
