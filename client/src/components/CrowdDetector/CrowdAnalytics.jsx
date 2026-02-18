/**
 * CrowdAnalytics - Charts and stats: count over time, peak count, violations today
 */

import React from 'react';
import { motion } from 'framer-motion';

export default function CrowdAnalytics({ logs = [] }) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayLogs = logs.filter((l) => new Date(l.createdAt) >= today);
  const peakCount = todayLogs.length ? Math.max(...todayLogs.map((l) => l.detectedCount || 0)) : 0;
  const violationCount = todayLogs.filter((l) => l.restrictedViolation || l.alertTriggered).length;
  const recentCounts = todayLogs.slice(-30).reverse();

  return (
    <motion.div
      className="dashboard-card mt-4"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2 }}
    >
      <h6 className="text-white mb-3">Crowd Analytics (Today)</h6>
      <div className="row g-3 mb-3">
        <div className="col-md-4">
          <div className="dashboard-card text-center py-3">
            <div className="text-muted small">Peak Count</div>
            <div className="display-6 text-white">{peakCount}</div>
          </div>
        </div>
        <div className="col-md-4">
          <div className="dashboard-card text-center py-3">
            <div className="text-muted small">Violations Today</div>
            <div className="display-6 text-danger">{violationCount}</div>
          </div>
        </div>
        <div className="col-md-4">
          <div className="dashboard-card text-center py-3">
            <div className="text-muted small">Samples Logged</div>
            <div className="display-6 text-white">{todayLogs.length}</div>
          </div>
        </div>
      </div>
      <div>
        <div className="text-muted small mb-2">Count over time (last 30 samples)</div>
        <div className="d-flex align-items-end gap-1" style={{ height: 100 }}>
          {recentCounts.length === 0 && (
            <div className="text-muted small w-100 text-center py-4">No data yet. Start camera to log.</div>
          )}
          {recentCounts.map((log, i) => (
            <motion.div
              key={log._id || i}
              className="crowd-chart-bar"
              initial={{ height: 0 }}
              animate={{ height: `${Math.min(100, (log.detectedCount || 0) * 12)}%` }}
              transition={{ delay: i * 0.02 }}
              style={{
                flex: 1,
                minHeight: 4,
                maxWidth: 20,
                background: log.restrictedViolation ? 'rgba(220, 53, 69, 0.9)' : 'rgba(255, 0, 0, 0.5)',
                borderRadius: '4px 4px 0 0',
              }}
              title={`${log.detectedCount} at ${new Date(log.createdAt).toLocaleTimeString()}`}
            />
          ))}
        </div>
      </div>
    </motion.div>
  );
}
