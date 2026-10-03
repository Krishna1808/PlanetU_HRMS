import React, { useState, useEffect, useCallback } from 'react';
import { api } from '../api';
import { Modal } from './Modal';
import { Icons } from './Icons';

interface GrievanceManagementPageProps {
  user: any;
}

const CATEGORY_LABELS: Record<string, { label: string; color: string; bg: string }> = {
  HARASSMENT_DISCRIMINATION: { label: 'Harassment & POSH', color: '#b91c1c', bg: '#fef2f2' },
  WORKPLACE_SAFETY: { label: 'Safety & Hazard', color: '#c2410c', bg: '#fff7ed' },
  COMPENSATION_PAYROLL: { label: 'Payroll & Compensation', color: '#15803d', bg: '#f0fdf4' },
  MANAGEMENT_LEADERSHIP: { label: 'Leadership Conduct', color: '#7c3aed', bg: '#f5f3ff' },
  POLICY_VIOLATION: { label: 'Policy Violation', color: '#b45309', bg: '#fffbeb' },
  OTHER: { label: 'General / Other', color: '#475569', bg: '#f8fafc' },
};

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; border: string }> = {
  SUBMITTED: { label: 'Submitted', color: '#1d4ed8', bg: '#eff6ff', border: '#bfdbfe' },
  UNDER_INVESTIGATION: { label: 'Investigating', color: '#b45309', bg: '#fef3c7', border: '#fde68a' },
  ESCALATED: { label: 'Escalated', color: '#a21caf', bg: '#fdf4ff', border: '#f5d0fe' },
  RESOLVED: { label: 'Resolved', color: '#047857', bg: '#ecfdf5', border: '#a7f3d0' },
  CLOSED: { label: 'Closed', color: '#475569', bg: '#f1f5f9', border: '#cbd5e1' },
  REJECTED: { label: 'Dismissed', color: '#b91c1c', bg: '#fef2f2', border: '#fecaca' },
};

const PRIORITY_BADGES: Record<string, { label: string; color: string; bg: string }> = {
  URGENT: { label: 'URGENT', color: '#dc2626', bg: '#fee2e2' },
  HIGH: { label: 'HIGH', color: '#ea580c', bg: '#ffedd5' },
  MEDIUM: { label: 'MEDIUM', color: '#2563eb', bg: '#dbeafe' },
  LOW: { label: 'LOW', color: '#64748b', bg: '#f1f5f9' },
};

