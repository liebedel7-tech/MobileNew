import React from 'react';
import { motion, AnimatePresence, type PanInfo } from 'framer-motion';
import { X } from 'lucide-react';

interface SwipeableAlertBannerProps {
  children: React.ReactNode;
  onDismiss: () => void;
  className?: string;
  showCloseButton?: boolean;
  closeButtonClassName?: string;
  ariaLabel?: string;
}

/**
 * Reusable framer-motion swipe-to-dismiss alert/toast banner.
 * Supports smooth horizontal swipe (left or right) to dismiss without blocking vertical scroll.
 */
export const SwipeableAlertBanner: React.FC<SwipeableAlertBannerProps> = ({
  children,
  onDismiss,
  className = '',
  showCloseButton = false,
  closeButtonClassName = 'p-1 hover:bg-white/10 rounded-lg text-current opacity-80 hover:opacity-100 shrink-0 cursor-pointer transition',
  ariaLabel = 'Dismiss alert',
}) => {
  const handleDragEnd = (_: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    if (Math.abs(info.offset.x) > 85 || Math.abs(info.velocity.x) > 380) {
      onDismiss();
    }
  };

  return (
    <motion.div
      layout="position"
      initial={{ opacity: 0, y: -10, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, x: 220, transition: { duration: 0.18, ease: 'easeIn' } }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
      drag="x"
      dragDirectionLock
      dragConstraints={{ left: 0, right: 0 }}
      dragElastic={0.45}
      whileDrag={{ opacity: 0.72, scale: 0.985 }}
      onDragEnd={handleDragEnd}
      style={{ touchAction: 'pan-y' }}
      className={`select-none cursor-grab active:cursor-grabbing ${className}`}
      role="status"
    >
      <div className="flex-1 min-w-0">{children}</div>
      {showCloseButton && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onDismiss();
          }}
          aria-label={ariaLabel}
          className={closeButtonClassName}
        >
          <X className="w-4 h-4" />
        </button>
      )}
    </motion.div>
  );
};

interface SwipeableModalCardProps {
  children: React.ReactNode;
  onDismiss: () => void;
  backdropClassName?: string;
  cardClassName?: string;
  closeOnBackdropClick?: boolean;
  showDragHandle?: boolean;
}

/**
 * Reusable framer-motion swipe-to-dismiss modal card & backdrop.
 * Uses horizontal swipe-to-dismiss (`drag="x"`) with direction locking so
 * vertical scrolling inside tall modal bodies remains smooth on mobile devices.
 */
export const SwipeableModalCard: React.FC<SwipeableModalCardProps> = ({
  children,
  onDismiss,
  backdropClassName = 'fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 overflow-y-auto',
  cardClassName = 'bg-slate-900 border border-slate-700 w-full max-w-md rounded-2xl shadow-2xl overflow-hidden',
  closeOnBackdropClick = true,
  showDragHandle = true,
}) => {
  const handleDragEnd = (_: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    const target = _.target as HTMLElement | null;
    if (target && target.closest('input, textarea, select, option')) {
      return;
    }
    if (Math.abs(info.offset.x) > 105 || Math.abs(info.velocity.x) > 450) {
      onDismiss();
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.16 }}
      onClick={(e) => {
        if (closeOnBackdropClick && e.target === e.currentTarget) {
          onDismiss();
        }
      }}
      className={backdropClassName}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, x: 260, scale: 0.96, transition: { duration: 0.18, ease: 'easeIn' } }}
        transition={{ type: 'spring', stiffness: 380, damping: 32 }}
        drag="x"
        dragDirectionLock
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={0.35}
        whileDrag={{ opacity: 0.85, scale: 0.985 }}
        onDragEnd={handleDragEnd}
        style={{ touchAction: 'pan-y' }}
        onClick={(e) => e.stopPropagation()}
        className={`relative ${cardClassName}`}
      >
        {showDragHandle && (
          <div
            className="w-full flex items-center justify-center pt-2 pb-0.5 pointer-events-none select-none shrink-0"
            aria-hidden="true"
          >
            <div className="w-10 h-1 rounded-full bg-slate-700/80" />
          </div>
        )}
        {children}
      </motion.div>
    </motion.div>
  );
};

export { AnimatePresence };
