import { useEffect, useState } from 'react';
import { api } from '../api';
import { Modal } from './Modal';
import { DonutChart } from './ReportCharts';

export function PayrollPage({ user }: { user: any }) {
  const [config, setConfig] = useState<any>(null);
  const [batches, setBatches] = useState<any[]>([]);
  const [selectedBatch, setSelectedBatch] = useState<any>(null);
  const [employees, setEmployees] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Payslip search and filter
  const [payslipSearch, setPayslipSearch] = useState('');
  const [payslipFilter, setPayslipFilter] = useState<'ALL' | 'PRORATED' | 'WITH_BONUS'>('ALL');

  // Calculate Batch inputs
  const [calcYear, setCalcYear] = useState(new Date().getFullYear());
  const [calcMonth, setCalcMonth] = useState(new Date().getMonth() + 1);
  const [calcLoading, setCalcLoading] = useState(false);

  // Set Salary Structure Modal
  const [showSalaryModal, setShowSalaryModal] = useState(false);
  const [salEmpId, setSalEmpId] = useState('');
  const [salAnnualCtc, setSalAnnualCtc] = useState<number>(600000);
  const [salEffectiveFrom, setSalEffectiveFrom] = useState(new Date().toISOString().split('T')[0]);
  const [salReason, setSalReason] = useState('Initial Structure or Appraisal');
  const [salSubmitting, setSalSubmitting] = useState(false);

  // Bonus & Adjustment Modal
  const [showAdjModal, setShowAdjModal] = useState(false);
  const [adjEmpId, setAdjEmpId] = useState('');
  const [adjYear, setAdjYear] = useState(new Date().getFullYear());
  const [adjMonth, setAdjMonth] = useState(new Date().getMonth() + 1);
  const [adjType, setAdjType] = useState('BONUS');
  const [adjAmount, setAdjAmount] = useState<number>(5000);
  const [adjReason, setAdjReason] = useState('Performance Bonus');
  const [adjSubmitting, setAdjSubmitting] = useState(false);

  // Disburse Modal
  const [showDisburseModal, setShowDisburseModal] = useState(false);
  const [paymentRef, setPaymentRef] = useState('UTR-NEFT-' + Date.now().toString().slice(-6));
  const [disburseNotes, setDisburseNotes] = useState('Corporate Net Banking Batch');
  const [disburseLoading, setDisburseLoading] = useState(false);

  const isFinance = user?.role === 'FINANCE';
  const isAdminOrFinance = isFinance || user?.role === 'CLIENT_SUPER_ADMIN' || user?.role === 'HR_ADMIN';

  const loadData = async () => {
    try {
      setLoading(true);
      setError('');
      const [cfgRes, batchesRes, empsRes] = await Promise.all([
        api.getPayrollConfig().catch(() => null),
        api.getBatches().catch(() => []),
        api.getEmployees().catch(() => ({ data: [] })),
      ]);
      setConfig(cfgRes);
      setBatches(batchesRes || []);
      setEmployees(empsRes.data || []);
      if (empsRes.data?.length > 0) {
        setSalEmpId(empsRes.data[0].id);
        setAdjEmpId(empsRes.data[0].id);
      }
      if (batchesRes.length > 0 && !selectedBatch) {
        loadBatchDetails(batchesRes[0].id);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load payroll data');
    } finally {
      setLoading(false);
    }
  };

  const loadBatchDetails = async (id: string) => {
    try {
      const details = await api.getBatchById(id);
      setSelectedBatch(details);
    } catch (err: any) {
      alert(err.message || 'Failed to load batch details');
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCalculateBatch = async () => {
    try {
      setCalcLoading(true);
      const batch = await api.calculateBatch(Number(calcYear), Number(calcMonth));
      alert(`Payroll batch for ${calcMonth}/${calcYear} calculated successfully as DRAFT!`);
      await loadData();
      setSelectedBatch(batch);
    } catch (err: any) {
      alert(err.message || 'Failed to calculate payroll batch');
    } finally {
      setCalcLoading(false);
    }
  };

  const handleLockBatch = async () => {
    if (!selectedBatch) return;
    if (!confirm(`Are you sure you want to LOCK batch ${selectedBatch.month}/${selectedBatch.year}? This freezes all calculations and makes it immutable.`)) return;
    try {
      await api.lockBatch(selectedBatch.id);
      alert('Batch locked successfully!');
      await loadBatchDetails(selectedBatch.id);
      await loadData();
    } catch (err: any) {
      alert(err.message || 'Failed to lock batch');
    }
  };

  const handleDisburseBatch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBatch) return;
    try {
      setDisburseLoading(true);
      await api.disburseBatch(selectedBatch.id, paymentRef, disburseNotes);
      alert('Batch marked as DISBURSED!');
      setShowDisburseModal(false);
      await loadBatchDetails(selectedBatch.id);
      await loadData();
    } catch (err: any) {
      alert(err.message || 'Disbursal failed');
    } finally {
      setDisburseLoading(false);
    }
  };

  const handleSetSalary = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSalSubmitting(true);
      await api.setSalaryStructure({
        employeeId: salEmpId,
        annualCtc: Number(salAnnualCtc),
        effectiveFrom: new Date(salEffectiveFrom).toISOString(),
        revisionReason: salReason,
      });
      alert('Salary structure updated in append-only ledger!');
      setShowSalaryModal(false);
    } catch (err: any) {
      alert(err.message || 'Failed to set salary structure');
    } finally {
      setSalSubmitting(false);
    }
  };

  const handleCreateAdjustment = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setAdjSubmitting(true);
      await api.createPayrollAdjustment({
        employeeId: adjEmpId,
        year: Number(adjYear),
        month: Number(adjMonth),
        type: adjType,
        amount: Number(adjAmount),
        reason: adjReason,
      });
      alert('Adjustment created successfully! Recalculate draft batch to include it.');
      setShowAdjModal(false);
      setAdjReason('Performance Bonus');
      setAdjAmount(5000);
      if (selectedBatch && selectedBatch.year === Number(adjYear) && selectedBatch.month === Number(adjMonth)) {
        await loadBatchDetails(selectedBatch.id);
      }
    } catch (err: any) {
      alert(err.message || 'Failed to create adjustment');
    } finally {
      setAdjSubmitting(false);
    }
  };

  const handleDownloadBankAdvice = async () => {
    if (!selectedBatch) return;
    try {
      const csv = await api.downloadBankAdviceCsv(selectedBatch.id);
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Bank_Payment_Advice_${selectedBatch.year}_${selectedBatch.month}.csv`;
      a.click();
    } catch (err: any) {
      alert(err.message || 'Failed to download bank advice');
    }
  };

  const monthlyGrossPreview = salAnnualCtc > 0 ? (salAnnualCtc / 12).toFixed(2) : '0.00';
  const basicPreview = (Number(monthlyGrossPreview) * 0.5).toFixed(2);
  const hraPreview = (Number(monthlyGrossPreview) * 0.25).toFixed(2);
  const splPreview = (Number(monthlyGrossPreview) * 0.25).toFixed(2);

  if (loading) {
    return <div className="card" style={{ padding: '40px', textAlign: 'center' }}>Loading Payroll Engine...</div>;
  }

  if (!isAdminOrFinance) {
    return (
      <div className="card" style={{ borderLeft: '4px solid #f59e0b' }}>
        <h3 style={{ fontSize: '16px', fontWeight: 600 }}>Payroll Console Restricted</h3>
        <p style={{ color: '#64748b', marginTop: '8px', fontSize: '13px' }}>
          Payroll configuration, salary structures, and batch calculations are restricted to the <strong>Finance</strong> role and HR Administrators.
        </p>
        <p style={{ fontSize: '13px', marginTop: '8px' }}>
          Employees can view and download their own personal finalized payslips under the <strong>ESS Workspace (M7)</strong> tab.
        </p>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Header */}
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <h2 style={{ fontSize: '18px', fontWeight: 700 }}>Payroll Management Engine</h2>
            <p style={{ fontSize: '13px', color: '#64748b', marginTop: '4px' }}>
              Option A (Indian Reference Model): Prorated-then-PF math, configurable PF ceiling, PT threshold, immutable batch lifecycle, and bank advice.
            </p>
          </div>
          {isFinance && (
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <button className="btn btn-secondary" onClick={() => setShowAdjModal(true)}>
                Add Bonus / Adjustment
              </button>
              <button className="btn btn-primary" onClick={() => setShowSalaryModal(true)}>
                Define / Revise Salary Structure
              </button>
            </div>
          )}
        </div>
      </div>

      {error && <div className="card" style={{ color: '#dc2626' }}>{error}</div>}

      {/* Compliance Configuration Snapshot */}
      {config && (
        <div className="card" style={{ background: '#f8fafc', border: '1px solid #e2e8f0' }}>
          <h3 style={{ fontSize: '14px', fontWeight: 700, color: '#475569', marginBottom: '10px' }}>
            Statutory & Compliance Configuration
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '10px', fontSize: '12px' }}>
            <div><span style={{ color: '#64748b' }}>Salary Formula:</span> <strong>50% Basic / 25% HRA / 25% Spl</strong></div>
            <div><span style={{ color: '#64748b' }}>PF Wage Ceiling:</span> <strong>₹{config.pfCeilingAmount}</strong> {config.applyPfCeiling ? '(Active)' : '(Uncapped)'}</div>
            <div><span style={{ color: '#64748b' }}>PF Rates:</span> <strong>{config.pfEmployeeRate}% Emp / {config.pfEmployerRate}% Empr</strong></div>
            <div><span style={{ color: '#64748b' }}>ESI Compliance:</span> <strong>{config.applyEsi ? `${config.esiEmployeeRate}% Emp / ${config.esiEmployerRate}% Empr (≤₹${config.esiThresholdAmount})` : 'Disabled'}</strong></div>
            <div><span style={{ color: '#64748b' }}>Professional Tax:</span> <strong>₹{config.ptAmount}/mo</strong> (Threshold: ₹{config.ptSalaryThreshold})</div>
            <div><span style={{ color: '#64748b' }}>Rounding Rule:</span> <strong>{config.roundToWholeRupee ? 'Whole Rupee at Net Pay' : 'Double Precision'}</strong></div>
          </div>
        </div>
      )}

      {/* Calculate Batch Control */}
      {isFinance && (
        <div className="card" style={{ borderLeft: '4px solid #2563eb' }}>
          <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '10px' }}>
            ▶️ Run Monthly Payroll Batch
          </h3>
          <p style={{ fontSize: '12px', color: '#64748b', marginBottom: '14px' }}>
            Pulls finalized payable days from <code>AttendanceService.getFinalizedPayableDays</code>, calculates prorated earnings and statutory deductions idempotently as a DRAFT.
          </p>
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
            <input
              type="number"
              value={calcYear}
              onChange={(e) => setCalcYear(Number(e.target.value))}
              placeholder="Year"
              style={{ width: '100px', padding: '8px', border: '1px solid #cbd5e1', borderRadius: '4px', fontSize: '13px' }}
            />
            <input
              type="number"
              value={calcMonth}
              onChange={(e) => setCalcMonth(Number(e.target.value))}
              min={1}
              max={12}
              placeholder="Month"
              style={{ width: '80px', padding: '8px', border: '1px solid #cbd5e1', borderRadius: '4px', fontSize: '13px' }}
            />
            <button className="btn btn-primary" onClick={handleCalculateBatch} disabled={calcLoading}>
              {calcLoading ? 'Calculating...' : 'Calculate Draft Batch'}
            </button>
          </div>
        </div>
      )}

      {/* Batch Selector & Status */}
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 600 }}>Payroll Batches</h3>
            <select
              value={selectedBatch?.id || ''}
              onChange={(e) => loadBatchDetails(e.target.value)}
              style={{ padding: '6px 12px', border: '1px solid #cbd5e1', borderRadius: '4px', fontSize: '13px' }}
            >
              {batches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.month}/{b.year} — Status: {b.status} (Net: ₹{b.totalNetPay})
                </option>
              ))}
            </select>
          </div>

          {selectedBatch && isFinance && (
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                className="btn btn-secondary"
                onClick={handleDownloadBankAdvice}
                style={{ fontSize: '12px' }}
              >
                Download Bank Advice (CSV)
              </button>

              {selectedBatch.status === 'DRAFT' && (
                <button
                  className="btn btn-primary"
                  onClick={handleLockBatch}
                  style={{ background: '#f59e0b', borderColor: '#d97706', fontSize: '12px' }}
                >
                  Lock Batch (Freeze)
                </button>
              )}

              {selectedBatch.status === 'LOCKED' && (
                <button
                  className="btn btn-primary"
                  onClick={() => setShowDisburseModal(true)}
                  style={{ background: '#16a34a', borderColor: '#15803d', fontSize: '12px' }}
                >
                  Disburse Batch
                </button>
              )}
            </div>
          )}
        </div>

        {selectedBatch ? (() => {
          const payslips = selectedBatch.payslips || [];

          const totalBasic = payslips.reduce((s: number, p: any) => s + (Number(p.earnedBasic) || 0), 0);
          const totalHra = payslips.reduce((s: number, p: any) => s + (Number(p.earnedHra) || 0), 0);
          const totalSpl = payslips.reduce((s: number, p: any) => s + (Number(p.earnedSpecialAllowance) || 0), 0);
          const totalAdditions = payslips.reduce((s: number, p: any) => s + (Number(p.bonusAmount || 0) + Number(p.arrearsAmount || 0) + Number(p.otherAdditions || 0)), 0);

          const totalEmployeePf = payslips.reduce((s: number, p: any) => s + (Number(p.employeePf) || 0), 0);
          const totalEmployeeEsi = payslips.reduce((s: number, p: any) => s + (Number(p.employeeEsi) || 0), 0);
          const totalPt = payslips.reduce((s: number, p: any) => s + (Number(p.professionalTax) || 0), 0);
          const totalTds = payslips.reduce((s: number, p: any) => s + (Number(p.tdsAmount) || 0), 0);
          const totalOtherDeductions = payslips.reduce((s: number, p: any) => s + (Number(p.otherDeductions) || 0), 0);

          const totalEmployerPf = payslips.reduce((s: number, p: any) => s + (Number(p.employerPf) || 0), 0);
          const totalEmployerEsi = payslips.reduce((s: number, p: any) => s + (Number(p.employerEsi) || 0), 0);
          const totalEmployerStatutory = totalEmployerPf + totalEmployerEsi;

          const totalCostToCompany = Number(selectedBatch.totalGrossPay || 0) + totalEmployerStatutory;
          const avgTakeHome = selectedBatch.totalEmployees > 0
            ? Math.round(Number(selectedBatch.totalNetPay || 0) / selectedBatch.totalEmployees)
            : 0;

          // Donut Slices
          const earningsSlices = [
            { label: 'Basic Salary (50%)', value: Math.round(totalBasic), color: '#2563eb', sublabel: 'Statutory Core' },
            { label: 'HRA (25%)', value: Math.round(totalHra), color: '#3b82f6', sublabel: 'House Rent' },
            { label: 'Special Allowance (25%)', value: Math.round(totalSpl), color: '#06b6d4', sublabel: 'Flexible Component' },
            ...(totalAdditions > 0 ? [{ label: 'Bonuses & Adjustments', value: Math.round(totalAdditions), color: '#10b981', sublabel: 'Incentives' }] : []),
          ];

          const deductionsSlices = [
            { label: 'Provident Fund (EPF 12%)', value: Math.round(totalEmployeePf), color: '#ea580c', sublabel: 'Employee EPF' },
            ...(totalEmployeeEsi > 0 ? [{ label: 'Employee ESI (0.75%)', value: Math.round(totalEmployeeEsi), color: '#f59e0b', sublabel: 'Health Insurance' }] : []),
            { label: 'Professional Tax (PT)', value: Math.round(totalPt), color: '#8b5cf6', sublabel: 'State Statutory' },
            ...(totalTds > 0 ? [{ label: 'TDS (Income Tax)', value: Math.round(totalTds), color: '#ec4899', sublabel: 'Withholding' }] : []),
            ...(totalOtherDeductions > 0 ? [{ label: 'Other Deductions', value: Math.round(totalOtherDeductions), color: '#64748b', sublabel: 'Custom' }] : []),
          ];

          const filteredPayslips = payslips.filter((ps: any) => {
            const code = ps.employee?.employeeCode?.toLowerCase() || '';
            const name = `${ps.employee?.firstName} ${ps.employee?.lastName}`.toLowerCase();
            const dept = ps.employee?.department?.name?.toLowerCase() || '';
            const q = payslipSearch.toLowerCase().trim();
            const matchesSearch = !q || code.includes(q) || name.includes(q) || dept.includes(q);

            if (!matchesSearch) return false;

            if (payslipFilter === 'PRORATED') {
              return Number(ps.payableDays) < Number(ps.totalMonthDays);
            }
            if (payslipFilter === 'WITH_BONUS') {
              const additions = Number(ps.bonusAmount || 0) + Number(ps.arrearsAmount || 0) + Number(ps.otherAdditions || 0);
              return additions > 0;
            }
            return true;
          });

          const proratedCount = payslips.filter((p: any) => Number(p.payableDays) < Number(p.totalMonthDays)).length;
          const bonusCount = payslips.filter((p: any) => (Number(p.bonusAmount || 0) + Number(p.arrearsAmount || 0) + Number(p.otherAdditions || 0)) > 0).length;

          return (
            <div>
              {/* Batch Lifecycle Stepper */}
              <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '8px', border: '1px solid #e2e8f0', marginBottom: '20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
                  <span style={{ fontSize: '11px', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Batch Lifecycle Processing Progression
                  </span>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <span style={{ fontSize: '12px', color: '#64748b' }}>
                      Cycle Period: <strong>Month {selectedBatch.month}/{selectedBatch.year}</strong>
                    </span>
                    <span className={`badge ${selectedBatch.status === 'DISBURSED' ? 'badge-active' : selectedBatch.status === 'LOCKED' ? 'badge-role' : 'badge-inactive'}`}>
                      {selectedBatch.status}
                    </span>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '10px' }}>
                  {/* Step 1: DRAFT */}
                  <div style={{
                    padding: '12px',
                    borderRadius: '6px',
                    background: selectedBatch.status === 'DRAFT' ? '#eff6ff' : '#ffffff',
                    border: selectedBatch.status === 'DRAFT' ? '2px solid #3b82f6' : '1px solid #e2e8f0',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                      <span style={{
                        width: '20px', height: '20px', borderRadius: '50%',
                        background: selectedBatch.status !== 'DRAFT' ? '#16a34a' : '#2563eb',
                        color: '#ffffff', fontSize: '11px', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center'
                      }}>
                        {selectedBatch.status !== 'DRAFT' ? '✓' : '1'}
                      </span>
                      <strong style={{ fontSize: '13px', color: '#1e293b' }}>1. Draft & Calculation</strong>
                    </div>
                    <p style={{ fontSize: '11px', color: '#64748b', margin: 0 }}>
                      Prorated math bound to Attendance payable days. Modifiable via bonus/adjustments.
                    </p>
                  </div>

                  {/* Step 2: LOCKED */}
                  <div style={{
                    padding: '12px',
                    borderRadius: '6px',
                    background: selectedBatch.status === 'LOCKED' ? '#fffbeb' : '#ffffff',
                    border: selectedBatch.status === 'LOCKED' ? '2px solid #f59e0b' : '1px solid #e2e8f0',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                      <span style={{
                        width: '20px', height: '20px', borderRadius: '50%',
                        background: selectedBatch.status === 'DISBURSED' ? '#16a34a' : selectedBatch.status === 'LOCKED' ? '#d97706' : '#94a3b8',
                        color: '#ffffff', fontSize: '11px', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center'
                      }}>
                        {selectedBatch.status === 'DISBURSED' ? '✓' : '2'}
                      </span>
                      <strong style={{ fontSize: '13px', color: '#1e293b' }}>2. Locked & Audited</strong>
                    </div>
                    <p style={{ fontSize: '11px', color: '#64748b', margin: 0 }}>
                      {selectedBatch.lockedAt ? `Locked on ${new Date(selectedBatch.lockedAt).toLocaleDateString()}` : 'Frozen & immutable. Bank advice verified.'}
                    </p>
                  </div>

                  {/* Step 3: DISBURSED */}
                  <div style={{
                    padding: '12px',
                    borderRadius: '6px',
                    background: selectedBatch.status === 'DISBURSED' ? '#f0fdf4' : '#ffffff',
                    border: selectedBatch.status === 'DISBURSED' ? '2px solid #16a34a' : '1px solid #e2e8f0',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                      <span style={{
                        width: '20px', height: '20px', borderRadius: '50%',
                        background: selectedBatch.status === 'DISBURSED' ? '#16a34a' : '#94a3b8',
                        color: '#ffffff', fontSize: '11px', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center'
                      }}>
                        {selectedBatch.status === 'DISBURSED' ? '✓' : '3'}
                      </span>
                      <strong style={{ fontSize: '13px', color: '#1e293b' }}>3. Disbursed & Released</strong>
                    </div>
                    <p style={{ fontSize: '11px', color: '#64748b', margin: 0 }}>
                      {selectedBatch.status === 'DISBURSED'
                        ? `Ref: ${selectedBatch.paymentReference || 'Bank-UTR'} (${new Date(selectedBatch.disbursedAt).toLocaleDateString()})`
                        : 'Disbursal payout and release of payslips to ESS portal.'}
                    </p>
                  </div>
                </div>
              </div>

              {/* State Action Banner */}
              {selectedBatch.status === 'DRAFT' && (
                <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: '6px', padding: '10px 14px', marginBottom: '20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
                  <div style={{ fontSize: '12px', color: '#92400e' }}>
                    🟡 <strong>Draft Cycle in Review:</strong> Adjustments and attendance syncing remain active. Verify net payouts before freezing.
                  </div>
                  {isFinance && (
                    <button
                      className="btn btn-primary"
                      onClick={handleLockBatch}
                      style={{ background: '#f59e0b', borderColor: '#d97706', fontSize: '12px', padding: '4px 12px' }}
                    >
                      Lock Batch (Freeze Calculations)
                    </button>
                  )}
                </div>
              )}

              {selectedBatch.status === 'LOCKED' && (
                <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '6px', padding: '10px 14px', marginBottom: '20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
                  <div style={{ fontSize: '12px', color: '#1e40af' }}>
                    🔒 <strong>Locked & Audit-Frozen:</strong> Download corporate bank advice CSV for treasury transmission, then confirm disbursal.
                  </div>
                  {isFinance && (
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button className="btn btn-secondary" onClick={handleDownloadBankAdvice} style={{ fontSize: '12px', padding: '4px 10px' }}>
                        Bank CSV
                      </button>
                      <button
                        className="btn btn-primary"
                        onClick={() => setShowDisburseModal(true)}
                        style={{ background: '#16a34a', borderColor: '#15803d', fontSize: '12px', padding: '4px 12px' }}
                      >
                        Confirm Disbursal
                      </button>
                    </div>
                  )}
                </div>
              )}

              {selectedBatch.status === 'DISBURSED' && (
                <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '6px', padding: '10px 14px', marginBottom: '20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
                  <div style={{ fontSize: '12px', color: '#166534' }}>
                    ✅ <strong>Cycle Disbursed:</strong> Payment Reference: <code>{selectedBatch.paymentReference || 'UTR-PROCESSED'}</code>. Payslips are published in employee ESS portals.
                  </div>
                  <button className="btn btn-secondary" onClick={handleDownloadBankAdvice} style={{ fontSize: '12px', padding: '4px 10px' }}>
                    Download Bank Advice
                  </button>
                </div>
              )}

              {/* Executive Summary Metrics Strip */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '12px', marginBottom: '20px' }}>
                <div style={{ background: '#eff6ff', padding: '14px', borderRadius: '8px', border: '1px solid #bfdbfe' }}>
                  <div style={{ fontSize: '11px', fontWeight: 600, color: '#1e40af' }}>Total Net Take-Home</div>
                  <div style={{ fontSize: '22px', fontWeight: 900, marginTop: '4px', color: '#1d4ed8' }}>
                    ₹{Number(selectedBatch.totalNetPay).toLocaleString('en-IN')}
                  </div>
                  <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>Direct employee bank transfer</div>
                </div>

                <div style={{ background: '#f8fafc', padding: '14px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                  <div style={{ fontSize: '11px', fontWeight: 600, color: '#475569' }}>Total Gross Earnings</div>
                  <div style={{ fontSize: '20px', fontWeight: 800, marginTop: '4px', color: '#1e293b' }}>
                    ₹{Number(selectedBatch.totalGrossPay).toLocaleString('en-IN')}
                  </div>
                  <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>Earned Basic + HRA + Spl + Bonus</div>
                </div>

                <div style={{ background: '#fef2f2', padding: '14px', borderRadius: '8px', border: '1px solid #fecaca' }}>
                  <div style={{ fontSize: '11px', fontWeight: 600, color: '#b91c1c' }}>Statutory Deductions</div>
                  <div style={{ fontSize: '20px', fontWeight: 800, marginTop: '4px', color: '#dc2626' }}>
                    ₹{Number(selectedBatch.totalDeductions).toLocaleString('en-IN')}
                  </div>
                  <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>Employee EPF (12%) + ESI + PT</div>
                </div>

                <div style={{ background: '#fffbeb', padding: '14px', borderRadius: '8px', border: '1px solid #fde68a' }}>
                  <div style={{ fontSize: '11px', fontWeight: 600, color: '#b45309' }}>Employer Contributions</div>
                  <div style={{ fontSize: '20px', fontWeight: 800, marginTop: '4px', color: '#d97706' }}>
                    ₹{totalEmployerStatutory.toLocaleString('en-IN')}
                  </div>
                  <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>Employer EPF (12%) + ESI (3.25%)</div>
                </div>

                <div style={{ background: '#f8fafc', padding: '14px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                  <div style={{ fontSize: '11px', fontWeight: 600, color: '#475569' }}>Total CTC Expenditure</div>
                  <div style={{ fontSize: '20px', fontWeight: 800, marginTop: '4px', color: '#0f172a' }}>
                    ₹{totalCostToCompany.toLocaleString('en-IN')}
                  </div>
                  <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>Gross + Employer statutory cost</div>
                </div>

                <div style={{ background: '#f0fdf4', padding: '14px', borderRadius: '8px', border: '1px solid #bbf7d0' }}>
                  <div style={{ fontSize: '11px', fontWeight: 600, color: '#15803d' }}>Average Net / Employee</div>
                  <div style={{ fontSize: '20px', fontWeight: 800, marginTop: '4px', color: '#16a34a' }}>
                    ₹{avgTakeHome.toLocaleString('en-IN')}
                  </div>
                  <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>Across {selectedBatch.totalEmployees} employees</div>
                </div>
              </div>

              {/* Visual Analytics Strip (Dual Donut Charts & Statutory Breakdown) */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px', marginBottom: '24px' }}>
                {/* Gross Earnings Composition Donut */}
                <div style={{ background: '#f8fafc', padding: '18px', borderRadius: '8px', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  <h4 style={{ fontSize: '13px', fontWeight: 700, color: '#334155', marginBottom: '4px', alignSelf: 'flex-start' }}>
                    Gross Earnings Composition
                  </h4>
                  <p style={{ fontSize: '11px', color: '#64748b', marginBottom: '12px', alignSelf: 'flex-start' }}>
                    Proportional distribution of salary components across the organization.
                  </p>
                  <DonutChart
                    data={earningsSlices}
                    size={170}
                    thickness={22}
                    centerTitle="Gross"
                    centerValue={`₹${(Number(selectedBatch.totalGrossPay) / 1000).toFixed(0)}k`}
                  />
                </div>

                {/* Statutory Deductions & Compliance Donut */}
                <div style={{ background: '#f8fafc', padding: '18px', borderRadius: '8px', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  <h4 style={{ fontSize: '13px', fontWeight: 700, color: '#334155', marginBottom: '4px', alignSelf: 'flex-start' }}>
                    Statutory Deductions Composition
                  </h4>
                  <p style={{ fontSize: '11px', color: '#64748b', marginBottom: '12px', alignSelf: 'flex-start' }}>
                    Withholdings for PF, ESI, Professional Tax, and Income Tax.
                  </p>
                  <DonutChart
                    data={deductionsSlices}
                    size={170}
                    thickness={22}
                    centerTitle="Deductions"
                    centerValue={`₹${(Number(selectedBatch.totalDeductions) / 1000).toFixed(0)}k`}
                  />
                </div>

                {/* Compliance & Audit Ratios */}
                <div style={{ background: '#f8fafc', padding: '18px', borderRadius: '8px', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                  <div>
                    <h4 style={{ fontSize: '13px', fontWeight: 700, color: '#334155', marginBottom: '4px' }}>
                      Compliance Audit Ratios
                    </h4>
                    <p style={{ fontSize: '11px', color: '#64748b', marginBottom: '14px' }}>
                      Statutory efficiency metrics for Month {selectedBatch.month}/{selectedBatch.year}.
                    </p>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '12px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '6px', borderBottom: '1px dashed #e2e8f0' }}>
                        <span style={{ color: '#64748b' }}>Take-Home Pay Ratio:</span>
                        <strong>{Number(selectedBatch.totalGrossPay) > 0 ? ((Number(selectedBatch.totalNetPay) / Number(selectedBatch.totalGrossPay)) * 100).toFixed(1) : 0}%</strong>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '6px', borderBottom: '1px dashed #e2e8f0' }}>
                        <span style={{ color: '#64748b' }}>Employee Deduction Rate:</span>
                        <strong style={{ color: '#dc2626' }}>{Number(selectedBatch.totalGrossPay) > 0 ? ((Number(selectedBatch.totalDeductions) / Number(selectedBatch.totalGrossPay)) * 100).toFixed(1) : 0}%</strong>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '6px', borderBottom: '1px dashed #e2e8f0' }}>
                        <span style={{ color: '#64748b' }}>Employer Statutory Burden:</span>
                        <strong style={{ color: '#d97706' }}>{Number(selectedBatch.totalGrossPay) > 0 ? ((totalEmployerStatutory / Number(selectedBatch.totalGrossPay)) * 100).toFixed(1) : 0}%</strong>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '6px', borderBottom: '1px dashed #e2e8f0' }}>
                        <span style={{ color: '#64748b' }}>PF Wage Ceiling:</span>
                        <span className="badge badge-active" style={{ fontSize: '10px' }}>₹{config?.pfCeilingAmount || 15000}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: '#64748b' }}>Rounding Standard:</span>
                        <span style={{ color: '#16a34a', fontWeight: 600 }}>Whole Rupee at Net</span>
                      </div>
                    </div>
                  </div>

                  <div style={{ background: '#ffffff', padding: '10px', borderRadius: '6px', border: '1px solid #e2e8f0', marginTop: '12px', fontSize: '11px', color: '#64748b' }}>
                    💡 <em>Formulas conform strictly to Indian Reference Model (PF 12% on min(Basic, ₹15,000) prorated by attendance).</em>
                  </div>
                </div>
              </div>

              {/* Adjustments & Bonuses Table */}
              {selectedBatch.adjustments && selectedBatch.adjustments.length > 0 && (
                <div style={{ marginBottom: '24px' }}>
                  <h4 style={{ fontSize: '14px', fontWeight: 700, marginBottom: '10px' }}>
                    Adjustments & Bonuses ({selectedBatch.adjustments.length})
                  </h4>
                  <div className="table-responsive">
                    <table style={{ marginBottom: '16px' }}>
                      <thead>
                        <tr>
                          <th>Employee</th>
                          <th>Type</th>
                          <th>Amount</th>
                          <th>Reason / Note</th>
                          <th>Status</th>
                          {isFinance && selectedBatch.status === 'DRAFT' && <th>Action</th>}
                        </tr>
                      </thead>
                      <tbody>
                        {selectedBatch.adjustments.map((adj: any) => {
                          const isAddition = ['BONUS', 'ARREARS', 'OVERTIME', 'REIMBURSEMENT'].includes(adj.type);
                          return (
                            <tr key={adj.id}>
                              <td><strong>{adj.employee?.employeeCode}</strong> — {adj.employee?.firstName} {adj.employee?.lastName}</td>
                              <td>
                                <span className="badge" style={{
                                  background: isAddition ? '#dcfce7' : '#fee2e2',
                                  color: isAddition ? '#166534' : '#991b1b',
                                  fontSize: '11px',
                                }}>
                                  {adj.type}
                                </span>
                              </td>
                              <td style={{ fontWeight: 700, color: isAddition ? '#16a34a' : '#dc2626' }}>
                                {isAddition ? '+' : '-'}₹{Number(adj.amount).toFixed(2)}
                              </td>
                              <td style={{ fontSize: '12px' }}>{adj.description || '—'}</td>
                              <td>
                                <span className={`badge ${adj.isProcessed ? 'badge-active' : 'badge-inactive'}`}>
                                  {adj.isProcessed ? 'Included in Batch' : 'Pending'}
                                </span>
                              </td>
                              {isFinance && selectedBatch.status === 'DRAFT' && (
                                <td>
                                  <button
                                    type="button"
                                    className="btn btn-secondary"
                                    style={{ padding: '2px 8px', fontSize: '11px', color: '#dc2626', borderColor: '#fca5a5' }}
                                    onClick={async () => {
                                      if (!confirm(`Delete adjustment ${adj.type} of ₹${adj.amount}?`)) return;
                                      try {
                                        await api.deletePayrollAdjustment(adj.id);
                                        alert('Adjustment deleted! Recalculate draft batch to update payroll totals.');
                                        loadBatchDetails(selectedBatch.id);
                                      } catch (err: any) {
                                        alert(err.message || 'Failed to delete adjustment');
                                      }
                                    }}
                                  >
                                    Remove
                                  </button>
                                </td>
                              )}
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Individual Employee Payslips with Search & Filters */}
              <div style={{ marginBottom: '14px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap', gap: '10px' }}>
                  <h4 style={{ fontSize: '14px', fontWeight: 700, margin: 0 }}>
                    Itemized Employee Payslips ({filteredPayslips.length} of {payslips.length})
                  </h4>

                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                    {/* Search Input */}
                    <input
                      type="text"
                      placeholder="Search employee, code, dept..."
                      value={payslipSearch}
                      onChange={(e) => setPayslipSearch(e.target.value)}
                      style={{ padding: '5px 10px', fontSize: '12px', border: '1px solid #cbd5e1', borderRadius: '4px', width: '200px' }}
                    />

                    {/* Filter Pills */}
                    <button
                      type="button"
                      className={`btn ${payslipFilter === 'ALL' ? 'btn-primary' : 'btn-secondary'}`}
                      style={{ padding: '4px 10px', fontSize: '11px' }}
                      onClick={() => setPayslipFilter('ALL')}
                    >
                      All ({payslips.length})
                    </button>
                    <button
                      type="button"
                      className={`btn ${payslipFilter === 'PRORATED' ? 'btn-primary' : 'btn-secondary'}`}
                      style={{ padding: '4px 10px', fontSize: '11px' }}
                      onClick={() => setPayslipFilter('PRORATED')}
                    >
                      Prorated ({proratedCount})
                    </button>
                    <button
                      type="button"
                      className={`btn ${payslipFilter === 'WITH_BONUS' ? 'btn-primary' : 'btn-secondary'}`}
                      style={{ padding: '4px 10px', fontSize: '11px' }}
                      onClick={() => setPayslipFilter('WITH_BONUS')}
                    >
                      With Bonuses ({bonusCount})
                    </button>
                  </div>
                </div>

                <div className="table-responsive">
                  <table>
                    <thead>
                      <tr>
                        <th>Code</th>
                        <th>Employee</th>
                        <th>Attendance</th>
                        <th>Earned Basic</th>
                        <th>Earned Gross</th>
                        <th>Bonus / Add.</th>
                        <th>PF (12%)</th>
                        <th>ESI</th>
                        <th>PT</th>
                        <th>Deductions</th>
                        <th>Net Take-Home</th>
                        <th>Payslip</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredPayslips.map((ps: any) => {
                        const additions = Number(ps.bonusAmount || 0) + Number(ps.arrearsAmount || 0) + Number(ps.otherAdditions || 0);
                        const isProrated = Number(ps.payableDays) < Number(ps.totalMonthDays);

                        return (
                          <tr key={ps.id}>
                            <td><strong>{ps.employee?.employeeCode}</strong></td>
                            <td>
                              <div>
                                <span style={{ fontWeight: 600 }}>{ps.employee?.firstName} {ps.employee?.lastName}</span>
                                {ps.employee?.department?.name && (
                                  <div style={{ fontSize: '10px', color: '#64748b' }}>{ps.employee.department.name}</div>
                                )}
                              </div>
                            </td>
                            <td>
                              {isProrated ? (
                                <span className="badge badge-inactive" style={{ background: '#fef3c7', color: '#b45309', border: '1px solid #fde68a', fontSize: '11px' }} title="Prorated based on attendance/absences">
                                  {ps.payableDays}/{ps.totalMonthDays}d (Prorated)
                                </span>
                              ) : (
                                <span className="badge badge-active" style={{ fontSize: '11px' }}>
                                  {ps.payableDays}/{ps.totalMonthDays}d
                                </span>
                              )}
                            </td>
                            <td>₹{Number(ps.earnedBasic).toFixed(2)}</td>
                            <td>₹{Number(ps.earnedGross).toFixed(2)}</td>
                            <td style={{ color: additions > 0 ? '#16a34a' : '#64748b', fontWeight: additions > 0 ? 700 : 'normal' }}>
                              {additions > 0 ? `+₹${additions.toFixed(2)}` : '—'}
                            </td>
                            <td>₹{Number(ps.employeePf).toFixed(2)}</td>
                            <td>₹{Number(ps.employeeEsi || 0).toFixed(2)}</td>
                            <td>₹{Number(ps.professionalTax).toFixed(2)}</td>
                            <td style={{ color: '#dc2626', fontWeight: 600 }}>₹{Number(ps.totalDeductions).toFixed(2)}</td>
                            <td style={{ fontWeight: 800, color: '#16a34a', fontSize: '14px' }}>₹{Number(ps.netPay).toFixed(2)}</td>
                            <td>
                              <div style={{ display: 'flex', gap: '4px' }}>
                                <a
                                  href={api.getPayslipViewHtmlUrl(ps.id)}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="btn btn-secondary"
                                  style={{ padding: '3px 8px', fontSize: '11px' }}
                                >
                                  Web
                                </a>
                                <button
                                  type="button"
                                  onClick={() => api.downloadPayslipPdf(ps.id, `Payslip-${ps.employee?.employeeCode || ps.id}-${selectedBatch.month}-${selectedBatch.year}.pdf`)}
                                  className="btn btn-primary"
                                  style={{ padding: '3px 8px', fontSize: '11px' }}
                                >
                                  PDF
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          );
        })() : (
          <div style={{ color: '#64748b', fontSize: '13px', padding: '20px 0', textAlign: 'center' }}>
            No payroll batches generated yet. Click "Calculate Draft Batch" above to start.
          </div>
        )}
      </div>

      {/* Set Salary Structure Modal */}
      {showSalaryModal && (
        <Modal onClose={() => setShowSalaryModal(false)}>
          <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(4px)',
            display: 'flex', justifyContent: 'center', alignItems: 'center',
            zIndex: 1000, padding: '20px', boxSizing: 'border-box',
          }}>
            <div className="card" style={{ width: '500px', maxWidth: '100%', maxHeight: '90vh', overflowY: 'auto' }}>

              <h3 style={{ marginBottom: '14px' }}>Set / Revise Salary Structure</h3>
              <p style={{ fontSize: '12px', color: '#64748b', marginBottom: '14px' }}>
                Append-Only Ledger (Rule #4): Updates close previous active row with <code>effectiveTo</code> and creates a new active version.
              </p>

              <form onSubmit={handleSetSalary} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 600 }}>Employee</label>
                  <select
                    value={salEmpId}
                    onChange={(e) => setSalEmpId(e.target.value)}
                    style={{ width: '100%', padding: '8px', border: '1px solid #cbd5e1', borderRadius: '4px', marginTop: '4px' }}
                  >
                    {employees.map((emp) => (
                      <option key={emp.id} value={emp.id}>
                        {emp.employeeCode} — {emp.firstName} {emp.lastName}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={{ fontSize: '12px', fontWeight: 600 }}>Annual CTC (INR)</label>
                  <input
                    type="number"
                    value={salAnnualCtc}
                    onChange={(e) => setSalAnnualCtc(Number(e.target.value))}
                    step="1000"
                    required
                    style={{ width: '100%', padding: '8px', border: '1px solid #cbd5e1', borderRadius: '4px', marginTop: '4px' }}
                  />
                </div>

                {/* Automatic Statutory Breakdown Preview */}
                <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '6px', fontSize: '12px', border: '1px solid #e2e8f0' }}>
                  <div style={{ fontWeight: 700, marginBottom: '6px' }}>Monthly Breakdown Preview:</div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>Monthly Gross:</span> <strong>₹{monthlyGrossPreview}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>Basic (50%):</span> <strong>₹{basicPreview}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>HRA (25%):</span> <strong>₹{hraPreview}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>Special Allowance (25%):</span> <strong>₹{splPreview}</strong>
                  </div>
                </div>

                <div>
                  <label style={{ fontSize: '12px', fontWeight: 600 }}>Effective From Date</label>
                  <input
                    type="date"
                    value={salEffectiveFrom}
                    onChange={(e) => setSalEffectiveFrom(e.target.value)}
                    required
                    style={{ width: '100%', padding: '8px', border: '1px solid #cbd5e1', borderRadius: '4px', marginTop: '4px' }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: '12px', fontWeight: 600 }}>Revision Reason</label>
                  <input
                    type="text"
                    value={salReason}
                    onChange={(e) => setSalReason(e.target.value)}
                    style={{ width: '100%', padding: '8px', border: '1px solid #cbd5e1', borderRadius: '4px', marginTop: '4px' }}
                  />
                </div>


                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '14px' }}>
                  <button type="button" className="btn btn-secondary" onClick={() => setShowSalaryModal(false)}>
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-primary" disabled={salSubmitting}>
                    {salSubmitting ? 'Saving...' : 'Save Structure'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </Modal>
      )}

      {/* Disburse Batch Modal */}
      {showDisburseModal && (
        <Modal onClose={() => setShowDisburseModal(false)}>
          <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(4px)',
            display: 'flex', justifyContent: 'center', alignItems: 'center',
            zIndex: 1000, padding: '20px', boxSizing: 'border-box',
          }}>
            <div className="card" style={{ width: '450px', maxWidth: '100%', maxHeight: '90vh', overflowY: 'auto' }}>
              <h3 style={{ marginBottom: '14px' }}>Disburse Payroll Batch</h3>
              <p style={{ fontSize: '12px', color: '#64748b', marginBottom: '14px' }}>
                Confirm corporate bank disbursal and record the transaction reference identifier.
              </p>

              <form onSubmit={handleDisburseBatch} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 600 }}>Payment Reference (UTR / Batch Ref)</label>
                  <input
                    type="text"
                    value={paymentRef}
                    onChange={(e) => setPaymentRef(e.target.value)}
                    required
                    style={{ width: '100%', padding: '8px', border: '1px solid #cbd5e1', borderRadius: '4px', marginTop: '4px' }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: '12px', fontWeight: 600 }}>Disbursal Notes</label>
                  <input
                    type="text"
                    value={disburseNotes}
                    onChange={(e) => setDisburseNotes(e.target.value)}
                    style={{ width: '100%', padding: '8px', border: '1px solid #cbd5e1', borderRadius: '4px', marginTop: '4px' }}
                  />
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '14px' }}>
                  <button type="button" className="btn btn-secondary" onClick={() => setShowDisburseModal(false)}>
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-primary" disabled={disburseLoading} style={{ background: '#16a34a' }}>
                    {disburseLoading ? 'Disbursing...' : 'Confirm Disbursal'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </Modal>
      )}

      {/* Bonus & Adjustment Modal */}
      {showAdjModal && (
        <Modal onClose={() => setShowAdjModal(false)}>
          <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(4px)',
            display: 'flex', justifyContent: 'center', alignItems: 'center',
            zIndex: 1000, padding: '20px', boxSizing: 'border-box',
          }}>
            <div className="card" style={{ width: '500px', maxWidth: '100%', maxHeight: '90vh', overflowY: 'auto' }}>
              <h3 style={{ marginBottom: '14px' }}>Add One-Time Adjustment or Bonus</h3>
              <p style={{ fontSize: '12px', color: '#64748b', marginBottom: '14px' }}>
                Append an adjustment (Bonus, Arrears, Overtime, Reimbursement, TDS, or Deduction) to an employee for a specific pay period.
              </p>

              <form onSubmit={handleCreateAdjustment} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 600 }}>Employee</label>
                  <select
                    value={adjEmpId}
                    onChange={(e) => setAdjEmpId(e.target.value)}
                    required
                    style={{ width: '100%', padding: '8px', border: '1px solid #cbd5e1', borderRadius: '4px', marginTop: '4px' }}
                  >
                    {employees.map((emp) => (
                      <option key={emp.id} value={emp.id}>
                        {emp.employeeCode} — {emp.firstName} {emp.lastName}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="modal-form-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <div>
                    <label style={{ fontSize: '12px', fontWeight: 600 }}>Year</label>
                    <input
                      type="number"
                      value={adjYear}
                      onChange={(e) => setAdjYear(Number(e.target.value))}
                      required
                      style={{ width: '100%', padding: '8px', border: '1px solid #cbd5e1', borderRadius: '4px', marginTop: '4px' }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '12px', fontWeight: 600 }}>Month (1-12)</label>
                    <input
                      type="number"
                      min={1}
                      max={12}
                      value={adjMonth}
                      onChange={(e) => setAdjMonth(Number(e.target.value))}
                      required
                      style={{ width: '100%', padding: '8px', border: '1px solid #cbd5e1', borderRadius: '4px', marginTop: '4px' }}
                    />
                  </div>
                </div>

                <div>
                  <label style={{ fontSize: '12px', fontWeight: 600 }}>Adjustment Type</label>
                  <select
                    value={adjType}
                    onChange={(e) => setAdjType(e.target.value)}
                    required
                    style={{ width: '100%', padding: '8px', border: '1px solid #cbd5e1', borderRadius: '4px', marginTop: '4px' }}
                  >
                    <optgroup label="Earnings / Additions">
                      <option value="BONUS">Bonus (Performance, Festive, etc.)</option>
                      <option value="ARREARS">Arrears (Past adjustment)</option>
                      <option value="OVERTIME">Overtime</option>
                      <option value="REIMBURSEMENT">Reimbursement</option>
                    </optgroup>
                    <optgroup label="Deductions">
                      <option value="TDS">TDS (Income Tax)</option>
                      <option value="OTHER_DEDUCTION">Other Custom Deduction</option>
                    </optgroup>
                  </select>
                </div>

                <div>
                  <label style={{ fontSize: '12px', fontWeight: 600 }}>Amount (₹ INR)</label>
                  <input
                    type="number"
                    min={1}
                    step="0.01"
                    value={adjAmount}
                    onChange={(e) => setAdjAmount(Number(e.target.value))}
                    required
                    style={{ width: '100%', padding: '8px', border: '1px solid #cbd5e1', borderRadius: '4px', marginTop: '4px' }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: '12px', fontWeight: 600 }}>Reason / Description</label>
                  <input
                    type="text"
                    value={adjReason}
                    onChange={(e) => setAdjReason(e.target.value)}
                    placeholder="e.g. Q3 Performance Incentive"
                    required
                    style={{ width: '100%', padding: '8px', border: '1px solid #cbd5e1', borderRadius: '4px', marginTop: '4px' }}
                  />
                </div>

                <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '12px' }}>
                  <button type="button" className="btn btn-secondary" onClick={() => setShowAdjModal(false)}>
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-primary" disabled={adjSubmitting}>
                    {adjSubmitting ? 'Saving...' : 'Add Adjustment'}
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
