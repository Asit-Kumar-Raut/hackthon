/**
 * NotificationPanel - Real-time toast notifications (Socket.io alerts)
 * Renders fixed-position toast messages for posture/crowd events
 */

import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

let _addNotif = null;

/**
 * Call this from anywhere to push a notification
 */
export function pushNotification(message, type = 'info') {
    if (_addNotif) _addNotif({ id: Date.now(), message, type });
}

export default function NotificationPanel() {
    const [notifs, setNotifs] = useState([]);

    const addNotif = useCallback((notif) => {
        setNotifs((prev) => [notif, ...prev].slice(0, 5)); // max 5 toasts
        // Auto-dismiss after 5 seconds
        setTimeout(() => {
            setNotifs((prev) => prev.filter((n) => n.id !== notif.id));
        }, 5000);
    }, []);

    useEffect(() => {
        _addNotif = addNotif;
        return () => { _addNotif = null; };
    }, [addNotif]);

    const remove = (id) => setNotifs((prev) => prev.filter((n) => n.id !== id));

    const typeStyles = {
        info: { borderColor: 'rgba(255,0,0,0.5)', icon: '🔔' },
        alert: { borderColor: '#FF0000', icon: '🚨' },
        success: { borderColor: 'rgba(34,197,94,0.5)', icon: '✅' },
        warning: { borderColor: 'rgba(245,158,11,0.5)', icon: '⚠️' },
    };

    return (
        <div className="notification-panel" aria-live="polite">
            <AnimatePresence>
                {notifs.map((n) => {
                    const style = typeStyles[n.type] || typeStyles.info;
                    return (
                        <motion.div
                            key={n.id}
                            className="notification-toast"
                            style={{ borderColor: style.borderColor }}
                            initial={{ x: 120, opacity: 0 }}
                            animate={{ x: 0, opacity: 1 }}
                            exit={{ x: 120, opacity: 0 }}
                            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                        >
                            <div className="d-flex align-items-start gap-2">
                                <span style={{ fontSize: '1rem', flex: 'none' }}>{style.icon}</span>
                                <span style={{ flex: 1, fontSize: '0.82rem', lineHeight: 1.4 }}>{n.message}</span>
                                <button
                                    type="button"
                                    onClick={() => remove(n.id)}
                                    style={{
                                        background: 'none',
                                        border: 'none',
                                        color: 'rgba(255,255,255,0.3)',
                                        cursor: 'pointer',
                                        padding: 0,
                                        fontSize: '0.9rem',
                                        flex: 'none',
                                        lineHeight: 1,
                                    }}
                                    aria-label="Dismiss notification"
                                >
                                    ×
                                </button>
                            </div>
                        </motion.div>
                    );
                })}
            </AnimatePresence>
        </div>
    );
}
