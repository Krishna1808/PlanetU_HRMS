import { useEffect, useState } from 'react';
import { api } from '../api';

export function ShiftsPage() {
  const [shifts, setShifts] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Assign modal
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [selectedEmpId, setSelectedEmpId] = useState('');
  const [selectedShiftId, setSelectedShiftId] = useState('');
  const [effectiveFrom, setEffectiveFrom] = useState(new Date().toISOString().split('T')[0]);
  const [weeklyOffs, setWeeklyOffs] = useState<string[]>(['SATURDAY', 'SUNDAY']);
  const [submitting, setSubmitting] = useState(false);

  const loadData = async () => {
    try {
      setLoading(true);
      setError('');
      const [shiftsRes, empsRes] = await Promise.all([
        api.getShifts(),
        api.getEmployees(),
      ]);
      setShifts(shiftsRes);
      setEmployees(empsRes.data || []);
      if (shiftsRes.length > 0) setSelectedShiftId(shiftsRes[0].id);
      if (empsRes.data?.length > 0) setSelectedEmpId(empsRes.data[0].id);
    } catch (err: any) {
      setError(err.message || 'Failed to load shifts data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleAssign = async (e: React.FormEvent) => {
    e.preventDefault();
    const empId = selectedEmpId || (employees.length > 0 ? employees[0].id : '');
    const sId = selectedShiftId || (shifts.length > 0 ? shifts[0].id : '');

    if (!empId || !sId) {
      alert('Please select both an employee and a shift template.');
      return;
    }

    try {
      setSubmitting(true);
      await api.assignShift({
        employeeId: empId,
        shiftId: sId,
        effectiveFrom: new Date(effectiveFrom).toISOString(),
        weeklyOffDays: weeklyOffs,
      });
      alert('Shift assigned successfully!');
      setShowAssignModal(false);
    } catch (err: any) {
      alert(err.message || 'Failed to assign shift');
    } finally {
      setSubmitting(false);
    }
  };

  const toggleDay = (day: string) => {
    setWeeklyOffs((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]
    );
  };

  const daysOfWeek = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY'];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <div>
            <h2 style={{ fontSize: '18px', fontWeight: 700 }}>⏱️ Shift Management (Module 3)</h2>
            <p style={{ fontSize: '13px', color: '#64748b', marginTop: '4px' }}>
              Defines working hours, cross-midnight overnight shifts, grace periods, and append-only employee roster assignments.
            </p>
          </div>
          <button
            className="btn btn-primary"
            onClick={() => {
              if (shifts.length > 0 && !selectedShiftId) setSelectedShiftId(shifts[0].id);
              if (employees.length > 0 && !selectedEmpId) setSelectedEmpId(employees[0].id);
              setShowAssignModal(true);
            }}
          >
            ➕ Assign Shift to Employee
          </button>
        </div>

        {error && <div style={{ color: '#dc2626', marginBottom: '12px' }}>{error}</div>}

        {loading ? (
          <div>Loading shifts...</div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Code</th>
                <th>Shift Name</th>
                <th>Work Timings</th>
                <th>Grace Period</th>
                <th>Break</th>
                <th>Full Day / Half Day Threshold</th>
                <th>Default</th>
              </tr>
            </thead>
            <tbody>
              {shifts.map((s) => (
                <tr key={s.id}>
                  <td><span className="badge badge-role">{s.code}</span></td>
                  <td><strong>{s.name}</strong></td>
                  <td>{s.startTime} – {s.endTime} {s.isOvernight && <span style={{ color: '#d97706', fontSize: '11px' }}>(Overnight)</span>}</td>
                  <td>{s.gracePeriodMinutes} mins</td>
                  <td>{s.breakDurationMinutes} mins</td>
                  <td>{s.fullDayThresholdMinutes / 60}h / {s.halfDayThresholdMinutes / 60}h</td>
                  <td>{s.isDefault ? <span className="badge badge-active">Default</span> : 'No'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Assign Modal */}
      {showAssignModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000
        }}>
          <div className="card" style={{ width: '480px', maxWidth: '90%' }}>
            <h3 style={{ marginBottom: '16px' }}>Assign Shift Roster</h3>
            <form onSubmit={handleAssign} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ fontSize: '12px', fontWeight: 600 }}>Select Employee</label>
                <select
                  value={selectedEmpId}
                  onChange={(e) => setSelectedEmpId(e.target.value)}
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
                <label style={{ fontSize: '12px', fontWeight: 600 }}>Select Shift Template</label>
                <select
                  value={selectedShiftId}
                  onChange={(e) => setSelectedShiftId(e.target.value)}
                  style={{ width: '100%', padding: '8px', border: '1px solid #cbd5e1', borderRadius: '4px', marginTop: '4px' }}
                >
                  {shifts.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.code}: {s.startTime} - {s.endTime})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ fontSize: '12px', fontWeight: 600 }}>Effective From Date</label>
                <input
                  type="date"
                  value={effectiveFrom}
                  onChange={(e) => setEffectiveFrom(e.target.value)}
                  style={{ width: '100%', padding: '8px', border: '1px solid #cbd5e1', borderRadius: '4px', marginTop: '4px' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '12px', fontWeight: 600, display: 'block', marginBottom: '6px' }}>
                  Weekly Off Days
                </label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                  {daysOfWeek.map((day) => (
                    <button
                      key={day}
                      type="button"
                      onClick={() => toggleDay(day)}
                      style={{
                        padding: '4px 10px',
                        fontSize: '11px',
                        borderRadius: '4px',
                        border: '1px solid #cbd5e1',
                        cursor: 'pointer',
                        background: weeklyOffs.includes(day) ? '#2563eb' : '#f8fafc',
                        color: weeklyOffs.includes(day) ? 'white' : '#334155',
                      }}
                    >
                      {day.slice(0, 3)}
                    </button>
                  ))}
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '16px' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowAssignModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={submitting}>
                  {submitting ? 'Assigning...' : 'Assign Roster'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
