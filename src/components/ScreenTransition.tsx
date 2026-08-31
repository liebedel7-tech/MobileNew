import React from 'react';
import { motion, AnimatePresence } from 'motion/react';

interface ScreenTransitionProps {
  screenKey: string;
  children: React.ReactNode;
}

export const ScreenTransition: React.FC<ScreenTransitionProps> = ({
  screenKey,
  children,
}) => {
  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={screenKey}
        initial={{ opacity: 0, y: 6, scale: 0.995 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -4, scale: 0.995 }}
        transition={{ duration: 0.2 }}
        className="w-full flex-1 min-h-0 h-full flex flex-col overflow-hidden"
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
};
