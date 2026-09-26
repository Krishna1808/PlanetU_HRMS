import React, { useEffect, useState } from 'react';
import { api } from '../api';

interface Props {
  onSuccess: () => void;
  onCancel: () => void;
}

export const AddEmployeeForm: React.FC<Props> = ({ onSuccess, onCancel }) => {
  const [departments, setDepartments] = useState<any[]>([]);
  const [designations, setDesignations] = useState<any[]>([]);

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [workEmail, setWorkEmail] = useState('');
  const [personalEmail, setPersonalEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [departmentId, setDepartmentId] = useState('');
  const [designationId, setDesignationId] = useState('');
  const [dateOfJoining, setDateOfJoining] = useState(
    new Date().toISOString().split('T')[0],
  );
  const [createLogin, setCreateLogin] = useState(true);
  const [initialPassword, setInitialPassword] = useState('Password@123');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    // Load lookup masters
    api.getDepartments().then((depts) => {
      setDepartments(depts);
      if (depts.length > 0) setDepartmentId(depts[0].id);
    }).catch((err) => setError('Failed to load departments: ' + err.message));

    api.getDesignations().then((desigs) => {
      setDesignations(desigs);
      if (desigs.length > 0) setDesignationId(desigs[0].id);
    }).catch((err) => setError('Failed to load designations: ' + err.message));
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!departmentId || !designationId) {
      setError('Please select both a department and a designation.');
      return;
    }

    const effectiveWorkEmail = workEmail.trim().toLowerCase();
    if (createLogin && !effectiveWorkEmail && !personalEmail.trim()) {
      setError('Please provide a work email address to create a login account and receive notifications.');
      return;
    }

    const loginEmail = effectiveWorkEmail || personalEmail.trim().toLowerCase();

    setLoading(true);
    try {
      await api.createEmployee({
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        workEmail: createLogin && loginEmail ? loginEmail : undefined,
        personalEmail: personalEmail.trim() || loginEmail || undefined,
        initialPassword: createLogin && loginEmail ? (initialPassword.trim() || 'Password@123') : undefined,
        phone: phone.trim() || undefined,
        departmentId,
        designationId,
        dateOfJoining: new Date(dateOfJoining).toISOString(),
        employmentType: 'FULL_TIME',
        employmentStatus: 'ACTIVE',
      });
      onSuccess();
    } catch (err: any) {
      setError(err.message || 'Failed to create employee');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <div>
          <h2 style={{ fontSize: '18px', fontWeight: 600 }}>Add New Employee</h2>
          <p style={{ fontSize: '13px', color: '#64748b' }}>
            Basic employee record &mdash; Sequential code (e.g. ENG-0001) generated automatically
          </p>
        </div>
        <button className="btn btn-secondary" onClick={onCancel} type="button">
          Cancel
        </button>
      </div>

      {error && <div className="alert-error">{error}</div>}

      <form onSubmit={handleSubmit}>
        <div className="form-grid">
          <div className="form-group">
            <label>First Name *</label>
            <input
              className="form-control"
              type="text"
              required
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              placeholder="e.g. John"
            />
          </div>

          <div className="form-group">
            <label>Last Name *</label>
            <input
              className="form-control"
              type="text"
              required
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              placeholder="e.g. Doe"
            />
          </div>
        </div>

        <div className="form-grid">
          <div className="form-group">
            <label>
              Work / Login Email {createLogin ? '*' : ''}
            </label>
            <input
              className="form-control"
              type="email"
              required={createLogin}
              value={workEmail}
              onChange={(e) => setWorkEmail(e.target.value)}
              placeholder="e.g. employee@company.com or employee@gmail.com"
            />
            <small style={{ fontSize: '11px', color: '#64748b', display: 'block', marginTop: '4px' }}>
              Used for Employee Self-Service login and receiving all real-time email notifications.
            </small>
          </div>

          <div className="form-group">
            <label>Personal Email (Optional)</label>
            <input
              className="form-control"
              type="email"
              value={personalEmail}
              onChange={(e) => setPersonalEmail(e.target.value)}
              placeholder="e.g. personal@example.com"
            />
          </div>
        </div>

        <div className="form-grid">
          <div className="form-group">
            <label>Phone Number</label>
            <input
              className="form-control"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="e.g. +91 9876543210"
            />
          </div>
        </div>

        {/* User Account & Real-time Notification Provisioning */}
        <div
          style={{
            background: '#f8fafc',
            border: '1px solid #e2e8f0',
            borderRadius: '8px',
            padding: '14px 16px',
            marginBottom: '16px',
          }}
        >
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontWeight: 600, fontSize: '13px', color: '#1e293b' }}>
            <input
              type="checkbox"
              checked={createLogin}
              onChange={(e) => setCreateLogin(e.target.checked)}
              style={{ width: '16px', height: '16px', cursor: 'pointer' }}
            />
            <span>Create Self-Service Login & Enable Real-Time Email Notifications</span>
          </label>
          <p style={{ fontSize: '12px', color: '#64748b', margin: '6px 0 0 24px' }}>
            When enabled, a portal account is created with this email address. The employee will receive real-time email notifications for announcements, payslips, bonuses, leave approvals, and shift rosters.
          </p>

          {createLogin && (
            <div style={{ marginTop: '12px', marginLeft: '24px', maxWidth: '320px' }}>
              <label style={{ fontSize: '12px', fontWeight: 500, color: '#475569', display: 'block', marginBottom: '4px' }}>
                Initial Temporary Password
              </label>
              <input
                className="form-control"
                type="text"
                value={initialPassword}
                onChange={(e) => setInitialPassword(e.target.value)}
                placeholder="Default: Password@123"
                style={{ fontSize: '13px' }}
              />
            </div>
          )}
        </div>

        <div className="form-grid">
          <div className="form-group">
            <label>Department *</label>
            <select
              className="form-control"
              required
              value={departmentId}
              onChange={(e) => setDepartmentId(e.target.value)}
            >
              {departments.map((dept) => (
                <option key={dept.id} value={dept.id}>
                  {dept.name} ({dept.codePrefix})
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label>Designation *</label>
            <select
              className="form-control"
              required
              value={designationId}
              onChange={(e) => setDesignationId(e.target.value)}
            >
              {designations.map((desig) => (
                <option key={desig.id} value={desig.id}>
                  {desig.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="form-grid">
          <div className="form-group">
            <label>Date of Joining *</label>
            <input
              className="form-control"
              type="date"
              required
              value={dateOfJoining}
              onChange={(e) => setDateOfJoining(e.target.value)}
            />
          </div>
        </div>

        <div style={{ display: 'flex', gap: '12px', marginTop: '20px' }}>
          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? 'Creating...' : 'Save Employee'}
          </button>
          <button type="button" className="btn btn-secondary" onClick={onCancel}>
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
};
