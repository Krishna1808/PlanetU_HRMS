import { useEffect, useState } from 'react';
import { api } from '../api';

export function LeavesPage({ user }: { user: any }) {
  const [balances, setBalances] = useState<any[]>([]);
  const [myRequests, setMyRequests] = useState<any[]>([]);
  const [pendingRequests, setPendingRequests] = useState<any[]>([]);
  const [leaveTypes, setLeaveTypes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Apply modal
  const [showApplyModal, setShowApplyModal] = useState(false);
  const [selectedLeaveTypeId, setSelectedLeaveTypeId] = useState('');
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
  const [isHalfDay, setIsHalfDay] = useState(false);
  const [halfDaySession, setHalfDaySession] = useState('FIRST_HALF');
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const isManagerOrAdmin =
    user?.role === 'MANAGER' ||
    user?.role === 'HR_ADMIN' ||
    user?.role === 'CLIENT_SUPER_ADMIN';

  const loadLeaves = async () => {
    try {
      setLoading(true);
      setError('');
      const [balancesRes, requestsRes, typesRes, pendingRes] = await Promise.all([
        api.getMyLeaveBalances().catch(() => ({ balances: [] })),
        api.getMyLeaveRequests().catch(() => []),
        api.getLeaveTypes().catch(() => []),
        isManagerOrAdmin ? api.getPendingLeaves().catch(() => []) : Promise.resolve([]),
      ]);

      setBalances(balancesRes.balances || []);
      setMyRequests(requestsRes || []);
      setLeaveTypes(typesRes || []);
      setPendingRequests(pendingRes || []);
      if (typesRes.length > 0) setSelectedLeaveTypeId(typesRes[0].id);
    } catch (err: any) {
      setError(err.message || 'Failed to load leaves data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLeaves();
  }, []);

  const handleApply = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSubmitting(true);
      await api.applyLeave({
        leaveTypeId: selectedLeaveTypeId,
        startDate: new Date(startDate).toISOString(),
        endDate: new Date(endDate).toISOString(),
        isHalfDay,
        halfDaySession: isHalfDay ? halfDaySession : undefined,
        reason,
      });
      alert('Leave applied successfully!');
      setShowApplyModal(false);
      setReason('');
      await loadLeaves();
    } catch (err: any) {
      alert(err.message || 'Failed to apply leave');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancel = async (id: string) => {
    if (!confirm('Are you sure you want to cancel this leave application?')) return;
    try {
      await api.cancelLeave(id);
      await loadLeaves();
    } catch (err: any) {
      alert(err.message || 'Failed to cancel leave');
    }
  };

  const handleAction = async (id: string, action: 'APPROVE' | 'REJECT') => {
    const reasonPrompt =
      action === 'REJECT' ? prompt('Enter rejection reason:') || 'Administrative decision' : undefined;
    try {
      await api.actionLeave(id, action, reasonPrompt);
      alert(`Leave request ${action.toLowerCase()}d`);
      await loadLeaves();
    } catch (err: any) {
      alert(err.message || `Failed to ${action.toLowerCase()} leave`);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Header */}
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h2 style={{ fontSize: '18px', fontWeight: 700 }}>🌴 Leave Management (Module 5)</h2>
            <p style={{ fontSize: '13px', color: '#64748b', marginTop: '4px' }}>
              Append-only transaction ledger, shift-aware weekly off deductions, accrual policies, and multi-tier approval workflows.
            </p>
          </div>
          <button className="btn btn-primary" onClick={() => setShowApplyModal(true)}>
            📝 Apply for Leave
          </button>
        </div>
      </div>

      {error && <div className="card" style={{ color: '#dc2626' }}>{error}</div>}

      {/* Live Balance Cards */}
      <div className="card">
        <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '14px' }}>Live Leave Balances</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px' }}>
          {balances.map((b) => (
            <div key={b.leaveTypeId} style={{ background: '#f8fafc', padding: '16px', borderRadius: '6px', border: '1px solid #e2e8f0', textAlign: 'center' }}>
              <div style={{ fontSize: '12px', fontWeight: 700, color: '#64748b' }}>{b.leaveTypeName} ({b.leaveTypeCode})</div>
              <div style={{ fontSize: '28px', fontWeight: 800, color: b.isPaid ? '#2563eb' : '#dc2626', margin: '6px 0' }}>
                {b.availableBalance}
              </div>
              <div style={{ fontSize: '11px', color: '#94a3b8' }}>
                Allowed: {b.daysAllowedPerYear}d • Pending: {b.pendingDays}d
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Manager Approval Queue (if Manager/Admin) */}
      {isManagerOrAdmin && (
        <div className="card" style={{ borderLeft: '4px solid #f59e0b' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 600 }}>📥 Pending Subordinate Approvals ({pendingRequests.length})</h3>
            <span className="badge badge-role">APPROVAL QUEUE</span>
          </div>
          {pendingRequests.length === 0 ? (
            <div style={{ color: '#64748b', fontSize: '13px' }}>No pending approval requests from your direct reports.</div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Employee</th>
                  <th>Leave Type</th>
                  <th>Dates</th>
                  <th>Days</th>
                  <th>Reason</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {pendingRequests.map((req) => (
                  <tr key={req.id}>
                    <td><strong>{req.employee?.firstName} {req.employee?.lastName}</strong> ({req.employee?.employeeCode})</td>
                    <td><span className="badge badge-role">{req.leaveType?.code}</span></td>
                    <td>{new Date(req.startDate).toLocaleDateString()} – {new Date(req.endDate).toLocaleDateString()}</td>
                    <td>{req.totalDays}</td>
                    <td>{req.reason}</td>
                    <td>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <button
                          className="btn btn-primary"
                          style={{ padding: '4px 10px', fontSize: '12px', background: '#16a34a' }}
                          onClick={() => handleAction(req.id, 'APPROVE')}
                        >
                          Approve
                        </button>
                        <button
                          className="btn btn-danger"
                          style={{ padding: '4px 10px', fontSize: '12px' }}
                          onClick={() => handleAction(req.id, 'REJECT')}
                        >
                          Reject
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* My Leave Requests */}
      <div className="card">
        <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '12px' }}>My Leave Application History</h3>
        {loading ? (
          <div>Loading leave requests...</div>
        ) : myRequests.length === 0 ? (
          <div style={{ color: '#64748b', fontSize: '13px' }}>No leave requests found.</div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Type</th>
                <th>Dates</th>
                <th>Days</th>
                <th>Reason</th>
                <th>Applied At</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {myRequests.map((req) => (
                <tr key={req.id}>
                  <td><span className="badge badge-role">{req.leaveType?.code}</span> {req.leaveType?.name}</td>
                  <td>{new Date(req.startDate).toLocaleDateString()} – {new Date(req.endDate).toLocaleDateString()}</td>
                  <td>{req.totalDays}</td>
                  <td>{req.reason}</td>
                  <td>{new Date(req.appliedAt).toLocaleDateString()}</td>
                  <td>
                    <span
                      className={`badge ${
                        req.status === 'APPROVED'
                          ? 'badge-active'
                          : req.status === 'PENDING'
                          ? 'badge-role'
                          : 'badge-inactive'
                      }`}
                    >
                      {req.status}
                    </span>
                  </td>
                  <td>
                    {req.status === 'PENDING' && (
                      <button
                        className="btn btn-secondary"
                        style={{ padding: '3px 8px', fontSize: '11px', color: '#dc2626' }}
                        onClick={() => handleCancel(req.id)}
                      >
                        Cancel
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Apply Leave Modal */}
      {showApplyModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000
        }}>
          <div className="card" style={{ width: '480px', maxWidth: '90%' }}>
            <h3 style={{ marginBottom: '14px' }}>📝 Apply for Leave</h3>
            <form onSubmit={handleApply} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <label style={{ fontSize: '12px', fontWeight: 600 }}>Leave Type</label>
                <select
                  value={selectedLeaveTypeId}
                  onChange={(e) => setSelectedLeaveTypeId(e.target.value)}
                  style={{ width: '100%', padding: '8px', border: '1px solid #cbd5e1', borderRadius: '4px', marginTop: '4px' }}
                >
                  {leaveTypes.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name} ({t.code}) {t.isPaid ? '— Paid' : '— Unpaid (LWP)'}
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 600 }}>Start Date</label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    style={{ width: '100%', padding: '8px', border: '1px solid #cbd5e1', borderRadius: '4px', marginTop: '4px' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 600 }}>End Date</label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    style={{ width: '100%', padding: '8px', border: '1px solid #cbd5e1', borderRadius: '4px', marginTop: '4px' }}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <input
                  type="checkbox"
                  id="halfDayToggle"
                  checked={isHalfDay}
                  onChange={(e) => setIsHalfDay(e.target.checked)}
                />
                <label htmlFor="halfDayToggle" style={{ fontSize: '13px' }}>Apply as Half-Day Leave</label>
              </div>

              {isHalfDay && (
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 600 }}>Half-Day Session</label>
                  <select
                    value={halfDaySession}
                    onChange={(e) => setHalfDaySession(e.target.value)}
                    style={{ width: '100%', padding: '8px', border: '1px solid #cbd5e1', borderRadius: '4px', marginTop: '4px' }}
                  >
                    <option value="FIRST_HALF">First Half (Morning Session)</option>
                    <option value="SECOND_HALF">Second Half (Afternoon Session)</option>
                  </select>
                </div>
              )}

              <div>
                <label style={{ fontSize: '12px', fontWeight: 600 }}>Reason for Leave</label>
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="State reason for absence..."
                  required
                  rows={3}
                  style={{ width: '100%', padding: '8px', border: '1px solid #cbd5e1', borderRadius: '4px', marginTop: '4px', fontSize: '13px' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '14px' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowApplyModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={submitting}>
                  {submitting ? 'Submitting...' : 'Submit Application'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
