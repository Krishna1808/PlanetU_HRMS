import React, { useEffect, useState, useMemo } from 'react';
import { api } from '../api';
import { Modal } from './Modal';

interface Props {
  onSelectEmployee: (id: string) => void;
  onNavigateAdd: () => void;
}

export const EmployeeListPage: React.FC<Props> = ({
  onSelectEmployee,
  onNavigateAdd,
}) => {
  const [employees, setEmployees] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDeptFilter, setSelectedDeptFilter] = useState('');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState('');

  // Termination modal state
  const [selectedTerminateEmp, setSelectedTerminateEmp] = useState<any | null>(null);
  const [noticePeriodDays, setNoticePeriodDays] = useState(30);
  const [terminateReason, setTerminateReason] = useState('');
  const [terminating, setTerminating] = useState(false);
  const [terminateError, setTerminateError] = useState('');
  const [terminateSuccess, setTerminateSuccess] = useState('');

  const calculateEffectiveExitDate = (days: number) => {
    const d = new Date();
    d.setDate(d.getDate() + Number(days));
    return d.toLocaleDateString('en-US', {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const loadData = async () => {
    setLoading(true);
    setError('');
    try {
      const [empRes, deptRes, meRes] = await Promise.all([
        api.getEmployees(),
        api.getDepartments().catch(() => []),
        api.getMe().catch(() => null),
      ]);
      setEmployees(empRes.data || []);
      setDepartments(deptRes || []);
      setCurrentUser(meRes);
    } catch (err: any) {
      setError(err.message || 'Failed to load employees');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const filteredEmployees = useMemo(() => {
    return employees.filter((emp) => {
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        emp.employeeCode?.toLowerCase().includes(q) ||
        emp.firstName?.toLowerCase().includes(q) ||
        emp.lastName?.toLowerCase().includes(q) ||
        `${emp.firstName} ${emp.lastName}`.toLowerCase().includes(q) ||
        emp.personalEmail?.toLowerCase().includes(q) ||
        emp.user?.email?.toLowerCase().includes(q) ||
        emp.department?.name?.toLowerCase().includes(q) ||
        emp.designation?.name?.toLowerCase().includes(q);

      const matchesDept =
        !selectedDeptFilter || emp.departmentId === selectedDeptFilter || emp.department?.id === selectedDeptFilter;

      const matchesStatus =
        !selectedStatusFilter || emp.employmentStatus === selectedStatusFilter;

      return matchesSearch && matchesDept && matchesStatus;
    });
  }, [employees, searchQuery, selectedDeptFilter, selectedStatusFilter]);

  const activeCount = useMemo(
    () => employees.filter((e) => e.employmentStatus === 'ACTIVE' || !e.employmentStatus).length,
    [employees],
  );

  const isHrOrAdmin =
    currentUser?.role === 'CLIENT_SUPER_ADMIN' || currentUser?.role === 'HR_ADMIN';

  const handleConfirmTerminate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTerminateEmp) return;
    setTerminating(true);
    setTerminateError('');
    try {
      const days = Number(noticePeriodDays);
      await api.terminateEmployee(selectedTerminateEmp.id, {
        noticePeriodDays: days,
        reason: terminateReason.trim(),
      });
      setTerminateSuccess(
        days > 0
          ? `Termination notice issued for ${selectedTerminateEmp.firstName} ${selectedTerminateEmp.lastName}. Notice period: ${days} days (Effective: ${calculateEffectiveExitDate(days)}). Notification delivered to employee.`
          : `Employee ${selectedTerminateEmp.firstName} ${selectedTerminateEmp.lastName} (${selectedTerminateEmp.employeeCode}) has been immediately terminated.`,
      );
      setSelectedTerminateEmp(null);
      await loadData();
      setTimeout(() => setTerminateSuccess(''), 6000);
    } catch (err: any) {
      setTerminateError(err?.message || 'Failed to issue termination notice');
    } finally {
      setTerminating(false);
    }
  };

  return (
    <div className="card">
      {/* Header with Title and Primary Action */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '12px',
          marginBottom: '20px',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <h2 style={{ fontSize: '20px', fontWeight: 700, color: '#0f172a' }}>Employee Directory</h2>
            <span
              style={{
                fontSize: '12px',
                fontWeight: 700,
                background: '#eff6ff',
                color: '#2563eb',
                padding: '2px 8px',
                borderRadius: '999px',
                border: '1px solid #bfdbfe',
              }}
            >
              {employees.length} Total
            </span>
            <span
              style={{
                fontSize: '12px',
                fontWeight: 600,
                background: '#ecfdf5',
                color: '#059669',
                padding: '2px 8px',
                borderRadius: '999px',
                border: '1px solid #a7f3d0',
              }}
            >
              {activeCount} Active
            </span>
          </div>
          <p style={{ fontSize: '13px', color: '#64748b', marginTop: '2px' }}>
            View profiles, job designations, reporting structures, and employment statuses.
          </p>
        </div>

        <button className="btn btn-primary" onClick={onNavigateAdd} style={{ padding: '8px 18px', fontSize: '13px' }}>
          Add New Employee
        </button>
      </div>

      {terminateSuccess && (
        <div className="alert-success" style={{ marginBottom: '16px' }}>
          {terminateSuccess}
        </div>
      )}

      {error && <div className="alert-error">{error}</div>}

      {/* Filter and Search Toolbar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          marginBottom: '16px',
          flexWrap: 'wrap',
          background: '#f8fafc',
          padding: '12px 14px',
          borderRadius: '8px',
          border: '1px solid #e2e8f0',
        }}
      >
        <div style={{ flex: '1 1 240px', position: 'relative' }}>
          <span
            style={{
              position: 'absolute',
              left: '10px',
              top: '50%',
              transform: 'translateY(-50%)',
              color: '#94a3b8',
              fontSize: '14px',
              pointerEvents: 'none',
            }}
          >
            
          </span>
          <input
            type="text"
            placeholder="Search by name, employee code, role, or department..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              paddingLeft: '32px',
              paddingRight: searchQuery ? '30px' : '10px',
              width: '100%',
              fontSize: '13px',
            }}
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              style={{
                position: 'absolute',
                right: '8px',
                top: '50%',
                transform: 'translateY(-50%)',
                background: 'none',
                border: 'none',
                color: '#94a3b8',
                cursor: 'pointer',
                fontSize: '14px',
              }}
              title="Clear search"
            >
              Close
            </button>
          )}
        </div>

        <div style={{ minWidth: '180px' }}>
          <select
            value={selectedDeptFilter}
            onChange={(e) => setSelectedDeptFilter(e.target.value)}
            style={{ width: '100%', fontSize: '13px' }}
          >
            <option value="">All Departments</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </div>

        <div style={{ minWidth: '150px' }}>
          <select
            value={selectedStatusFilter}
            onChange={(e) => setSelectedStatusFilter(e.target.value)}
            style={{ width: '100%', fontSize: '13px' }}
          >
            <option value="">All Statuses</option>
            <option value="ACTIVE">ACTIVE</option>
            <option value="PROBATION">PROBATION</option>
            <option value="NOTICE_PERIOD">NOTICE PERIOD</option>
            <option value="TERMINATED">TERMINATED</option>
          </select>
        </div>

        {(searchQuery || selectedDeptFilter || selectedStatusFilter) && (
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => {
              setSearchQuery('');
              setSelectedDeptFilter('');
              setSelectedStatusFilter('');
            }}
            style={{ fontSize: '12px', padding: '6px 10px' }}
          >
            Reset Filters
          </button>
        )}
      </div>

      {/* Loading Skeletons */}
      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', padding: '10px 0' }}>
          {[1, 2, 3, 4, 5].map((i) => (
            <div
              key={i}
              className="skeleton"
              style={{
                height: '52px',
                width: '100%',
                borderRadius: '8px',
              }}
            />
          ))}
        </div>
      ) : filteredEmployees.length === 0 ? (
        <div
          style={{
            padding: '48px 24px',
            textAlign: 'center',
            color: '#64748b',
            background: '#f8fafc',
            borderRadius: '8px',
            border: '1px dashed #cbd5e1',
            margin: '12px 0',
          }}
        >
          
          {employees.length === 0 ? (
            <div>
              <strong style={{ fontSize: '15px', color: '#1e293b' }}>No employees found in the directory</strong>
              <p style={{ fontSize: '13px', marginTop: '4px' }}>
                Click below to onboard your first team member!
              </p>
              <button
                className="btn btn-primary"
                onClick={onNavigateAdd}
                style={{ marginTop: '14px' }}
              >
                + Add Employee
              </button>
            </div>
          ) : (
            <div>
              <strong style={{ fontSize: '15px', color: '#1e293b' }}>No matching employees</strong>
              <p style={{ fontSize: '13px', marginTop: '4px' }}>
                Try adjusting your search keywords or filter criteria.
              </p>
              <button
                className="btn btn-secondary"
                onClick={() => {
                  setSearchQuery('');
                  setSelectedDeptFilter('');
                  setSelectedStatusFilter('');
                }}
                style={{ marginTop: '12px' }}
              >
                Clear All Filters
              </button>
            </div>
          )}
        </div>
      ) : (
        <div style={{ overflowX: 'auto', border: '1px solid #e2e8f0', borderRadius: '8px' }}>
          <table>
            <thead>
              <tr>
                <th>Employee</th>
                <th>Employee Code</th>
                <th>Department</th>
                <th>Designation</th>
                <th>Status</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredEmployees.map((emp) => {
                const initials = `${emp.firstName?.[0] || ''}${emp.lastName?.[0] || ''}`.toUpperCase() || 'EM';
                return (
                  <tr key={emp.id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div
                          style={{
                            width: '34px',
                            height: '34px',
                            borderRadius: '50%',
                            background: '#3b82f6',
                            color: '#ffffff',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontWeight: 700,
                            fontSize: '12px',
                            flexShrink: 0,
                            boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                          }}
                        >
                          {initials}
                        </div>
                        <div>
                          <div style={{ fontWeight: 600, color: '#0f172a', fontSize: '13px' }}>
                            {emp.firstName} {emp.lastName}
                          </div>
                          <div style={{ fontSize: '11px', color: '#64748b' }}>
                            {emp.personalEmail || emp.user?.email || '—'}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td>
                      <span
                        style={{
                          fontWeight: 700,
                          color: '#2563eb',
                          fontFamily: 'monospace',
                          fontSize: '12px',
                          background: '#eff6ff',
                          padding: '2px 6px',
                          borderRadius: '4px',
                        }}
                      >
                        {emp.employeeCode}
                      </span>
                    </td>
                    <td>
                      <span style={{ color: '#334155', fontWeight: 500 }}>
                        {emp.department?.name || '—'}
                      </span>
                    </td>
                    <td>
                      <span style={{ color: '#334155', fontWeight: 500 }}>
                        {emp.designation?.name || '—'}
                      </span>
                    </td>
                    <td>
                      <span
                        className="badge"
                        style={{
                          background:
                            emp.employmentStatus === 'TERMINATED'
                              ? '#fee2e2'
                              : emp.employmentStatus === 'ACTIVE'
                              ? '#dcfce7'
                              : emp.employmentStatus === 'PROBATION'
                              ? '#fef9c3'
                              : emp.employmentStatus === 'NOTICE_PERIOD'
                              ? '#ffedd5'
                              : '#f1f5f9',
                          color:
                            emp.employmentStatus === 'TERMINATED'
                              ? '#b91c1c'
                              : emp.employmentStatus === 'ACTIVE'
                              ? '#15803d'
                              : emp.employmentStatus === 'PROBATION'
                              ? '#854d0e'
                              : emp.employmentStatus === 'NOTICE_PERIOD'
                              ? '#c2410c'
                              : '#475569',
                          border:
                            emp.employmentStatus === 'TERMINATED'
                              ? '1px solid #fca5a5'
                              : emp.employmentStatus === 'ACTIVE'
                              ? '1px solid #bbf7d0'
                              : emp.employmentStatus === 'PROBATION'
                              ? '1px solid #fef08a'
                              : emp.employmentStatus === 'NOTICE_PERIOD'
                              ? '1px solid #fed7aa'
                              : '1px solid #e2e8f0',
                        }}
                      >
                        {emp.employmentStatus === 'TERMINATED'
                          ? 'TERMINATED'
                          : emp.employmentStatus === 'NOTICE_PERIOD'
                          ? '⏳ NOTICE PERIOD'
                          : emp.employmentStatus || 'ACTIVE'}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end', alignItems: 'center' }}>
                        <button
                          className="btn btn-secondary"
                          style={{ padding: '5px 12px', fontSize: '12px' }}
                          onClick={() => onSelectEmployee(emp.id)}
                        >
                          View Profile ↗
                        </button>
                        {isHrOrAdmin && emp.employmentStatus !== 'TERMINATED' && emp.id !== currentUser?.employeeId && (
                          <button
                            className="btn btn-danger"
                            style={{ padding: '5px 10px', fontSize: '12px' }}
                            title="Issue Termination Notice"
                            onClick={() => {
                              setSelectedTerminateEmp(emp);
                              setNoticePeriodDays(30);
                              setTerminateReason('');
                              setTerminateError('');
                            }}
                          >
                            {emp.employmentStatus === 'NOTICE_PERIOD' ? 'Notice / Exit' : 'Terminate'}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* QUICK TERMINATE CONFIRMATION MODAL */}
      {selectedTerminateEmp && (
        <Modal onClose={() => setSelectedTerminateEmp(null)}>
          <div
            className="modal-backdrop-smooth"
            style={{
              position: 'fixed',
              inset: 0,
              backgroundColor: 'rgba(15, 23, 42, 0.65)',
              backdropFilter: 'blur(4px)',
              zIndex: 1000,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '20px',
            }}
            onClick={() => setSelectedTerminateEmp(null)}
          >

          <div
            className="modal-dialog-smooth"
            style={{
              background: '#ffffff',
              borderRadius: '12px',
              width: '100%',
              maxWidth: '500px',
              maxHeight: '90vh',
              display: 'flex',
              flexDirection: 'column',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
              overflow: 'hidden',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                background: '#991b1b',
                color: '#f8fafc',
                padding: '16px 20px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <div>
                <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 800, color: '#f8fafc' }}>
                  Issue Termination Notice
                </h3>
                <p style={{ margin: '2px 0 0', fontSize: '12px', color: '#fecaca' }}>
                  {selectedTerminateEmp.firstName} {selectedTerminateEmp.lastName} ({selectedTerminateEmp.employeeCode})
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedTerminateEmp(null)}
                style={{
                  background: 'rgba(255,255,255,0.15)',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '6px',
                  width: '30px',
                  height: '30px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '15px',
                  cursor: 'pointer',
                }}
              >
                Close
              </button>
            </div>

            <form onSubmit={handleConfirmTerminate} style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ fontSize: '13px', fontWeight: 600, color: '#334155', display: 'block', marginBottom: '6px' }}>
                  Notice Period (Days) *
                </label>
                <div style={{ display: 'flex', gap: '8px', marginBottom: '8px', flexWrap: 'wrap' }}>
                  {[
                    { label: 'Immediate (0d)', days: 0 },
                    { label: '15 Days', days: 15 },
                    { label: '30 Days (Standard)', days: 30 },
                    { label: '60 Days', days: 60 },
                    { label: '90 Days', days: 90 },
                  ].map((preset) => (
                    <button
                      key={preset.days}
                      type="button"
                      onClick={() => setNoticePeriodDays(preset.days)}
                      style={{
                        padding: '5px 11px',
                        fontSize: '12px',
                        fontWeight: 600,
                        borderRadius: '6px',
                        border: noticePeriodDays === preset.days ? '2px solid #2563eb' : '1px solid #cbd5e1',
                        background: noticePeriodDays === preset.days ? '#eff6ff' : '#f8fafc',
                        color: noticePeriodDays === preset.days ? '#1e40af' : '#475569',
                        cursor: 'pointer',
                      }}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
                <input
                  type="number"
                  min="0"
                  max="365"
                  required
                  value={noticePeriodDays}
                  onChange={(e) => setNoticePeriodDays(Math.max(0, parseInt(e.target.value, 10) || 0))}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    fontSize: '14px',
                    fontWeight: 600,
                    border: '1px solid #cbd5e1',
                    borderRadius: '6px',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              {/* Dynamic status preview & notification notice */}
              {noticePeriodDays > 0 ? (
                <div
                  style={{
                    background: '#eff6ff',
                    border: '1px solid #bfdbfe',
                    borderRadius: '8px',
                    padding: '12px 14px',
                    fontSize: '13px',
                    color: '#1e40af',
                    lineHeight: 1.5,
                  }}
                >
                  <div style={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px' }}>
                    Effective Last Working Day: <strong>{calculateEffectiveExitDate(noticePeriodDays)}</strong> ({noticePeriodDays} days notice)
                  </div>
                  <p style={{ margin: '6px 0 0', fontSize: '12px', color: '#1e3a8a' }}>
                    Status transitions to <strong>NOTICE_PERIOD</strong>. The employee will receive an official notification informing them of this termination notice, the {noticePeriodDays}-day notice period, and scheduled last working day. Platform login credentials remain active until exit.
                  </p>
                </div>
              ) : (
                <div
                  style={{
                    background: '#fef2f2',
                    border: '1px solid #fecaca',
                    borderRadius: '8px',
                    padding: '12px 14px',
                    fontSize: '13px',
                    color: '#991b1b',
                    lineHeight: 1.5,
                  }}
                >
                  <strong>Immediate Deactivation (0 Days Notice)</strong>
                  <p style={{ margin: '4px 0 0', fontSize: '12px' }}>
                    This will immediately revoke <strong>{selectedTerminateEmp.firstName} {selectedTerminateEmp.lastName}</strong>'s login credentials, set status to <strong>TERMINATED</strong>, record today as the exit date, and send an immediate separation notification to the employee.
                  </p>
                </div>
              )}

              {terminateError && (
                <div style={{ padding: '10px 14px', background: '#fef2f2', color: '#991b1b', border: '1px solid #fecaca', borderRadius: '6px', fontSize: '13px' }}>
                  {terminateError}
                </div>
              )}

              <div>
                <label style={{ fontSize: '13px', fontWeight: 600, color: '#334155', display: 'block', marginBottom: '4px' }}>
                  Reason for Termination *
                </label>
                <textarea
                  required
                  rows={3}
                  placeholder="e.g. Involuntary separation, contract termination, performance, restructuring..."
                  value={terminateReason}
                  onChange={(e) => setTerminateReason(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    fontSize: '13px',
                    border: '1px solid #cbd5e1',
                    borderRadius: '6px',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '8px' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setSelectedTerminateEmp(null)}
                  disabled={terminating}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-danger"
                  disabled={terminating || !terminateReason.trim()}
                >
                  {terminating ? (
                    <>
                      <span className="spinner" /> Processing...
                    </>
                  ) : noticePeriodDays > 0 ? (
                    'Issue Termination Notice'
                  ) : (
                    'Confirm Immediate Termination'
                  )}
                </button>
              </div>
            </form>
          </div>
          </div>
        </Modal>
      )}
    </div>
  );
};

