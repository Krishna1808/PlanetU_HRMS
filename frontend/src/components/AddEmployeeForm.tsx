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
  const [personalEmail, setPersonalEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [departmentId, setDepartmentId] = useState('');
  const [designationId, setDesignationId] = useState('');
  const [dateOfJoining, setDateOfJoining] = useState(
    new Date().toISOString().split('T')[0],
  );

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

    setLoading(true);
    try {
      await api.createEmployee({
        firstName,
        lastName,
        personalEmail: personalEmail || undefined,
        phone: phone || undefined,
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
            <label>Personal Email</label>
            <input
              className="form-control"
              type="email"
              value={personalEmail}
              onChange={(e) => setPersonalEmail(e.target.value)}
              placeholder="e.g. john.doe@example.com"
            />
          </div>

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
