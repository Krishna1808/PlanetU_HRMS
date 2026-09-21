import { useEffect, useState } from 'react';
import { api } from '../api';
import { Modal } from './Modal';

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

  // Add Policy modal (HR / Super Admin)
  const [showAddPolicyModal, setShowAddPolicyModal] = useState(false);
  const [policyName, setPolicyName] = useState('');
  const [policyCode, setPolicyCode] = useState('');
  const [policyDescription, setPolicyDescription] = useState('');
  const [policyDays, setPolicyDays] = useState<number>(12);
  const [policyIsPaid, setPolicyIsPaid] = useState(true);
  const [policyAccrual, setPolicyAccrual] = useState('YEARLY');
  const [policyCarryForward, setPolicyCarryForward] = useState<number>(0);
  const [policyRequiresApproval, setPolicyRequiresApproval] = useState(true);
  const [submittingPolicy, setSubmittingPolicy] = useState(false);

  // Allocate Leaves modal (HR / Super Admin)
  const [showAllocateModal, setShowAllocateModal] = useState(false);
  const [allocateTarget, setAllocateTarget] = useState<'DEPARTMENT' | 'EMPLOYEE'>('DEPARTMENT');
  const [departmentList, setDepartmentList] = useState<any[]>([]);
  const [employeeList, setEmployeeList] = useState<any[]>([]);
  const [allocDepartmentId, setAllocDepartmentId] = useState('');
  const [allocEmployeeId, setAllocEmployeeId] = useState('');
  const [allocLeaveTypeId, setAllocLeaveTypeId] = useState('');
  const [allocDays, setAllocDays] = useState<number>(10);
  const [allocReason, setAllocReason] = useState('');
  const [submittingAllocate, setSubmittingAllocate] = useState(false);
  const [loadingMasters, setLoadingMasters] = useState(false);

  const isManagerOrAdmin =
    user?.role === 'MANAGER' ||
    user?.role === 'HR_ADMIN' ||
    user?.role === 'CLIENT_SUPER_ADMIN';

  const isHrOrSuperAdmin =
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
      if (typesRes.length > 0 && !selectedLeaveTypeId) {
        setSelectedLeaveTypeId(typesRes[0].id);
      }
      if (typesRes.length > 0 && !allocLeaveTypeId) {
        setAllocLeaveTypeId(typesRes[0].id);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load leaves data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLeaves();
  }, []);

  const openAllocateModal = async () => {
    setLoadingMasters(true);
    setShowAllocateModal(true);
    try {
      const [depts, emps] = await Promise.all([
        api.getDepartments().catch(() => []),
        api.getEmployees().catch(() => ({ data: [] })),
      ]);
      const empData = Array.isArray(emps) ? emps : (emps?.data || []);
      setDepartmentList(depts || []);
      setEmployeeList(empData);
      if (depts && depts.length > 0 && !allocDepartmentId) {
        setAllocDepartmentId(depts[0].id);
      }
      if (empData && empData.length > 0 && !allocEmployeeId) {
        setAllocEmployeeId(empData[0].id);
      }
      if (leaveTypes.length > 0 && !allocLeaveTypeId) {
        setAllocLeaveTypeId(leaveTypes[0].id);
      }
    } catch (err: any) {
      alert(err.message || 'Failed to fetch departments/employees list');
    } finally {
      setLoadingMasters(false);
    }
  };

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

  const handleCreatePolicy = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSubmittingPolicy(true);
      await api.createLeaveType({
        name: policyName.trim(),
        code: policyCode.trim().toUpperCase(),
        description: policyDescription.trim() || undefined,
        daysAllowedPerYear: Number(policyDays),
        isPaid: policyIsPaid,
        accrualFrequency: policyAccrual,
        carryForwardLimit: Number(policyCarryForward),
        requiresApproval: policyRequiresApproval,
      });
      alert(`Leave policy '${policyName}' created successfully!`);
      setShowAddPolicyModal(false);
      setPolicyName('');
      setPolicyCode('');
      setPolicyDescription('');
      setPolicyDays(12);
      setPolicyIsPaid(true);
      setPolicyAccrual('YEARLY');
      setPolicyCarryForward(0);
      await loadLeaves();
    } catch (err: any) {
      alert(err.message || 'Failed to create leave policy');
    } finally {
      setSubmittingPolicy(false);
    }
  };

  const handleAllocateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!allocLeaveTypeId) {
      alert('Please select a leave policy');
      return;
    }
    if (!allocDays || isNaN(Number(allocDays))) {
      alert('Please specify a valid number of days');
      return;
    }
    if (!allocReason.trim()) {
      alert('Please provide a reason for allocating leaves');
      return;
    }

    try {
      setSubmittingAllocate(true);
      if (allocateTarget === 'DEPARTMENT') {
        if (!allocDepartmentId) {
          alert('Please select a department');
          return;
        }
        const res = await api.allocateDepartmentLeaves({
          departmentId: allocDepartmentId,
          leaveTypeId: allocLeaveTypeId,
          days: Number(allocDays),
          reason: allocReason.trim(),
        });
        alert(
          `Success: Allocated ${res.daysPerEmployee} day(s) to ${res.allocatedCount} active employee(s) in department '${res.departmentName}'.`
        );
      } else {
        if (!allocEmployeeId) {
          alert('Please select an employee');
          return;
        }
        const res = await api.adjustLeaveBalance({
          employeeId: allocEmployeeId,
          leaveTypeId: allocLeaveTypeId,
          days: Number(allocDays),
          reason: allocReason.trim(),
        });
        alert(
          `Success: Adjusted leave balance. New balance is ${res.currentBalance} day(s).`
        );
      }

      setShowAllocateModal(false);
      setAllocReason('');
      await loadLeaves();
    } catch (err: any) {
      alert(err.message || 'Failed to allocate/adjust leaves');
    } finally {
      setSubmittingAllocate(false);
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
    let reasonPrompt: string | undefined;
    if (action === 'REJECT') {
      const promptRes = prompt('Enter rejection reason:');
      if (promptRes === null) return; // User cancelled prompt dialog
      reasonPrompt = promptRes.trim() || 'Administrative decision';
    }
    try {
      await api.actionLeave(id, action, reasonPrompt);
      alert(`Leave request successfully ${action === 'APPROVE' ? 'approved' : 'rejected'}!`);
      await loadLeaves();
    } catch (err: any) {
      alert(err.message || `Failed to ${action.toLowerCase()} leave`);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Header */}
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <h2 style={{ fontSize: '18px', fontWeight: 700 }}>🌴 Leave Management</h2>
            <p style={{ fontSize: '13px', color: '#64748b', marginTop: '4px' }}>
              Append-only transaction ledger, shift-aware weekly off deductions, accrual policies, and multi-tier approval workflows.
            </p>
          </div>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {isHrOrSuperAdmin && (
              <>
                <button
                  className="btn btn-secondary"
                  style={{ background: '#f8fafc', borderColor: '#cbd5e1', color: '#0f172a' }}
                  onClick={() => setShowAddPolicyModal(true)}
                >
                  ➕ Add Leave Policy
                </button>
                <button
                  className="btn btn-secondary"
                  style={{ background: '#f0fdf4', borderColor: '#86efac', color: '#15803d' }}
                  onClick={openAllocateModal}
                >
                  ⚙️ Set / Allocate Leaves
                </button>
              </>
            )}
            <button className="btn btn-primary" onClick={() => setShowApplyModal(true)}>
              📝 Apply for Leave
            </button>
          </div>
        </div>
      </div>

      {error && <div className="card" style={{ color: '#dc2626' }}>{error}</div>}

      {/* Live Balance Cards */}
      <div className="card">
        <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '14px' }}>My Live Leave Balances</h3>
        {balances.length === 0 ? (
          <div style={{ color: '#64748b', fontSize: '13px' }}>No leave balances available.</div>
        ) : (
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
        )}
      </div>

      {/* Leave Policies Overview (Visible to HR Admin & Super Admin) */}
      {isHrOrSuperAdmin && (
        <div className="card" style={{ borderLeft: '4px solid #3b82f6' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <div>
              <h3 style={{ fontSize: '16px', fontWeight: 600 }}>📋 Active Organization Leave Policies ({leaveTypes.length})</h3>
              <p style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>
                Managed policies configured for your organization. HR Admins and Super Admins can add new policies or credit days.
              </p>
            </div>
            <button
              className="btn btn-secondary"
              style={{ fontSize: '12px', padding: '4px 10px' }}
              onClick={() => setShowAddPolicyModal(true)}
            >
              ➕ Define New Policy
            </button>
          </div>

          {leaveTypes.length === 0 ? (
            <div style={{ color: '#64748b', fontSize: '13px' }}>No leave policies defined. Click '➕ Define New Policy' to add one.</div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Policy Name</th>
                  <th>Code</th>
                  <th>Type</th>
                  <th>Quota (Days/Year)</th>
                  <th>Accrual</th>
                  <th>Carry Forward Max</th>
                  <th>Approval Required</th>
                </tr>
              </thead>
              <tbody>
                {leaveTypes.map((type) => (
                  <tr key={type.id}>
                    <td><strong>{type.name}</strong></td>
                    <td><span className="badge badge-role">{type.code}</span></td>
                    <td>
                      <span className={`badge ${type.isPaid ? 'badge-active' : 'badge-inactive'}`}>
                        {type.isPaid ? 'Paid' : 'Unpaid (LWP)'}
                      </span>
                    </td>
                    <td>{type.daysAllowedPerYear} days</td>
                    <td style={{ textTransform: 'capitalize' }}>{type.accrualFrequency?.toLowerCase() || 'Monthly'}</td>
                    <td>{type.carryForwardLimit} days</td>
                    <td>{type.requiresApproval ? 'Yes' : 'No (Auto)'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

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

      {/* --------------------------------------------------------------------- */}
      {/* 1. Apply Leave Modal (All Employees)                                  */}
      {/* --------------------------------------------------------------------- */}
      {showApplyModal && (
        <Modal onClose={() => setShowApplyModal(false)}>
          <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(4px)',
            display: 'flex', justifyContent: 'center', alignItems: 'center',
            zIndex: 1000, padding: '20px', boxSizing: 'border-box',
          }}>
            <div className="card" style={{ width: '480px', maxWidth: '100%', maxHeight: '90vh', overflowY: 'auto' }}>


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
        </Modal>
      )}

      {/* --------------------------------------------------------------------- */}
      {/* 2. Add Leave Policy Modal (HR / Super Admin)                          */}
      {/* --------------------------------------------------------------------- */}
      {showAddPolicyModal && (
        <Modal onClose={() => setShowAddPolicyModal(false)}>
          <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(4px)',
            display: 'flex', justifyContent: 'center', alignItems: 'center',
            zIndex: 1000, padding: '20px', boxSizing: 'border-box',
          }}>
            <div className="card" style={{ width: '520px', maxWidth: '100%', maxHeight: '90vh', overflowY: 'auto' }}>


            <h3 style={{ marginBottom: '6px' }}>➕ Define New Leave Policy</h3>
            <p style={{ fontSize: '12px', color: '#64748b', marginBottom: '14px' }}>
              Create a new leave category with annual allowance and carry-forward rules.
            </p>

            <form onSubmit={handleCreatePolicy} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '10px' }}>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 600 }}>Policy Name *</label>
                  <input
                    type="text"
                    placeholder="e.g. Paternity Leave"
                    value={policyName}
                    onChange={(e) => setPolicyName(e.target.value)}
                    required
                    style={{ width: '100%', padding: '8px', border: '1px solid #cbd5e1', borderRadius: '4px', marginTop: '4px' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 600 }}>Code *</label>
                  <input
                    type="text"
                    placeholder="e.g. PL"
                    value={policyCode}
                    onChange={(e) => setPolicyCode(e.target.value)}
                    required
                    style={{ width: '100%', padding: '8px', border: '1px solid #cbd5e1', borderRadius: '4px', marginTop: '4px', textTransform: 'uppercase' }}
                  />
                </div>
              </div>

              <div>
                <label style={{ fontSize: '12px', fontWeight: 600 }}>Description</label>
                <textarea
                  placeholder="Optional notes or eligibility guidelines..."
                  value={policyDescription}
                  onChange={(e) => setPolicyDescription(e.target.value)}
                  rows={2}
                  style={{ width: '100%', padding: '8px', border: '1px solid #cbd5e1', borderRadius: '4px', marginTop: '4px', fontSize: '13px' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 600 }}>Annual Quota (Days) *</label>
                  <input
                    type="number"
                    min="0"
                    step="0.5"
                    value={policyDays}
                    onChange={(e) => setPolicyDays(Number(e.target.value))}
                    required
                    style={{ width: '100%', padding: '8px', border: '1px solid #cbd5e1', borderRadius: '4px', marginTop: '4px' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 600 }}>Carry Forward Max (Days)</label>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={policyCarryForward}
                    onChange={(e) => setPolicyCarryForward(Number(e.target.value))}
                    style={{ width: '100%', padding: '8px', border: '1px solid #cbd5e1', borderRadius: '4px', marginTop: '4px' }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 600 }}>Accrual Frequency</label>
                  <select
                    value={policyAccrual}
                    onChange={(e) => setPolicyAccrual(e.target.value)}
                    style={{ width: '100%', padding: '8px', border: '1px solid #cbd5e1', borderRadius: '4px', marginTop: '4px' }}
                  >
                    <option value="YEARLY">Yearly (Lump Sum)</option>
                    <option value="MONTHLY">Monthly Accrual</option>
                    <option value="QUARTERLY">Quarterly Accrual</option>
                    <option value="NONE">None / Ad-hoc</option>
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 600 }}>Compensation Type</label>
                  <select
                    value={policyIsPaid ? 'PAID' : 'UNPAID'}
                    onChange={(e) => setPolicyIsPaid(e.target.value === 'PAID')}
                    style={{ width: '100%', padding: '8px', border: '1px solid #cbd5e1', borderRadius: '4px', marginTop: '4px' }}
                  >
                    <option value="PAID">Paid Leave</option>
                    <option value="UNPAID">Unpaid (Deducts Payable Days)</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
                <input
                  type="checkbox"
                  id="requiresApproval"
                  checked={policyRequiresApproval}
                  onChange={(e) => setPolicyRequiresApproval(e.target.checked)}
                />
                <label htmlFor="requiresApproval" style={{ fontSize: '13px' }}>Requires Manager Approval</label>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '14px' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowAddPolicyModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={submittingPolicy}>
                  {submittingPolicy ? 'Creating...' : 'Create Policy'}
                </button>
              </div>
            </form>
          </div>
          </div>
        </Modal>
      )}

      {/* --------------------------------------------------------------------- */}
      {/* 3. Set / Allocate Leaves Modal (HR / Super Admin)                     */}
      {/* --------------------------------------------------------------------- */}
      {showAllocateModal && (
        <Modal onClose={() => setShowAllocateModal(false)}>
          <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(4px)',
            display: 'flex', justifyContent: 'center', alignItems: 'center',
            zIndex: 1000, padding: '20px', boxSizing: 'border-box',
          }}>
            <div className="card" style={{ width: '520px', maxWidth: '100%', maxHeight: '90vh', overflowY: 'auto' }}>


            <h3 style={{ marginBottom: '6px' }}>⚙️ Set / Allocate Leave Balances</h3>
            <p style={{ fontSize: '12px', color: '#64748b', marginBottom: '14px' }}>
              Bulk allocate leaves across an entire department or credit/adjust a specific employee's balance in the append-only ledger.
            </p>

            {loadingMasters ? (
              <div style={{ padding: '20px', textAlign: 'center', color: '#64748b' }}>Loading departments and employees...</div>
            ) : (
              <form onSubmit={handleAllocateSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                {/* Target Switcher */}
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 600, display: 'block', marginBottom: '6px' }}>Allocation Scope</label>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                      type="button"
                      className="btn"
                      style={{
                        flex: 1,
                        background: allocateTarget === 'DEPARTMENT' ? '#2563eb' : '#f1f5f9',
                        color: allocateTarget === 'DEPARTMENT' ? '#ffffff' : '#334155',
                        border: '1px solid #cbd5e1',
                        fontWeight: 600,
                      }}
                      onClick={() => setAllocateTarget('DEPARTMENT')}
                    >
                      🏢 Entire Department
                    </button>
                    <button
                      type="button"
                      className="btn"
                      style={{
                        flex: 1,
                        background: allocateTarget === 'EMPLOYEE' ? '#2563eb' : '#f1f5f9',
                        color: allocateTarget === 'EMPLOYEE' ? '#ffffff' : '#334155',
                        border: '1px solid #cbd5e1',
                        fontWeight: 600,
                      }}
                      onClick={() => setAllocateTarget('EMPLOYEE')}
                    >
                      👤 Specific Employee
                    </button>
                  </div>
                </div>

                {/* Target Selection */}
                {allocateTarget === 'DEPARTMENT' ? (
                  <div>
                    <label style={{ fontSize: '12px', fontWeight: 600 }}>Target Department *</label>
                    <select
                      value={allocDepartmentId}
                      onChange={(e) => setAllocDepartmentId(e.target.value)}
                      required
                      style={{ width: '100%', padding: '8px', border: '1px solid #cbd5e1', borderRadius: '4px', marginTop: '4px' }}
                    >
                      {departmentList.length === 0 && <option value="">No departments found</option>}
                      {departmentList.map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.name} ({d.codePrefix || 'N/A'})
                        </option>
                      ))}
                    </select>
                    <div style={{ fontSize: '11px', color: '#64748b', marginTop: '4px' }}>
                      All active employees belonging to this department will receive this credit adjustment.
                    </div>
                  </div>
                ) : (
                  <div>
                    <label style={{ fontSize: '12px', fontWeight: 600 }}>Target Employee *</label>
                    <select
                      value={allocEmployeeId}
                      onChange={(e) => setAllocEmployeeId(e.target.value)}
                      required
                      style={{ width: '100%', padding: '8px', border: '1px solid #cbd5e1', borderRadius: '4px', marginTop: '4px' }}
                    >
                      {employeeList.length === 0 && <option value="">No employees found</option>}
                      {employeeList.map((emp) => (
                        <option key={emp.id} value={emp.id}>
                          {emp.firstName} {emp.lastName} ({emp.employeeCode}) — {emp.designation?.name || 'Staff'}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Leave Policy Selection */}
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 600 }}>Leave Policy / Type *</label>
                  <select
                    value={allocLeaveTypeId}
                    onChange={(e) => setAllocLeaveTypeId(e.target.value)}
                    required
                    style={{ width: '100%', padding: '8px', border: '1px solid #cbd5e1', borderRadius: '4px', marginTop: '4px' }}
                  >
                    {leaveTypes.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name} ({t.code}) — {t.daysAllowedPerYear}d annual limit
                      </option>
                    ))}
                  </select>
                </div>

                {/* Days Input */}
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 600 }}>
                    {allocateTarget === 'DEPARTMENT' ? 'Days to Allocate (Per Employee) *' : 'Days to Credit / Adjust *'}
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    value={allocDays}
                    onChange={(e) => setAllocDays(Number(e.target.value))}
                    required
                    style={{ width: '100%', padding: '8px', border: '1px solid #cbd5e1', borderRadius: '4px', marginTop: '4px' }}
                  />
                  <div style={{ fontSize: '11px', color: '#64748b', marginTop: '3px' }}>
                    Enter positive value to add/credit leaves (e.g. 10). Enter negative to deduct.
                  </div>
                </div>

                {/* Reason */}
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 600 }}>Audit Ledger Reason *</label>
                  <textarea
                    value={allocReason}
                    onChange={(e) => setAllocReason(e.target.value)}
                    placeholder="e.g. Annual 2026 quota allotment, Festival bonus leaves, Joining grant..."
                    required
                    rows={2}
                    style={{ width: '100%', padding: '8px', border: '1px solid #cbd5e1', borderRadius: '4px', marginTop: '4px', fontSize: '13px' }}
                  />
                </div>

                {/* Buttons */}
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
                  <button type="button" className="btn btn-secondary" onClick={() => setShowAllocateModal(false)}>
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-primary" disabled={submittingAllocate}>
                    {submittingAllocate ? 'Processing...' : 'Confirm & Allocate'}
                  </button>
                </div>
              </form>
            )}
          </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

