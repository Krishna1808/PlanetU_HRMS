import React, { useEffect, useState } from 'react';
import { api } from '../api';
import { Modal } from './Modal';

export function EssDashboardPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [remarks, setRemarks] = useState('');

  // Self-profile edit modal
  const [showEditModal, setShowEditModal] = useState(false);
  const [editPhone, setEditPhone] = useState('');
  const [editPersonalEmail, setEditPersonalEmail] = useState('');
  const [editCurrentAddress, setEditCurrentAddress] = useState('');
  const [editEmergencyName, setEditEmergencyName] = useState('');
  const [editEmergencyPhone, setEditEmergencyPhone] = useState('');
  const [editEmergencyRelation, setEditEmergencyRelation] = useState('');
  const [editMessage, setEditMessage] = useState('');

  // Leave apply modal state
  const [showApplyModal, setShowApplyModal] = useState(false);
  const [leaveTypes, setLeaveTypes] = useState<any[]>([]);
  const [applyTypeId, setApplyTypeId] = useState('');
  const [applyStartDate, setApplyStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [applyEndDate, setApplyEndDate] = useState(new Date().toISOString().split('T')[0]);
  const [applyHalfDay, setApplyHalfDay] = useState(false);
  const [applyHalfDaySession, setApplyHalfDaySession] = useState('FIRST_HALF');
  const [applyReason, setApplyReason] = useState('');
  const [applyingLeave, setApplyingLeave] = useState(false);

  const openApplyLeaveModal = async () => {
    setShowApplyModal(true);
    if (leaveTypes.length === 0) {
      try {
        const types = await api.getLeaveTypes();
        setLeaveTypes(types || []);
        if (types && types.length > 0) {
          setApplyTypeId(types[0].id);
        }
      } catch {
        // ignore
      }
    } else if (!applyTypeId && leaveTypes.length > 0) {
      setApplyTypeId(leaveTypes[0].id);
    }
  };

  const handleApplyLeaveSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!applyTypeId) {
      alert('Please select a leave type');
      return;
    }
    try {
      setApplyingLeave(true);
      await api.applyLeave({
        leaveTypeId: applyTypeId,
        startDate: new Date(applyStartDate).toISOString(),
        endDate: new Date(applyEndDate).toISOString(),
        isHalfDay: applyHalfDay,
        halfDaySession: applyHalfDay ? applyHalfDaySession : undefined,
        reason: applyReason,
      });
      alert('Leave application submitted successfully!');
      setShowApplyModal(false);
      setApplyReason('');
      await loadDashboard();
    } catch (err: any) {
      alert(err.message || 'Failed to submit leave application');
    } finally {
      setApplyingLeave(false);
    }
  };

  const loadDashboard = async () => {
    try {
      setLoading(true);
      setError('');
      const res = await api.getEssDashboard();
      setData(res);
      if (res.profile) {
        setEditPhone(res.profile.phone || '');
        setEditPersonalEmail(res.profile.personalEmail || '');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load dashboard');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboard();
  }, []);

  const handleCheckIn = async () => {
    try {
      setActionLoading(true);
      await api.checkIn(remarks || undefined);
      setRemarks('');
      await loadDashboard();
    } catch (err: any) {
      alert(err.message || 'Check-in failed');
    } finally {
      setActionLoading(false);
    }
  };

  const handleCheckOut = async () => {
    try {
      setActionLoading(true);
      await api.checkOut(remarks || undefined);
      setRemarks('');
      await loadDashboard();
    } catch (err: any) {
      alert(err.message || 'Check-out failed');
    } finally {
      setActionLoading(false);
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setActionLoading(true);
      setEditMessage('');
      await api.updateEssProfile({
        phone: editPhone || undefined,
        personalEmail: editPersonalEmail || undefined,
        currentAddress: editCurrentAddress || undefined,
        emergencyContactName: editEmergencyName || undefined,
        emergencyContactPhone: editEmergencyPhone || undefined,
        emergencyContactRelation: editEmergencyRelation || undefined,
      });
      setEditMessage('Profile updated successfully!');
      setTimeout(() => {
        setShowEditModal(false);
        setEditMessage('');
        loadDashboard();
      }, 1200);
    } catch (err: any) {
      alert(err.message || 'Profile update failed');
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return <div className="card" style={{ textAlign: 'center', padding: '40px' }}>Loading Employee Workspace...</div>;
  }

  if (error) {
    return (
      <div className="card" style={{ borderLeft: '4px solid #ef4444' }}>
        <h3>Dashboard Unavailable</h3>
        <p style={{ color: '#64748b', marginTop: '8px' }}>{error}</p>
        <p style={{ fontSize: '13px', marginTop: '8px' }}>
          <em>Ensure your user account is linked to an active Employee record to access personal self-service.</em>
        </p>
      </div>
    );
  }

  const { profile, shift, todayAttendance, leaveBalances, recentLeaveRequests, latestPayslip, managerOverview } = data;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* 1. Header Banner */}
      <div className="card" style={{ background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)', color: 'white' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <div style={{ fontSize: '12px', textTransform: 'uppercase', color: '#94a3b8', letterSpacing: '0.05em' }}>
              Employee Self-Service
            </div>
            <h2 style={{ fontSize: '22px', fontWeight: 700, margin: '4px 0', color: 'white' }}>
              Welcome back, {profile.firstName} {profile.lastName} 👋
            </h2>
            <div style={{ fontSize: '14px', color: '#cbd5e1' }}>
              <strong>{profile.employeeCode}</strong> • {profile.designation} ({profile.department})
              {profile.reportingManager && <span> • Reports to: <strong>{profile.reportingManager}</strong></span>}
            </div>
          </div>
          <button
            className="btn btn-secondary"
            style={{ background: '#334155', color: '#f8fafc', borderColor: '#475569' }}
            onClick={() => setShowEditModal(true)}
          >
            ✏️ Edit My Contact Info
          </button>
        </div>
      </div>

      {/* 2. Manager Alert (if applicable) */}
      {managerOverview && (
        <div className="card" style={{ background: '#eff6ff', border: '1px solid #bfdbfe' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <span style={{ fontWeight: 700, color: '#1e40af' }}>👔 Manager Workspace</span>
              <p style={{ fontSize: '13px', color: '#3b82f6', margin: '4px 0 0' }}>
                You have <strong>{managerOverview.directReportsCount}</strong> direct reports and{' '}
                <strong>{managerOverview.pendingLeaveApprovalsCount}</strong> pending leave approval requests.
              </p>
            </div>
            <span className="badge badge-role" style={{ background: '#2563eb', color: 'white' }}>
              MANAGER ACTIVE
            </span>
          </div>
        </div>
      )}

      {/* 3. Grid: Today Attendance & Shift info */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px' }}>
        {/* Attendance Card */}
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 600 }}>⏱️ Today's Attendance</h3>
            <span
              className={`badge ${
                todayAttendance.status === 'PRESENT'
                  ? 'badge-active'
                  : todayAttendance.status === 'WEEKLY_OFF'
                  ? 'badge-role'
                  : 'badge-inactive'
              }`}
            >
              {todayAttendance.status}
            </span>
          </div>

          <div style={{ fontSize: '13px', display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: '#64748b' }}>Check-In:</span>
              <span style={{ fontWeight: 600 }}>
                {todayAttendance.checkInTime ? new Date(todayAttendance.checkInTime).toLocaleTimeString() : '—'}
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: '#64748b' }}>Check-Out:</span>
              <span style={{ fontWeight: 600 }}>
                {todayAttendance.checkOutTime ? new Date(todayAttendance.checkOutTime).toLocaleTimeString() : '—'}
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: '#64748b' }}>Active Duration:</span>
              <span style={{ fontWeight: 600 }}>
                {todayAttendance.totalActiveMinutes !== null ? `${todayAttendance.totalActiveMinutes} mins` : '—'}
              </span>
            </div>
            {todayAttendance.isLate && (
              <div style={{ color: '#dc2626', fontWeight: 600, fontSize: '12px' }}>
                ⚠️ Marked Late (Punched after shift grace period)
              </div>
            )}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <input
              type="text"
              placeholder="Optional punch remarks..."
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              style={{ width: '100%', padding: '6px 10px', fontSize: '13px', border: '1px solid #cbd5e1', borderRadius: '4px' }}
            />
            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                className="btn btn-primary"
                style={{ flex: 1 }}
                disabled={actionLoading || Boolean(todayAttendance.checkInTime)}
                onClick={handleCheckIn}
              >
                {todayAttendance.checkInTime ? 'Already Checked In' : 'Clock In'}
              </button>
              <button
                className="btn btn-secondary"
                style={{ flex: 1 }}
                disabled={actionLoading || !todayAttendance.checkInTime || Boolean(todayAttendance.checkOutTime)}
                onClick={handleCheckOut}
              >
                {todayAttendance.checkOutTime ? 'Already Checked Out' : 'Clock Out'}
              </button>
            </div>
          </div>
        </div>

        {/* Shift Card */}
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 600 }}>📅 Assigned Shift</h3>
            <span className="badge badge-role">{shift.shiftCode}</span>
          </div>
          <div style={{ fontSize: '14px', fontWeight: 600, marginBottom: '8px', color: '#1e293b' }}>
            {shift.shiftName}
          </div>
          <div style={{ fontSize: '13px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: '#64748b' }}>Hours:</span>
              <span style={{ fontWeight: 600 }}>{shift.startTime} – {shift.endTime}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: '#64748b' }}>Grace Period:</span>
              <span>{shift.gracePeriodMinutes} mins</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: '#64748b' }}>Weekly Offs:</span>
              <span style={{ fontWeight: 500, color: '#2563eb' }}>{shift.weeklyOffDays.join(', ')}</span>
            </div>
          </div>
        </div>

        {/* Latest Payslip Card */}
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 600 }}>💰 Latest Payslip</h3>
            {latestPayslip && <span className="badge badge-active">{latestPayslip.status}</span>}
          </div>
          {latestPayslip ? (
            <div>
              <div style={{ fontSize: '12px', color: '#64748b' }}>
                Period: {latestPayslip.month}/{latestPayslip.year} • Payable: {latestPayslip.payableDays} days
              </div>
              <div style={{ fontSize: '24px', fontWeight: 800, color: '#16a34a', margin: '8px 0' }}>
                ₹{Number(latestPayslip.netPay).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </div>
              <div style={{ fontSize: '12px', color: '#475569', display: 'flex', justifyContent: 'space-between' }}>
                <span>Gross: ₹{latestPayslip.earnedGross}</span>
                <span>Deductions: ₹{latestPayslip.totalDeductions}</span>
              </div>
              <a
                href={api.getPayslipViewHtmlUrl(latestPayslip.id)}
                target="_blank"
                rel="noreferrer"
                className="btn btn-secondary"
                style={{ display: 'inline-block', marginTop: '12px', fontSize: '12px', width: '100%', textAlign: 'center' }}
              >
                📄 View Printable Payslip
              </a>
            </div>
          ) : (
            <div style={{ color: '#64748b', fontSize: '13px', textAlign: 'center', padding: '20px 0' }}>
              No finalized payslips available yet.
            </div>
          )}
        </div>
      </div>

      {/* 4. Leave Balances Grid */}
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h3 style={{ fontSize: '16px', fontWeight: 600 }}>🌴 My Leave Balances</h3>
          <button
            className="btn btn-primary"
            onClick={openApplyLeaveModal}
            style={{ padding: '6px 14px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <span>➕</span>
            <span>Apply for Leave</span>
          </button>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
          {leaveBalances.map((b: any) => (
            <div
              key={b.leaveTypeId}
              style={{
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: '8px',
                padding: '16px',
                textAlign: 'center',
              }}
            >
              <div style={{ fontSize: '12px', fontWeight: 700, color: '#64748b' }}>{b.name} ({b.code})</div>
              <div style={{ fontSize: '26px', fontWeight: 800, color: b.isPaid ? '#2563eb' : '#dc2626', margin: '6px 0' }}>
                {b.availableBalance}
              </div>
              <div style={{ fontSize: '11px', color: '#94a3b8' }}>
                Allowed: {b.daysAllowedPerYear} / yr
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 5. Recent Leave Requests */}
      <div className="card">
        <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '12px' }}>📝 Recent Leave Applications</h3>
        {recentLeaveRequests.length === 0 ? (
          <div style={{ color: '#64748b', fontSize: '13px' }}>No leave applications recorded.</div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Type</th>
                <th>Dates</th>
                <th>Days</th>
                <th>Reason</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {recentLeaveRequests.map((r: any) => (
                <tr key={r.id}>
                  <td><strong>{r.leaveTypeCode}</strong></td>
                  <td>{r.startDate} to {r.endDate}</td>
                  <td>{r.totalDays}</td>
                  <td>{r.reason}</td>
                  <td>
                    <span
                      className={`badge ${
                        r.status === 'APPROVED'
                          ? 'badge-active'
                          : r.status === 'PENDING'
                          ? 'badge-role'
                          : 'badge-inactive'
                      }`}
                    >
                      {r.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* 6. Self-Profile Edit Modal (FR-EMP-006) */}
      {showEditModal && (
        <Modal onClose={() => setShowEditModal(false)}>
          <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(15, 23, 42, 0.6)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            zIndex: 1000,
            padding: '20px',
            boxSizing: 'border-box',
          }}>
            <div className="card" style={{ width: '500px', maxWidth: '100%', maxHeight: '90vh', overflowY: 'auto' }}>


            <h3 style={{ marginBottom: '12px' }}>✏️ Update Contact & Emergency Info</h3>
            <p style={{ fontSize: '12px', color: '#64748b', marginBottom: '16px' }}>
              Per FR-EMP-006, employees may self-update low-risk personal contact details. Designation, salary, and statutory fields require HR Admin.
            </p>

            {editMessage && <div style={{ color: '#16a34a', fontWeight: 600, marginBottom: '12px' }}>{editMessage}</div>}

            <form onSubmit={handleSaveProfile} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <label style={{ fontSize: '12px', fontWeight: 600 }}>Phone Number</label>
                <input
                  type="text"
                  className="form-control"
                  value={editPhone}
                  onChange={(e) => setEditPhone(e.target.value)}
                  style={{ width: '100%', padding: '8px', marginTop: '4px', border: '1px solid #cbd5e1', borderRadius: '4px' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '12px', fontWeight: 600 }}>Personal Email</label>
                <input
                  type="email"
                  className="form-control"
                  value={editPersonalEmail}
                  onChange={(e) => setEditPersonalEmail(e.target.value)}
                  style={{ width: '100%', padding: '8px', marginTop: '4px', border: '1px solid #cbd5e1', borderRadius: '4px' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '12px', fontWeight: 600 }}>Current Address</label>
                <input
                  type="text"
                  className="form-control"
                  value={editCurrentAddress}
                  onChange={(e) => setEditCurrentAddress(e.target.value)}
                  style={{ width: '100%', padding: '8px', marginTop: '4px', border: '1px solid #cbd5e1', borderRadius: '4px' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 600 }}>Emergency Contact Name</label>
                  <input
                    type="text"
                    className="form-control"
                    value={editEmergencyName}
                    onChange={(e) => setEditEmergencyName(e.target.value)}
                    style={{ width: '100%', padding: '8px', marginTop: '4px', border: '1px solid #cbd5e1', borderRadius: '4px' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 600 }}>Emergency Phone</label>
                  <input
                    type="text"
                    className="form-control"
                    value={editEmergencyPhone}
                    onChange={(e) => setEditEmergencyPhone(e.target.value)}
                    style={{ width: '100%', padding: '8px', marginTop: '4px', border: '1px solid #cbd5e1', borderRadius: '4px' }}
                  />
                </div>
              </div>

              <div>
                <label style={{ fontSize: '12px', fontWeight: 600 }}>Emergency Contact Relationship</label>
                <input
                  type="text"
                  className="form-control"
                  value={editEmergencyRelation}
                  onChange={(e) => setEditEmergencyRelation(e.target.value)}
                  placeholder="e.g. Spouse, Parent, Sibling"
                  style={{ width: '100%', padding: '8px', marginTop: '4px', border: '1px solid #cbd5e1', borderRadius: '4px' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '16px' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowEditModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={actionLoading}>
                  {actionLoading ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
          </div>
        </Modal>
      )}

      {/* Apply Leave Modal */}
      {showApplyModal && (
        <Modal onClose={() => setShowApplyModal(false)}>
          <div
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(15, 23, 42, 0.6)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 1000,
              backdropFilter: 'blur(4px)',
              padding: '20px',
              boxSizing: 'border-box',
            }}
          >
            <div className="card" style={{ width: '480px', maxWidth: '100%', maxHeight: '90vh', overflowY: 'auto' }}>


            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ fontSize: '16px', fontWeight: 700 }}>🌴 Apply for Leave</h3>
              <button
                onClick={() => setShowApplyModal(false)}
                style={{ background: 'none', border: 'none', fontSize: '18px', cursor: 'pointer', color: '#64748b' }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleApplyLeaveSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ fontSize: '12px', fontWeight: 600, color: '#475569', display: 'block', marginBottom: '4px' }}>
                  Leave Type *
                </label>
                <select
                  value={applyTypeId}
                  onChange={(e) => setApplyTypeId(e.target.value)}
                  required
                  style={{ width: '100%', padding: '8px', border: '1px solid #cbd5e1', borderRadius: '4px', fontSize: '13px' }}
                >
                  {leaveTypes.length === 0 ? (
                    <option value="">Loading leave types...</option>
                  ) : (
                    leaveTypes.map((lt) => (
                      <option key={lt.id} value={lt.id}>
                        {lt.name} ({lt.code}) {lt.isPaid ? '— Paid' : '— Unpaid (LWP)'}
                      </option>
                    ))
                  )}
                </select>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 600, color: '#475569', display: 'block', marginBottom: '4px' }}>
                    Start Date *
                  </label>
                  <input
                    type="date"
                    required
                    value={applyStartDate}
                    onChange={(e) => setApplyStartDate(e.target.value)}
                    style={{ width: '100%', padding: '8px', border: '1px solid #cbd5e1', borderRadius: '4px', fontSize: '13px' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 600, color: '#475569', display: 'block', marginBottom: '4px' }}>
                    End Date *
                  </label>
                  <input
                    type="date"
                    required
                    value={applyEndDate}
                    onChange={(e) => setApplyEndDate(e.target.value)}
                    style={{ width: '100%', padding: '8px', border: '1px solid #cbd5e1', borderRadius: '4px', fontSize: '13px' }}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '16px', background: '#f8fafc', padding: '10px', borderRadius: '6px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={applyHalfDay}
                    onChange={(e) => setApplyHalfDay(e.target.checked)}
                  />
                  <span>Half Day</span>
                </label>

                {applyHalfDay && (
                  <select
                    value={applyHalfDaySession}
                    onChange={(e) => setApplyHalfDaySession(e.target.value)}
                    style={{ padding: '4px 8px', fontSize: '12px', border: '1px solid #cbd5e1', borderRadius: '4px' }}
                  >
                    <option value="FIRST_HALF">First Half (Morning)</option>
                    <option value="SECOND_HALF">Second Half (Afternoon)</option>
                  </select>
                )}
              </div>

              <div>
                <label style={{ fontSize: '12px', fontWeight: 600, color: '#475569', display: 'block', marginBottom: '4px' }}>
                  Reason / Notes *
                </label>
                <textarea
                  required
                  rows={3}
                  placeholder="State the reason for leave..."
                  value={applyReason}
                  onChange={(e) => setApplyReason(e.target.value)}
                  style={{ width: '100%', padding: '8px', border: '1px solid #cbd5e1', borderRadius: '4px', fontSize: '13px', boxSizing: 'border-box' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowApplyModal(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={applyingLeave}
                >
                  {applyingLeave ? 'Submitting...' : 'Submit Application'}
                </button>
              </div>
            </form>
          </div>
          </div>
        </Modal>
      )}
    </div>
  );

}
