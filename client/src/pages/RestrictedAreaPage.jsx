import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Container } from 'react-bootstrap';
import { useAuth } from '../context/AuthContext';
import { LogoutButton } from '../components/LogoutButton';
import NotificationPanel from '../components/NotificationPanel';
import RestrictedAreaMonitor from '../components/RestrictedAreaMonitor/RestrictedAreaMonitor';
import { intrusionLogsService } from '../services/intrusionLogs';
import './DashboardPages.css';

export default function RestrictedAreaPage() {
    const { user } = useAuth();
    const [logs, setLogs] = useState([]);

    // Initial load
    useEffect(() => {
        loadLogs();
    }, []);

    const loadLogs = async () => {
        try {
            const recent = await intrusionLogsService.getRecentIntrusions(20);
            setLogs(recent);
        } catch (err) {
            console.error('Failed to load intrusion logs:', err);
        }
    };

    return (
        <div className="dashboard-page head-dashboard">
            <NotificationPanel />

            {/* Navbar - Matching Head Dashboard */}
            <nav className="dashboard-navbar d-flex align-items-center gap-3">
                <span className="navbar-brand me-auto">
                    🛡️ Head Employee Dashboard
                </span>

                {/* Nav tabs */}
                <div className="d-none d-md-flex gap-1">
                    <Link
                        to="/head/dashboard"
                        className="nav-link"
                    >
                        Crowd Dashboard
                    </Link>
                    <Link
                        to="/head/restricted-area"
                        className="nav-link active"
                    >
                        Restricted Area
                    </Link>
                </div>

                <span className="user-chip d-none d-md-inline-flex">
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#22c55e', flexShrink: 0 }} />
                    {user?.name} · {user?.employeeId}
                </span>
                <LogoutButton />
            </nav>

            <Container fluid className="py-4">
                <AnimatePresence mode="wait">
                    <motion.div
                        key="restricted"
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -12 }}
                        transition={{ duration: 0.3 }}
                    >
                        <div className="section-header">
                            <span>🚫</span> Restricted Area Monitoring
                        </div>

                        {/* Main Monitor Component */}
                        <RestrictedAreaMonitor onLogUpdate={loadLogs} />

                        {/* Alert Log from Firebase */}
                        <motion.div
                            className="dashboard-card mt-4"
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.25 }}
                        >
                            <div className="section-header mb-3">
                                <span>📋</span> Live Intrusion Incidents
                                {logs.length > 0 && (
                                    <span className="ms-2 badge" style={{
                                        background: 'rgba(255,0,0,0.2)',
                                        border: '1px solid rgba(255,0,0,0.4)',
                                        color: '#FF0000',
                                        borderRadius: 99,
                                        padding: '2px 10px',
                                        fontSize: '0.72rem',
                                        fontWeight: 600,
                                    }}>
                                        {logs.length}
                                    </span>
                                )}
                            </div>

                            <div className="alert-history-list" style={{ maxHeight: '400px', overflowY: 'auto' }}>
                                {logs.length === 0 ? (
                                    <div className="text-center py-4" style={{ color: 'rgba(255,255,255,0.3)', fontSize: '0.875rem' }}>
                                        No intrusion alerts recorded yet. Secure.
                                    </div>
                                ) : (
                                    logs.map((log, i) => {
                                        const at = log.timestamp ? new Date(log.timestamp) : null;
                                        return (
                                            <div key={log.id ?? i} className="alert-history-item border-bottom border-dark pb-2 mb-2 d-flex justify-content-between align-items-center">
                                                <span style={{ color: 'rgba(255,255,255,0.8)', fontSize: '0.85rem' }}>
                                                    <span style={{ color: '#FF0000', marginRight: 6 }}>🚨</span>
                                                    Intruder: <strong>{log.detectedPerson}</strong>
                                                    <span className="mx-2">·</span>
                                                    Zone ID: <strong>{log.zoneId}</strong>
                                                    <span className="mx-2">·</span>
                                                    Confidence: <strong>{Math.round(log.confidenceScore * 100)}%</strong>
                                                </span>
                                                <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.75rem', whiteSpace: 'nowrap' }}>
                                                    {at ? at.toLocaleString() : '—'}
                                                </span>
                                            </div>
                                        );
                                    })
                                )}
                            </div>
                        </motion.div>
                    </motion.div>
                </AnimatePresence>
            </Container>
        </div>
    );
}
