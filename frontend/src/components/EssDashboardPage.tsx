import React, { useEffect, useState } from 'react';
import { api } from '../api';
import { Modal } from './Modal';
import { Icons } from './Icons';

const DOCUMENT_TYPE_LABELS: Record<string, { label: string; badgeClass: string; color: string }> = {
  OFFER_LETTER: { label: 'Offer / Appointment Letter', badgeClass: 'badge-role', color: '#2563eb' },
  EXPERIENCE_LETTER: { label: 'Experience / Relieving Letter', badgeClass: 'badge-role', color: '#0891b2' },
  ID_PROOF: { label: 'Identity Proof', badgeClass: 'badge-active', color: '#16a34a' },
  EDUCATION_CERTIFICATE: { label: 'Education / Degree', badgeClass: 'badge-role', color: '#7c3aed' },
  RESUME: { label: 'Resume / CV', badgeClass: 'badge-role', color: '#d97706' },
  OTHER: { label: 'Other Document', badgeClass: 'badge-inactive', color: '#64748b' },
};

function formatFileSize(bytes?: number | null): string {
  if (!bytes) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

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
  const [calculationPreview, setCalculationPreview] = useState<any>(null);
  const [calculatingPreview, setCalculatingPreview] = useState(false);

  // Subtabs navigation
  const [essTab, setEssTab] = useState<'overview' | 'documents' | 'payslips'>('overview');

  // Documents management state
  const [documents, setDocuments] = useState<any[]>([]);
  const [loadingDocs, setLoadingDocs] = useState(false);
  const [docFilter, setDocFilter] = useState('ALL');
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadDocType, setUploadDocType] = useState('ID_PROOF');
  const [uploadDocName, setUploadDocName] = useState('');
  const [uploadDocFile, setUploadDocFile] = useState<File | null>(null);
  const [uploadDocBase64, setUploadDocBase64] = useState('');
  const [uploadingDoc, setUploadingDoc] = useState(false);
  const [uploadDocError, setUploadDocError] = useState('');
  const [previewDoc, setPreviewDoc] = useState<any | null>(null);
  const [letterModalType, setLetterModalType] = useState<'APPOINTMENT' | 'OFFER' | null>(null);

  // Payslips list state
  const [allPayslips, setAllPayslips] = useState<any[]>([]);
  const [loadingPayslips, setLoadingPayslips] = useState(false);
  const [payslipYearFilter, setPayslipYearFilter] = useState('ALL');
  const [downloadingPdfId, setDownloadingPdfId] = useState<string | null>(null);

  useEffect(() => {
    if (!showApplyModal || !applyStartDate || !applyEndDate) {
      setCalculationPreview(null);
      return;
    }
    let isCurrent = true;
    setCalculatingPreview(true);
    api.calculateLeaveDays({
      startDate: new Date(applyStartDate).toISOString(),
      endDate: new Date(applyEndDate).toISOString(),
      isHalfDay: applyHalfDay,
    })
      .then((res) => {
        if (isCurrent) setCalculationPreview(res);
      })
      .catch(() => {
        if (isCurrent) setCalculationPreview(null);
      })
      .finally(() => {
        if (isCurrent) setCalculatingPreview(false);
      });
    return () => {
      isCurrent = false;
    };
  }, [showApplyModal, applyStartDate, applyEndDate, applyHalfDay]);

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

  const loadDocuments = async () => {
    try {
      setLoadingDocs(true);
      const docs = await api.getEssDocuments();
      setDocuments(docs || []);
    } catch (err: any) {
      console.error('Failed to load documents:', err);
    } finally {
      setLoadingDocs(false);
    }
  };

  const loadPayslips = async () => {
    try {
      setLoadingPayslips(true);
      const slips = await api.getEssPayslips();
      setAllPayslips(slips || []);
    } catch (err: any) {
      console.error('Failed to load payslips:', err);
    } finally {
      setLoadingPayslips(false);
    }
  };

  useEffect(() => {
    loadDashboard();
    loadDocuments();
    loadPayslips();
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      setUploadDocError('File size exceeds the 10 MB limit. Please select a smaller file.');
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
      setUploadDocError('Failed to read file content.');
    };
    reader.readAsDataURL(file);
  };

  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadDocFile || !uploadDocBase64) {
      setUploadDocError('Please choose a file to upload');
      return;
    }
    try {
      setUploadingDoc(true);
      setUploadDocError('');
      const finalName = uploadDocName.trim() || uploadDocFile.name;
      await api.uploadEssDocument({
        documentType: uploadDocType,
        fileName: finalName,
        fileUrl: uploadDocBase64,
        fileSize: uploadDocFile.size,
      });
      setShowUploadModal(false);
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

  const handleDeleteDocument = async (docId: string, docName: string) => {
    if (!confirm(`Are you sure you want to delete "${docName}"?`)) return;
    try {
      await api.deleteEssDocument(docId);
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

  const handleDownloadPayslip = async (payslipId: string, month: number, year: number) => {
    try {
      setDownloadingPdfId(payslipId);
      await api.downloadPayslipPdf(payslipId, `Payslip-${month}-${year}.pdf`);
    } catch (err: any) {
      alert(err?.message || 'Failed to download payslip PDF');
    } finally {
      setDownloadingPdfId(null);
    }
  };

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

  const { profile, shift, todayAttendance, leaveBalances, recentLeaveRequests, latestPayslip, managerOverview, upcomingHolidays } = data;

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
              Welcome back, {profile.firstName} {profile.lastName}
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
            Edit My Contact Info
          </button>
        </div>
      </div>

      {/* Subtab Navigation Bar */}
      <div style={{
        display: 'flex',
        gap: '8px',
        borderBottom: '2px solid #e2e8f0',
        paddingBottom: '8px',
        flexWrap: 'wrap',
      }}>
        <button
          type="button"
          onClick={() => setEssTab('overview')}
          style={{
            padding: '8px 16px',
            borderRadius: '8px',
            border: 'none',
            background: essTab === 'overview' ? '#2563eb' : '#f1f5f9',
            color: essTab === 'overview' ? '#ffffff' : '#475569',
            fontWeight: 600,
            fontSize: '13px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            transition: 'all 0.15s',
          }}
        >
          <Icons.Home size={16} color={essTab === 'overview' ? '#ffffff' : '#64748b'} />
          <span>Overview</span>
        </button>

        <button
          type="button"
          onClick={() => setEssTab('documents')}
          style={{
            padding: '8px 16px',
            borderRadius: '8px',
            border: 'none',
            background: essTab === 'documents' ? '#2563eb' : '#f1f5f9',
            color: essTab === 'documents' ? '#ffffff' : '#475569',
            fontWeight: 600,
            fontSize: '13px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            transition: 'all 0.15s',
          }}
        >
          <Icons.FileText size={16} color={essTab === 'documents' ? '#ffffff' : '#64748b'} />
          <span>My Documents & Letters</span>
          {documents.length > 0 && (
            <span style={{
              background: essTab === 'documents' ? 'rgba(255,255,255,0.3)' : '#cbd5e1',
              color: essTab === 'documents' ? '#ffffff' : '#1e293b',
              padding: '2px 7px',
              borderRadius: '10px',
              fontSize: '11px',
              fontWeight: 700,
            }}>
              {documents.length}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setEssTab('payslips')}
          style={{
            padding: '8px 16px',
            borderRadius: '8px',
            border: 'none',
            background: essTab === 'payslips' ? '#2563eb' : '#f1f5f9',
            color: essTab === 'payslips' ? '#ffffff' : '#475569',
            fontWeight: 600,
            fontSize: '13px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            transition: 'all 0.15s',
          }}
        >
          <Icons.Dollar size={16} color={essTab === 'payslips' ? '#ffffff' : '#64748b'} />
          <span>My Payslips</span>
          {allPayslips.length > 0 && (
            <span style={{
              background: essTab === 'payslips' ? 'rgba(255,255,255,0.3)' : '#cbd5e1',
              color: essTab === 'payslips' ? '#ffffff' : '#1e293b',
              padding: '2px 7px',
              borderRadius: '10px',
              fontSize: '11px',
              fontWeight: 700,
            }}>
              {allPayslips.length}
            </span>
          )}
        </button>
      </div>

      {essTab === 'overview' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

      {/* 2. Manager Alert (if applicable) */}
      {managerOverview && (
        <div className="card" style={{ background: '#eff6ff', border: '1px solid #bfdbfe' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <span style={{ fontWeight: 700, color: '#1e40af' }}>Manager Workspace</span>
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
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(270px, 1fr))', gap: '20px' }}>
        {/* Attendance Card */}
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Icons.Clock size={18} color="#2563eb" />
              <h3 style={{ fontSize: '16px', fontWeight: 600, margin: 0 }}>Today's Attendance</h3>
            </div>
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
                Marked Late (Punched after shift grace period)
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
            <h3 style={{ fontSize: '16px', fontWeight: 600 }}>Assigned Shift</h3>
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
            <h3 style={{ fontSize: '16px', fontWeight: 600 }}>Latest Payslip</h3>
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
              <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
                <a
                  href={api.getPayslipViewHtmlUrl(latestPayslip.id)}
                  target="_blank"
                  rel="noreferrer"
                  className="btn btn-secondary"
                  style={{ flex: 1, fontSize: '12px', textAlign: 'center', padding: '6px 8px' }}
                >
                  View Web
                </a>
                <button
                  type="button"
                  onClick={() => api.downloadPayslipPdf(latestPayslip.id, `Payslip-${latestPayslip.month}-${latestPayslip.year}.pdf`)}
                  className="btn btn-primary"
                  style={{ flex: 1, fontSize: '12px', textAlign: 'center', padding: '6px 8px' }}
                >
                  Download PDF
                </button>
              </div>
              <button
                type="button"
                onClick={() => setEssTab('payslips')}
                className="btn btn-secondary"
                style={{ width: '100%', marginTop: '8px', fontSize: '12px', textAlign: 'center', padding: '5px 8px' }}
              >
                View All Payslips ({allPayslips.length}) →
              </button>
            </div>
          ) : (
            <div style={{ color: '#64748b', fontSize: '13px', textAlign: 'center', padding: '20px 0' }}>
              <div>No finalized payslips available yet.</div>
              {allPayslips.length > 0 && (
                <button
                  type="button"
                  onClick={() => setEssTab('payslips')}
                  className="btn btn-secondary"
                  style={{ marginTop: '8px', fontSize: '12px', padding: '5px 10px' }}
                >
                  View All Payslips ({allPayslips.length}) →
                </button>
              )}
            </div>
          )}
        </div>

        {/* Upcoming Holidays Card */}
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Icons.Calendar size={18} color="#2563eb" />
              <h3 style={{ fontSize: '16px', fontWeight: 600, margin: 0 }}>Upcoming Holidays</h3>
            </div>
            <span className="badge badge-role">
              {upcomingHolidays?.length ? `${upcomingHolidays.length} upcoming` : 'None'}
            </span>
          </div>

          {(!upcomingHolidays || upcomingHolidays.length === 0) ? (
            <div style={{ color: '#64748b', fontSize: '13px', textAlign: 'center', padding: '24px 0' }}>
              No upcoming holidays scheduled for your location.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {upcomingHolidays.map((h: any) => {
                const hDate = new Date(h.date);
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                const diffTime = hDate.getTime() - today.getTime();
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                const countdownText = diffDays === 0 ? 'Today' : diffDays === 1 ? 'Tomorrow' : `In ${diffDays} days`;

                return (
                  <div
                    key={h.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '8px 10px',
                      background: '#f8fafc',
                      borderRadius: '8px',
                      border: '1px solid #e2e8f0',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div
                        style={{
                          background: h.isRestricted ? '#fffbeb' : '#eff6ff',
                          border: `1px solid ${h.isRestricted ? '#fde68a' : '#bfdbfe'}`,
                          color: h.isRestricted ? '#b45309' : '#1d4ed8',
                          padding: '3px 6px',
                          borderRadius: '6px',
                          textAlign: 'center',
                          minWidth: '40px',
                        }}
                      >
                        <div style={{ fontSize: '9px', fontWeight: 700, textTransform: 'uppercase' }}>
                          {hDate.toLocaleDateString('en-US', { month: 'short' })}
                        </div>
                        <div style={{ fontSize: '15px', fontWeight: 800, lineHeight: 1.1 }}>
                          {hDate.getDate()}
                        </div>
                      </div>
                      <div>
                        <div style={{ fontSize: '13px', fontWeight: 600, color: '#1e293b' }}>
                          {h.name}
                        </div>
                        <div style={{ fontSize: '11px', color: '#64748b', display: 'flex', gap: '6px', alignItems: 'center' }}>
                          <span>{hDate.toLocaleDateString('en-US', { weekday: 'short' })}</span>
                          <span>•</span>
                          <span>{h.location ? h.location.name : 'All Branches'}</span>
                        </div>
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <span
                        className="badge"
                        style={{
                          fontSize: '11px',
                          background: h.isRestricted ? '#fef3c7' : '#dcfce7',
                          color: h.isRestricted ? '#92400e' : '#15803d',
                          border: `1px solid ${h.isRestricted ? '#fde68a' : '#bbf7d0'}`,
                        }}
                      >
                        {h.isRestricted ? 'Restricted' : 'Mandatory'}
                      </span>
                      <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px', fontWeight: 500 }}>
                        {countdownText}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* 4. Leave Balances Grid */}
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h3 style={{ fontSize: '16px', fontWeight: 600 }}>My Leave Balances</h3>
          <button
            className="btn btn-primary"
            onClick={openApplyLeaveModal}
            style={{ padding: '6px 14px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <Icons.Plus size={14} color="#ffffff" />
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
        <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '12px' }}>Recent Leave Applications</h3>
        {recentLeaveRequests.length === 0 ? (
          <div style={{ color: '#64748b', fontSize: '13px' }}>No leave applications recorded.</div>
        ) : (
          <div className="table-responsive">
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
          </div>
        )}
      </div>
      </div>
      )}

      {/* 6. Documents & Official Letters View */}
      {essTab === 'documents' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Header & Quick Action Card */}
          <div className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
            <div>
              <h3 style={{ fontSize: '18px', fontWeight: 700, margin: 0, color: '#0f172a' }}>
                My Official Documents & Records
              </h3>
              <p style={{ fontSize: '13px', color: '#64748b', margin: '4px 0 0' }}>
                Download company appointment letters, offer letters, and upload your personal compliance records (ID proofs, degrees, resume).
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
                setShowUploadModal(true);
              }}
              style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '9px 18px', fontSize: '13px' }}
            >
              <Icons.Upload size={16} color="#ffffff" />
              <span>Upload Document</span>
            </button>
          </div>

          {/* Company Issued Letters & Contracts */}
          <div className="card">
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
              <Icons.Award size={20} color="#2563eb" />
              <h3 style={{ fontSize: '16px', fontWeight: 700, margin: 0, color: '#1e293b' }}>
                Official Company Letters & Agreements
              </h3>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '16px' }}>
              {/* Appointment Letter Card */}
              <div style={{
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: '10px',
                padding: '18px',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                gap: '12px',
              }}>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Icons.FileText size={18} color="#2563eb" />
                      <h4 style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: '#0f172a' }}>
                        Letter of Appointment
                      </h4>
                    </div>
                    <span className="badge badge-active">OFFICIAL</span>
                  </div>
                  <p style={{ fontSize: '12px', color: '#64748b', margin: '8px 0 0', lineHeight: 1.5 }}>
                    Formal appointment letter certifying employment as <strong>{profile.designation}</strong> in <strong>{profile.department}</strong>.
                  </p>
                </div>

                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => setLetterModalType('APPOINTMENT')}
                    style={{ flex: 1, minWidth: '120px', fontSize: '12px', padding: '7px 10px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                  >
                    <Icons.Eye size={14} />
                    <span>View & Print</span>
                  </button>
                  {documents.find((d) => d.documentType === 'OFFER_LETTER' || d.fileName.toLowerCase().includes('appointment')) && (
                    <button
                      type="button"
                      className="btn btn-primary"
                      onClick={() => {
                        const doc = documents.find((d) => d.documentType === 'OFFER_LETTER' || d.fileName.toLowerCase().includes('appointment'));
                        if (doc) downloadDoc(doc);
                      }}
                      style={{ flex: 1, minWidth: '120px', fontSize: '12px', padding: '7px 10px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                    >
                      <Icons.Download size={14} color="#ffffff" />
                      <span>Download File</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Offer Letter Card */}
              <div style={{
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: '10px',
                padding: '18px',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                gap: '12px',
              }}>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Icons.FileText size={18} color="#0891b2" />
                      <h4 style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: '#0f172a' }}>
                        Employment Offer Letter
                      </h4>
                    </div>
                    <span className="badge badge-role">OFFICIAL</span>
                  </div>
                  <p style={{ fontSize: '12px', color: '#64748b', margin: '8px 0 0', lineHeight: 1.5 }}>
                    Formal job offer document with compensation structure, role description, and joining date.
                  </p>
                </div>

                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => setLetterModalType('OFFER')}
                    style={{ flex: 1, minWidth: '120px', fontSize: '12px', padding: '7px 10px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                  >
                    <Icons.Eye size={14} />
                    <span>View & Print</span>
                  </button>
                  {documents.find((d) => d.documentType === 'OFFER_LETTER') && (
                    <button
                      type="button"
                      className="btn btn-primary"
                      onClick={() => {
                        const doc = documents.find((d) => d.documentType === 'OFFER_LETTER');
                        if (doc) downloadDoc(doc);
                      }}
                      style={{ flex: 1, minWidth: '120px', fontSize: '12px', padding: '7px 10px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                    >
                      <Icons.Download size={14} color="#ffffff" />
                      <span>Download File</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Experience / Relieving Card */}
              <div style={{
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: '10px',
                padding: '18px',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                gap: '12px',
              }}>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Icons.Briefcase size={18} color="#7c3aed" />
                      <h4 style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: '#0f172a' }}>
                        Experience / Relieving Letter
                      </h4>
                    </div>
                    <span className="badge badge-inactive">SERVICE RECORD</span>
                  </div>
                  <p style={{ fontSize: '12px', color: '#64748b', margin: '8px 0 0', lineHeight: 1.5 }}>
                    {documents.find((d) => d.documentType === 'EXPERIENCE_LETTER')
                      ? 'Official experience certificate issued and available for download.'
                      : 'Service certificate available upon completion of tenure and exit clearance.'}
                  </p>
                </div>

                {documents.find((d) => d.documentType === 'EXPERIENCE_LETTER') ? (
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={() => {
                      const doc = documents.find((d) => d.documentType === 'EXPERIENCE_LETTER');
                      if (doc) downloadDoc(doc);
                    }}
                    style={{ width: '100%', fontSize: '12px', padding: '7px 10px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                  >
                    <Icons.Download size={14} color="#ffffff" />
                    <span>Download Experience Letter</span>
                  </button>
                ) : (
                  <div style={{ fontSize: '11px', color: '#94a3b8', fontStyle: 'italic', textAlign: 'center', padding: '6px' }}>
                    Available upon exit clearance
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Personal Uploaded Documents */}
          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', marginBottom: '16px' }}>
              <div>
                <h3 style={{ fontSize: '16px', fontWeight: 700, margin: 0, color: '#0f172a' }}>
                  My Uploaded Documents ({documents.length})
                </h3>
                <p style={{ fontSize: '12px', color: '#64748b', margin: '2px 0 0' }}>
                  Identity proofs, educational qualifications, resume, and uploaded records.
                </p>
              </div>

              {/* Filter Chips */}
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                {[
                  { key: 'ALL', label: `All (${documents.length})` },
                  { key: 'ID_PROOF', label: `ID Proofs (${documents.filter((d) => d.documentType === 'ID_PROOF').length})` },
                  { key: 'EDUCATION_CERTIFICATE', label: `Education (${documents.filter((d) => d.documentType === 'EDUCATION_CERTIFICATE').length})` },
                  { key: 'RESUME', label: `Resumes (${documents.filter((d) => d.documentType === 'RESUME').length})` },
                  { key: 'OFFER_LETTER', label: `Letters (${documents.filter((d) => d.documentType === 'OFFER_LETTER').length})` },
                  { key: 'OTHER', label: `Other (${documents.filter((d) => d.documentType === 'OTHER').length})` },
                ].map((chip) => (
                  <button
                    key={chip.key}
                    type="button"
                    onClick={() => setDocFilter(chip.key)}
                    style={{
                      padding: '4px 10px',
                      fontSize: '11px',
                      fontWeight: 600,
                      borderRadius: '14px',
                      border: '1px solid',
                      borderColor: docFilter === chip.key ? '#2563eb' : '#cbd5e1',
                      background: docFilter === chip.key ? '#eff6ff' : '#ffffff',
                      color: docFilter === chip.key ? '#1d4ed8' : '#475569',
                      cursor: 'pointer',
                    }}
                  >
                    {chip.label}
                  </button>
                ))}
              </div>
            </div>

            {loadingDocs ? (
              <div style={{ textAlign: 'center', padding: '30px', color: '#64748b', fontSize: '13px' }}>
                Loading your documents...
              </div>
            ) : documents.length === 0 ? (
              <div style={{
                textAlign: 'center',
                padding: '40px 20px',
                background: '#f8fafc',
                borderRadius: '8px',
                border: '1px dashed #cbd5e1',
              }}>
                <div style={{ display: 'inline-flex', padding: '12px', background: '#e2e8f0', borderRadius: '50%', marginBottom: '10px' }}>
                  <Icons.Upload size={24} color="#64748b" />
                </div>
                <h4 style={{ margin: '0 0 6px', fontSize: '15px', color: '#1e293b' }}>No personal documents uploaded yet</h4>
                <p style={{ fontSize: '13px', color: '#64748b', margin: '0 0 16px', maxWidth: '420px', marginInline: 'auto' }}>
                  Upload your PAN card, Aadhaar, educational degree certificates, or resume for official HR records and verification.
                </p>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => {
                    setUploadDocError('');
                    setShowUploadModal(true);
                  }}
                  style={{ fontSize: '13px', padding: '8px 18px' }}
                >
                  + Upload Your First Document
                </button>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(290px, 1fr))', gap: '14px' }}>
                {documents
                  .filter((d) => docFilter === 'ALL' || d.documentType === docFilter)
                  .map((doc) => {
                    const meta = DOCUMENT_TYPE_LABELS[doc.documentType] || DOCUMENT_TYPE_LABELS.OTHER;
                    const isPdf = doc.fileName.toLowerCase().endsWith('.pdf') || doc.fileUrl.startsWith('data:application/pdf');
                    const isImg = doc.fileUrl.startsWith('data:image/') || /\.(png|jpe?g|webp)$/i.test(doc.fileName);

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
                        <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                          <div style={{
                            width: '40px',
                            height: '40px',
                            borderRadius: '8px',
                            background: isPdf ? '#fee2e2' : isImg ? '#ecfdf5' : '#eff6ff',
                            color: isPdf ? '#dc2626' : isImg ? '#059669' : '#2563eb',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0,
                          }}>
                            <Icons.FileText size={20} />
                          </div>

                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div
                              style={{
                                fontSize: '14px',
                                fontWeight: 700,
                                color: '#0f172a',
                                whiteSpace: 'nowrap',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                              }}
                              title={doc.fileName}
                            >
                              {doc.fileName}
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '4px', flexWrap: 'wrap' }}>
                              <span
                                className={`badge ${meta.badgeClass}`}
                                style={{ fontSize: '10px', padding: '2px 6px' }}
                              >
                                {meta.label}
                              </span>
                              <span style={{ fontSize: '11px', color: '#94a3b8' }}>
                                • {formatFileSize(doc.fileSize)}
                              </span>
                            </div>

                            <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '4px' }}>
                              Uploaded {new Date(doc.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                            </div>
                          </div>
                        </div>

                        {/* Actions */}
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', borderTop: '1px solid #f1f5f9', paddingTop: '10px' }}>
                          <button
                            type="button"
                            onClick={() => setPreviewDoc(doc)}
                            className="btn btn-secondary"
                            style={{ padding: '5px 10px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px' }}
                            title="Preview Document"
                          >
                            <Icons.Eye size={13} />
                            <span>Preview</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => downloadDoc(doc)}
                            className="btn btn-primary"
                            style={{ padding: '5px 10px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px' }}
                            title="Download Document"
                          >
                            <Icons.Download size={13} color="#ffffff" />
                            <span>Download</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => handleDeleteDocument(doc.id, doc.fileName)}
                            style={{
                              padding: '5px 8px',
                              background: '#fef2f2',
                              border: '1px solid #fecaca',
                              color: '#dc2626',
                              borderRadius: '4px',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                            }}
                            title="Delete Document"
                          >
                            <Icons.Trash size={13} color="#dc2626" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* 7. Payslips View */}
      {essTab === 'payslips' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Summary Stat Banner */}
          <div className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
            <div>
              <h3 style={{ fontSize: '18px', fontWeight: 700, margin: 0, color: '#0f172a' }}>
                My Payslips & Compensation History
              </h3>
              <p style={{ fontSize: '13px', color: '#64748b', margin: '4px 0 0' }}>
                Access and download your finalized monthly salary slips and tax deduction statements.
              </p>
            </div>

            {/* Year Filter */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <label style={{ fontSize: '12px', fontWeight: 600, color: '#475569' }}>Filter Year:</label>
              <select
                value={payslipYearFilter}
                onChange={(e) => setPayslipYearFilter(e.target.value)}
                style={{ padding: '6px 10px', fontSize: '13px', border: '1px solid #cbd5e1', borderRadius: '6px', background: '#ffffff' }}
              >
                <option value="ALL">All Years</option>
                {Array.from(new Set(allPayslips.map((p) => String(p.year)))).sort().reverse().map((yr) => (
                  <option key={yr} value={yr}>{yr}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Metric Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
            <div className="card" style={{ background: '#f8fafc' }}>
              <div style={{ fontSize: '12px', fontWeight: 600, color: '#64748b', textTransform: 'uppercase' }}>
                Total Payslips Available
              </div>
              <div style={{ fontSize: '26px', fontWeight: 800, color: '#1e293b', marginTop: '6px' }}>
                {allPayslips.length}
              </div>
              <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '2px' }}>
                Disbursed by Finance
              </div>
            </div>

            <div className="card" style={{ background: '#f0fdf4' }}>
              <div style={{ fontSize: '12px', fontWeight: 600, color: '#16a34a', textTransform: 'uppercase' }}>
                Latest Disbursed Net Pay
              </div>
              <div style={{ fontSize: '26px', fontWeight: 800, color: '#15803d', marginTop: '6px' }}>
                {latestPayslip ? `₹${Number(latestPayslip.netPay).toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : '—'}
              </div>
              <div style={{ fontSize: '11px', color: '#16a34a', marginTop: '2px' }}>
                {latestPayslip ? `Period: ${latestPayslip.month}/${latestPayslip.year}` : 'No slips disbursed'}
              </div>
            </div>

            <div className="card" style={{ background: '#eff6ff' }}>
              <div style={{ fontSize: '12px', fontWeight: 600, color: '#2563eb', textTransform: 'uppercase' }}>
                Currency & Bank
              </div>
              <div style={{ fontSize: '20px', fontWeight: 800, color: '#1d4ed8', marginTop: '6px' }}>
                {profile.currency || 'INR'} (₹)
              </div>
              <div style={{ fontSize: '11px', color: '#2563eb', marginTop: '2px' }}>
                Direct Bank Transfer
              </div>
            </div>
          </div>

          {/* Payslips Table */}
          <div className="card">
            <h3 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '14px', color: '#0f172a' }}>
              Disbursed Payslips Register
            </h3>

            {loadingPayslips ? (
              <div style={{ textAlign: 'center', padding: '30px', color: '#64748b', fontSize: '13px' }}>
                Loading your payslips...
              </div>
            ) : allPayslips.length === 0 ? (
              <div style={{
                textAlign: 'center',
                padding: '40px 20px',
                background: '#f8fafc',
                borderRadius: '8px',
                border: '1px dashed #cbd5e1',
              }}>
                <div style={{ display: 'inline-flex', padding: '12px', background: '#e2e8f0', borderRadius: '50%', marginBottom: '10px' }}>
                  <Icons.Dollar size={24} color="#64748b" />
                </div>
                <h4 style={{ margin: '0 0 6px', fontSize: '15px', color: '#1e293b' }}>No payslips generated yet</h4>
                <p style={{ fontSize: '13px', color: '#64748b', margin: 0 }}>
                  Once the monthly payroll batch is locked and disbursed by your Finance team, your official payslips and tax breakdowns will appear here automatically.
                </p>
              </div>
            ) : (
              <div className="table-responsive">
                <table>
                  <thead>
                    <tr>
                      <th>Pay Period</th>
                      <th>Payable Days</th>
                      <th>Gross Earnings</th>
                      <th>Deductions</th>
                      <th>Net Disbursed</th>
                      <th>Status</th>
                      <th style={{ textAlign: 'right' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {allPayslips
                      .filter((p) => payslipYearFilter === 'ALL' || String(p.year) === payslipYearFilter)
                      .map((slip) => {
                        const monthName = new Date(slip.year, slip.month - 1).toLocaleString('en-US', { month: 'long' });
                        const isDownloading = downloadingPdfId === slip.id;

                        return (
                          <tr key={slip.id}>
                            <td>
                              <strong>{monthName} {slip.year}</strong>
                              <div style={{ fontSize: '11px', color: '#94a3b8' }}>
                                Period: {String(slip.month).padStart(2, '0')}/{slip.year}
                              </div>
                            </td>
                            <td>{slip.payableDays} days</td>
                            <td>₹{Number(slip.earnedGross || slip.grossPay || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                            <td style={{ color: '#dc2626' }}>
                              ₹{Number(slip.totalDeductions || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                            </td>
                            <td style={{ fontSize: '15px', fontWeight: 800, color: '#16a34a' }}>
                              ₹{Number(slip.netPay || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                            </td>
                            <td>
                              <span className="badge badge-active">{slip.status || 'DISBURSED'}</span>
                            </td>
                            <td style={{ textAlign: 'right' }}>
                              <div style={{ display: 'inline-flex', gap: '6px' }}>
                                <a
                                  href={api.getPayslipViewHtmlUrl(slip.id)}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="btn btn-secondary"
                                  style={{ padding: '5px 9px', fontSize: '11px', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '4px' }}
                                >
                                  <Icons.Eye size={12} />
                                  <span>View</span>
                                </a>

                                <button
                                  type="button"
                                  onClick={() => handleDownloadPayslip(slip.id, slip.month, slip.year)}
                                  disabled={isDownloading}
                                  className="btn btn-primary"
                                  style={{ padding: '5px 9px', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '4px' }}
                                >
                                  <Icons.Download size={12} color="#ffffff" />
                                  <span>{isDownloading ? 'Downloading...' : 'PDF'}</span>
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Upload Document Modal */}
      {showUploadModal && (
        <Modal onClose={() => setShowUploadModal(false)}>
          <div style={{
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
          }}>
            <div className="card" style={{ width: '480px', maxWidth: '100%', maxHeight: '90vh', overflowY: 'auto' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <h3 style={{ fontSize: '16px', fontWeight: 700, margin: 0 }}>
                  Upload Personal Document
                </h3>
                <button
                  onClick={() => setShowUploadModal(false)}
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

              <form onSubmit={handleUploadSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 600, color: '#475569', display: 'block', marginBottom: '4px' }}>
                    Document Category *
                  </label>
                  <select
                    value={uploadDocType}
                    onChange={(e) => setUploadDocType(e.target.value)}
                    required
                    style={{ width: '100%', padding: '8px 10px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '13px' }}
                  >
                    <option value="ID_PROOF">Identity Proof (Aadhaar, PAN, Passport, Voter ID)</option>
                    <option value="EDUCATION_CERTIFICATE">Educational Degree / Certificate / Transcripts</option>
                    <option value="RESUME">Resume / Curriculum Vitae</option>
                    <option value="OFFER_LETTER">Signed Offer / Appointment Letter</option>
                    <option value="EXPERIENCE_LETTER">Relieving / Experience Certificate</option>
                    <option value="OTHER">Other Official Document</option>
                  </select>
                </div>

                <div>
                  <label style={{ fontSize: '12px', fontWeight: 600, color: '#475569', display: 'block', marginBottom: '4px' }}>
                    Document Name / Title *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Aadhaar Card Front & Back, Degree Certificate"
                    value={uploadDocName}
                    onChange={(e) => setUploadDocName(e.target.value)}
                    style={{ width: '100%', padding: '8px 10px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '13px', boxSizing: 'border-box' }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: '12px', fontWeight: 600, color: '#475569', display: 'block', marginBottom: '4px' }}>
                    Choose File (PDF, PNG, JPG - Max 10MB) *
                  </label>
                  <input
                    type="file"
                    required
                    accept=".pdf,.png,.jpg,.jpeg,.webp,.doc,.docx"
                    onChange={handleFileChange}
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
                    onClick={() => setShowUploadModal(false)}
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

      {/* Official Letterhead Modal */}
      {letterModalType && (
        <Modal onClose={() => setLetterModalType(null)}>
          <div style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.75)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            backdropFilter: 'blur(5px)',
            padding: '20px',
            boxSizing: 'border-box',
          }}>
            <div className="card" style={{
              width: '750px',
              maxWidth: '100%',
              maxHeight: '92vh',
              overflowY: 'auto',
              background: '#ffffff',
              padding: '36px',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
            }}>
              <style>{`
                @media print {
                  body * { visibility: hidden !important; }
                  #printable-letter, #printable-letter * { visibility: visible !important; }
                  #printable-letter {
                    position: absolute !important;
                    left: 0 !important;
                    top: 0 !important;
                    width: 100% !important;
                    padding: 24px !important;
                  }
                  .no-print { display: none !important; }
                }
              `}</style>

              {/* Modal Top Actions */}
              <div className="no-print" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', borderBottom: '1px solid #e2e8f0', paddingBottom: '14px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Icons.Award size={20} color="#2563eb" />
                  <span style={{ fontWeight: 700, fontSize: '15px', color: '#1e293b' }}>
                    Official Letter Generator & Verification
                  </span>
                </div>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <button
                    type="button"
                    onClick={() => window.print()}
                    className="btn btn-primary"
                    style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', padding: '6px 14px' }}
                  >
                    <Icons.Download size={14} color="#ffffff" />
                    <span>Print / Save as PDF</span>
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => setLetterModalType(null)}
                    style={{ fontSize: '12px', padding: '6px 12px' }}
                  >
                    Close
                  </button>
                </div>
              </div>

              {/* Printable Letterhead Document */}
              <div id="printable-letter" style={{ fontFamily: 'Georgia, serif', color: '#1e293b', lineHeight: 1.6 }}>
                {/* Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '3px solid #2563eb', paddingBottom: '16px', marginBottom: '24px' }}>
                  <div>
                    <h1 style={{ margin: 0, fontSize: '24px', fontWeight: 800, color: '#1e3a8a', fontFamily: 'system-ui, sans-serif', letterSpacing: '-0.5px' }}>
                      PlanetU Enterprise
                    </h1>
                    <div style={{ fontSize: '12px', color: '#64748b', fontFamily: 'system-ui, sans-serif' }}>
                      Human Capital Management & Technology Operations
                    </div>
                  </div>
                  <div style={{ textAlign: 'right', fontSize: '11px', color: '#64748b', fontFamily: 'system-ui, sans-serif' }}>
                    <div>Corporate Operations Office</div>
                    <div>Bangalore, Karnataka, India</div>
                    <div>hr@planetu.com • planetu-hrms.onrender.com</div>
                  </div>
                </div>

                {/* Reference & Date */}
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', marginBottom: '20px', fontFamily: 'system-ui, sans-serif' }}>
                  <div>
                    <strong>Ref:</strong> PLU/HR/{profile.employeeCode}/{letterModalType}-{new Date().getFullYear()}
                  </div>
                  <div>
                    <strong>Date:</strong> {new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}
                  </div>
                </div>

                {/* Recipient */}
                <div style={{ marginBottom: '24px', fontSize: '13px' }}>
                  <div><strong>To,</strong></div>
                  <div style={{ fontSize: '15px', fontWeight: 700, marginTop: '4px' }}>{profile.firstName} {profile.lastName}</div>
                  <div>Employee ID: <strong>{profile.employeeCode}</strong></div>
                  <div>Position: <strong>{profile.designation}</strong></div>
                  <div>Department: <strong>{profile.department}</strong></div>
                  {profile.currentAddress && <div>Address: {profile.currentAddress}</div>}
                </div>

                {/* Subject */}
                <div style={{
                  fontSize: '14px',
                  fontWeight: 800,
                  textDecoration: 'underline',
                  marginBottom: '20px',
                  textAlign: 'center',
                  textTransform: 'uppercase',
                  fontFamily: 'system-ui, sans-serif',
                  color: '#1e3a8a',
                }}>
                  {letterModalType === 'APPOINTMENT'
                    ? 'SUBJECT: OFFICIAL LETTER OF APPOINTMENT'
                    : 'SUBJECT: FORMAL OFFER OF EMPLOYMENT'}
                </div>

                {/* Body */}
                <div style={{ fontSize: '13px', textAlign: 'justify', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <p>
                    Dear <strong>{profile.firstName}</strong>,
                  </p>

                  {letterModalType === 'APPOINTMENT' ? (
                    <>
                      <p>
                        We are pleased to formally issue this Letter of Appointment confirming your position as <strong>{profile.designation}</strong> in the <strong>{profile.department}</strong> department at <strong>PlanetU HRMS</strong> effective from <strong>{new Date(profile.dateOfJoining || Date.now()).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}</strong>.
                      </p>
                      <p>
                        <strong>1. Position & Duties:</strong> You shall report directly to <strong>{profile.reportingManager || 'your designated Department Head / Manager'}</strong>. Your principal responsibilities include contributing to corporate objectives with standard professional integrity.
                      </p>
                      <p>
                        <strong>2. Working Schedule & Shift:</strong> You will adhere to assigned shift schedule <strong>{shift?.shiftName || 'Standard Business Shift'}</strong> ({shift?.startTime || '09:00'} to {shift?.endTime || '18:00'}), with recognized weekly off days ({shift?.weeklyOffDays?.join(', ') || 'Saturday, Sunday'}).
                      </p>
                      <p>
                        <strong>3. Remuneration & Benefits:</strong> Your agreed compensation structure will be disbursed monthly as per organization payroll cycles through direct bank account transfer.
                      </p>
                      <p>
                        <strong>4. Code of Conduct & Confidentiality:</strong> You agree to uphold all organizational governance policies, data security guidelines, and proprietary non-disclosure obligations in effect.
                      </p>
                      <p>
                        We congratulate you on your official appointment and look forward to your valuable contributions to our continued growth.
                      </p>
                    </>
                  ) : (
                    <>
                      <p>
                        On behalf of <strong>PlanetU Enterprise</strong>, we are pleased to extend this formal offer of employment for the position of <strong>{profile.designation}</strong> in the <strong>{profile.department}</strong> department.
                      </p>
                      <p>
                        <strong>1. Position & Joining:</strong> You are scheduled to join on <strong>{new Date(profile.dateOfJoining || Date.now()).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}</strong> under Employee ID <strong>{profile.employeeCode}</strong>.
                      </p>
                      <p>
                        <strong>2. Compensation & Benefits:</strong> Your total compensation package includes basic pay, statutory components, applicable allowances, and annual performance appraisal eligibility.
                      </p>
                      <p>
                        <strong>3. Terms of Acceptance:</strong> Please retain this official offer document for your personal records or upload a signed duplicate copy to your self-service portal.
                      </p>
                    </>
                  )}
                </div>

                {/* Signatures */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: '48px', paddingTop: '20px' }}>
                  <div>
                    <div style={{ fontWeight: 800, fontSize: '13px', color: '#1e3a8a', fontFamily: 'system-ui, sans-serif' }}>
                      For PlanetU Enterprise
                    </div>
                    <div style={{ height: '40px', display: 'flex', alignItems: 'center' }}>
                      <span style={{ fontFamily: 'cursive', fontSize: '18px', color: '#1d4ed8' }}>PlanetU HR Director</span>
                    </div>
                    <div style={{ fontSize: '12px', fontWeight: 700 }}>Authorized Signatory</div>
                    <div style={{ fontSize: '11px', color: '#64748b' }}>Human Resources Department</div>
                  </div>

                  <div style={{ textAlign: 'right' }}>
                    <div style={{ height: '40px', borderBottom: '1px solid #cbd5e1', width: '180px' }} />
                    <div style={{ fontSize: '12px', fontWeight: 700, marginTop: '4px' }}>
                      {profile.firstName} {profile.lastName}
                    </div>
                    <div style={{ fontSize: '11px', color: '#64748b' }}>Employee Acceptance Signature</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </Modal>
      )}

      {/* Document Preview Modal */}
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

      {/* 8. Self-Profile Edit Modal (FR-EMP-006) */}
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


            <h3 style={{ marginBottom: '12px' }}>Update Contact & Emergency Info</h3>
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

              <div className="modal-form-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
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
              <h3 style={{ fontSize: '16px', fontWeight: 700 }}>Apply for Leave</h3>
              <button
                onClick={() => setShowApplyModal(false)}
                style={{ background: 'none', border: 'none', fontSize: '18px', cursor: 'pointer', color: '#64748b' }}
              >
                Close
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

              <div className="modal-form-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
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

              {calculatingPreview && (
                <div style={{ fontSize: '11px', color: '#64748b', fontStyle: 'italic', padding: '4px 0' }}>
                  Calculating working days & checking holiday calendar...
                </div>
              )}

              {calculationPreview && !calculatingPreview && (
                <div
                  style={{
                    background: '#f8fafc',
                    border: '1px solid #e2e8f0',
                    borderRadius: '6px',
                    padding: '10px 12px',
                    fontSize: '12px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '4px',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ color: '#475569', fontWeight: 600 }}>Deductible Leave Days:</span>
                    <span style={{ fontSize: '15px', fontWeight: 800, color: calculationPreview.workingDays > 0 ? '#1e293b' : '#dc2626' }}>
                      {calculationPreview.workingDays} {calculationPreview.workingDays === 1 ? 'day' : 'days'}
                    </span>
                  </div>

                  {(calculationPreview.holidayDays > 0 || calculationPreview.weeklyOffDays > 0) && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '4px' }}>
                      {calculationPreview.holidayDays > 0 && (
                        <span
                          className="badge"
                          style={{
                            background: '#dcfce7',
                            color: '#15803d',
                            border: '1px solid #bbf7d0',
                            fontSize: '11px',
                            fontWeight: 600,
                          }}
                        >
                          {calculationPreview.holidayDays} Public Holiday Excluded ({calculationPreview.holidays.map((h: any) => h.name).join(', ')})
                        </span>
                      )}
                      {calculationPreview.weeklyOffDays > 0 && (
                        <span
                          className="badge"
                          style={{
                            background: '#eff6ff',
                            color: '#1d4ed8',
                            border: '1px solid #bfdbfe',
                            fontSize: '11px',
                            fontWeight: 600,
                          }}
                        >
                          {calculationPreview.weeklyOffDays} Weekly Off{calculationPreview.weeklyOffDays > 1 ? 's' : ''} Excluded
                        </span>
                      )}
                    </div>
                  )}
                </div>
              )}

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
