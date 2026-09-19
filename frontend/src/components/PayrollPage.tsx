import { useEffect, useState } from 'react';
import { api } from '../api';

export function PayrollPage({ user }: { user: any }) {
  const [config, setConfig] = useState<any>(null);
  const [batches, setBatches] = useState<any[]>([]);
  const [selectedBatch, setSelectedBatch] = useState<any>(null);
  const [employees, setEmployees] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

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
      if (empsRes.data?.length > 0) setSalEmpId(empsRes.data[0].id);
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
        <h3 style={{ fontSize: '16px', fontWeight: 600 }}>🔒 Payroll Console Restricted</h3>
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
            <h2 style={{ fontSize: '18px', fontWeight: 700 }}>💰 Payroll Management Engine</h2>
            <p style={{ fontSize: '13px', color: '#64748b', marginTop: '4px' }}>
              Option A (Indian Reference Model): Prorated-then-PF math, configurable PF ceiling, PT threshold, immutable batch lifecycle, and bank advice.
            </p>
          </div>
          {isFinance && (
            <button className="btn btn-primary" onClick={() => setShowSalaryModal(true)}>
              💵 Define / Revise Salary Structure
            </button>
          )}
        </div>
      </div>

      {error && <div className="card" style={{ color: '#dc2626' }}>{error}</div>}

      {/* Compliance Configuration Snapshot */}
      {config && (
        <div className="card" style={{ background: '#f8fafc', border: '1px solid #e2e8f0' }}>
          <h3 style={{ fontSize: '14px', fontWeight: 700, color: '#475569', marginBottom: '10px' }}>
            ⚙️ Statutory & Compliance Configuration
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '10px', fontSize: '12px' }}>
            <div><span style={{ color: '#64748b' }}>Salary Formula:</span> <strong>50% Basic / 25% HRA / 25% Spl</strong></div>
            <div><span style={{ color: '#64748b' }}>PF Wage Ceiling:</span> <strong>₹{config.pfCeilingAmount}</strong> {config.applyPfCeiling ? '(Active)' : '(Uncapped)'}</div>
            <div><span style={{ color: '#64748b' }}>PF Rates:</span> <strong>{config.pfEmployeeRate}% Emp / {config.pfEmployerRate}% Empr</strong></div>
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
                📥 Download Bank Advice (CSV)
              </button>

              {selectedBatch.status === 'DRAFT' && (
                <button
                  className="btn btn-primary"
                  onClick={handleLockBatch}
                  style={{ background: '#f59e0b', borderColor: '#d97706', fontSize: '12px' }}
                >
                  🔒 Lock Batch (Freeze)
                </button>
              )}

              {selectedBatch.status === 'LOCKED' && (
                <button
                  className="btn btn-primary"
                  onClick={() => setShowDisburseModal(true)}
                  style={{ background: '#16a34a', borderColor: '#15803d', fontSize: '12px' }}
                >
                  💳 Disburse Batch
                </button>
              )}
            </div>
          )}
        </div>

        {selectedBatch ? (
          <div>
            {/* Summary Metrics */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '12px', marginBottom: '20px' }}>
              <div style={{ background: '#f8fafc', padding: '14px', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                <div style={{ fontSize: '11px', color: '#64748b' }}>Batch Status</div>
                <div style={{ fontSize: '16px', fontWeight: 800, marginTop: '4px' }}>
                  <span className={`badge ${selectedBatch.status === 'DISBURSED' ? 'badge-active' : selectedBatch.status === 'LOCKED' ? 'badge-role' : 'badge-inactive'}`}>
                    {selectedBatch.status}
                  </span>
                </div>
              </div>

              <div style={{ background: '#f8fafc', padding: '14px', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                <div style={{ fontSize: '11px', color: '#64748b' }}>Employees Processed</div>
                <div style={{ fontSize: '20px', fontWeight: 800, marginTop: '4px' }}>{selectedBatch.totalEmployees}</div>
              </div>

              <div style={{ background: '#f8fafc', padding: '14px', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                <div style={{ fontSize: '11px', color: '#64748b' }}>Total Gross Earnings</div>
                <div style={{ fontSize: '18px', fontWeight: 800, marginTop: '4px', color: '#1e293b' }}>
                  ₹{Number(selectedBatch.totalGrossPay).toLocaleString('en-IN')}
                </div>
              </div>

              <div style={{ background: '#f8fafc', padding: '14px', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                <div style={{ fontSize: '11px', color: '#64748b' }}>Total Deductions (PF+PT)</div>
                <div style={{ fontSize: '18px', fontWeight: 800, marginTop: '4px', color: '#dc2626' }}>
                  ₹{Number(selectedBatch.totalDeductions).toLocaleString('en-IN')}
                </div>
              </div>

              <div style={{ background: '#eff6ff', padding: '14px', borderRadius: '6px', border: '1px solid #bfdbfe' }}>
                <div style={{ fontSize: '11px', color: '#1e40af' }}>Total Net Take-Home</div>
                <div style={{ fontSize: '20px', fontWeight: 900, marginTop: '4px', color: '#1d4ed8' }}>
                  ₹{Number(selectedBatch.totalNetPay).toLocaleString('en-IN')}
                </div>
              </div>
            </div>

            {/* Payslips Table */}
            <h4 style={{ fontSize: '14px', fontWeight: 700, marginBottom: '10px' }}>
              Individual Employee Payslips ({selectedBatch.payslips?.length || 0})
            </h4>

            <table>
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Name</th>
                  <th>Payable Days</th>
                  <th>Earned Basic</th>
                  <th>Earned Gross</th>
                  <th>PF (Emp)</th>
                  <th>PT</th>
                  <th>Total Deductions</th>
                  <th>Net Take-Home</th>
                  <th>Payslip View</th>
                </tr>
              </thead>
              <tbody>
                {(selectedBatch.payslips || []).map((ps: any) => (
                  <tr key={ps.id}>
                    <td><strong>{ps.employee?.employeeCode}</strong></td>
                    <td>{ps.employee?.firstName} {ps.employee?.lastName}</td>
                    <td>{ps.payableDays} / {ps.totalMonthDays}</td>
                    <td>₹{Number(ps.earnedBasic).toFixed(2)}</td>
                    <td>₹{Number(ps.earnedGross).toFixed(2)}</td>
                    <td>₹{Number(ps.employeePf).toFixed(2)}</td>
                    <td>₹{Number(ps.professionalTax).toFixed(2)}</td>
                    <td style={{ color: '#dc2626' }}>₹{Number(ps.totalDeductions).toFixed(2)}</td>
                    <td style={{ fontWeight: 800, color: '#16a34a' }}>₹{Number(ps.netPay).toFixed(2)}</td>
                    <td>
                      <a
                        href={api.getPayslipViewHtmlUrl(ps.id)}
                        target="_blank"
                        rel="noreferrer"
                        className="btn btn-secondary"
                        style={{ padding: '3px 8px', fontSize: '11px' }}
                      >
                        📄 Printable View
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div style={{ color: '#64748b', fontSize: '13px', padding: '20px 0', textAlign: 'center' }}>
            No payroll batches generated yet. Click "Calculate Draft Batch" above to start.
          </div>
        )}
      </div>

      {/* Set Salary Structure Modal */}
      {showSalaryModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000
        }}>
          <div className="card" style={{ width: '500px', maxWidth: '90%' }}>
            <h3 style={{ marginBottom: '14px' }}>💵 Set / Revise Salary Structure</h3>
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
      )}

      {/* Disburse Batch Modal */}
      {showDisburseModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000
        }}>
          <div className="card" style={{ width: '450px', maxWidth: '90%' }}>
            <h3 style={{ marginBottom: '14px' }}>💳 Disburse Payroll Batch</h3>
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
      )}
    </div>
  );
}
