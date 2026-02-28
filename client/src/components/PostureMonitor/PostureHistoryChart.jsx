/**
 * PostureHistoryChart - Chart.js bar chart of posture history (good/bad over time)
 * Uses react-chartjs-2 for a premium visual
 */

import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import { Bar } from 'react-chartjs-2';

// Register Chart.js components
ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

export default function PostureHistoryChart({ logs }) {
  const recent = useMemo(() => (logs || []).slice(0, 30).reverse(), [logs]);

  const chartData = useMemo(() => {
    const labels = recent.map((log, i) => {
      const d = log.timestamp ? new Date(log.timestamp) : log.createdAt ? new Date(log.createdAt) : null;
      return d ? d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : `#${i + 1}`;
    });

    return {
      labels,
      datasets: [
        {
          label: 'Good Posture',
          data: recent.map((log) => (log.postureStatus === 'good' ? 1 : 0)),
          backgroundColor: 'rgba(34, 197, 94, 0.75)',
          borderColor: 'rgba(34, 197, 94, 1)',
          borderWidth: 1,
          borderRadius: 4,
        },
        {
          label: 'Bad Posture',
          data: recent.map((log) => (log.postureStatus === 'bad' ? 1 : 0)),
          backgroundColor: 'rgba(255, 0, 0, 0.7)',
          borderColor: 'rgba(255, 0, 0, 1)',
          borderWidth: 1,
          borderRadius: 4,
        },
      ],
    };
  }, [recent]);

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        labels: {
          color: 'rgba(255,255,255,0.6)',
          font: { family: 'Inter, sans-serif', size: 12 },
          boxWidth: 12,
          boxHeight: 12,
        },
      },
      tooltip: {
        backgroundColor: 'rgba(10, 10, 10, 0.95)',
        borderColor: 'rgba(255, 0, 0, 0.5)',
        borderWidth: 1,
        titleColor: '#fff',
        bodyColor: 'rgba(255,255,255,0.7)',
        titleFont: { family: 'Inter, sans-serif', size: 12 },
        bodyFont: { family: 'Inter, sans-serif', size: 11 },
      },
    },
    scales: {
      x: {
        ticks: {
          color: 'rgba(255,255,255,0.3)',
          font: { family: 'Inter, sans-serif', size: 10 },
          maxTicksLimit: 10,
          maxRotation: 45,
        },
        grid: { color: 'rgba(255,255,255,0.04)' },
      },
      y: {
        ticks: {
          color: 'rgba(255,255,255,0.3)',
          font: { family: 'Inter, sans-serif', size: 10 },
          stepSize: 1,
          max: 1,
        },
        grid: { color: 'rgba(255,255,255,0.04)' },
        min: 0,
        max: 1,
      },
    },
  };

  return (
    <motion.div
      className="dashboard-card"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2 }}
    >
      <h6 className="text-white mb-3" style={{ fontSize: '0.9rem', fontWeight: 600 }}>
        📊 Posture History (last {recent.length} events)
      </h6>

      {recent.length === 0 ? (
        <div className="text-center py-4" style={{ color: 'rgba(255,255,255,0.3)', fontSize: '0.875rem' }}>
          No data yet. Start monitoring to see your posture history.
        </div>
      ) : (
        <div style={{ height: 160 }}>
          <Bar data={chartData} options={chartOptions} />
        </div>
      )}
    </motion.div>
  );
}
