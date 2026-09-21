import React, { useState, useEffect } from 'react';
import { api } from '../api';
import { Modal } from './Modal';

interface OffboardingPageProps {
  user: any;
}

export const OffboardingPage: React.FC<OffboardingPageProps> = ({ user }) => {
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Modals state
  const [showApplyModal, setShowApplyModal] = useState(false);
  const [showActionModal, setShowActionModal] = useState<any | null>(null);
  const [showTasksModal, setShowTasksModal] = useState<any | null>(null);
  const [showInterviewModal, setShowInterviewModal] = useState<any | null>(null);
  const [showFnFModal, setShowFnFModal] = useState<any | null>(null);

  // Form states
  const [applyForm, setApplyForm] = useState({
    reason: '',
    proposedLastWorkingDay: '',
    noticePeriodDays: 30,
    exitType: 'RESIGNATION',
  });

  const [actionForm, setActionForm] = useState({
    decision: 'APPROVED',
    approvedLastWorkingDay: '',
    comments: '',
  });

  const [interviewForm, setInterviewForm] = useState({
    reasonCategory: 'CAREER_GROWTH',
    companyCultureRating: 5,
    managementRating: 4,
    workLifeBalanceRating: 4,
    compensationRating: 4,
    wouldRecommendCompany: true,
    feedback: '',
  });

  const [fnfAdditionsForm] = useState({
    gratuityAmount: 0,
    bonusAmount: 0,
    otherDeductions: 0,
    otherDeductionsRemarks: '',
    remarks: '',
  });

  const isHrOrAdmin =
    user.role === 'HR_ADMIN' || user.role === 'CLIENT_SUPER_ADMIN';
  const isManager = user.role === 'MANAGER';
  const isFinance = user.role === 'FINANCE';

  const loadRequests = async () => {
    setLoading(true);
    try {
      const filter = statusFilter === 'ALL' ? undefined : statusFilter;
      const res = await api.getExitRequests(filter, searchQuery || undefined);
      setRequests(res.data || []);
      setErrorMsg('');
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to load exit requests');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRequests();
  }, [statusFilter]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    loadRequests();
  };

  const handleApplyResignation = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.applyResignation({
        ...applyForm,
        noticePeriodDays: Number(applyForm.noticePeriodDays),
        proposedLastWorkingDay: new Date(applyForm.proposedLastWorkingDay).toISOString(),
      });
      setSuccessMsg('Resignation request submitted successfully');
      setShowApplyModal(false);
      setApplyForm({
        reason: '',
        proposedLastWorkingDay: '',
        noticePeriodDays: 30,
        exitType: 'RESIGNATION',
      });
      loadRequests();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to submit resignation request');
    }
  };

  const handleActionResignation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!showActionModal) return;
    try {
      await api.actionResignation(showActionModal.id, {
        decision: actionForm.decision,
        approvedLastWorkingDay: actionForm.approvedLastWorkingDay
          ? new Date(actionForm.approvedLastWorkingDay).toISOString()
          : undefined,
        comments: actionForm.comments,
      });
      setSuccessMsg(`Exit request ${actionForm.decision.toLowerCase()} successfully`);
      setShowActionModal(null);
      loadRequests();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to action exit request');
    }
  };

  const handleUpdateTask = async (taskId: string, status: string) => {
    try {
      await api.updateClearanceTask(taskId, { status });
      // Refresh current task modal details
      if (showTasksModal) {
        const fresh = await api.getExitRequestById(showTasksModal.id);
        setShowTasksModal(fresh);
      }
      loadRequests();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to update clearance task');
    }
  };

  const handleSubmitInterview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!showInterviewModal) return;
    try {
      await api.submitExitInterview(showInterviewModal.id, interviewForm);
      setSuccessMsg('Exit interview submitted successfully');
      setShowInterviewModal(null);
      loadRequests();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to submit exit interview');
    }
  };

  const handleCalculateFnF = async (exitReqId: string) => {
    try {
      const calc = await api.calculateFnFSettlement(exitReqId, {
        gratuityAmount: Number(fnfAdditionsForm.gratuityAmount),
        bonusAmount: Number(fnfAdditionsForm.bonusAmount),
        otherDeductions: Number(fnfAdditionsForm.otherDeductions),
        otherDeductionsRemarks: fnfAdditionsForm.otherDeductionsRemarks,
        remarks: fnfAdditionsForm.remarks,
      });
      setShowFnFModal(calc);
      setSuccessMsg('Full & Final (FnF) settlement calculated');
      loadRequests();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to calculate FnF settlement');
    }
  };

  const handleApproveFnF = async (exitReqId: string) => {
    try {
      await api.approveFnFSettlement(exitReqId);
      setSuccessMsg('FnF settlement approved successfully');
      // Refresh modal
      const fresh = await api.getExitRequestById(exitReqId);
      setShowFnFModal(fresh.fnfSettlement);
      loadRequests();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to approve FnF settlement');
    }
  };

  const handleFinalizeExit = async (req: any) => {
    if (
      !window.confirm(
        `Are you sure you want to finalize the exit for ${req.employee?.firstName} ${req.employee?.lastName} (${req.employee?.employeeCode})? This will deactivate their login and mark their status as RESIGNED.`
      )
    ) {
      return;
    }
    try {
      const res = await api.finalizeExit(req.id);
      setSuccessMsg(res.message || 'Employee exit finalized successfully');
      loadRequests();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to finalize exit');
    }
  };

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case 'PENDING_APPROVAL':
        return '#f59e0b';
      case 'APPROVED':
        return '#3b82f6';
      case 'CLEARANCE_IN_PROGRESS':
        return '#8b5cf6';
      case 'SETTLEMENT_PENDING':
        return '#ec4899';
      case 'COMPLETED':
        return '#10b981';
      case 'REJECTED':
        return '#ef4444';
      default:
        return '#64748b';
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Header & Overview */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          background: '#ffffff',
          padding: '20px 24px',
          borderRadius: '8px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
        }}
      >
        <div>
          <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 800, color: '#0f172a' }}>
            🚪 Offboarding & Exit Management Engine
          </h2>
          <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#64748b' }}>
            Manage employee separations, multi-department clearance checklists, and statutory Full & Final (FnF) settlements.
          </p>
        </div>
        <button
          className="btn btn-primary"
          style={{ background: '#2563eb', color: '#ffffff', padding: '10px 18px', fontWeight: 600 }}
          onClick={() => setShowApplyModal(true)}
        >
          + Apply for Resignation
        </button>
      </div>

      {/* Notifications */}
      {errorMsg && (
        <div
          style={{
            background: '#fef2f2',
            borderLeft: '4px solid #ef4444',
            padding: '12px 16px',
            color: '#991b1b',
            borderRadius: '4px',
            fontSize: '14px',
          }}
        >
          <strong>Error:</strong> {errorMsg}
        </div>
      )}
      {successMsg && (
        <div
          style={{
            background: '#ecfdf5',
            borderLeft: '4px solid #10b981',
            padding: '12px 16px',
            color: '#065f46',
            borderRadius: '4px',
            fontSize: '14px',
          }}
        >
          <strong>Success:</strong> {successMsg}
        </div>
      )}

      {/* Pipeline Filter Bar */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '12px',
          flexWrap: 'wrap',
        }}
      >
        <div style={{ display: 'flex', gap: '6px', overflowX: 'auto' }}>
          {[
            { key: 'ALL', label: 'All Exits' },
            { key: 'PENDING_APPROVAL', label: 'Pending Approval' },
            { key: 'CLEARANCE_IN_PROGRESS', label: 'Clearance' },
            { key: 'SETTLEMENT_PENDING', label: 'FnF Pending' },
            { key: 'COMPLETED', label: 'Exited (Done)' },
            { key: 'REJECTED', label: 'Rejected' },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setStatusFilter(tab.key)}
              style={{
                padding: '8px 14px',
                borderRadius: '6px',
                border: '1px solid',
                borderColor: statusFilter === tab.key ? '#2563eb' : '#cbd5e1',
                background: statusFilter === tab.key ? '#eff6ff' : '#ffffff',
                color: statusFilter === tab.key ? '#1d4ed8' : '#475569',
                fontWeight: statusFilter === tab.key ? 700 : 500,
                fontSize: '12px',
                cursor: 'pointer',
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <form onSubmit={handleSearch} style={{ display: 'flex', gap: '8px' }}>
          <input
            type="text"
            placeholder="Search employee, code..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              padding: '8px 12px',
              border: '1px solid #cbd5e1',
              borderRadius: '6px',
              fontSize: '13px',
              width: '220px',
            }}
          />
          <button
            type="submit"
            className="btn btn-secondary"
            style={{ padding: '8px 14px', fontSize: '13px' }}
          >
            Search
          </button>
        </form>
      </div>

      {/* Requests Table */}
      <div
        style={{
          background: '#ffffff',
          borderRadius: '8px',
          border: '1px solid #e2e8f0',
          overflow: 'hidden',
          boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
        }}
      >
        {loading ? (
          <div style={{ padding: '32px', textAlign: 'center', color: '#64748b' }}>
            Loading exit requests...
          </div>
        ) : requests.length === 0 ? (
          <div style={{ padding: '40px', textAlign: 'center', color: '#94a3b8' }}>
            No exit requests found in this stage.
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569', fontWeight: 600 }}>
                <th style={{ padding: '12px 16px' }}>Employee</th>
                <th style={{ padding: '12px 16px' }}>Type & Notice</th>
                <th style={{ padding: '12px 16px' }}>Resignation Date</th>
                <th style={{ padding: '12px 16px' }}>Last Working Day</th>
                <th style={{ padding: '12px 16px' }}>Status</th>
                <th style={{ padding: '12px 16px', textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {requests.map((req) => (
                <tr key={req.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '12px 16px' }}>
                    <div style={{ fontWeight: 600, color: '#0f172a' }}>
                      {req.employee?.firstName} {req.employee?.lastName}
                    </div>
                    <div style={{ fontSize: '11px', color: '#64748b' }}>
                      {req.employee?.employeeCode} • {req.employee?.department?.name || 'General'}
                    </div>
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <span style={{ fontWeight: 600, color: '#334155' }}>{req.exitType}</span>
                    <div style={{ fontSize: '11px', color: '#64748b' }}>{req.noticePeriodDays} days notice</div>
                  </td>
                  <td style={{ padding: '12px 16px', color: '#334155' }}>
                    {new Date(req.resignationDate).toLocaleDateString()}
                  </td>
                  <td style={{ padding: '12px 16px', color: '#334155' }}>
                    {req.approvedLastWorkingDay
                      ? new Date(req.approvedLastWorkingDay).toLocaleDateString()
                      : new Date(req.proposedLastWorkingDay).toLocaleDateString() + ' (Proposed)'}
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <span
                      style={{
                        padding: '3px 8px',
                        borderRadius: '12px',
                        fontSize: '11px',
                        fontWeight: 700,
                        background: getStatusBadgeColor(req.status) + '15',
                        color: getStatusBadgeColor(req.status),
                      }}
                    >
                      {req.status}
                    </span>
                  </td>
                  <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                    <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                      {/* Action Approval */}
                      {req.status === 'PENDING_APPROVAL' && (isHrOrAdmin || isManager) && (
                        <button
                          className="btn btn-secondary"
                          style={{ padding: '4px 10px', fontSize: '11px' }}
                          onClick={() => {
                            setShowActionModal(req);
                            setActionForm({
                              decision: 'APPROVED',
                              approvedLastWorkingDay: new Date(req.proposedLastWorkingDay).toISOString().split('T')[0],
                              comments: '',
                            });
                          }}
                        >
                          Approve / Reject
                        </button>
                      )}

                      {/* View Clearance Checklists */}
                      <button
                        className="btn btn-secondary"
                        style={{ padding: '4px 10px', fontSize: '11px' }}
                        onClick={async () => {
                          const full = await api.getExitRequestById(req.id);
                          setShowTasksModal(full);
                        }}
                      >
                        Clearances ({req.clearanceTasks?.filter((t: any) => t.status === 'CLEARED').length || 0}/
                        {req.clearanceTasks?.length || 0})
                      </button>

                      {/* Exit Interview */}
                      <button
                        className="btn btn-secondary"
                        style={{ padding: '4px 10px', fontSize: '11px' }}
                        onClick={() => setShowInterviewModal(req)}
                      >
                        {req.exitInterview ? '⭐ Interview Done' : '📝 Interview'}
                      </button>

                      {/* FnF Settlement */}
                      {(isHrOrAdmin || isFinance) && (
                        <button
                          className="btn btn-secondary"
                          style={{ padding: '4px 10px', fontSize: '11px', background: '#f8fafc' }}
                          onClick={async () => {
                            if (req.fnfSettlement) {
                              setShowFnFModal(req.fnfSettlement);
                            } else {
                              await handleCalculateFnF(req.id);
                            }
                          }}
                        >
                          💰 FnF {req.fnfSettlement ? `(${req.fnfSettlement.status})` : 'Calc'}
                        </button>
                      )}

                      {/* Finalize Exit */}
                      {isHrOrAdmin && req.status !== 'COMPLETED' && (
                        <button
                          className="btn btn-primary"
                          style={{
                            padding: '4px 10px',
                            fontSize: '11px',
                            background: '#059669',
                            color: '#ffffff',
                            fontWeight: 600,
                          }}
                          onClick={() => handleFinalizeExit(req)}
                        >
                          Finalize Exit
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* MODAL 1: Apply for Resignation */}
      {showApplyModal && (
        <Modal onClose={() => setShowApplyModal(false)}>
          <div
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(15,23,42,0.6)',
              backdropFilter: 'blur(4px)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 1000,
              padding: '20px',
              boxSizing: 'border-box',
            }}
          >
          <div
            style={{
              background: '#ffffff',
              borderRadius: '8px',
              padding: '24px',
              width: '480px',
              maxWidth: '100%',
              maxHeight: '90vh',
              overflowY: 'auto',
              boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)',
            }}
          >
            <h3 style={{ margin: '0 0 16px', fontSize: '18px', fontWeight: 700 }}>
              Submit Resignation Request
            </h3>
            <form onSubmit={handleApplyResignation} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>
                  Exit Type
                </label>
                <select
                  value={applyForm.exitType}
                  onChange={(e) => setApplyForm({ ...applyForm, exitType: e.target.value })}
                  style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #cbd5e1' }}
                >
                  <option value="RESIGNATION">Resignation (Voluntary)</option>
                  <option value="RETIREMENT">Retirement</option>
                  <option value="CONTRACT_END">End of Contract</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>
                  Proposed Last Working Day *
                </label>
                <input
                  type="date"
                  required
                  value={applyForm.proposedLastWorkingDay}
                  onChange={(e) => setApplyForm({ ...applyForm, proposedLastWorkingDay: e.target.value })}
                  style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #cbd5e1' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>
                  Notice Period (Days)
                </label>
                <input
                  type="number"
                  min="0"
                  value={applyForm.noticePeriodDays}
                  onChange={(e) => setApplyForm({ ...applyForm, noticePeriodDays: Number(e.target.value) })}
                  style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #cbd5e1' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>
                  Reason for Leaving *
                </label>
                <textarea
                  required
                  rows={3}
                  placeholder="Explain the reasons for separation..."
                  value={applyForm.reason}
                  onChange={(e) => setApplyForm({ ...applyForm, reason: e.target.value })}
                  style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #cbd5e1' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '12px' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowApplyModal(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Submit Request
                </button>
              </div>
            </form>
          </div>
          </div>
        </Modal>
      )}

      {/* MODAL 2: Action Resignation */}
      {showActionModal && (
        <Modal onClose={() => setShowActionModal(null)}>
          <div
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(15,23,42,0.6)',
              backdropFilter: 'blur(4px)',
              display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '20px',
            boxSizing: 'border-box',
          }}
        >
          <div
            style={{
              background: '#ffffff',
              borderRadius: '8px',
              padding: '24px',
              width: '460px',
              maxWidth: '100%',
              maxHeight: '90vh',
              overflowY: 'auto',
            }}
          >
            <h3 style={{ margin: '0 0 16px', fontSize: '18px', fontWeight: 700 }}>
              Action Resignation: {showActionModal.employee?.firstName} {showActionModal.employee?.lastName}
            </h3>
            <form onSubmit={handleActionResignation} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>
                  Decision
                </label>
                <select
                  value={actionForm.decision}
                  onChange={(e) => setActionForm({ ...actionForm, decision: e.target.value })}
                  style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #cbd5e1' }}
                >
                  <option value="APPROVED">Approve Resignation</option>
                  <option value="REJECTED">Reject / Counter-Offer</option>
                </select>
              </div>

              {actionForm.decision === 'APPROVED' && (
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>
                    Agreed Last Working Day (LWD)
                  </label>
                  <input
                    type="date"
                    value={actionForm.approvedLastWorkingDay}
                    onChange={(e) =>
                      setActionForm({ ...actionForm, approvedLastWorkingDay: e.target.value })
                    }
                    style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #cbd5e1' }}
                  />
                </div>
              )}

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>
                  Comments / Notes
                </label>
                <textarea
                  rows={3}
                  value={actionForm.comments}
                  onChange={(e) => setActionForm({ ...actionForm, comments: e.target.value })}
                  placeholder="Manager / HR review remarks..."
                  style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #cbd5e1' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '12px' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowActionModal(null)}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Confirm Decision
                </button>
              </div>
            </form>
          </div>
          </div>
        </Modal>
      )}

      {/* MODAL 3: Clearance Tasks Inspector */}
      {showTasksModal && (
        <Modal onClose={() => setShowTasksModal(null)}>
          <div
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(15,23,42,0.6)',
              backdropFilter: 'blur(4px)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 1000,
              padding: '20px',
              boxSizing: 'border-box',
            }}
          >
          <div
            style={{
              background: '#ffffff',
              borderRadius: '8px',
              padding: '24px',
              width: '680px',
              maxWidth: '100%',
              maxHeight: '90vh',
              overflowY: 'auto',

            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 700 }}>
                  Clearance Checklists: {showTasksModal.employee?.firstName} {showTasksModal.employee?.lastName}
                </h3>
                <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#64748b' }}>
                  Multi-department sign-offs required prior to exit finalization.
                </p>
              </div>
              <button
                className="btn btn-secondary"
                style={{ padding: '4px 8px', fontSize: '12px' }}
                onClick={() => setShowTasksModal(null)}
              >
                ✕ Close
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {showTasksModal.clearanceTasks?.map((task: any) => (
                <div
                  key={task.id}
                  style={{
                    border: '1px solid #e2e8f0',
                    borderRadius: '6px',
                    padding: '12px 16px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    background: task.status === 'CLEARED' ? '#f0fdf4' : '#ffffff',
                  }}
                >
                  <div style={{ flex: 1, paddingRight: '16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span
                        style={{
                          fontSize: '11px',
                          fontWeight: 700,
                          background: '#e2e8f0',
                          padding: '2px 6px',
                          borderRadius: '4px',
                        }}
                      >
                        {task.departmentType}
                      </span>
                      <strong style={{ fontSize: '14px', color: '#0f172a' }}>{task.title}</strong>
                      {task.isMandatory && (
                        <span style={{ fontSize: '10px', color: '#ef4444', fontWeight: 700 }}>MANDATORY</span>
                      )}
                    </div>
                    {task.description && (
                      <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#64748b' }}>
                        {task.description}
                      </p>
                    )}
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span
                      style={{
                        padding: '2px 8px',
                        borderRadius: '12px',
                        fontSize: '11px',
                        fontWeight: 700,
                        background:
                          task.status === 'CLEARED'
                            ? '#dcfce7'
                            : task.status === 'WAIVED'
                            ? '#fef3c7'
                            : '#fee2e2',
                        color:
                          task.status === 'CLEARED'
                            ? '#15803d'
                            : task.status === 'WAIVED'
                            ? '#b45309'
                            : '#b91c1c',
                      }}
                    >
                      {task.status}
                    </span>

                    {(isHrOrAdmin || isManager || isFinance) && task.status !== 'CLEARED' && (
                      <button
                        className="btn btn-secondary"
                        style={{ padding: '3px 8px', fontSize: '11px', background: '#22c55e', color: '#ffffff' }}
                        onClick={() => handleUpdateTask(task.id, 'CLEARED')}
                      >
                        Clear
                      </button>
                    )}
                    {(isHrOrAdmin) && task.status !== 'WAIVED' && (
                      <button
                        className="btn btn-secondary"
                        style={{ padding: '3px 8px', fontSize: '11px' }}
                        onClick={() => handleUpdateTask(task.id, 'WAIVED')}
                      >
                        Waive
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
          </div>
        </Modal>
      )}

      {/* MODAL 4: Exit Interview */}
      {showInterviewModal && (
        <Modal onClose={() => setShowInterviewModal(null)}>
          <div
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(15,23,42,0.6)',
              backdropFilter: 'blur(4px)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 1000,
              padding: '20px',
              boxSizing: 'border-box',
            }}
          >
          <div
            style={{
              background: '#ffffff',
              borderRadius: '8px',
              padding: '24px',
              width: '520px',
              maxWidth: '100%',
              maxHeight: '90vh',
              overflowY: 'auto',
            }}
          >
            <h3 style={{ margin: '0 0 16px', fontSize: '18px', fontWeight: 700 }}>
              Confidential Exit Interview: {showInterviewModal.employee?.firstName} {showInterviewModal.employee?.lastName}
            </h3>
            <form onSubmit={handleSubmitInterview} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>
                  Primary Reason for Leaving
                </label>
                <select
                  value={interviewForm.reasonCategory}
                  onChange={(e) => setInterviewForm({ ...interviewForm, reasonCategory: e.target.value })}
                  style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #cbd5e1' }}
                >
                  <option value="CAREER_GROWTH">Career Growth & Learning</option>
                  <option value="BETTER_OPPORTUNITY">Better Opportunity</option>
                  <option value="HIGHER_COMPENSATION">Higher Compensation</option>
                  <option value="WORK_CULTURE">Work Culture & Environment</option>
                  <option value="RELOCATION">Relocation</option>
                  <option value="HEALTH_PERSONAL">Health / Personal Reasons</option>
                  <option value="MANAGEMENT_ISSUES">Management Issues</option>
                  <option value="OTHER">Other</option>
                </select>
              </div>

              {[
                { label: 'Company Culture Rating (1 - 5)', field: 'companyCultureRating' },
                { label: 'Management & Leadership (1 - 5)', field: 'managementRating' },
                { label: 'Work-Life Balance (1 - 5)', field: 'workLifeBalanceRating' },
                { label: 'Compensation & Benefits (1 - 5)', field: 'compensationRating' },
              ].map((item) => (
                <div key={item.field}>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>
                    {item.label}
                  </label>
                  <input
                    type="range"
                    min="1"
                    max="5"
                    value={(interviewForm as any)[item.field]}
                    onChange={(e) =>
                      setInterviewForm({ ...interviewForm, [item.field]: Number(e.target.value) })
                    }
                    style={{ width: '100%' }}
                  />
                  <div style={{ fontSize: '12px', color: '#64748b', textAlign: 'right' }}>
                    Rating: {(interviewForm as any)[item.field]} / 5
                  </div>
                </div>
              ))}

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <input
                  type="checkbox"
                  id="recommend"
                  checked={interviewForm.wouldRecommendCompany}
                  onChange={(e) =>
                    setInterviewForm({ ...interviewForm, wouldRecommendCompany: e.target.checked })
                  }
                />
                <label htmlFor="recommend" style={{ fontSize: '13px', fontWeight: 600 }}>
                  I would recommend PlanetU to a friend or colleague
                </label>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>
                  Detailed Feedback & Suggestions
                </label>
                <textarea
                  rows={3}
                  value={interviewForm.feedback}
                  onChange={(e) => setInterviewForm({ ...interviewForm, feedback: e.target.value })}
                  placeholder="Share constructive feedback on processes, team, or culture..."
                  style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #cbd5e1' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '12px' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowInterviewModal(null)}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Submit Feedback
                </button>
              </div>
            </form>
          </div>
          </div>
        </Modal>
      )}

      {/* MODAL 5: Full and Final (FnF) Settlement Statement */}
      {showFnFModal && (
        <Modal onClose={() => setShowFnFModal(null)}>
          <div
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(15,23,42,0.6)',
              backdropFilter: 'blur(4px)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 1000,
              padding: '20px',
              boxSizing: 'border-box',
            }}
          >
          <div
            style={{
              background: '#ffffff',
              borderRadius: '8px',
              padding: '24px',
              width: '640px',
              maxWidth: '100%',
              maxHeight: '90vh',
              overflowY: 'auto',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 700 }}>
                  Full & Final (FnF) Statutory Settlement
                </h3>
                <span
                  style={{
                    fontSize: '11px',
                    fontWeight: 700,
                    padding: '2px 8px',
                    borderRadius: '10px',
                    background: showFnFModal.status === 'APPROVED' ? '#dcfce7' : '#fef3c7',
                    color: showFnFModal.status === 'APPROVED' ? '#15803d' : '#b45309',
                  }}
                >
                  Status: {showFnFModal.status}
                </span>
              </div>
              <button
                className="btn btn-secondary"
                style={{ padding: '4px 8px', fontSize: '12px' }}
                onClick={() => setShowFnFModal(null)}
              >
                ✕ Close
              </button>
            </div>

            {/* Additions & Earnings */}
            <div style={{ marginBottom: '16px', background: '#f8fafc', padding: '12px 16px', borderRadius: '6px' }}>
              <h4 style={{ margin: '0 0 10px', fontSize: '13px', color: '#0f172a', fontWeight: 700 }}>
                1. Earnings & Additions
              </h4>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '12px' }}>
                <div>Final Month Payable Days: <strong>{Number(showFnFModal.payableDays)} days</strong></div>
                <div>Earned Basic Wage: <strong>₹{Number(showFnFModal.earnedBasic).toLocaleString()}</strong></div>
                <div>Earned HRA: <strong>₹{Number(showFnFModal.earnedHra).toLocaleString()}</strong></div>
                <div>Earned Special Allowance: <strong>₹{Number(showFnFModal.earnedSpecialAllowance).toLocaleString()}</strong></div>
                <div>Leave Encashment ({Number(showFnFModal.encashableLeaveDays)} days): <strong>₹{Number(showFnFModal.leaveEncashmentAmount).toLocaleString()}</strong></div>
                <div>Gratuity / Bonus: <strong>₹{(Number(showFnFModal.gratuityAmount) + Number(showFnFModal.bonusAmount)).toLocaleString()}</strong></div>
              </div>
              <div style={{ marginTop: '10px', borderTop: '1px solid #e2e8f0', paddingTop: '8px', textAlign: 'right', fontWeight: 700, color: '#15803d' }}>
                Total Additions: ₹{Number(showFnFModal.totalAdditions).toLocaleString()}
              </div>
            </div>

            {/* Deductions */}
            <div style={{ marginBottom: '16px', background: '#fef2f2', padding: '12px 16px', borderRadius: '6px' }}>
              <h4 style={{ margin: '0 0 10px', fontSize: '13px', color: '#991b1b', fontWeight: 700 }}>
                2. Deductions & Recoveries
              </h4>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '12px' }}>
                <div>Notice Shortfall ({showFnFModal.noticeShortfallDays} days): <strong>₹{Number(showFnFModal.noticeDeductionAmount).toLocaleString()}</strong></div>
                <div>Statutory EPF: <strong>₹{Number(showFnFModal.employeePf).toLocaleString()}</strong></div>
                <div>Professional Tax (PT): <strong>₹{Number(showFnFModal.professionalTax).toLocaleString()}</strong></div>
                <div>Other Recoveries: <strong>₹{Number(showFnFModal.otherDeductions).toLocaleString()}</strong></div>
              </div>
              <div style={{ marginTop: '10px', borderTop: '1px solid #fecaca', paddingTop: '8px', textAlign: 'right', fontWeight: 700, color: '#b91c1c' }}>
                Total Deductions: ₹{Number(showFnFModal.totalDeductions).toLocaleString()}
              </div>
            </div>

            {/* Net Settlement */}
            <div
              style={{
                background: '#eff6ff',
                border: '1px solid #bfdbfe',
                padding: '16px',
                borderRadius: '6px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '16px',
              }}
            >
              <div>
                <div style={{ fontSize: '12px', color: '#1e40af', fontWeight: 600 }}>NET PAYABLE TO EMPLOYEE</div>
                <div style={{ fontSize: '24px', fontWeight: 900, color: '#1e3a8a' }}>
                  ₹{Number(showFnFModal.netSettlementAmount).toLocaleString()}
                </div>
              </div>

              {(isFinance || isHrOrAdmin) && showFnFModal.status === 'DRAFT' && (
                <button
                  className="btn btn-primary"
                  style={{ background: '#2563eb', padding: '8px 16px', fontWeight: 700 }}
                  onClick={() => handleApproveFnF(showFnFModal.exitRequestId)}
                >
                  Approve FnF Statement
                </button>
              )}
            </div>

            <div style={{ textAlign: 'right' }}>
              <button
                className="btn btn-secondary"
                onClick={() => setShowFnFModal(null)}
              >
                Close
              </button>
            </div>
          </div>
          </div>
        </Modal>
      )}
    </div>
  );
};

