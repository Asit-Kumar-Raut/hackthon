/**
 * Access Control Panel – Manager only
 * Register Authorized Personnel: Name, Employee ID, Department, Phone number, Face (capture/upload)
 * Data stored in Firebase authorized_faces for face recognition access authorization.
 */
import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { authorizedFacesService } from '../../services/authorizedFacesService';
import { pushNotification } from '../NotificationPanel';

const DEFAULT_ALERT_MOBILE = '9861216929';

export default function AccessControlPanel() {
    const { user } = useAuth();
    const [list, setList] = useState([]);
    const [name, setName] = useState('');
    const [employeeId, setEmployeeId] = useState('');
    const [department, setDepartment] = useState('');
    const [phoneNumber, setPhoneNumber] = useState(DEFAULT_ALERT_MOBILE);
    const [loading, setLoading] = useState(false);

    const isManager = user?.role === 'head' || user?.role === 'manager';

    useEffect(() => {
        if (isManager) loadAuthorized();
    }, [isManager]);

    const loadAuthorized = async () => {
        const data = await authorizedFacesService.getAllAuthorized();
        setList(data || []);
    };

    const handleRegister = async (e) => {
        e.preventDefault();
        if (!name.trim() || !employeeId.trim()) {
            pushNotification('Name and Employee ID are required.', 'alert');
            return;
        }
        setLoading(true);
        try {
            await authorizedFacesService.registerAuthorizedPerson({
                name: name.trim(),
                employeeId: employeeId.trim(),
                department: department.trim(),
                phoneNumber: phoneNumber.trim() || DEFAULT_ALERT_MOBILE,
                faceEncoding: [],
                createdBy: user?.employeeId,
            });
            pushNotification('Authorized person registered.', 'success');
            setName('');
            setEmployeeId('');
            setDepartment('');
            setPhoneNumber(DEFAULT_ALERT_MOBILE);
            loadAuthorized();
        } catch (err) {
            pushNotification('Registration failed.', 'alert');
        }
        setLoading(false);
    };

    const handleRemove = async (id) => {
        try {
            await authorizedFacesService.removeAuthorizedPerson(id);
            pushNotification('Removed from authorized list.', 'success');
            loadAuthorized();
        } catch (err) {
            pushNotification('Remove failed.', 'alert');
        }
    };

    if (!isManager) return null;

    return (
        <div className="dashboard-card mt-4">
            <h5 className="mb-3">🧠 Access Control Panel – Authorized Personnel</h5>
            <p className="text-muted small mb-3">Register personnel for face recognition access. Only Manager can add/remove.</p>

            <form onSubmit={handleRegister} className="row g-2 mb-4">
                <div className="col-md-3">
                    <input type="text" className="form-control form-control-sm" placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} />
                </div>
                <div className="col-md-2">
                    <input type="text" className="form-control form-control-sm" placeholder="Employee ID" value={employeeId} onChange={(e) => setEmployeeId(e.target.value)} />
                </div>
                <div className="col-md-2">
                    <input type="text" className="form-control form-control-sm" placeholder="Department" value={department} onChange={(e) => setDepartment(e.target.value)} />
                </div>
                <div className="col-md-3">
                    <input type="tel" className="form-control form-control-sm" placeholder="Phone (e.g. 9861216929)" value={phoneNumber} onChange={(e) => setPhoneNumber(e.target.value)} />
                </div>
                <div className="col-md-2">
                    <button type="submit" className="btn btn-primary btn-sm w-100" disabled={loading}>Add</button>
                </div>
            </form>

            <div className="small text-muted mb-2">Alert mobile (default): {DEFAULT_ALERT_MOBILE}</div>

            <ul className="list-group list-group-flush">
                {list.length === 0 && <li className="list-group-item bg-transparent text-muted">No authorized personnel yet.</li>}
                {list.map((item) => (
                    <li key={item.id} className="list-group-item bg-transparent d-flex justify-content-between align-items-center">
                        <span>{item.name} · {item.employeeId} · {item.department} · {item.phoneNumber || '—'}</span>
                        <button type="button" className="btn btn-outline-danger btn-sm" onClick={() => handleRemove(item.id)}>Remove</button>
                    </li>
                ))}
            </ul>
        </div>
    );
}
