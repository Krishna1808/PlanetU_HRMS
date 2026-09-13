import { useEffect, useState } from 'react';
import { api } from '../api';

export function AttendancePage() {
  const [todayState, setTodayState] = useState<any>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [remarks, setRemarks] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

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
      const [today, records, emps] = await Promise.all([
        api.getTodayAttendance().catch(() => null),
        api.getMyAttendanceHistory().catch(() => []),
        api.getEmployees().catch(() => ({ data: [] })),
      ]);
      setTodayState(today);
      setHistory(records || []);
      setEmployees(emps.data || []);
      if (emps.data?.length > 0) setQueryEmpId(emps.data[0].id);
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
        <h2 style={{ fontSize: '18px', fontWeight: 700 }}>📍 Attendance Management (Module 4)</h2>
        <p style={{ fontSize: '13px', color: '#64748b', marginTop: '4px' }}>
          Web check-in/out, grace period detection, active duration thresholds, unexcused absence tracking, and the authoritative <strong>single source of truth</strong> for payroll payable days.
        </p>
      </div>

      {error && <div className="card" style={{ color: '#dc2626' }}>{error}</div>}

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
        <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '8px' }}>
          🔍 Authoritative Payable Days Query (Attendance Contract for Payroll)
        </h3>
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
          <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
            <div style={{ fontSize: '14px', fontWeight: 700, color: '#1e293b', marginBottom: '8px' }}>
              Results for {payableDaysResult.employeeName} ({payableDaysResult.employeeCode}) — {payableDaysResult.month}/{payableDaysResult.year}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '10px', fontSize: '13px' }}>
              <div><span style={{ color: '#64748b' }}>Total Month Days:</span> <strong>{payableDaysResult.totalMonthDays}</strong></div>
              <div><span style={{ color: '#64748b' }}>Present Days:</span> <strong>{payableDaysResult.presentDays}</strong></div>
              <div><span style={{ color: '#64748b' }}>Weekly Offs:</span> <strong>{payableDaysResult.weeklyOffDays}</strong></div>
              <div><span style={{ color: '#64748b' }}>Paid Leaves:</span> <strong>{payableDaysResult.paidLeaveDays}</strong></div>
              <div><span style={{ color: '#64748b' }}>Half Days:</span> <strong>{payableDaysResult.halfDays}</strong></div>
              <div><span style={{ color: '#dc2626' }}>Unexcused Absences:</span> <strong>{payableDaysResult.unexcusedAbsenceDays}</strong></div>
              <div><span style={{ color: '#dc2626' }}>LWP Days:</span> <strong>{payableDaysResult.lwpDays}</strong></div>
              <div style={{ color: '#16a34a', fontSize: '15px' }}>
                <span>Final Payable Days:</span> <strong>{payableDaysResult.payableDays}</strong>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Punch History */}
      <div className="card">
        <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '12px' }}>Personal Punch History</h3>
        {loading ? (
          <div>Loading attendance history...</div>
        ) : history.length === 0 ? (
          <div style={{ color: '#64748b', fontSize: '13px' }}>No recorded punches found.</div>
        ) : (
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
        )}
      </div>
    </div>
  );
}
