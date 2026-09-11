import React, { useEffect, useState } from 'react';
import { api } from '../api';

interface Props {
  employeeId: string;
  onBack: () => void;
}

export const EmployeeProfileView: React.FC<Props> = ({ employeeId, onBack }) => {
  const [employee, setEmployee] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    setLoading(true);
    api
      .getEmployeeById(employeeId)
      .then((data) => setEmployee(data))
      .catch((err) => setError(err.message || 'Failed to load employee details'))
      .finally(() => setLoading(false));
  }, [employeeId]);

  if (loading) {
    return (
      <div className="card">
        <p style={{ color: '#64748b' }}>Loading profile...</p>
      </div>
    );
  }

  if (error || !employee) {
    return (
      <div className="card">
        <div className="alert-error">{error || 'Employee not found'}</div>
        <button className="btn btn-secondary" onClick={onBack}>
          &larr; Back to Directory
        </button>
      </div>
    );
  }

  return (
    <div className="card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <div>
          <span style={{ fontSize: '13px', fontWeight: 600, color: '#2563eb' }}>
            {employee.employeeCode}
          </span>
          <h2 style={{ fontSize: '20px', fontWeight: 600, marginTop: '2px' }}>
            {employee.firstName} {employee.lastName}
          </h2>
          <p style={{ fontSize: '14px', color: '#64748b' }}>
            {employee.designation?.name || '—'} &bull; {employee.department?.name || '—'}
          </p>
        </div>
        <button className="btn btn-secondary" onClick={onBack}>
          &larr; Back to Directory
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '24px', marginTop: '16px' }}>
        {/* Personal Details */}
        <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '6px' }}>
          <h3 style={{ fontSize: '14px', fontWeight: 600, color: '#334155', marginBottom: '12px', textTransform: 'uppercase' }}>
            Personal Details
          </h3>
          <p style={{ fontSize: '13px', marginBottom: '8px' }}>
            <strong>Email:</strong> {employee.personalEmail || '—'}
          </p>
          <p style={{ fontSize: '13px', marginBottom: '8px' }}>
            <strong>Phone:</strong> {employee.phone || '—'}
          </p>
          <p style={{ fontSize: '13px', marginBottom: '8px' }}>
            <strong>Current Address:</strong> {employee.currentAddress || '—'}
          </p>
          <p style={{ fontSize: '13px' }}>
            <strong>Emergency Contact:</strong> {employee.emergencyContactName ? `${employee.emergencyContactName} (${employee.emergencyContactPhone || 'No phone'})` : '—'}
          </p>
        </div>

        {/* Employment Details */}
        <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '6px' }}>
          <h3 style={{ fontSize: '14px', fontWeight: 600, color: '#334155', marginBottom: '12px', textTransform: 'uppercase' }}>
            Employment Details
          </h3>
          <p style={{ fontSize: '13px', marginBottom: '8px' }}>
            <strong>Department:</strong> {employee.department?.name} ({employee.department?.codePrefix})
          </p>
          <p style={{ fontSize: '13px', marginBottom: '8px' }}>
            <strong>Designation:</strong> {employee.designation?.name}
          </p>
          <p style={{ fontSize: '13px', marginBottom: '8px' }}>
            <strong>Status:</strong> <span className="badge badge-active">{employee.employmentStatus}</span>
          </p>
          <p style={{ fontSize: '13px', marginBottom: '8px' }}>
            <strong>Employment Type:</strong> {employee.employmentType}
          </p>
          <p style={{ fontSize: '13px' }}>
            <strong>Date of Joining:</strong> {new Date(employee.dateOfJoining).toLocaleDateString()}
          </p>
        </div>
      </div>
    </div>
  );
};
