import React, { useEffect, useState } from 'react';
import { api } from '../api';
import { Modal } from './Modal';
import { Icons } from './Icons';

const DOCUMENT_TYPE_LABELS: Record<string, { label: string; badgeClass: string }> = {
  OFFER_LETTER: { label: 'Offer / Appointment Letter', badgeClass: 'badge-role' },
  EXPERIENCE_LETTER: { label: 'Experience / Relieving Letter', badgeClass: 'badge-role' },
  ID_PROOF: { label: 'Identity Proof', badgeClass: 'badge-active' },
  EDUCATION_CERTIFICATE: { label: 'Education / Degree', badgeClass: 'badge-role' },
  RESUME: { label: 'Resume / CV', badgeClass: 'badge-role' },
  OTHER: { label: 'Other Document', badgeClass: 'badge-inactive' },
};

function formatFileSize(bytes?: number | null): string {
  if (!bytes) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

interface Props {
  employeeId: string;
  onBack: () => void;
}

export const EmployeeProfileView: React.FC<Props> = ({ employeeId, onBack }) => {
  const [employee, setEmployee] = useState<any>(null);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [designations, setDesignations] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [allEmployees, setAllEmployees] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Position change modal state
  const [showEditPositionModal, setShowEditPositionModal] = useState(false);
  const [newDesignationId, setNewDesignationId] = useState('');
  const [newDepartmentId, setNewDepartmentId] = useState('');
  const [newReportingManagerId, setNewReportingManagerId] = useState('');
  const [changeReason, setChangeReason] = useState('');
  const [updatingPosition, setUpdatingPosition] = useState(false);
  const [positionSuccessMsg, setPositionSuccessMsg] = useState('');
  const [positionErrorMsg, setPositionErrorMsg] = useState('');

  // Termination modal state
  const [showTerminateModal, setShowTerminateModal] = useState(false);
  const [noticePeriodDays, setNoticePeriodDays] = useState<number>(30);
  const [terminationReason, setTerminationReason] = useState('');
  const [terminating, setTerminating] = useState(false);
  const [terminateError, setTerminateError] = useState('');
  const [terminateSuccess, setTerminateSuccess] = useState('');

  // Document management state
  const [documents, setDocuments] = useState<any[]>([]);
  const [loadingDocs, setLoadingDocs] = useState(false);
  const [showUploadDocModal, setShowUploadDocModal] = useState(false);
  const [uploadDocType, setUploadDocType] = useState('OFFER_LETTER');
  const [uploadDocName, setUploadDocName] = useState('');
  const [uploadDocFile, setUploadDocFile] = useState<File | null>(null);
  const [uploadDocBase64, setUploadDocBase64] = useState('');
  const [uploadingDoc, setUploadingDoc] = useState(false);
  const [uploadDocError, setUploadDocError] = useState('');
  const [previewDoc, setPreviewDoc] = useState<any | null>(null);

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

  const loadDocuments = async () => {
    try {
      setLoadingDocs(true);
      const docs = await api.getEmployeeDocuments(employeeId);
      setDocuments(docs || []);
    } catch {
      // ignore
    } finally {
      setLoadingDocs(false);
    }
  };

  const handleDocFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      setUploadDocError('File size exceeds 10 MB limit.');
      return;
    }
    setUploadDocFile(file);
    setUploadDocError('');
    if (!uploadDocName) {
      setUploadDocName(file.name.replace(/\.[^/.]+$/, ''));
    }
    const reader = new FileReader();
    reader.onload = () => {
      setUploadDocBase64(reader.result as string);
    };
    reader.onerror = () => {
      setUploadDocError('Failed to read file.');
    };
    reader.readAsDataURL(file);
  };

  const handleUploadDocSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadDocFile || !uploadDocBase64) {
      setUploadDocError('Please select a file to upload');
      return;
    }
    try {
      setUploadingDoc(true);
      setUploadDocError('');
      await api.uploadEmployeeDocument(employeeId, {
        documentType: uploadDocType,
        fileName: uploadDocName.trim() || uploadDocFile.name,
        fileUrl: uploadDocBase64,
        fileSize: uploadDocFile.size,
      });
      setShowUploadDocModal(false);
      setUploadDocFile(null);
      setUploadDocBase64('');
      setUploadDocName('');
      await loadDocuments();
    } catch (err: any) {
      setUploadDocError(err?.message || 'Failed to upload document');
    } finally {
      setUploadingDoc(false);
    }
  };

  const handleDeleteDoc = async (docId: string, docName: string) => {
    if (!confirm(`Delete "${docName}"?`)) return;
    try {
      await api.deleteEmployeeDocument(employeeId, docId);
      await loadDocuments();
    } catch (err: any) {
      alert(err?.message || 'Failed to delete document');
    }
  };

  const downloadDoc = (doc: any) => {
    if (doc.fileUrl.startsWith('data:')) {
      const a = document.createElement('a');
      a.href = doc.fileUrl;
      a.download = doc.fileName || 'document';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } else {
      window.open(doc.fileUrl, '_blank');
    }
  };

  const loadProfile = async () => {
    setLoading(true);
    setError('');
    try {
      const [empData, meData, desigData, deptData, empsData, docsData] = await Promise.all([
        api.getEmployeeById(employeeId),
        api.getMe().catch(() => null),
        api.getDesignations().catch(() => []),
        api.getDepartments().catch(() => []),
        api.getEmployees().catch(() => ({ data: [] })),
        api.getEmployeeDocuments(employeeId).catch(() => []),
      ]);
      setEmployee(empData);
      setCurrentUser(meData);
      setDesignations(desigData || []);
      setDepartments(deptData || []);
      setAllEmployees(empsData?.data || []);
      setDocuments(docsData || []);
    } catch (err: any) {
      setError(err?.message || 'Failed to load employee details');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProfile();
  }, [employeeId]);

  const openEditPositionModal = () => {
    if (!employee) return;
    setNewDesignationId(employee.designationId || employee.designation?.id || '');
    setNewDepartmentId(employee.departmentId || employee.department?.id || '');
    setNewReportingManagerId(employee.reportingManagerId || employee.reportingManager?.id || '');
    setChangeReason('');
    setPositionSuccessMsg('');
    setPositionErrorMsg('');
    setShowEditPositionModal(true);
  };

  const handleSavePosition = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDesignationId) {
      setPositionErrorMsg('Please select a designation/position');
      return;
    }
    setUpdatingPosition(true);
    setPositionSuccessMsg('');
    setPositionErrorMsg('');
    try {
      await api.updateEmployee(employee.id, {
        designationId: newDesignationId,
        departmentId: newDepartmentId || undefined,
        reportingManagerId: newReportingManagerId ? newReportingManagerId : null,
        changeReason: changeReason.trim() || 'Designation / Position Update',
      });
      // Refresh employee profile
      const updated = await api.getEmployeeById(employee.id);
      setEmployee(updated);
      setPositionSuccessMsg('Designation & position updated successfully!');
      setTimeout(() => {
        setShowEditPositionModal(false);
        setPositionSuccessMsg('');
      }, 1200);
    } catch (err: any) {
      setPositionErrorMsg(err?.message || 'Failed to update position');
    } finally {
      setUpdatingPosition(false);
    }
  };

  const canEditPosition =
    !currentUser ||
    currentUser.role === 'CLIENT_SUPER_ADMIN' ||
    currentUser.role === 'HR_ADMIN';

  const canTerminate =
    (currentUser?.role === 'CLIENT_SUPER_ADMIN' || currentUser?.role === 'HR_ADMIN') &&
    employee?.employmentStatus !== 'TERMINATED' &&
    currentUser?.employeeId !== employee?.id;

  const handleTerminateEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!employee) return;
    setTerminating(true);
    setTerminateError('');
    try {
      const days = Number(noticePeriodDays);
      await api.terminateEmployee(employee.id, {
        noticePeriodDays: days,
        reason: terminationReason.trim(),
      });
      setTerminateSuccess(
        days > 0
          ? `Termination notice issued for ${employee.firstName} ${employee.lastName}. Notice period: ${days} days (Effective: ${calculateEffectiveExitDate(days)}). Notification delivered to employee.`
          : `Employee ${employee.firstName} ${employee.lastName} (${employee.employeeCode}) has been immediately terminated.`,
      );
      setShowTerminateModal(false);
      await loadProfile();
      setTimeout(() => setTerminateSuccess(''), 6000);
    } catch (err: any) {
      setTerminateError(err?.message || 'Failed to issue termination notice');
    } finally {
      setTerminating(false);
    }
  };

  if (loading) {
    return (
      <div className="card">
        <p style={{ color: '#64748b', padding: '24px 0', textAlign: 'center' }}>Loading profile...</p>
      </div>
    );
  }

  if (error || !employee) {
    return (
      <div className="card">
        <div className="alert-error">{error || 'Employee not found'}</div>
        <button className="btn btn-secondary" onClick={onBack} style={{ marginTop: '12px' }}>
          &larr; Back to Directory
        </button>
      </div>
    );
  }

  // Filter manager options to exclude the employee themselves
  const managerCandidates = allEmployees.filter((emp) => emp.id !== employee.id);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {terminateSuccess && (
        <div className="alert-success" style={{ margin: 0 }}>
          {terminateSuccess}
        </div>
      )}

      {/* Active Notice Period Banner */}
      {employee.employmentStatus === 'NOTICE_PERIOD' && (
        <div
          style={{
            background: 'linear-gradient(135deg, #fffbeb, #fef3c7)',
            border: '1px solid #fde68a',
            borderRadius: '10px',
            padding: '16px 20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '14px',
            boxShadow: '0 2px 4px rgba(0,0,0,0.03)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div style={{ fontSize: '30px' }}>⏳</div>
            <div>
              <div style={{ fontWeight: 800, color: '#92400e', fontSize: '15px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                Employee Under Active Termination Notice Period
                <span style={{ fontSize: '11px', background: '#f59e0b', color: '#ffffff', padding: '2px 8px', borderRadius: '12px' }}>
                  Action Pending Exit
                </span>
              </div>
              <div style={{ fontSize: '13px', color: '#b45309', marginTop: '3px' }}>
                Scheduled Last Working Day:{' '}
                <strong>
                  {employee.dateOfExit
                    ? new Date(employee.dateOfExit).toLocaleDateString('en-US', {
                        weekday: 'short',
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                      })
                    : 'Scheduled'}
                </strong>
                . Platform login credentials remain active during this notice period.
              </div>
            </div>
          </div>
          {canTerminate && (
            <button
              type="button"
              className="btn btn-danger"
              style={{ fontSize: '12px', padding: '7px 14px' }}
              onClick={() => {
                setNoticePeriodDays(0);
                setTerminationReason('Early departure / Finalize immediate termination');
                setTerminateError('');
                setShowTerminateModal(true);
              }}
            >
              Complete Immediate Exit Now
            </button>
          )}
        </div>
      )}

      {/* Top Profile Card */}
      <div className="card" style={{ border: '1px solid #e2e8f0' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div
              style={{
                width: '64px',
                height: '64px',
                borderRadius: '50%',
                background: 'linear-gradient(135deg, #2563eb, #1d4ed8)',
                color: '#ffffff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '22px',
                fontWeight: 700,
                boxShadow: '0 4px 6px -1px rgba(37, 99, 235, 0.3)',
              }}
            >
              {employee.firstName?.[0]}
              {employee.lastName?.[0]}
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <h2 style={{ fontSize: '22px', fontWeight: 800, margin: 0, color: '#0f172a' }}>
                  {employee.firstName} {employee.lastName}
                </h2>
                <span className="badge badge-role" style={{ fontSize: '12px' }}>
                  {employee.employeeCode}
                </span>
                <span
                  className="badge"
                  style={{
                    fontSize: '11px',
                    background:
                      employee.employmentStatus === 'TERMINATED'
                        ? '#fee2e2'
                        : employee.employmentStatus === 'NOTICE_PERIOD'
                        ? '#fef3c7'
                        : '#dcfce7',
                    color:
                      employee.employmentStatus === 'TERMINATED'
                        ? '#b91c1c'
                        : employee.employmentStatus === 'NOTICE_PERIOD'
                        ? '#b45309'
                        : '#15803d',
                    border:
                      employee.employmentStatus === 'TERMINATED'
                        ? '1px solid #fca5a5'
                        : employee.employmentStatus === 'NOTICE_PERIOD'
                        ? '1px solid #fde68a'
                        : '1px solid #bbf7d0',
                  }}
                >
                  {employee.employmentStatus === 'TERMINATED'
                    ? 'TERMINATED'
                    : employee.employmentStatus === 'NOTICE_PERIOD'
                    ? '⏳ NOTICE PERIOD'
                    : employee.employmentStatus}
                </span>
                {employee.user?.role && (
                  <span
                    style={{
                      background: '#f1f5f9',
                      color: '#475569',
                      padding: '2px 8px',
                      borderRadius: '4px',
                      fontSize: '11px',
                      fontWeight: 700,
                    }}
                  >
                    Role: {employee.user.role}
                  </span>
                )}
              </div>
              <p style={{ fontSize: '14px', color: '#64748b', marginTop: '4px', margin: '4px 0 0' }}>
                <strong style={{ color: '#2563eb' }}>{employee.designation?.name || 'No Designation'}</strong> &bull; {employee.department?.name || 'No Department'}
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            {canEditPosition && employee.employmentStatus !== 'TERMINATED' && (
              <button
                type="button"
                className="btn btn-primary"
                onClick={openEditPositionModal}
                style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', padding: '8px 14px' }}
              >
                Change Designation / Position
              </button>
            )}
            {canTerminate && (
              <button
                type="button"
                className="btn btn-danger"
                onClick={() => {
                  setNoticePeriodDays(30);
                  setTerminationReason('');
                  setTerminateError('');
                  setShowTerminateModal(true);
                }}
                style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', padding: '8px 14px' }}
              >
                {employee.employmentStatus === 'NOTICE_PERIOD' ? 'Update Notice / Immediate Exit' : 'Issue Termination Notice'}
              </button>
            )}
            <button className="btn btn-secondary" onClick={onBack} style={{ fontSize: '13px', padding: '8px 14px' }}>
              &larr; Back to Directory
            </button>
          </div>
        </div>

        {/* Detailed Attributes Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px', marginTop: '24px' }}>
          {/* Employment & Position Details */}
          <div style={{ background: '#f8fafc', padding: '20px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
              <h3 style={{ fontSize: '14px', fontWeight: 700, color: '#0f172a', textTransform: 'uppercase', letterSpacing: '0.05em', margin: 0 }}>
                Position & Employment Details
              </h3>
              {canEditPosition && (
                <button
                  type="button"
                  onClick={openEditPositionModal}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: '#2563eb',
                    fontSize: '12px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    textDecoration: 'underline',
                  }}
                >
                  Edit Position
                </button>
              )}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '13px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #e2e8f0', paddingBottom: '6px' }}>
                <span style={{ color: '#64748b' }}>Designation / Title:</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <strong style={{ color: '#0f172a', fontSize: '14px' }}>{employee.designation?.name || '—'}</strong>
                  {canEditPosition && (
                    <button
                      type="button"
                      onClick={openEditPositionModal}
                      style={{
                        background: '#eff6ff',
                        color: '#2563eb',
                        border: '1px solid #bfdbfe',
                        borderRadius: '4px',
                        padding: '1px 6px',
                        fontSize: '11px',
                        cursor: 'pointer',
                        fontWeight: 600,
                      }}
                    >
                      Change
                    </button>
                  )}
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #e2e8f0', paddingBottom: '6px' }}>
                <span style={{ color: '#64748b' }}>Department:</span>
                <strong style={{ color: '#0f172a' }}>
                  {employee.department?.name} ({employee.department?.codePrefix})
                </strong>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #e2e8f0', paddingBottom: '6px' }}>
                <span style={{ color: '#64748b' }}>Reporting Manager:</span>
                <strong style={{ color: '#0f172a' }}>
                  {employee.reportingManager
                    ? `${employee.reportingManager.firstName} ${employee.reportingManager.lastName} (${employee.reportingManager.employeeCode})`
                    : 'None (Direct / Head)'}
                </strong>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #e2e8f0', paddingBottom: '6px' }}>
                <span style={{ color: '#64748b' }}>Employment Status:</span>
                <span className="badge badge-active">{employee.employmentStatus}</span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #e2e8f0', paddingBottom: '6px' }}>
                <span style={{ color: '#64748b' }}>Employment Type:</span>
                <strong style={{ color: '#0f172a' }}>{employee.employmentType}</strong>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#64748b' }}>Date of Joining:</span>
                <strong style={{ color: '#0f172a' }}>
                  {employee.dateOfJoining ? new Date(employee.dateOfJoining).toLocaleDateString() : '—'}
                </strong>
              </div>
            </div>
          </div>

          {/* Personal & Contact Details */}
          <div style={{ background: '#f8fafc', padding: '20px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
            <h3 style={{ fontSize: '14px', fontWeight: 700, color: '#0f172a', marginBottom: '16px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Personal & Contact Details
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '13px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #e2e8f0', paddingBottom: '6px' }}>
                <span style={{ color: '#64748b' }}>Personal Email:</span>
                <strong style={{ color: '#0f172a' }}>{employee.personalEmail || '—'}</strong>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #e2e8f0', paddingBottom: '6px' }}>
                <span style={{ color: '#64748b' }}>Phone Number:</span>
                <strong style={{ color: '#0f172a' }}>{employee.phone || '—'}</strong>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #e2e8f0', paddingBottom: '6px' }}>
                <span style={{ color: '#64748b' }}>Current Address:</span>
                <strong style={{ color: '#0f172a', textAlign: 'right', maxWidth: '60%' }}>
                  {employee.currentAddress || '—'}
                </strong>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#64748b' }}>Emergency Contact:</span>
                <strong style={{ color: '#0f172a' }}>
                  {employee.emergencyContactName
                    ? `${employee.emergencyContactName} (${employee.emergencyContactPhone || 'No phone'})`
                    : '—'}
                </strong>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* EMPLOYEE DOCUMENTS & OFFICIAL RECORDS */}
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '14px', marginBottom: '16px' }}>
          <div>
            <h3 style={{ fontSize: '16px', fontWeight: 700, margin: 0, color: '#0f172a' }}>
              Employee Documents & Official Records ({documents.length})
            </h3>
            <p style={{ fontSize: '12px', color: '#64748b', margin: '2px 0 0' }}>
              Offer letters, appointment letters, identity cards, educational certificates, and employee uploads.
            </p>
          </div>

          <button
            type="button"
            className="btn btn-primary"
            onClick={() => {
              setUploadDocError('');
              setUploadDocFile(null);
              setUploadDocBase64('');
              setUploadDocName('');
              setShowUploadDocModal(true);
            }}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', padding: '8px 16px' }}
          >
            <Icons.Upload size={15} color="#ffffff" />
            <span>Upload Document</span>
          </button>
        </div>

        {loadingDocs ? (
          <div style={{ textAlign: 'center', padding: '24px', color: '#64748b', fontSize: '13px' }}>
            Loading documents...
          </div>
        ) : documents.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '30px', background: '#f8fafc', borderRadius: '8px', border: '1px dashed #cbd5e1' }}>
            <p style={{ color: '#64748b', margin: '0 0 12px', fontSize: '13px' }}>No documents uploaded for this employee yet.</p>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => {
                setUploadDocError('');
                setShowUploadDocModal(true);
              }}
              style={{ fontSize: '12px' }}
            >
              + Upload Offer Letter or Document
            </button>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(290px, 1fr))', gap: '12px' }}>
            {documents.map((doc) => {
              const meta = DOCUMENT_TYPE_LABELS[doc.documentType] || DOCUMENT_TYPE_LABELS.OTHER;
              return (
                <div
                  key={doc.id}
                  style={{
                    background: '#ffffff',
                    border: '1px solid #e2e8f0',
                    borderRadius: '8px',
                    padding: '14px',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    gap: '12px',
                    boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.05)',
                  }}
                >
                  <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                    <div style={{ padding: '8px', background: '#eff6ff', borderRadius: '6px', color: '#2563eb' }}>
                      <Icons.FileText size={18} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '13px', fontWeight: 700, color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {doc.fileName}
                      </div>
                      <div style={{ display: 'flex', gap: '6px', alignItems: 'center', marginTop: '4px' }}>
                        <span className={`badge ${meta.badgeClass}`} style={{ fontSize: '10px' }}>
                          {meta.label}
                        </span>
                        <span style={{ fontSize: '11px', color: '#94a3b8' }}>
                          • {formatFileSize(doc.fileSize)}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '6px', borderTop: '1px solid #f1f5f9', paddingTop: '8px' }}>
                    <button
                      type="button"
                      onClick={() => setPreviewDoc(doc)}
                      className="btn btn-secondary"
                      style={{ padding: '4px 8px', fontSize: '11px' }}
                    >
                      Preview
                    </button>
                    <button
                      type="button"
                      onClick={() => downloadDoc(doc)}
                      className="btn btn-primary"
                      style={{ padding: '4px 8px', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '4px' }}
                    >
                      <Icons.Download size={12} color="#ffffff" />
                      <span>Download</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteDoc(doc.id, doc.fileName)}
                      style={{ padding: '4px 6px', background: '#fef2f2', border: '1px solid #fecaca', color: '#dc2626', borderRadius: '4px', cursor: 'pointer' }}
                      title="Delete Document"
                    >
                      <Icons.Trash size={12} color="#dc2626" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* EDIT POSITION & DESIGNATION MODAL */}
      {showEditPositionModal && (
        <Modal onClose={() => setShowEditPositionModal(false)}>
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
            onClick={() => setShowEditPositionModal(false)}
          >

          <div
            className="modal-dialog-smooth"
            style={{
              background: '#ffffff',
              borderRadius: '12px',
              width: '100%',
              maxWidth: '560px',
              maxHeight: '90vh',
              display: 'flex',
              flexDirection: 'column',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
              overflow: 'hidden',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div
              style={{
                background: '#0f172a',
                color: '#f8fafc',
                padding: '16px 20px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <div>
                <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 800, color: '#f8fafc' }}>
                  Change Position & Designation
                </h3>
                <p style={{ margin: '2px 0 0', fontSize: '12px', color: '#94a3b8' }}>
                  {employee.firstName} {employee.lastName} ({employee.employeeCode})
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowEditPositionModal(false)}
                style={{
                  background: '#1e293b',
                  color: '#94a3b8',
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

            {/* Modal Form */}
            <form onSubmit={handleSavePosition} style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {positionSuccessMsg && (
                <div style={{ padding: '10px 14px', background: '#ecfdf5', color: '#065f46', border: '1px solid #a7f3d0', borderRadius: '6px', fontSize: '13px', fontWeight: 600 }}>
                  {positionSuccessMsg}
                </div>
              )}
              {positionErrorMsg && (
                <div style={{ padding: '10px 14px', background: '#fef2f2', color: '#991b1b', border: '1px solid #fecaca', borderRadius: '6px', fontSize: '13px' }}>
                  {positionErrorMsg}
                </div>
              )}

              {/* Designation Selector */}
              <div>
                <label style={{ fontSize: '13px', fontWeight: 600, color: '#334155', display: 'block', marginBottom: '4px' }}>
                  Designation / Job Position *
                </label>
                <select
                  required
                  value={newDesignationId}
                  onChange={(e) => setNewDesignationId(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    fontSize: '13px',
                    border: '1px solid #cbd5e1',
                    borderRadius: '6px',
                    background: '#ffffff',
                    fontWeight: 600,
                  }}
                >
                  <option value="">-- Select Designation / Position --</option>
                  {designations.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name} {d.description ? `(${d.description})` : ''}
                    </option>
                  ))}
                </select>
                <span style={{ fontSize: '11px', color: '#64748b', display: 'block', marginTop: '2px' }}>
                  Current: {employee.designation?.name || 'Unassigned'}
                </span>
              </div>

              {/* Department Selector */}
              <div>
                <label style={{ fontSize: '13px', fontWeight: 600, color: '#334155', display: 'block', marginBottom: '4px' }}>
                  Department (Transfer Position)
                </label>
                <select
                  value={newDepartmentId}
                  onChange={(e) => setNewDepartmentId(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    fontSize: '13px',
                    border: '1px solid #cbd5e1',
                    borderRadius: '6px',
                    background: '#ffffff',
                  }}
                >
                  <option value="">-- Select Department --</option>
                  {departments.map((dept) => (
                    <option key={dept.id} value={dept.id}>
                      {dept.name} ({dept.codePrefix})
                    </option>
                  ))}
                </select>
                <span style={{ fontSize: '11px', color: '#64748b', display: 'block', marginTop: '2px' }}>
                  Current: {employee.department?.name}
                </span>
              </div>

              {/* Reporting Manager Selector */}
              <div>
                <label style={{ fontSize: '13px', fontWeight: 600, color: '#334155', display: 'block', marginBottom: '4px' }}>
                  Reporting Manager
                </label>
                <select
                  value={newReportingManagerId}
                  onChange={(e) => setNewReportingManagerId(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    fontSize: '13px',
                    border: '1px solid #cbd5e1',
                    borderRadius: '6px',
                    background: '#ffffff',
                  }}
                >
                  <option value="">-- No Direct Manager (Direct / Head) --</option>
                  {managerCandidates.map((mgr) => (
                    <option key={mgr.id} value={mgr.id}>
                      {mgr.firstName} {mgr.lastName} ({mgr.employeeCode}) {mgr.designation?.name ? `• ${mgr.designation.name}` : ''}
                    </option>
                  ))}
                </select>
              </div>

              {/* Change Reason for Audit Ledger */}
              <div>
                <label style={{ fontSize: '13px', fontWeight: 600, color: '#334155', display: 'block', marginBottom: '4px' }}>
                  Reason for Change / Promotion
                </label>
                <input
                  type="text"
                  placeholder="e.g. Annual Appraisal Promotion to Lead, Organizational Realignment"
                  value={changeReason}
                  onChange={(e) => setChangeReason(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    fontSize: '13px',
                    border: '1px solid #cbd5e1',
                    borderRadius: '6px',
                    boxSizing: 'border-box',
                  }}
                />
                <span style={{ fontSize: '11px', color: '#64748b', display: 'block', marginTop: '2px' }}>
                  Automatically recorded in the immutable employee job history audit ledger.
                </span>
              </div>

              {/* Modal Actions */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '8px' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowEditPositionModal(false)}
                  disabled={updatingPosition}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={updatingPosition}
                >
                  {updatingPosition ? (
                    <>
                      <span className="spinner" /> Saving...
                    </>
                  ) : (
                    'Save Position Update'
                  )}
                </button>
              </div>
            </form>
          </div>
          </div>
        </Modal>
      )}

      {/* TERMINATION MODAL */}
      {showTerminateModal && (
        <Modal onClose={() => setShowTerminateModal(false)}>
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
            onClick={() => setShowTerminateModal(false)}
          >

          <div
            className="modal-dialog-smooth"
            style={{
              background: '#ffffff',
              borderRadius: '12px',
              width: '100%',
              maxWidth: '520px',
              maxHeight: '90vh',
              display: 'flex',
              flexDirection: 'column',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
              overflow: 'hidden',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
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
                  {employee.firstName} {employee.lastName} ({employee.employeeCode}) &bull; {employee.designation?.name || 'Employee'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowTerminateModal(false)}
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

            {/* Modal Form */}
            <form onSubmit={handleTerminateEmployee} style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
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
                    The employee will be placed on <strong>NOTICE_PERIOD</strong>. An official notification will be dispatched informing them of this termination notice, the {noticePeriodDays}-day notice period, and their scheduled last working day. Platform login credentials remain active until their exit date.
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
                  <strong>Immediate Separation (0 Days Notice)</strong>
                  <p style={{ margin: '4px 0 0', fontSize: '12px' }}>
                    This will immediately revoke login credentials, set status to <strong>TERMINATED</strong>, record today as the exit date, and send an immediate separation notification to the employee.
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
                  placeholder="e.g. Involuntary separation due to performance, contract completion, restructuring, or policy violation..."
                  value={terminationReason}
                  onChange={(e) => setTerminationReason(e.target.value)}
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
                  onClick={() => setShowTerminateModal(false)}
                  disabled={terminating}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-danger"
                  disabled={terminating || !terminationReason.trim()}
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

      {/* Upload Document Modal */}
      {showUploadDocModal && (
        <Modal onClose={() => setShowUploadDocModal(false)}>
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
            <div className="card" style={{ width: '480px', maxWidth: '100%', maxHeight: '90vh', overflowY: 'auto' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <h3 style={{ fontSize: '16px', fontWeight: 700, margin: 0 }}>
                  Upload Document for {employee.firstName}
                </h3>
                <button
                  onClick={() => setShowUploadDocModal(false)}
                  style={{ background: 'none', border: 'none', fontSize: '18px', cursor: 'pointer', color: '#64748b' }}
                >
                  ✕
                </button>
              </div>

              {uploadDocError && (
                <div style={{ padding: '10px 12px', background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca', borderRadius: '6px', fontSize: '13px', marginBottom: '14px' }}>
                  {uploadDocError}
                </div>
              )}

              <form onSubmit={handleUploadDocSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 600, color: '#475569', display: 'block', marginBottom: '4px' }}>
                    Document Type *
                  </label>
                  <select
                    value={uploadDocType}
                    onChange={(e) => setUploadDocType(e.target.value)}
                    required
                    style={{ width: '100%', padding: '8px 10px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '13px' }}
                  >
                    <option value="OFFER_LETTER">Offer / Appointment Letter</option>
                    <option value="EXPERIENCE_LETTER">Relieving / Experience Certificate</option>
                    <option value="ID_PROOF">Identity Proof (Aadhaar / PAN / Passport)</option>
                    <option value="EDUCATION_CERTIFICATE">Education / Degree Certificate</option>
                    <option value="RESUME">Resume / Curriculum Vitae</option>
                    <option value="OTHER">Other Official Document</option>
                  </select>
                </div>

                <div>
                  <label style={{ fontSize: '12px', fontWeight: 600, color: '#475569', display: 'block', marginBottom: '4px' }}>
                    Document Title *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Official Offer Letter, Signed Appointment Letter"
                    value={uploadDocName}
                    onChange={(e) => setUploadDocName(e.target.value)}
                    style={{ width: '100%', padding: '8px 10px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '13px', boxSizing: 'border-box' }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: '12px', fontWeight: 600, color: '#475569', display: 'block', marginBottom: '4px' }}>
                    Select File (PDF, PNG, JPG - Max 10MB) *
                  </label>
                  <input
                    type="file"
                    required
                    accept=".pdf,.png,.jpg,.jpeg,.webp,.doc,.docx"
                    onChange={handleDocFileChange}
                    style={{ width: '100%', padding: '8px', border: '1px dashed #cbd5e1', borderRadius: '6px', fontSize: '13px', background: '#f8fafc', boxSizing: 'border-box' }}
                  />
                  {uploadDocFile && (
                    <div style={{ fontSize: '11px', color: '#16a34a', marginTop: '4px', fontWeight: 600 }}>
                      Selected: {uploadDocFile.name} ({formatFileSize(uploadDocFile.size)})
                    </div>
                  )}
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '12px' }}>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => setShowUploadDocModal(false)}
                    disabled={uploadingDoc}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={uploadingDoc || !uploadDocFile}
                    style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                  >
                    <Icons.Upload size={14} color="#ffffff" />
                    <span>{uploadingDoc ? 'Uploading...' : 'Upload Document'}</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        </Modal>
      )}

      {/* Preview Document Modal */}
      {previewDoc && (
        <Modal onClose={() => setPreviewDoc(null)}>
          <div style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.75)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            backdropFilter: 'blur(4px)',
            padding: '20px',
            boxSizing: 'border-box',
          }}>
            <div className="card" style={{ width: '700px', maxWidth: '100%', maxHeight: '90vh', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e2e8f0', paddingBottom: '10px' }}>
                <div>
                  <h3 style={{ fontSize: '15px', fontWeight: 700, margin: 0 }}>
                    {previewDoc.fileName}
                  </h3>
                  <span style={{ fontSize: '11px', color: '#64748b' }}>
                    {DOCUMENT_TYPE_LABELS[previewDoc.documentType]?.label || previewDoc.documentType} • {formatFileSize(previewDoc.fileSize)}
                  </span>
                </div>

                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={() => downloadDoc(previewDoc)}
                    style={{ fontSize: '12px', padding: '6px 12px', display: 'flex', alignItems: 'center', gap: '4px' }}
                  >
                    <Icons.Download size={14} color="#ffffff" />
                    <span>Download</span>
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => setPreviewDoc(null)}
                    style={{ fontSize: '12px', padding: '6px 10px' }}
                  >
                    Close
                  </button>
                </div>
              </div>

              <div style={{ textAlign: 'center', minHeight: '300px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f8fafc', borderRadius: '8px', padding: '10px' }}>
                {previewDoc.fileUrl.startsWith('data:image/') || /\.(png|jpe?g|webp)$/i.test(previewDoc.fileName) ? (
                  <img
                    src={previewDoc.fileUrl}
                    alt={previewDoc.fileName}
                    style={{ maxWidth: '100%', maxHeight: '65vh', objectFit: 'contain', borderRadius: '4px' }}
                  />
                ) : previewDoc.fileUrl.startsWith('data:application/pdf') || previewDoc.fileName.toLowerCase().endsWith('.pdf') ? (
                  <iframe
                    src={previewDoc.fileUrl}
                    title={previewDoc.fileName}
                    style={{ width: '100%', height: '65vh', border: 'none', borderRadius: '4px' }}
                  />
                ) : (
                  <div style={{ padding: '40px', color: '#64748b' }}>
                    <Icons.FileText size={48} color="#94a3b8" />
                    <p style={{ marginTop: '12px', fontSize: '14px', fontWeight: 600 }}>Preview not available for this file type</p>
                    <button
                      type="button"
                      className="btn btn-primary"
                      onClick={() => downloadDoc(previewDoc)}
                      style={{ marginTop: '8px' }}
                    >
                      Download File to View
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );

};
