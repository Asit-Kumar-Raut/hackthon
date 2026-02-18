/**
 * PostureAlertOverlay - Blur screen, alert popup, and siren when bad posture > 10 min
 */

import React, { useEffect } from 'react';
import { motion } from 'framer-motion';

export default function PostureAlertOverlay({ onDismiss, message, playSiren, stopSiren }) {
  useEffect(() => {
    if (playSiren) playSiren(8000);
    return () => { if (stopSiren) stopSiren(); };
  }, [playSiren, stopSiren]);

  return (
    <motion.div
      className="alert-overlay"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.4 }}
      onClick={(e) => e.target === e.currentTarget && onDismiss()}
    >
      <motion.div
        className="alert-overlay-card"
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="alert-overlay-title">Posture Alert</div>
        <p className="alert-overlay-message">{message}</p>
        <motion.button
          type="button"
          className="btn-outline-red mt-3"
          onClick={onDismiss}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.98 }}
        >
          I understand
        </motion.button>
      </motion.div>
    </motion.div>
  );
}
