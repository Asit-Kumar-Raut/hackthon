/**
 * PostureHistoryChart - Simple chart of posture history (good/bad over time)
 */

import React from 'react';
import { motion } from 'framer-motion';

export default function PostureHistoryChart({ logs }) {
  const recent = (logs || []).slice(0, 30).reverse();
  const max = Math.max(1, recent.length);

  return (
    <motion.div
      className="dashboard-card"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2 }}
    >
      <h6 className="text-white mb-3">Posture History (last 30)</h6>
      <div className="posture-chart d-flex align-items-end gap-1" style={{ height: 120 }}>
        {recent.map((log, i) => (
          <motion.div
            key={log._id || i}
            className={`posture-chart-bar ${log.postureStatus}`}
            initial={{ height: 0 }}
            animate={{ height: `${(1 / max) * 100}%` }}
            transition={{ delay: i * 0.02 }}
            style={{ flex: 1, minHeight: 8 }}
            title={`${log.postureStatus} - ${log.createdAt ? new Date(log.createdAt).toLocaleTimeString() : ''}`}
          />
        ))}
        {recent.length === 0 && (
          <div className="text-muted small w-100 text-center py-4">No data yet. Start monitoring to see history.</div>
        )}
      </div>
      <div className="d-flex gap-3 mt-2 small text-muted">
        <span><span className="chart-legend good" /> Good</span>
        <span><span className="chart-legend bad" /> Bad</span>
      </div>
    </motion.div>
  );
}
