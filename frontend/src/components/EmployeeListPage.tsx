import React, { useEffect, useState } from 'react';
import { api } from '../api';

interface Props {
  onSelectEmployee: (id: string) => void;
  onNavigateAdd: () => void;
}

export const EmployeeListPage: React.FC<Props> = ({
  onSelectEmployee,
  onNavigateAdd,
}) => {
  const [employees, setEmployees] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadEmployees = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.getEmployees();
      setEmployees(res.data || []);
    } catch (err: any) {
      setError(err.message || 'Failed to load employees');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadEmployees();
  }, []);

  return (
    <div className="card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <div>
          <h2 style={{ fontSize: '18px', fontWeight: 600 }}>Employee Directory</h2>
          <p style={{ fontSize: '13px', color: '#64748b' }}>Plain view of registered employees</p>
        </div>
        <button className="btn btn-primary" onClick={onNavigateAdd}>
          + Add Employee
        </button>
      </div>

      {error && <div className="alert-error">{error}</div>}

      {loading ? (
        <p style={{ padding: '24px 0', color: '#64748b' }}>Loading employees...</p>
      ) : employees.length === 0 ? (
        <p style={{ padding: '24px 0', color: '#64748b' }}>
          No employees found yet. Click <strong>+ Add Employee</strong> to create the first record!
        </p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Employee Code</th>
              <th>Full Name</th>
              <th>Department</th>
              <th>Designation</th>
              <th>Status</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {employees.map((emp) => (
              <tr key={emp.id}>
                <td style={{ fontWeight: 600, color: '#2563eb' }}>{emp.employeeCode}</td>
                <td>{emp.firstName} {emp.lastName}</td>
                <td>{emp.department?.name || '—'}</td>
                <td>{emp.designation?.name || '—'}</td>
                <td>
                  <span className="badge badge-active">{emp.employmentStatus}</span>
                </td>
                <td>
                  <button
                    className="btn btn-secondary"
                    style={{ padding: '4px 10px', fontSize: '12px' }}
                    onClick={() => onSelectEmployee(emp.id)}
                  >
                    View Profile
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
};