export const GrievanceManagementPage: React.FC<GrievanceManagementPageProps> = ({ user: _user }) => {
  const [grievances, setGrievances] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Filters
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [priorityFilter, setPriorityFilter] = useState('ALL');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // Selected case for review drawer/modal
  const [selectedCase, setSelectedCase] = useState<any | null>(null);

  // Status & Assignment form in Drawer
  const [updateStatus, setUpdateStatus] = useState('UNDER_INVESTIGATION');
  const [updateNotes, setUpdateNotes] = useState('');
  const [updateIsInternal, setUpdateIsInternal] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);

  // Quick Timeline Note form
  const [noteContent, setNoteContent] = useState('');
  const [noteIsInternal, setNoteIsInternal] = useState(true);
  const [addingNote, setAddingNote] = useState(false);

  // Formal Resolution form
  const [showResolutionForm, setShowResolutionForm] = useState(false);
  const [resolutionStatus, setResolutionStatus] = useState<'RESOLVED' | 'REJECTED'>('RESOLVED');
  const [resolutionNotes, setResolutionNotes] = useState('');
  const [resolvingCase, setResolvingCase] = useState(false);

  const fetchStats = useCallback(async () => {
    try {
      const data = await api.getGrievanceStats();
      setStats(data);
    } catch (err: any) {
      console.warn('Failed to load grievance stats:', err.message);
    }
  }, []);

  const fetchGrievances = useCallback(async () => {
    try {
      setLoading(true);
      setErrorMsg('');
      const res = await api.getAllGrievances({
        page,
        limit: 15,
        status: statusFilter === 'ALL' ? undefined : statusFilter,
        category: categoryFilter === 'ALL' ? undefined : categoryFilter,
        priority: priorityFilter === 'ALL' ? undefined : priorityFilter,
        search: search.trim() || undefined,
      });
      setGrievances(res.data || []);
      setTotalPages(res.totalPages || 1);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to fetch grievances');
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter, categoryFilter, priorityFilter, search]);

  useEffect(() => {
    fetchStats();
    fetchGrievances();
  }, [fetchStats, fetchGrievances]);

  const openCaseDetails = async (caseId: string) => {
    try {
      const detail = await api.getGrievanceById(caseId);
      setSelectedCase(detail);
      setUpdateStatus(detail.status);
      setUpdateNotes('');
      setUpdateIsInternal(false);
      setShowResolutionForm(false);
      setResolutionNotes('');
    } catch (err: any) {
      alert(`Could not load case details: ${err.message}`);
    }
  };

  const handleStatusUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCase) return;
    try {
      setUpdatingStatus(true);
      setErrorMsg('');
      await api.updateGrievanceStatus(selectedCase.id, {
        status: updateStatus,
        notes: updateNotes.trim() || undefined,
        isInternalOnly: updateIsInternal,
      });
      setSuccessMsg(`Ticket ${selectedCase.ticketNumber} updated to ${updateStatus.replace(/_/g, ' ')}`);
      // Reload details and list
      await openCaseDetails(selectedCase.id);
      await fetchGrievances();
      await fetchStats();
      setUpdateNotes('');
    } catch (err: any) {
      alert(err.message || 'Failed to update status');
    } finally {
      setUpdatingStatus(false);
    }
  };

  const handleAddNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCase || !noteContent.trim()) return;
    try {
      setAddingNote(true);
      await api.addGrievanceTimelineNote(selectedCase.id, {
        notes: noteContent.trim(),
        isInternalOnly: noteIsInternal,
      });
      setNoteContent('');
      await openCaseDetails(selectedCase.id);
    } catch (err: any) {
      alert(err.message || 'Failed to log note');
    } finally {
      setAddingNote(false);
    }
  };

  const handleResolveSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCase || !resolutionNotes.trim()) return;
    try {
      setResolvingCase(true);
      await api.resolveGrievance(selectedCase.id, {
        resolutionNotes: resolutionNotes.trim(),
        status: resolutionStatus,
      });
      setSuccessMsg(`Ticket ${selectedCase.ticketNumber} marked as ${resolutionStatus}. Notification sent.`);
      setShowResolutionForm(false);
      setResolutionNotes('');
      await openCaseDetails(selectedCase.id);
      await fetchGrievances();
      await fetchStats();
    } catch (err: any) {
      alert(err.message || 'Failed to resolve grievance');
    } finally {
      setResolvingCase(false);
    }
  };

  const downloadAttachment = (url: string, name?: string) => {
    if (url.startsWith('data:')) {
      const a = document.createElement('a');
      a.href = url;
      a.download = name || 'grievance_evidence';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } else {
      window.open(url, '_blank');
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* 1. Header Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '14px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width: '38px',
              height: '38px',
              borderRadius: '8px',
              background: '#fef2f2',
              color: '#dc2626',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              <Icons.Shield size={22} color="#dc2626" />
            </div>
            <div>
              <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 800, color: '#0f172a' }}>
                Grievance Redressal & Case Management
              </h2>
              <p style={{ margin: '3px 0 0', fontSize: '13px', color: '#64748b' }}>
                Safe, confidential employee voice, POSH/ICC case investigations, SLA monitoring & resolution tracking.
              </p>
            </div>
          </div>
        </div>

        <button
          type="button"
          className="btn btn-secondary"
          onClick={() => {
            fetchStats();
            fetchGrievances();
          }}
          style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px' }}
        >
          <span>↻ Refresh Dashboard</span>
        </button>
      </div>

      {/* Success / Error Banners */}
      {successMsg && (
        <div style={{ padding: '10px 14px', background: '#ecfdf5', color: '#065f46', border: '1px solid #a7f3d0', borderRadius: '8px', fontSize: '13px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>✓ {successMsg}</span>
          <button onClick={() => setSuccessMsg('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#065f46', fontWeight: 'bold' }}>✕</button>
        </div>
      )}
      {errorMsg && (
        <div style={{ padding: '10px 14px', background: '#fef2f2', color: '#991b1b', border: '1px solid #fecaca', borderRadius: '8px', fontSize: '13px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>⚠ {errorMsg}</span>
          <button onClick={() => setErrorMsg('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#991b1b', fontWeight: 'bold' }}>✕</button>
        </div>
      )}

      {/* 2. Executive Metric Cards */}
      {stats && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '14px' }}>
          <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <span style={{ fontSize: '12px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
              Total Cases Filed
            </span>
            <span style={{ fontSize: '26px', fontWeight: 800, color: '#0f172a' }}>
              {stats.total || 0}
            </span>
            <span style={{ fontSize: '12px', color: '#64748b' }}>
              All-time tickets raised
            </span>
          </div>

          <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <span style={{ fontSize: '12px', fontWeight: 700, color: '#2563eb', textTransform: 'uppercase' }}>
              Active In-Progress
            </span>
            <span style={{ fontSize: '26px', fontWeight: 800, color: '#2563eb' }}>
              {stats.activeCases || 0}
            </span>
            <span style={{ fontSize: '12px', color: '#64748b' }}>
              {stats.underInvestigation || 0} investigating • {stats.escalated || 0} escalated
            </span>
          </div>

          <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '6px', background: stats.urgentActive > 0 ? '#fff1f2' : undefined, border: stats.urgentActive > 0 ? '1px solid #fecdd3' : undefined }}>
            <span style={{ fontSize: '12px', fontWeight: 700, color: '#dc2626', textTransform: 'uppercase' }}>
              Critical / Urgent
            </span>
            <span style={{ fontSize: '26px', fontWeight: 800, color: '#dc2626' }}>
              {stats.urgentActive || 0}
            </span>
            <span style={{ fontSize: '12px', color: stats.urgentActive > 0 ? '#b91c1c' : '#64748b' }}>
              High-priority SLA attention required
            </span>
          </div>

          <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <span style={{ fontSize: '12px', fontWeight: 700, color: '#059669', textTransform: 'uppercase' }}>
              Resolved & Closed
            </span>
            <span style={{ fontSize: '26px', fontWeight: 800, color: '#059669' }}>
              {stats.resolved || 0}
            </span>
            <span style={{ fontSize: '12px', color: '#64748b' }}>
              {stats.rejected ? `${stats.rejected} dismissed` : 'Full lifecycle redressal'}
            </span>
          </div>

          <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <span style={{ fontSize: '12px', fontWeight: 700, color: '#d97706', textTransform: 'uppercase' }}>
              Employee Satisfaction
            </span>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
              <span style={{ fontSize: '26px', fontWeight: 800, color: '#d97706' }}>
                {stats.averageSatisfactionRating ? `${stats.averageSatisfactionRating}` : '—'}
              </span>
              {stats.averageSatisfactionRating && (
                <span style={{ fontSize: '14px', color: '#f59e0b', fontWeight: 700 }}>
                  ★ / 5.0
                </span>
              )}
            </div>
            <span style={{ fontSize: '12px', color: '#64748b' }}>
              From {stats.totalFeedbackCount || 0} verified ratings
            </span>
          </div>
        </div>
      )}

      {/* 3. Filters & Search */}
      <div className="card" style={{ padding: '16px' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'center' }}>
          <div style={{ flex: '2', minWidth: '220px' }}>
            <input
              type="text"
              placeholder="Search by ticket #, subject, or keywords..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              style={{
                width: '100%',
                padding: '8px 12px',
                border: '1px solid #cbd5e1',
                borderRadius: '6px',
                fontSize: '13px',
                boxSizing: 'border-box',
              }}
            />
          </div>

          <div style={{ flex: '1', minWidth: '150px' }}>
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
              style={{
                width: '100%',
                padding: '8px 10px',
                border: '1px solid #cbd5e1',
                borderRadius: '6px',
                fontSize: '13px',
                boxSizing: 'border-box',
              }}
            >
              <option value="ALL">All Statuses</option>
              <option value="SUBMITTED">Submitted</option>
              <option value="UNDER_INVESTIGATION">Under Investigation</option>
              <option value="ESCALATED">Escalated</option>
              <option value="RESOLVED">Resolved</option>
              <option value="CLOSED">Closed</option>
              <option value="REJECTED">Dismissed</option>
            </select>
          </div>

          <div style={{ flex: '1', minWidth: '150px' }}>
            <select
              value={categoryFilter}
              onChange={(e) => {
                setCategoryFilter(e.target.value);
                setPage(1);
              }}
              style={{
                width: '100%',
                padding: '8px 10px',
                border: '1px solid #cbd5e1',
                borderRadius: '6px',
                fontSize: '13px',
                boxSizing: 'border-box',
              }}
            >
              <option value="ALL">All Categories</option>
              <option value="HARASSMENT_DISCRIMINATION">POSH & Harassment</option>
              <option value="WORKPLACE_SAFETY">Safety & Hazards</option>
              <option value="COMPENSATION_PAYROLL">Payroll & Compensation</option>
              <option value="MANAGEMENT_LEADERSHIP">Leadership Conduct</option>
              <option value="POLICY_VIOLATION">Policy Violation</option>
              <option value="OTHER">Other / General</option>
            </select>
          </div>

          <div style={{ flex: '1', minWidth: '120px' }}>
            <select
              value={priorityFilter}
              onChange={(e) => {
                setPriorityFilter(e.target.value);
                setPage(1);
              }}
              style={{
                width: '100%',
                padding: '8px 10px',
                border: '1px solid #cbd5e1',
                borderRadius: '6px',
                fontSize: '13px',
                boxSizing: 'border-box',
              }}
            >
              <option value="ALL">All Priorities</option>
              <option value="URGENT">Urgent</option>
              <option value="HIGH">High</option>
              <option value="MEDIUM">Medium</option>
              <option value="LOW">Low</option>
            </select>
          </div>
        </div>
      </div>

      {/* 4. Grievance Case Table */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>
            Loading grievance cases...
          </div>
        ) : grievances.length === 0 ? (
          <div style={{ padding: '48px', textAlign: 'center', color: '#64748b' }}>
            <Icons.Shield size={36} color="#94a3b8" style={{ marginBottom: '12px' }} />
            <h4 style={{ margin: 0, fontSize: '16px', color: '#334155' }}>No Grievances Found</h4>
            <p style={{ margin: '6px 0 0', fontSize: '13px' }}>
              No cases match the selected filter criteria.
            </p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="table" style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', textAlign: 'left' }}>
                  <th style={{ padding: '12px 16px', fontSize: '12px', fontWeight: 700, color: '#475569' }}>TICKET #</th>
                  <th style={{ padding: '12px 16px', fontSize: '12px', fontWeight: 700, color: '#475569' }}>SUBMITTER</th>
                  <th style={{ padding: '12px 16px', fontSize: '12px', fontWeight: 700, color: '#475569' }}>CATEGORY & SUBJECT</th>
                  <th style={{ padding: '12px 16px', fontSize: '12px', fontWeight: 700, color: '#475569' }}>PRIORITY</th>
                  <th style={{ padding: '12px 16px', fontSize: '12px', fontWeight: 700, color: '#475569' }}>STATUS</th>
                  <th style={{ padding: '12px 16px', fontSize: '12px', fontWeight: 700, color: '#475569' }}>DATE FILED</th>
                  <th style={{ padding: '12px 16px', fontSize: '12px', fontWeight: 700, color: '#475569', textAlign: 'right' }}>ACTION</th>
                </tr>
              </thead>
              <tbody>
                {grievances.map((g) => {
                  const cat = CATEGORY_LABELS[g.category] || CATEGORY_LABELS.OTHER;
                  const stat = STATUS_CONFIG[g.status] || STATUS_CONFIG.SUBMITTED;
                  const prio = PRIORITY_BADGES[g.priority] || PRIORITY_BADGES.MEDIUM;

                  return (
                    <tr key={g.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '14px 16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span style={{ fontWeight: 700, color: '#0f172a', fontSize: '13px' }}>
                            {g.ticketNumber}
                          </span>
                          {g.priority === 'URGENT' && (
                            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#dc2626' }} title="Urgent SLA" />
                          )}
                        </div>
                      </td>

                      <td style={{ padding: '14px 16px' }}>
                        {g.isAnonymous ? (
                          <span style={{
                            background: '#f1f5f9',
                            color: '#475569',
                            padding: '3px 8px',
                            borderRadius: '4px',
                            fontSize: '11px',
                            fontWeight: 700,
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                          }}>
                            <Icons.Lock size={11} color="#64748b" />
                            <span>Anonymous</span>
                          </span>
                        ) : g.employee ? (
                          <div>
                            <div style={{ fontWeight: 600, fontSize: '13px', color: '#1e293b' }}>
                              {g.employee.firstName} {g.employee.lastName}
                            </div>
                            <div style={{ fontSize: '11px', color: '#64748b' }}>
                              {g.employee.employeeCode} {g.employee.department ? `• ${g.employee.department.name}` : ''}
                            </div>
                          </div>
                        ) : (
                          <span style={{ fontSize: '12px', color: '#64748b' }}>Staff Member</span>
                        )}
                      </td>

                      <td style={{ padding: '14px 16px', maxWidth: '320px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '3px' }}>
                          <span style={{
                            background: cat.bg,
                            color: cat.color,
                            fontSize: '10px',
                            fontWeight: 700,
                            padding: '2px 6px',
                            borderRadius: '4px',
                          }}>
                            {cat.label}
                          </span>
                        </div>
                        <div style={{ fontWeight: 600, fontSize: '13px', color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {g.subject}
                        </div>
                      </td>

                      <td style={{ padding: '14px 16px' }}>
                        <span style={{
                          background: prio.bg,
                          color: prio.color,
                          padding: '3px 8px',
                          borderRadius: '4px',
                          fontSize: '11px',
                          fontWeight: 700,
                        }}>
                          {prio.label}
                        </span>
                      </td>

                      <td style={{ padding: '14px 16px' }}>
                        <span style={{
                          background: stat.bg,
                          color: stat.color,
                          border: `1px solid ${stat.border}`,
                          padding: '3px 8px',
                          borderRadius: '12px',
                          fontSize: '11px',
                          fontWeight: 700,
                        }}>
                          {stat.label}
                        </span>
                      </td>

                      <td style={{ padding: '14px 16px', fontSize: '12px', color: '#64748b' }}>
                        {new Date(g.createdAt).toLocaleDateString('en-IN', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </td>

                      <td style={{ padding: '14px 16px', textAlign: 'right' }}>
                        <button
                          type="button"
                          className="btn btn-secondary"
                          onClick={() => openCaseDetails(g.id)}
                          style={{ padding: '5px 12px', fontSize: '12px', fontWeight: 600 }}
                        >
                          Review Case
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Bar */}
        {totalPages > 1 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', borderTop: '1px solid #e2e8f0', background: '#f8fafc' }}>
            <span style={{ fontSize: '12px', color: '#64748b' }}>
              Page {page} of {totalPages}
            </span>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                type="button"
                className="btn btn-secondary"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                style={{ padding: '4px 10px', fontSize: '12px' }}
              >
                Previous
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                style={{ padding: '4px 10px', fontSize: '12px' }}
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 5. Detailed Case Review & Investigation Drawer Modal */}
      {selectedCase && (
        <Modal onClose={() => setSelectedCase(null)}>
          <div style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.65)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            backdropFilter: 'blur(4px)',
            padding: '20px',
            boxSizing: 'border-box',
          }}>
            <div className="card" style={{ width: '840px', maxWidth: '100%', maxHeight: '92vh', overflowY: 'auto', padding: '24px' }}>
              {/* Drawer Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid #e2e8f0', paddingBottom: '16px', marginBottom: '18px' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ fontSize: '20px', fontWeight: 800, color: '#0f172a' }}>
                      Case {selectedCase.ticketNumber}
                    </span>
                    <span style={{
                      background: STATUS_CONFIG[selectedCase.status]?.bg || '#eff6ff',
                      color: STATUS_CONFIG[selectedCase.status]?.color || '#1d4ed8',
                      border: `1px solid ${STATUS_CONFIG[selectedCase.status]?.border || '#bfdbfe'}`,
                      padding: '3px 10px',
                      borderRadius: '12px',
                      fontSize: '11px',
                      fontWeight: 700,
                    }}>
                      {STATUS_CONFIG[selectedCase.status]?.label || selectedCase.status}
                    </span>
                    <span style={{
                      background: PRIORITY_BADGES[selectedCase.priority]?.bg || '#f1f5f9',
                      color: PRIORITY_BADGES[selectedCase.priority]?.color || '#475569',
                      padding: '3px 8px',
                      borderRadius: '4px',
                      fontSize: '11px',
                      fontWeight: 700,
                    }}>
                      {selectedCase.priority}
                    </span>
                  </div>

                  <div style={{ fontSize: '13px', color: '#64748b', marginTop: '6px' }}>
                    Category: <strong>{CATEGORY_LABELS[selectedCase.category]?.label || selectedCase.category}</strong> • Filed on {new Date(selectedCase.createdAt).toLocaleString('en-IN')}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setSelectedCase(null)}
                  style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: '#64748b' }}
                >
                  ✕
                </button>
              </div>

              {/* Submitter & Confidentiality Status */}
              <div style={{
                background: selectedCase.isAnonymous ? '#f8fafc' : '#eff6ff',
                border: `1px solid ${selectedCase.isAnonymous ? '#e2e8f0' : '#bfdbfe'}`,
                borderRadius: '8px',
                padding: '12px 16px',
                marginBottom: '18px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}>
                <div>
                  <span style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', display: 'block' }}>
                    Filing Identity Status
                  </span>
                  {selectedCase.isAnonymous ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '4px', color: '#334155', fontWeight: 700, fontSize: '14px' }}>
                      <Icons.Lock size={15} color="#475569" />
                      <span>Anonymous Filing — Submitter Personal Identity Protected by System</span>
                    </div>
                  ) : selectedCase.employee ? (
                    <div style={{ marginTop: '4px', fontSize: '14px', fontWeight: 700, color: '#1e40af' }}>
                      {selectedCase.employee.firstName} {selectedCase.employee.lastName} ({selectedCase.employee.employeeCode})
                      <span style={{ fontSize: '12px', fontWeight: 500, color: '#3b82f6', marginLeft: '8px' }}>
                        {selectedCase.employee.department?.name || ''} • {selectedCase.employee.designation?.name || ''}
                      </span>
                    </div>
                  ) : (
                    <div style={{ marginTop: '4px', fontSize: '13px', color: '#334155' }}>Employee Record</div>
                  )}
                </div>

                {selectedCase.satisfactionRating && (
                  <div style={{ textAlign: 'right' }}>
                    <span style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', display: 'block' }}>
                      Employee Closure Feedback
                    </span>
                    <span style={{ fontSize: '16px', fontWeight: 800, color: '#d97706' }}>
                      ★ {selectedCase.satisfactionRating} / 5
                    </span>
                  </div>
                )}
              </div>

              {/* Subject & Description Content */}
              <div style={{ marginBottom: '20px' }}>
                <h4 style={{ margin: '0 0 8px', fontSize: '16px', fontWeight: 700, color: '#0f172a' }}>
                  {selectedCase.subject}
                </h4>
                <div style={{
                  background: '#ffffff',
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px',
                  padding: '14px',
                  fontSize: '13px',
                  lineHeight: '1.6',
                  color: '#334155',
                  whiteSpace: 'pre-wrap',
                }}>
                  {selectedCase.description}
                </div>

                {/* Evidence attachment */}
                {selectedCase.attachmentUrl && (
                  <div style={{ marginTop: '12px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ fontSize: '12px', fontWeight: 700, color: '#64748b' }}>Attached Evidence:</span>
                    <button
                      type="button"
                      onClick={() => downloadAttachment(selectedCase.attachmentUrl, selectedCase.attachmentName)}
                      className="btn btn-secondary"
                      style={{ padding: '5px 12px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}
                    >
                      <Icons.Download size={14} />
                      <span>{selectedCase.attachmentName || 'Download Evidence Document'}</span>
                    </button>
                  </div>
                )}
              </div>

              {/* Resolution Notes Banner if resolved */}
              {selectedCase.resolutionNotes && (
                <div style={{
                  background: '#f0fdf4',
                  border: '1px solid #bbf7d0',
                  borderRadius: '8px',
                  padding: '14px 16px',
                  marginBottom: '20px',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                    <Icons.Award size={18} color="#15803d" />
                    <h5 style={{ margin: 0, fontSize: '14px', fontWeight: 700, color: '#166534' }}>
                      Official Case Resolution Findings
                    </h5>
                  </div>
                  <p style={{ margin: 0, fontSize: '13px', color: '#15803d', lineHeight: '1.5', whiteSpace: 'pre-wrap' }}>
                    {selectedCase.resolutionNotes}
                  </p>
                  {selectedCase.resolvedByUser && (
                    <div style={{ fontSize: '11px', color: '#16a34a', marginTop: '6px' }}>
                      Resolved by {selectedCase.resolvedByUser.employee?.firstName || selectedCase.resolvedByUser.email} on {new Date(selectedCase.resolvedAt).toLocaleString('en-IN')}
                    </div>
                  )}
                </div>
              )}

              {/* Action Controls Tabs / Sections */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '16px', marginBottom: '24px' }}>
                {/* 1. Status Update & Investigator Assignment */}
                <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '16px' }}>
                  <h5 style={{ margin: '0 0 12px', fontSize: '13px', fontWeight: 700, color: '#1e293b' }}>
                    Triage & Update Status
                  </h5>
                  <form onSubmit={handleStatusUpdate} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <div>
                      <label style={{ fontSize: '11px', fontWeight: 600, color: '#64748b', display: 'block', marginBottom: '4px' }}>
                        Set New Case Status
                      </label>
                      <select
                        value={updateStatus}
                        onChange={(e) => setUpdateStatus(e.target.value)}
                        style={{ width: '100%', padding: '7px 10px', fontSize: '13px', border: '1px solid #cbd5e1', borderRadius: '4px' }}
                      >
                        <option value="SUBMITTED">SUBMITTED</option>
                        <option value="UNDER_INVESTIGATION">UNDER_INVESTIGATION</option>
                        <option value="ESCALATED">ESCALATED</option>
                        <option value="RESOLVED">RESOLVED</option>
                        <option value="CLOSED">CLOSED</option>
                        <option value="REJECTED">REJECTED / DISMISSED</option>
                      </select>
                    </div>

                    <div>
                      <label style={{ fontSize: '11px', fontWeight: 600, color: '#64748b', display: 'block', marginBottom: '4px' }}>
                        Status Transition Note (Optional)
                      </label>
                      <textarea
                        rows={2}
                        placeholder="Reason for escalation or status change..."
                        value={updateNotes}
                        onChange={(e) => setUpdateNotes(e.target.value)}
                        style={{ width: '100%', padding: '6px 8px', fontSize: '12px', border: '1px solid #cbd5e1', borderRadius: '4px', boxSizing: 'border-box' }}
                      />
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <input
                        type="checkbox"
                        id="updateIsInternal"
                        checked={updateIsInternal}
                        onChange={(e) => setUpdateIsInternal(e.target.checked)}
                      />
                      <label htmlFor="updateIsInternal" style={{ fontSize: '11px', color: '#475569', cursor: 'pointer' }}>
                        Internal Only (Hidden from submitter)
                      </label>
                    </div>

                    <button
                      type="submit"
                      className="btn btn-primary"
                      disabled={updatingStatus}
                      style={{ marginTop: '4px', fontSize: '12px', padding: '7px 12px' }}
                    >
                      {updatingStatus ? 'Updating...' : 'Update Status'}
                    </button>
                  </form>
                </div>

                {/* 2. Add Investigation Note */}
                <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '16px' }}>
                  <h5 style={{ margin: '0 0 12px', fontSize: '13px', fontWeight: 700, color: '#1e293b' }}>
                    Log Investigation Evidence / Meeting Note
                  </h5>
                  <form onSubmit={handleAddNote} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <div>
                      <label style={{ fontSize: '11px', fontWeight: 600, color: '#64748b', display: 'block', marginBottom: '4px' }}>
                        Investigation / Witness Log *
                      </label>
                      <textarea
                        required
                        rows={3}
                        placeholder="Log interview findings, committee review, witness statements..."
                        value={noteContent}
                        onChange={(e) => setNoteContent(e.target.value)}
                        style={{ width: '100%', padding: '6px 8px', fontSize: '12px', border: '1px solid #cbd5e1', borderRadius: '4px', boxSizing: 'border-box' }}
                      />
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <input
                        type="checkbox"
                        id="noteIsInternal"
                        checked={noteIsInternal}
                        onChange={(e) => setNoteIsInternal(e.target.checked)}
                      />
                      <label htmlFor="noteIsInternal" style={{ fontSize: '11px', color: '#475569', cursor: 'pointer' }}>
                        Internal Note (Committee confidential)
                      </label>
                    </div>

                    <button
                      type="submit"
                      className="btn btn-secondary"
                      disabled={addingNote || !noteContent.trim()}
                      style={{ marginTop: '4px', fontSize: '12px', padding: '7px 12px' }}
                    >
                      {addingNote ? 'Saving...' : '+ Log Investigation Note'}
                    </button>
                  </form>
                </div>
              </div>

              {/* 3. Formal Resolution Section Button */}
              {selectedCase.status !== 'RESOLVED' && selectedCase.status !== 'CLOSED' && (
                <div style={{ background: '#ecfdf5', border: '1px solid #a7f3d0', borderRadius: '8px', padding: '14px', marginBottom: '24px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
                    <div>
                      <h5 style={{ margin: 0, fontSize: '14px', fontWeight: 700, color: '#065f46' }}>
                        Ready to Conclude Case?
                      </h5>
                      <p style={{ margin: '2px 0 0', fontSize: '12px', color: '#047857' }}>
                        Publish formal resolution findings or dismissal notice to the submitter with email dispatch.
                      </p>
                    </div>
                    <button
                      type="button"
                      className="btn btn-primary"
                      onClick={() => setShowResolutionForm(!showResolutionForm)}
                      style={{ background: '#059669', borderColor: '#059669', fontSize: '12px', padding: '7px 14px' }}
                    >
                      {showResolutionForm ? 'Hide Form' : 'Publish Formal Resolution'}
                    </button>
                  </div>

                  {showResolutionForm && (
                    <form onSubmit={handleResolveSubmit} style={{ marginTop: '14px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      <div>
                        <label style={{ fontSize: '11px', fontWeight: 700, color: '#065f46', display: 'block', marginBottom: '4px' }}>
                          Resolution Outcome
                        </label>
                        <select
                          value={resolutionStatus}
                          onChange={(e) => setResolutionStatus(e.target.value as any)}
                          style={{ width: '100%', padding: '7px 10px', fontSize: '13px', border: '1px solid #a7f3d0', borderRadius: '4px' }}
                        >
                          <option value="RESOLVED">RESOLVED (Findings addressed & corrective actions taken)</option>
                          <option value="REJECTED">DISMISSED / REJECTED (Unsubstantiated or outside scope)</option>
                        </select>
                      </div>

                      <div>
                        <label style={{ fontSize: '11px', fontWeight: 700, color: '#065f46', display: 'block', marginBottom: '4px' }}>
                          Formal Resolution Notice / Corrective Actions *
                        </label>
                        <textarea
                          required
                          rows={4}
                          placeholder="Detail the committee's findings, corrective measures enacted, policy enforcement, or rationale for dismissal..."
                          value={resolutionNotes}
                          onChange={(e) => setResolutionNotes(e.target.value)}
                          style={{ width: '100%', padding: '8px', fontSize: '13px', border: '1px solid #a7f3d0', borderRadius: '4px', boxSizing: 'border-box' }}
                        />
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                        <button
                          type="button"
                          className="btn btn-secondary"
                          onClick={() => setShowResolutionForm(false)}
                          style={{ fontSize: '12px' }}
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          className="btn btn-primary"
                          disabled={resolvingCase || !resolutionNotes.trim()}
                          style={{ background: '#059669', borderColor: '#059669', fontSize: '12px' }}
                        >
                          {resolvingCase ? 'Publishing...' : 'Publish Formal Resolution'}
                        </button>
                      </div>
                    </form>
                  )}
                </div>
              )}

              {/* 4. Chronological Case Audit Trail */}
              <div>
                <h4 style={{ margin: '0 0 14px', fontSize: '15px', fontWeight: 700, color: '#0f172a' }}>
                  Investigation Audit Trail & Timeline ({selectedCase.timelines?.length || 0})
                </h4>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {selectedCase.timelines?.map((item: any) => (
                    <div
                      key={item.id}
                      style={{
                        background: item.isInternalOnly ? '#fffbeb' : '#ffffff',
                        border: `1px solid ${item.isInternalOnly ? '#fde68a' : '#e2e8f0'}`,
                        borderRadius: '6px',
                        padding: '12px 14px',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ fontWeight: 700, fontSize: '13px', color: '#1e293b' }}>
                            {item.actionTitle}
                          </span>
                          {item.isInternalOnly && (
                            <span style={{
                              background: '#fef3c7',
                              color: '#92400e',
                              fontSize: '10px',
                              fontWeight: 700,
                              padding: '2px 6px',
                              borderRadius: '4px',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '3px',
                            }}>
                              <Icons.Lock size={10} color="#92400e" />
                              <span>INTERNAL ONLY</span>
                            </span>
                          )}
                        </div>
                        <span style={{ fontSize: '11px', color: '#94a3b8' }}>
                          {new Date(item.createdAt).toLocaleString('en-IN')}
                        </span>
                      </div>

                      {item.notes && (
                        <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#475569', lineHeight: '1.5', whiteSpace: 'pre-wrap' }}>
                          {item.notes}
                        </p>
                      )}

                      {item.actionByUser && (
                        <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '6px' }}>
                          By: {item.actionByUser.employee?.firstName ? `${item.actionByUser.employee.firstName} ${item.actionByUser.employee.lastName}` : item.actionByUser.email} ({item.actionByUser.role})
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
