import { useEffect, useState } from 'react';
import { api } from '../api';
import { Modal } from './Modal';

interface OnboardingPageProps {
  user?: any;
}

export function OnboardingPage({ user: _user }: OnboardingPageProps) {
  const [candidates, setCandidates] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [designations, setDesignations] = useState<any[]>([]);
  const [grades, setGrades] = useState<any[]>([]);
  const [locations, setLocations] = useState<any[]>([]);
  const [managers, setManagers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState('');

  // Modals
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [showPreboardingModal, setShowPreboardingModal] = useState(false);
  const [selectedCandidate, setSelectedCandidate] = useState<any | null>(null);

  // Invite Form state
  const [inviteForm, setInviteForm] = useState({
    firstName: '',
    lastName: '',
    personalEmail: '',
    phone: '',
    departmentId: '',
    designationId: '',
    gradeId: '',
    locationId: '',
    reportingManagerId: '',
    proposedJoiningDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    offeredCtc: '600000',
    notes: '',
  });

  // Pre-boarding Form state
  const [preboardForm, setPreboardForm] = useState({
    phone: '',
    dateOfBirth: '1995-05-15',
    gender: 'MALE',
    currentAddress: '',
    permanentAddress: '',
    emergencyContactName: '',
    emergencyContactPhone: '',
    emergencyContactRelation: 'Spouse',
    bankName: 'HDFC Bank',
    accountNumber: '',
    ifscOrRouting: '',
    panNumber: '',
    uanNumber: '',
    notes: '',
  });

  const [submitting, setSubmitting] = useState(false);
  const [conversionResult, setConversionResult] = useState<any | null>(null);

  const loadData = async () => {
    try {
      setLoading(true);
      setError('');
      const [candRes, deptRes, desRes, grdRes, locRes, empRes] = await Promise.all([
        api.getOnboardingCandidates(statusFilter || undefined, searchTerm || undefined),
        api.getDepartments(),
        api.getDesignations(),
        api.getGrades(),
        api.getLocations(),
        api.getEmployees(),
      ]);

      setCandidates(candRes || []);
      setDepartments(deptRes || []);
      setDesignations(desRes || []);
      setGrades(grdRes || []);
      setLocations(locRes || []);
      setManagers(empRes.data || []);

      if (deptRes.length > 0 && !inviteForm.departmentId) {
        setInviteForm((prev) => ({ ...prev, departmentId: deptRes[0].id }));
      }
      if (desRes.length > 0 && !inviteForm.designationId) {
        setInviteForm((prev) => ({ ...prev, designationId: desRes[0].id }));
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load onboarding pipeline data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [statusFilter]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loadData();
  };

  const handleInviteSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSubmitting(true);
      await api.inviteCandidate({
        ...inviteForm,
        offeredCtc: inviteForm.offeredCtc ? Number(inviteForm.offeredCtc) : undefined,
        gradeId: inviteForm.gradeId || undefined,
        locationId: inviteForm.locationId || undefined,
        reportingManagerId: inviteForm.reportingManagerId || undefined,
      });

      alert('Candidate invited successfully with verification checklist tasks!');
      setShowInviteModal(false);
      setInviteForm({
        firstName: '',
        lastName: '',
        personalEmail: '',
        phone: '',
        departmentId: departments[0]?.id || '',
        designationId: designations[0]?.id || '',
        gradeId: '',
        locationId: '',
        reportingManagerId: '',
        proposedJoiningDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        offeredCtc: '600000',
        notes: '',
      });
      loadData();
    } catch (err: any) {
      alert(err.message || 'Failed to invite candidate');
    } finally {
      setSubmitting(false);
    }
  };

  const handleOpenDetails = async (candidateId: string) => {
    try {
      const fresh = await api.getOnboardingCandidateById(candidateId);
      setSelectedCandidate(fresh);
      setShowDetailsModal(true);
    } catch (err: any) {
      alert(err.message || 'Failed to load candidate details');
    }
  };

  const handleOpenPreboarding = (candidate: any) => {
    setSelectedCandidate(candidate);
    setPreboardForm({
      phone: candidate.phone || '',
      dateOfBirth: candidate.dateOfBirth ? candidate.dateOfBirth.split('T')[0] : '1995-05-15',
      gender: candidate.gender || 'MALE',
      currentAddress: candidate.currentAddress || '',
      permanentAddress: candidate.permanentAddress || '',
      emergencyContactName: candidate.emergencyContactName || '',
      emergencyContactPhone: candidate.emergencyContactPhone || '',
      emergencyContactRelation: candidate.emergencyContactRelation || 'Spouse',
      bankName: candidate.bankName || 'HDFC Bank',
      accountNumber: candidate.accountNumber || '',
      ifscOrRouting: candidate.ifscOrRouting || '',
      panNumber: candidate.panNumber || '',
      uanNumber: candidate.uanNumber || '',
      notes: candidate.notes || '',
    });
    setShowPreboardingModal(true);
  };

  const handlePreboardSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCandidate) return;
    try {
      setSubmitting(true);
      await api.submitPreBoardingForm(selectedCandidate.id, preboardForm);
      alert('Pre-boarding form updated successfully!');
      setShowPreboardingModal(false);
      loadData();
    } catch (err: any) {
      alert(err.message || 'Failed to submit pre-boarding form');
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleTask = async (task: any) => {
    const nextStatus = task.status === 'COMPLETED' ? 'PENDING' : 'COMPLETED';
    try {
      await api.updateOnboardingTask(task.id, {
        status: nextStatus,
        notes: nextStatus === 'COMPLETED' ? 'Verified by HR Admin' : 'Marked pending',
      });
      // Refresh candidate details
      const refreshed = await api.getOnboardingCandidateById(selectedCandidate.id);
      setSelectedCandidate(refreshed);
      loadData();
    } catch (err: any) {
      alert(err.message || 'Failed to update task');
    }
  };

  const handleConvert = async (candidate: any) => {
    const confirmConvert = window.confirm(
      `Convert ${candidate.firstName} ${candidate.lastName} into an official Employee? This will generate their employee code, user login credentials, shift schedule, and initial salary structure.`,
    );
    if (!confirmConvert) return;

    try {
      setSubmitting(true);
      const res = await api.convertCandidateToEmployee(candidate.id, {
        initialPassword: 'Password@123',
      });
      setConversionResult(res);
      setShowDetailsModal(false);
      loadData();
    } catch (err: any) {
      alert(err.message || 'Failed to convert candidate to employee');
    } finally {
      setSubmitting(false);
    }
  };

  const getStatusBadgeClass = (st: string) => {
    switch (st) {
      case 'INVITED':
        return 'badge-role';
      case 'SUBMITTED':
      case 'IN_PROGRESS':
        return 'badge-warning';
      case 'CONVERTED':
      case 'APPROVED':
        return 'badge-active';
      default:
        return 'badge-role';
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Header card */}
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <h2 style={{ fontSize: '18px', fontWeight: 700 }}>🚀 Employee Onboarding</h2>
            <p style={{ fontSize: '13px', color: '#64748b', marginTop: '4px' }}>
              Manages candidate pre-boarding forms, verification checklists, and atomic conversion into official Employee profiles & User logins.
            </p>
          </div>
          <button className="btn btn-primary" onClick={() => setShowInviteModal(true)}>
            ➕ Invite New Candidate
          </button>
        </div>

        {/* Pipeline Filter Bar */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '16px', flexWrap: 'wrap', gap: '12px' }}>
          <div style={{ display: 'flex', gap: '8px' }}>
            {['', 'INVITED', 'SUBMITTED', 'CONVERTED'].map((st) => (
              <button
                key={st}
                type="button"
                onClick={() => setStatusFilter(st)}
                style={{
                  padding: '6px 12px',
                  borderRadius: '4px',
                  border: '1px solid #cbd5e1',
                  fontSize: '12px',
                  fontWeight: statusFilter === st ? 700 : 500,
                  cursor: 'pointer',
                  background: statusFilter === st ? '#2563eb' : '#f8fafc',
                  color: statusFilter === st ? 'white' : '#334155',
                }}
              >
                {st === '' ? 'All Candidates' : st}
              </button>
            ))}
          </div>

          <form onSubmit={handleSearchSubmit} style={{ display: 'flex', gap: '8px' }}>
            <input
              type="text"
              placeholder="Search candidate name or email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{ padding: '6px 10px', fontSize: '12px', border: '1px solid #cbd5e1', borderRadius: '4px', width: '220px' }}
            />
            <button type="submit" className="btn btn-secondary" style={{ padding: '6px 12px', fontSize: '12px' }}>
              Search
            </button>
          </form>
        </div>

        {error && <div style={{ color: '#dc2626', marginTop: '12px', fontSize: '13px' }}>{error}</div>}

        {/* Conversion Success Notification */}
        {conversionResult && (
          <div style={{ marginTop: '16px', padding: '16px', background: '#ecfdf5', border: '1px solid #a7f3d0', borderRadius: '6px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <h4 style={{ color: '#065f46', fontSize: '14px', fontWeight: 700, margin: 0 }}>
                  🎉 Successfully Converted to Official Employee!
                </h4>
                <div style={{ fontSize: '12px', color: '#047857', marginTop: '8px', lineHeight: 1.6 }}>
                  <div><strong>Employee Name:</strong> {conversionResult.employee?.name}</div>
                  <div><strong>Generated Code:</strong> <span className="badge badge-active">{conversionResult.employee?.employeeCode}</span></div>
                  <div><strong>User Login Email:</strong> {conversionResult.user?.email}</div>
                  <div><strong>Assigned Role:</strong> {conversionResult.user?.role}</div>
                  <div><strong>Temporary Password:</strong> <code>{conversionResult.credentials?.temporaryPassword}</code></div>
                  <div style={{ marginTop: '4px', fontStyle: 'italic', color: '#065f46' }}>
                    * Automatically assigned default General Shift and created active Salary Structure based on offered CTC!
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setConversionResult(null)}
                style={{ background: 'none', border: 'none', fontSize: '16px', cursor: 'pointer', color: '#065f46' }}
              >
                ✕
              </button>
            </div>
          </div>
        )}

        {/* Candidates Table */}
        <div style={{ marginTop: '20px' }}>
          {loading ? (
            <div>Loading onboarding candidates...</div>
          ) : candidates.length === 0 ? (
            <div style={{ color: '#64748b', fontStyle: 'italic', padding: '20px 0' }}>
              No candidates found in the onboarding pipeline. Click "➕ Invite New Candidate" to initiate onboarding.
            </div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Candidate Name</th>
                  <th>Personal Email & Phone</th>
                  <th>Target Role & Dept</th>
                  <th>Proposed Joining</th>
                  <th>Offered CTC</th>
                  <th>Status</th>
                  <th>Checklist Progress</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {candidates.map((c) => {
                  const mandatoryTasks = c.tasks?.filter((t: any) => t.isMandatory) || [];
                  const completedMandatory = mandatoryTasks.filter((t: any) => t.status === 'COMPLETED').length;
                  const allDone = mandatoryTasks.length > 0 && completedMandatory === mandatoryTasks.length;

                  return (
                    <tr key={c.id}>
                      <td>
                        <strong>{c.firstName} {c.lastName}</strong>
                        {c.convertedEmployee && (
                          <div style={{ fontSize: '11px', color: '#059669', marginTop: '2px' }}>
                            Code: {c.convertedEmployee.employeeCode}
                          </div>
                        )}
                      </td>
                      <td>
                        <div>{c.personalEmail}</div>
                        <div style={{ fontSize: '11px', color: '#64748b' }}>{c.phone || 'No phone'}</div>
                      </td>
                      <td>
                        <div>{c.designation?.name}</div>
                        <div style={{ fontSize: '11px', color: '#64748b' }}>{c.department?.name}</div>
                      </td>
                      <td>{c.proposedJoiningDate ? c.proposedJoiningDate.split('T')[0] : '—'}</td>
                      <td>
                        {c.offeredCtc ? `₹${Number(c.offeredCtc).toLocaleString('en-IN')}` : '—'}
                      </td>
                      <td>
                        <span className={`badge ${getStatusBadgeClass(c.status)}`}>{c.status}</span>
                      </td>
                      <td>
                        <div style={{ fontSize: '11px' }}>
                          <span style={{ fontWeight: 600, color: allDone ? '#059669' : '#d97706' }}>
                            {completedMandatory}/{mandatoryTasks.length} mandatory
                          </span>
                        </div>
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: '6px' }}>
                          <button
                            type="button"
                            className="btn btn-secondary"
                            style={{ padding: '4px 8px', fontSize: '11px' }}
                            onClick={() => handleOpenDetails(c.id)}
                          >
                            📋 Checklist
                          </button>

                          {c.status !== 'CONVERTED' && (
                            <>
                              <button
                                type="button"
                                className="btn btn-secondary"
                                style={{ padding: '4px 8px', fontSize: '11px' }}
                                onClick={() => handleOpenPreboarding(c)}
                              >
                                📝 Form
                              </button>
                              <button
                                type="button"
                                className="btn btn-primary"
                                style={{ padding: '4px 8px', fontSize: '11px', background: allDone ? '#059669' : '#2563eb' }}
                                onClick={() => handleConvert(c)}
                                disabled={submitting}
                              >
                                ⚡ Convert
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Invite Candidate Modal */}
      {showInviteModal && (
        <Modal onClose={() => setShowInviteModal(false)}>
          <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(4px)',
            display: 'flex', justifyContent: 'center', alignItems: 'center',
            zIndex: 1000, padding: '20px', boxSizing: 'border-box',
          }}>
            <div className="card" style={{ width: '560px', maxWidth: '100%', maxHeight: '90vh', overflowY: 'auto' }}>

              <h3 style={{ marginBottom: '16px' }}>Invite Candidate for Onboarding</h3>
              <form onSubmit={handleInviteSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <div>
                    <label style={{ fontSize: '12px', fontWeight: 600 }}>First Name *</label>
                    <input
                      type="text"
                      required
                      value={inviteForm.firstName}
                      onChange={(e) => setInviteForm({ ...inviteForm, firstName: e.target.value })}
                      style={{ width: '100%', padding: '8px', border: '1px solid #cbd5e1', borderRadius: '4px' }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '12px', fontWeight: 600 }}>Last Name *</label>
                    <input
                      type="text"
                      required
                      value={inviteForm.lastName}
                      onChange={(e) => setInviteForm({ ...inviteForm, lastName: e.target.value })}
                      style={{ width: '100%', padding: '8px', border: '1px solid #cbd5e1', borderRadius: '4px' }}
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <div>
                    <label style={{ fontSize: '12px', fontWeight: 600 }}>Personal Email *</label>
                    <input
                      type="email"
                      required
                      value={inviteForm.personalEmail}
                      onChange={(e) => setInviteForm({ ...inviteForm, personalEmail: e.target.value })}
                      style={{ width: '100%', padding: '8px', border: '1px solid #cbd5e1', borderRadius: '4px' }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '12px', fontWeight: 600 }}>Phone Number</label>
                    <input
                      type="text"
                      value={inviteForm.phone}
                      onChange={(e) => setInviteForm({ ...inviteForm, phone: e.target.value })}
                      style={{ width: '100%', padding: '8px', border: '1px solid #cbd5e1', borderRadius: '4px' }}
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <div>
                    <label style={{ fontSize: '12px', fontWeight: 600 }}>Target Department *</label>
                    <select
                      value={inviteForm.departmentId}
                      onChange={(e) => setInviteForm({ ...inviteForm, departmentId: e.target.value })}
                      style={{ width: '100%', padding: '8px', border: '1px solid #cbd5e1', borderRadius: '4px' }}
                    >
                      {departments.map((d) => (
                        <option key={d.id} value={d.id}>{d.name} ({d.codePrefix})</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label style={{ fontSize: '12px', fontWeight: 600 }}>Target Designation *</label>
                    <select
                      value={inviteForm.designationId}
                      onChange={(e) => setInviteForm({ ...inviteForm, designationId: e.target.value })}
                      style={{ width: '100%', padding: '8px', border: '1px solid #cbd5e1', borderRadius: '4px' }}
                    >
                      {designations.map((des) => (
                        <option key={des.id} value={des.id}>{des.name}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <div>
                    <label style={{ fontSize: '12px', fontWeight: 600 }}>Grade (Optional)</label>
                    <select
                      value={inviteForm.gradeId}
                      onChange={(e) => setInviteForm({ ...inviteForm, gradeId: e.target.value })}
                      style={{ width: '100%', padding: '8px', border: '1px solid #cbd5e1', borderRadius: '4px' }}
                    >
                      <option value="">No Grade</option>
                      {grades.map((g) => (
                        <option key={g.id} value={g.id}>{g.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label style={{ fontSize: '12px', fontWeight: 600 }}>Location (Optional)</label>
                    <select
                      value={inviteForm.locationId}
                      onChange={(e) => setInviteForm({ ...inviteForm, locationId: e.target.value })}
                      style={{ width: '100%', padding: '8px', border: '1px solid #cbd5e1', borderRadius: '4px' }}
                    >
                      <option value="">No Location</option>
                      {locations.map((loc) => (
                        <option key={loc.id} value={loc.id}>{loc.name}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <div>
                    <label style={{ fontSize: '12px', fontWeight: 600 }}>Proposed Joining Date *</label>
                    <input
                      type="date"
                      required
                      value={inviteForm.proposedJoiningDate}
                      onChange={(e) => setInviteForm({ ...inviteForm, proposedJoiningDate: e.target.value })}
                      style={{ width: '100%', padding: '8px', border: '1px solid #cbd5e1', borderRadius: '4px' }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '12px', fontWeight: 600 }}>Offered Annual CTC (₹)</label>
                    <input
                      type="number"
                      value={inviteForm.offeredCtc}
                      onChange={(e) => setInviteForm({ ...inviteForm, offeredCtc: e.target.value })}
                      placeholder="e.g. 600000"
                      style={{ width: '100%', padding: '8px', border: '1px solid #cbd5e1', borderRadius: '4px' }}
                    />
                  </div>
                </div>

                <div>
                  <label style={{ fontSize: '12px', fontWeight: 600 }}>Reporting Manager</label>
                  <select
                    value={inviteForm.reportingManagerId}
                    onChange={(e) => setInviteForm({ ...inviteForm, reportingManagerId: e.target.value })}
                    style={{ width: '100%', padding: '8px', border: '1px solid #cbd5e1', borderRadius: '4px' }}
                  >
                    <option value="">None / Self-Managed</option>
                    {managers.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.employeeCode} — {m.firstName} {m.lastName}
                      </option>
                    ))}
                  </select>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '12px' }}>
                  <button type="button" className="btn btn-secondary" onClick={() => setShowInviteModal(false)}>
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-primary" disabled={submitting}>
                    {submitting ? 'Sending Invitation...' : 'Send Onboarding Invitation'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </Modal>
      )}


      {/* Candidate Details & Checklist Inspector Modal */}
      {showDetailsModal && selectedCandidate && (
        <Modal onClose={() => setShowDetailsModal(false)}>
          <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(4px)',
            display: 'flex', justifyContent: 'center', alignItems: 'center',
            zIndex: 1000, padding: '20px', boxSizing: 'border-box',
          }}>
            <div className="card" style={{ width: '640px', maxWidth: '100%', maxHeight: '90vh', overflowY: 'auto' }}>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
              <div>
                <h3 style={{ margin: 0 }}>{selectedCandidate.firstName} {selectedCandidate.lastName}</h3>
                <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>
                  {selectedCandidate.personalEmail} • {selectedCandidate.designation?.name} ({selectedCandidate.department?.name})
                </div>
              </div>
              <span className={`badge ${getStatusBadgeClass(selectedCandidate.status)}`}>
                {selectedCandidate.status}
              </span>
            </div>

            {/* Candidate Pre-boarding Data Overview */}
            <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '6px', fontSize: '12px', marginBottom: '16px', lineHeight: 1.6 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                <div><strong>Joining Date:</strong> {selectedCandidate.proposedJoiningDate?.split('T')[0]}</div>
                <div><strong>Offered CTC:</strong> ₹{Number(selectedCandidate.offeredCtc || 0).toLocaleString('en-IN')}</div>
                <div><strong>Bank Name:</strong> {selectedCandidate.bankName || 'Not submitted'}</div>
                <div><strong>Account No:</strong> {selectedCandidate.accountNumber || 'Not submitted'}</div>
                <div><strong>PAN Number:</strong> {selectedCandidate.panNumber || 'Not submitted'}</div>
                <div><strong>UAN Number:</strong> {selectedCandidate.uanNumber || 'Not submitted'}</div>
              </div>
            </div>

            {/* Checklist Tasks */}
            <h4 style={{ fontSize: '14px', fontWeight: 600, marginBottom: '10px' }}>
              Verification Checklist Tasks
            </h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '20px' }}>
              {selectedCandidate.tasks?.map((task: any) => (
                <div
                  key={task.id}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '10px 12px',
                    border: '1px solid #e2e8f0',
                    borderRadius: '6px',
                    background: task.status === 'COMPLETED' ? '#f0fdf4' : 'white',
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ fontSize: '13px', fontWeight: 600 }}>{task.title}</span>
                      {task.isMandatory && (
                        <span style={{ fontSize: '10px', color: '#dc2626', fontWeight: 700 }}>[MANDATORY]</span>
                      )}
                    </div>
                    {task.description && (
                      <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>
                        {task.description}
                      </div>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => handleToggleTask(task)}
                    style={{
                      padding: '4px 10px',
                      borderRadius: '4px',
                      border: '1px solid #cbd5e1',
                      fontSize: '11px',
                      cursor: 'pointer',
                      fontWeight: 600,
                      background: task.status === 'COMPLETED' ? '#22c55e' : '#f1f5f9',
                      color: task.status === 'COMPLETED' ? 'white' : '#475569',
                    }}
                  >
                    {task.status === 'COMPLETED' ? '✓ Completed' : 'Mark Done'}
                  </button>
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #e2e8f0', paddingTop: '16px' }}>
              <button type="button" className="btn btn-secondary" onClick={() => setShowDetailsModal(false)}>
                Close
              </button>

              {selectedCandidate.status !== 'CONVERTED' && (
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => handleConvert(selectedCandidate)}
                  disabled={submitting}
                >
                  {submitting ? 'Converting...' : '⚡ Complete Onboarding & Convert to Employee'}
                </button>
              )}
            </div>
          </div>
          </div>
        </Modal>
      )}

      {/* Pre-Boarding Form Modal */}
      {showPreboardingModal && selectedCandidate && (
        <Modal onClose={() => setShowPreboardingModal(false)}>
          <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(4px)',
            display: 'flex', justifyContent: 'center', alignItems: 'center',
            zIndex: 1000, padding: '20px', boxSizing: 'border-box',
          }}>
            <div className="card" style={{ width: '580px', maxWidth: '100%', maxHeight: '90vh', overflowY: 'auto' }}>

            <h3 style={{ marginBottom: '16px' }}>Pre-Boarding Submission Form</h3>
            <p style={{ fontSize: '12px', color: '#64748b', marginTop: '-10px', marginBottom: '16px' }}>
              Candidate: <strong>{selectedCandidate.firstName} {selectedCandidate.lastName}</strong> ({selectedCandidate.personalEmail})
            </p>
            <form onSubmit={handlePreboardSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 600 }}>Phone Number</label>
                  <input
                    type="text"
                    value={preboardForm.phone}
                    onChange={(e) => setPreboardForm({ ...preboardForm, phone: e.target.value })}
                    style={{ width: '100%', padding: '8px', border: '1px solid #cbd5e1', borderRadius: '4px' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 600 }}>Date of Birth</label>
                  <input
                    type="date"
                    value={preboardForm.dateOfBirth}
                    onChange={(e) => setPreboardForm({ ...preboardForm, dateOfBirth: e.target.value })}
                    style={{ width: '100%', padding: '8px', border: '1px solid #cbd5e1', borderRadius: '4px' }}
                  />
                </div>
              </div>

              <div>
                <label style={{ fontSize: '12px', fontWeight: 600 }}>Current Residential Address</label>
                <input
                  type="text"
                  value={preboardForm.currentAddress}
                  onChange={(e) => setPreboardForm({ ...preboardForm, currentAddress: e.target.value })}
                  placeholder="Street, City, Postal Code"
                  style={{ width: '100%', padding: '8px', border: '1px solid #cbd5e1', borderRadius: '4px' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 600 }}>Emergency Contact Name</label>
                  <input
                    type="text"
                    value={preboardForm.emergencyContactName}
                    onChange={(e) => setPreboardForm({ ...preboardForm, emergencyContactName: e.target.value })}
                    style={{ width: '100%', padding: '8px', border: '1px solid #cbd5e1', borderRadius: '4px' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 600 }}>Emergency Contact Phone</label>
                  <input
                    type="text"
                    value={preboardForm.emergencyContactPhone}
                    onChange={(e) => setPreboardForm({ ...preboardForm, emergencyContactPhone: e.target.value })}
                    style={{ width: '100%', padding: '8px', border: '1px solid #cbd5e1', borderRadius: '4px' }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 600 }}>Bank Name</label>
                  <input
                    type="text"
                    value={preboardForm.bankName}
                    onChange={(e) => setPreboardForm({ ...preboardForm, bankName: e.target.value })}
                    style={{ width: '100%', padding: '8px', border: '1px solid #cbd5e1', borderRadius: '4px' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 600 }}>Account Number</label>
                  <input
                    type="text"
                    value={preboardForm.accountNumber}
                    onChange={(e) => setPreboardForm({ ...preboardForm, accountNumber: e.target.value })}
                    style={{ width: '100%', padding: '8px', border: '1px solid #cbd5e1', borderRadius: '4px' }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 600 }}>IFSC / Bank Branch Code</label>
                  <input
                    type="text"
                    value={preboardForm.ifscOrRouting}
                    onChange={(e) => setPreboardForm({ ...preboardForm, ifscOrRouting: e.target.value })}
                    placeholder="e.g. HDFC0001234"
                    style={{ width: '100%', padding: '8px', border: '1px solid #cbd5e1', borderRadius: '4px' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 600 }}>PAN Number</label>
                  <input
                    type="text"
                    value={preboardForm.panNumber}
                    onChange={(e) => setPreboardForm({ ...preboardForm, panNumber: e.target.value })}
                    placeholder="e.g. ABCDE1234F"
                    style={{ width: '100%', padding: '8px', border: '1px solid #cbd5e1', borderRadius: '4px' }}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '12px' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowPreboardingModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={submitting}>
                  {submitting ? 'Saving...' : 'Save Pre-Boarding Details'}
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
