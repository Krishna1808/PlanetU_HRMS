import { useEffect, useState } from 'react';
import { api } from '../api';
import { CircularGauge } from './ReportCharts';

const toDateInputValue = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export function AttendancePage({ user }: { user?: any } = {}) {
  const [todayState, setTodayState] = useState<any>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [remarks, setRemarks] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [attendanceSummary, setAttendanceSummary] = useState<any>(null);
  const [teamRecords, setTeamRecords] = useState<any[]>([]);
  const [recordsStartDate, setRecordsStartDate] = useState(() => {
    const date = new Date();
    date.setDate(1);
    return toDateInputValue(date);
  });
  const [recordsEndDate, setRecordsEndDate] = useState(() => toDateInputValue(new Date()));

  const isManagerOrAdmin =
    user?.role === 'MANAGER' ||
    user?.role === 'HR_ADMIN' ||
    user?.role === 'CLIENT_SUPER_ADMIN' ||
    user?.role === 'FINANCE';

  // Payable days calculator tester
  const [queryEmpId, setQueryEmpId] = useState('');
  const [queryYear, setQueryYear] = useState(new Date().getFullYear());
  const [queryMonth, setQueryMonth] = useState(new Date().getMonth() + 1);
  const [payableDaysResult, setPayableDaysResult] = useState<any>(null);
  const [calcLoading, setCalcLoading] = useState(false);

  const loadAttendance = async () => {
    try {
      setLoading(true);
      setError('');
      const [today, records, emps, summary, teamAttendance] = await Promise.all([
        api.getTodayAttendance().catch(() => null),
        api.getMyAttendanceHistory().catch(() => []),
        api.getEmployees({ limit: 100 }).catch(() => ({ data: [] })),
        api.getAttendanceSummary().catch(() => null),
        isManagerOrAdmin
          ? api.getAttendanceRecords({ startDate: recordsStartDate, endDate: recordsEndDate }).catch(() => [])
          : Promise.resolve([]),
      ]);
      setTodayState(today);
      setHistory(records || []);
      setEmployees(emps.data || []);
      setAttendanceSummary(summary);
      setTeamRecords(teamAttendance || []);
      if (emps.data?.length > 0) setQueryEmpId((current) => current || emps.data[0].id);
    } catch (err: any) {
      setError(err.message || 'Failed to load attendance');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAttendance();
  }, []);

  const handlePunch = async (type: 'in' | 'out') => {
    try {
      setActionLoading(true);
      if (type === 'in') {
        await api.checkIn(remarks || undefined);
      } else {
        await api.checkOut(remarks || undefined);
      }
      setRemarks('');
      await loadAttendance();
    } catch (err: any) {
      alert(err.message || `Check-${type} failed`);
    } finally {
      setActionLoading(false);
    }
  };

  const handleCalculatePayableDays = async () => {
    if (!queryEmpId) return;
    try {
      setCalcLoading(true);
      const res = await api.getPayableDays(queryEmpId, Number(queryYear), Number(queryMonth));
      setPayableDaysResult(res);
    } catch (err: any) {
      alert(err.message || 'Failed to calculate payable days');
    } finally {
      setCalcLoading(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Module 4 Header */}
      <div className="card">
        <h2 style={{ fontSize: '18px', fontWeight: 700 }}>Attendance Management</h2>
        <p style={{ fontSize: '13px', color: '#64748b', marginTop: '4px' }}>
          Web check-in/out, grace period detection, active duration thresholds, unexcused absence tracking, and the authoritative <strong>single source of truth</strong> for payroll payable days.
        </p>
      </div>

      {error && <div className="card" style={{ color: '#dc2626' }}>{error}</div>}

      {/* Daily Roll-Call & Presence Telemetry */}
      {attendanceSummary && (
        <div className="card" style={{ borderLeft: '4px solid #10b981' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '8px' }}>
            <div>
              <h3 style={{ fontSize: '16px', fontWeight: 600 }}>Daily Roll-Call & Presence Telemetry</h3>
              <p style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>
                Live shift telemetry for today ({attendanceSummary.todayDate}) across active scheduled workforce.
              </p>
            </div>
            <span className="badge badge-active">Live Telemetry</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '24px', flexWrap: 'wrap' }}>
            {/* Presence Circular Gauge */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '14px 18px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0', minWidth: '170px' }}>
              <CircularGauge
                value={attendanceSummary.presenceRate}
                label="Presence Rate"
                sublabel={`${attendanceSummary.present + attendanceSummary.halfDay} of ${attendanceSummary.totalScheduled} Present`}
                size={130}
              />
            </div>

            {/* Metric Strip Cards */}
            <div style={{ flex: 1, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(135px, 1fr))', gap: '12px', minWidth: '240px' }}>
              <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', padding: '12px', borderRadius: '6px' }}>
                <div style={{ fontSize: '11px', fontWeight: 600, color: '#15803d' }}>Present (On-Time)</div>
                <div style={{ fontSize: '20px', fontWeight: 700, color: '#16a34a', marginTop: '4px' }}>
                  {Math.max(0, attendanceSummary.present - attendanceSummary.late)}
                </div>
                <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>Within shift grace window</div>
              </div>

              <div style={{ background: '#fffbeb', border: '1px solid #fde68a', padding: '12px', borderRadius: '6px' }}>
                <div style={{ fontSize: '11px', fontWeight: 600, color: '#b45309' }}>Late Clock-Ins</div>
                <div style={{ fontSize: '20px', fontWeight: 700, color: '#d97706', marginTop: '4px' }}>
                  {attendanceSummary.late}
                </div>
                <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>Exceeded shift grace</div>
              </div>

              <div style={{ background: '#f5f3ff', border: '1px solid #ddd6fe', padding: '12px', borderRadius: '6px' }}>
                <div style={{ fontSize: '11px', fontWeight: 600, color: '#6d28d9' }}>Half-Days</div>
                <div style={{ fontSize: '20px', fontWeight: 700, color: '#7c3aed', marginTop: '4px' }}>
                  {attendanceSummary.halfDay}
                </div>
                <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>0.5 payable weight</div>
              </div>

              <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', padding: '12px', borderRadius: '6px' }}>
                <div style={{ fontSize: '11px', fontWeight: 600, color: '#1d4ed8' }}>On Approved Leave</div>
                <div style={{ fontSize: '20px', fontWeight: 700, color: '#2563eb', marginTop: '4px' }}>
                  {attendanceSummary.onLeave}
                </div>
                <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>Excused via ledger</div>
              </div>

              <div style={{ background: '#fef2f2', border: '1px solid #fecaca', padding: '12px', borderRadius: '6px' }}>
                <div style={{ fontSize: '11px', fontWeight: 600, color: '#b91c1c' }}>Unrecorded / Absent</div>
                <div style={{ fontSize: '20px', fontWeight: 700, color: '#dc2626', marginTop: '4px' }}>
                  {attendanceSummary.unrecorded + attendanceSummary.explicitAbsent}
                </div>
                <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>Awaiting punch or absent</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Today Punch Card */}
      {todayState && (
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 600 }}>Web Punch Clock</h3>
            <span className="badge badge-active">{todayState.status}</span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px', marginBottom: '16px' }}>
            <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '6px' }}>
              <div style={{ fontSize: '11px', color: '#64748b' }}>Check-In Time</div>
              <div style={{ fontSize: '16px', fontWeight: 700, marginTop: '4px' }}>
                {todayState.checkInTime ? new Date(todayState.checkInTime).toLocaleTimeString() : 'Not clocked in'}
              </div>
            </div>
            <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '6px' }}>
              <div style={{ fontSize: '11px', color: '#64748b' }}>Check-Out Time</div>
              <div style={{ fontSize: '16px', fontWeight: 700, marginTop: '4px' }}>
                {todayState.checkOutTime ? new Date(todayState.checkOutTime).toLocaleTimeString() : 'Not clocked out'}
              </div>
            </div>
            <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '6px' }}>
              <div style={{ fontSize: '11px', color: '#64748b' }}>Active Duration</div>
              <div style={{ fontSize: '16px', fontWeight: 700, marginTop: '4px' }}>
                {todayState.totalActiveMinutes !== null ? `${todayState.totalActiveMinutes} mins` : '—'}
              </div>
            </div>
            <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '6px' }}>
              <div style={{ fontSize: '11px', color: '#64748b' }}>Lateness Flag</div>
              <div style={{ fontSize: '14px', fontWeight: 600, marginTop: '4px', color: todayState.isLate ? '#dc2626' : '#16a34a' }}>
                {todayState.isLate ? `Late (+${todayState.lateMinutes || 0}m)` : 'On Time'}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <input
              type="text"
              placeholder="Optional remarks..."
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              style={{ flex: 1, padding: '8px', border: '1px solid #cbd5e1', borderRadius: '4px', fontSize: '13px' }}
            />
            <button
              className="btn btn-primary"
              disabled={actionLoading || Boolean(todayState.checkInTime)}
              onClick={() => handlePunch('in')}
            >
              Clock In
            </button>
            <button
              className="btn btn-secondary"
              disabled={actionLoading || !todayState.checkInTime || Boolean(todayState.checkOutTime)}
              onClick={() => handlePunch('out')}
            >
              Clock Out
            </button>
          </div>
        </div>
      )}

      {/* Authoritative Single Source of Truth for Payroll Contract Tester */}
      <div className="card" style={{ borderLeft: '4px solid #2563eb' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', flexWrap: 'wrap', gap: '8px' }}>
          <h3 style={{ fontSize: '16px', fontWeight: 600 }}>
            Authoritative Payable Days Query (Attendance Contract for Payroll)
          </h3>
          {isManagerOrAdmin && (
            <span className="badge badge-active">Leadership Access</span>
          )}
        </div>
        <p style={{ fontSize: '12px', color: '#64748b', marginBottom: '14px' }}>
          Payroll consumes <code>AttendanceService.getFinalizedPayableDays</code> directly. Test the single source of truth contract for any employee and month:
        </p>

        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center', marginBottom: '16px' }}>
          <select
            value={queryEmpId}
            onChange={(e) => setQueryEmpId(e.target.value)}
            style={{ padding: '8px', border: '1px solid #cbd5e1', borderRadius: '4px', fontSize: '13px', minWidth: '220px' }}
          >
            {employees.map((emp) => (
              <option key={emp.id} value={emp.id}>
                {emp.employeeCode} — {emp.firstName} {emp.lastName}
              </option>
            ))}
          </select>

          <input
            type="number"
            value={queryYear}
            onChange={(e) => setQueryYear(Number(e.target.value))}
            placeholder="Year (e.g. 2026)"
            style={{ width: '100px', padding: '8px', border: '1px solid #cbd5e1', borderRadius: '4px', fontSize: '13px' }}
          />

          <input
            type="number"
            value={queryMonth}
            onChange={(e) => setQueryMonth(Number(e.target.value))}
            placeholder="Month (1-12)"
            min={1}
            max={12}
            style={{ width: '80px', padding: '8px', border: '1px solid #cbd5e1', borderRadius: '4px', fontSize: '13px' }}
          />

          <button className="btn btn-primary" onClick={handleCalculatePayableDays} disabled={calcLoading}>
            {calcLoading ? 'Querying...' : 'Query Payable Days Contract'}
          </button>
        </div>

        {payableDaysResult && (
          <div style={{ background: '#f8fafc', padding: '18px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
              <div style={{ fontSize: '14px', fontWeight: 700, color: '#1e293b' }}>
                Contract Reconciliation: {payableDaysResult.employeeName} ({payableDaysResult.employeeCode}) — Month {payableDaysResult.month}/{payableDaysResult.year}
              </div>
              <span className="badge badge-active" style={{ fontSize: '12px', padding: '4px 10px' }}>
                Total Calendar Days: {payableDaysResult.totalMonthDays}d
              </span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '10px', fontSize: '13px', marginBottom: '14px' }}>
              <div style={{ background: '#ffffff', padding: '10px 12px', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                <div style={{ color: '#64748b', fontSize: '11px' }}>Present Days</div>
                <div style={{ fontSize: '18px', fontWeight: 700, color: '#16a34a' }}>{payableDaysResult.presentDays}</div>
              </div>
              <div style={{ background: '#ffffff', padding: '10px 12px', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                <div style={{ color: '#64748b', fontSize: '11px' }}>Half Days (×0.5)</div>
                <div style={{ fontSize: '18px', fontWeight: 700, color: '#7c3aed' }}>
                  {payableDaysResult.halfDays} <span style={{ fontSize: '12px', fontWeight: 500, color: '#64748b' }}>({(payableDaysResult.halfDays * 0.5).toFixed(1)}d)</span>
                </div>
              </div>
              <div style={{ background: '#ffffff', padding: '10px 12px', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                <div style={{ color: '#64748b', fontSize: '11px' }}>Weekly Offs</div>
                <div style={{ fontSize: '18px', fontWeight: 700, color: '#0284c7' }}>{payableDaysResult.weeklyOffDays}</div>
              </div>
              <div style={{ background: '#ffffff', padding: '10px 12px', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                <div style={{ color: '#64748b', fontSize: '11px' }}>Paid Leaves</div>
                <div style={{ fontSize: '18px', fontWeight: 700, color: '#2563eb' }}>{payableDaysResult.paidLeaveDays}</div>
              </div>
              <div style={{ background: '#f0fdf4', padding: '10px 12px', borderRadius: '6px', border: '1px solid #bbf7d0' }}>
                <div style={{ color: '#15803d', fontSize: '11px', fontWeight: 600 }}>Public Holidays</div>
                <div style={{ fontSize: '18px', fontWeight: 700, color: '#16a34a' }}>
                  {payableDaysResult.holidayDays || 0} <span style={{ fontSize: '10px', background: '#dcfce7', color: '#15803d', padding: '2px 6px', borderRadius: '4px', fontWeight: 600 }}>Statutory</span>
                </div>
              </div>
              <div style={{ background: '#eff6ff', padding: '10px 12px', borderRadius: '6px', border: '1px solid #bfdbfe' }}>
                <div style={{ color: '#1d4ed8', fontSize: '11px', fontWeight: 600 }}>Upcoming Cycle Days</div>
                <div style={{ fontSize: '18px', fontWeight: 700, color: '#2563eb' }}>
                  {payableDaysResult.upcomingScheduledDays || 0} <span style={{ fontSize: '10px', background: '#dbeafe', color: '#1d4ed8', padding: '2px 6px', borderRadius: '4px', fontWeight: 600 }}>Active Month</span>
                </div>
              </div>
              <div style={{ background: '#fef2f2', padding: '10px 12px', borderRadius: '6px', border: '1px solid #fecaca' }}>
                <div style={{ color: '#b91c1c', fontSize: '11px', fontWeight: 600 }}>Unexcused Absences</div>
                <div style={{ fontSize: '18px', fontWeight: 700, color: '#dc2626' }}>{payableDaysResult.unexcusedAbsenceDays}</div>
              </div>
              <div style={{ background: '#fef2f2', padding: '10px 12px', borderRadius: '6px', border: '1px solid #fecaca' }}>
                <div style={{ color: '#b91c1c', fontSize: '11px', fontWeight: 600 }}>LWP Days</div>
                <div style={{ fontSize: '18px', fontWeight: 700, color: '#dc2626' }}>{payableDaysResult.lwpDays}</div>
              </div>
            </div>

            {/* Authoritative Formula Banner */}
            <div style={{ background: '#1e293b', color: '#f8fafc', padding: '12px 16px', borderRadius: '6px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
              <div>
                <div style={{ fontSize: '11px', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Authoritative Formula Execution
                </div>
                <div style={{ fontSize: '12px', color: '#cbd5e1', marginTop: '2px', fontFamily: 'monospace' }}>
                  Payable = {payableDaysResult.presentDays} + ({(payableDaysResult.halfDays * 0.5).toFixed(1)}) + {payableDaysResult.paidLeaveDays} + {payableDaysResult.weeklyOffDays} + {payableDaysResult.holidayDays || 0}
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '12px', color: '#94a3b8' }}>Final Payable Days:</span>
                <span style={{ fontSize: '22px', fontWeight: 800, color: '#4ade80' }}>
                  {payableDaysResult.payableDays} / {payableDaysResult.totalMonthDays}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Role-scoped team attendance: read-only for Finance; Manager scope is enforced by the API. */}
      {isManagerOrAdmin && (
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px', flexWrap: 'wrap', marginBottom: '14px' }}>
            <div>
              <h3 style={{ fontSize: '16px', fontWeight: 700, margin: 0 }}>Team Attendance Records</h3>
              <p style={{ fontSize: '12px', color: '#64748b', margin: '4px 0 0' }}>
                {user?.role === 'FINANCE'
                  ? 'Read-only attendance details for payroll review.'
                  : user?.role === 'MANAGER'
                    ? 'Your department and your direct reports in other departments.'
                    : 'Organization attendance records.'}
              </p>
            </div>
            <span className="badge badge-active">{teamRecords.length} records</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'flex-end', gap: '10px', flexWrap: 'wrap', marginBottom: '14px' }}>
            <label style={{ display: 'flex', flexDirection: 'column', gap: '5px', fontSize: '12px', color: '#475569', fontWeight: 600 }}>
              From
              <input
                type="date"
                value={recordsStartDate}
                max={recordsEndDate}
                onChange={(event) => setRecordsStartDate(event.target.value)}
                style={{ padding: '8px', border: '1px solid #cbd5e1', borderRadius: '6px', fontWeight: 400 }}
              />
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: '5px', fontSize: '12px', color: '#475569', fontWeight: 600 }}>
              To
              <input
                type="date"
                value={recordsEndDate}
                min={recordsStartDate}
                max={toDateInputValue(new Date())}
                onChange={(event) => setRecordsEndDate(event.target.value)}
                style={{ padding: '8px', border: '1px solid #cbd5e1', borderRadius: '6px', fontWeight: 400 }}
              />
            </label>
            <button className="btn btn-primary" onClick={loadAttendance} disabled={loading || !recordsStartDate || !recordsEndDate}>
              {loading ? 'Loading…' : 'Apply date range'}
            </button>
          </div>

          {loading ? (
            <div style={{ padding: '18px 0', color: '#64748b', fontSize: '13px' }}>Loading attendance records…</div>
          ) : teamRecords.length === 0 ? (
            <div style={{ padding: '22px 12px', background: '#f8fafc', border: '1px dashed #cbd5e1', borderRadius: '8px', textAlign: 'center', color: '#64748b', fontSize: '13px' }}>
              No attendance records were found for this date range.
            </div>
          ) : (
            <div className="table-responsive">
              <table>
                <thead>
                  <tr>
                    <th>Employee</th>
                    <th>Department</th>
                    <th>Date</th>
                    <th>Check In</th>
                    <th>Check Out</th>
                    <th>Late By</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {teamRecords.slice(0, 100).map((record) => (
                    <tr key={record.id}>
                      <td>
                        <div style={{ fontWeight: 650, color: '#0f172a' }}>{record.employee?.firstName} {record.employee?.lastName}</div>
                        <div style={{ fontSize: '11px', color: '#64748b' }}>{record.employee?.employeeCode || '—'}</div>
                      </td>
                      <td>{record.employee?.department?.name || '—'}</td>
                      <td>{new Date(record.date).toLocaleDateString()}</td>
                      <td>{record.checkInTime ? new Date(record.checkInTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}</td>
                      <td>{record.checkOutTime ? new Date(record.checkOutTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}</td>
                      <td>{record.isLate ? `${record.lateMinutes || 0} min` : '—'}</td>
                      <td>
                        <span className={record.status === 'PRESENT' ? 'badge badge-active' : 'badge badge-inactive'}>
                          {String(record.status || 'UNKNOWN').replace(/_/g, ' ')}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {teamRecords.length > 100 && (
                <p style={{ fontSize: '12px', color: '#64748b', marginTop: '10px' }}>
                  Showing the latest 100 of {teamRecords.length} records. Narrow the date range to see a smaller period.
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {/* Punch History */}
      <div className="card">
        <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '12px' }}>Personal Punch History</h3>
        {loading ? (
          <div>Loading attendance history...</div>
        ) : history.length === 0 ? (
          <div style={{ color: '#64748b', fontSize: '13px' }}>No recorded punches found.</div>
        ) : (
          <div className="table-responsive">
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Check In</th>
                  <th>Check Out</th>
                  <th>Duration</th>
                  <th>Lateness</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {history.map((rec) => (
                  <tr key={rec.id}>
                    <td>{new Date(rec.date).toLocaleDateString()}</td>
                    <td>{rec.checkInTime ? new Date(rec.checkInTime).toLocaleTimeString() : '—'}</td>
                    <td>{rec.checkOutTime ? new Date(rec.checkOutTime).toLocaleTimeString() : '—'}</td>
                    <td>{rec.totalActiveMinutes !== null ? `${rec.totalActiveMinutes} mins` : '—'}</td>
                    <td>{rec.isLate ? <span style={{ color: '#dc2626', fontWeight: 600 }}>Late ({rec.lateMinutes}m)</span> : 'On Time'}</td>
                    <td>
                      <span className={`badge ${rec.status === 'PRESENT' ? 'badge-active' : 'badge-inactive'}`}>
                        {rec.status}
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
  );
}
