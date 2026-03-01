/**
 * Mobile Alerts Panel – recent alerts stored in Firebase (sent to registered email addresses)
 */
import React, { useState, useEffect } from 'react';
import { alertNotificationService } from '../../services/alertNotificationService';

export default function MobileAlertsPanel() {
    const [alerts, setAlerts] = useState([]);

    useEffect(() => {
        loadAlerts();
    }, []);

    const loadAlerts = async () => {
        const data = await alertNotificationService.getRecentAlerts(30);
        setAlerts(data || []);
    };

    return (
        <div className="dashboard-card mt-4">
            <h5 className="mb-3">📱 Mobile Alert Notifications</h5>
            <p className="text-muted small mb-3">Alerts sent to registered email addresses. Stored in Firebase.</p>

            <div style={{ maxHeight: '280px', overflowY: 'auto' }}>
                {alerts.length === 0 && (
                    <div className="text-center py-4 text-muted small">No alerts yet.</div>
                )}
                {alerts.map((a) => (
                    <div key={a.id} className="border-bottom border-dark pb-2 mb-2 small">
                        <div className="text-info">{a.type}</div>
                        <div className="text-white-50">{a.message}</div>
                        <div className="text-muted" style={{ fontSize: '0.7rem' }}>{a.createdAt ? new Date(a.createdAt).toLocaleString() : '—'}</div>
                    </div>
                ))}
            </div>
        </div>
    );
}
