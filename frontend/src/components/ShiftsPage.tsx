import { useEffect, useState } from 'react';
import { api } from '../api';
import { Modal } from './Modal';
import { DonutChart } from './ReportCharts';
import { showToast } from './Toast';

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
      showToast.warning('Please select both an employee and a shift template.');
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
      showToast.success('Shift assigned successfully!');
      setShowAssignModal(false);
    } catch (err: any) {
      showToast.error(err.message || 'Failed to assign shift');
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

  const totalShifts = shifts.length;
  const activeShifts = shifts.filter((s) => s.isActive !== false).length;
  const overnightShifts = shifts.filter((s) => s.isOvernight).length;
  const defaultShift = shifts.find((s) => s.isDefault);
  const totalEmployees = employees.length;

  const shiftDurationSlices = shifts.map((s) => ({
    label: `${s.code} (${s.name})`,
    value: Math.round(s.fullDayThresholdMinutes / 60),
    sublabel: `${s.startTime} - ${s.endTime} (${s.fullDayThresholdMinutes / 60}h req)`,
  }));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <div>
            <h2 style={{ fontSize: '18px', fontWeight: 700 }}>⏱️ Shift Management</h2>
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
            Assign Shift to Employee
          </button>
        </div>

        {/* Shift Roster Metric Strip */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px', marginBottom: '20px' }}>
          <div style={{ background: '#f8fafc', padding: '14px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
            <div style={{ fontSize: '11px', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Configured Shifts</div>
            <div style={{ fontSize: '24px', fontWeight: 700, color: '#0f172a', marginTop: '4px' }}>{totalShifts}</div>
            <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>{activeShifts} active in roster</div>
          </div>
          <div style={{ background: '#eff6ff', padding: '14px', borderRadius: '8px', border: '1px solid #bfdbfe' }}>
            <div style={{ fontSize: '11px', fontWeight: 600, color: '#2563eb', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Default Schedule</div>
            <div style={{ fontSize: '20px', fontWeight: 700, color: '#1d4ed8', marginTop: '4px' }}>{defaultShift?.code || 'GEN'}</div>
            <div style={{ fontSize: '11px', color: '#3b82f6', marginTop: '2px' }}>{defaultShift?.name || 'General'} ({defaultShift?.startTime || '09:00'} - {defaultShift?.endTime || '18:00'})</div>
          </div>
          <div style={{ background: '#fefce8', padding: '14px', borderRadius: '8px', border: '1px solid #fef08a' }}>
            <div style={{ fontSize: '11px', fontWeight: 600, color: '#ca8a04', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Overnight Shifts</div>
            <div style={{ fontSize: '24px', fontWeight: 700, color: '#a16207', marginTop: '4px' }}>{overnightShifts}</div>
            <div style={{ fontSize: '11px', color: '#ca8a04', marginTop: '2px' }}>{overnightShifts > 0 ? 'Cross-midnight spans' : 'Standard daytime'}</div>
          </div>
          <div style={{ background: '#ecfdf5', padding: '14px', borderRadius: '8px', border: '1px solid #a7f3d0' }}>
            <div style={{ fontSize: '11px', fontWeight: 600, color: '#059669', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Eligible Headcount</div>
            <div style={{ fontSize: '24px', fontWeight: 700, color: '#047857', marginTop: '4px' }}>{totalEmployees}</div>
            <div style={{ fontSize: '11px', color: '#10b981', marginTop: '2px' }}>Active personnel tracked</div>
          </div>
        </div>

        {/* Visual Analytics Panel */}
        {shifts.length > 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px', marginBottom: '20px' }}>
            <div style={{ background: '#ffffff', padding: '16px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
              <div style={{ fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '8px' }}>Shift Duration & Thresholds (Hours)</div>
              <DonutChart data={shiftDurationSlices} size={160} />
            </div>
            <div style={{ background: '#ffffff', padding: '16px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
              <div style={{ fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '10px' }}>Attendance Safeguard Policy Rules</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '12px', color: '#475569' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 8px', background: '#f8fafc', borderRadius: '4px' }}>
                  <span>Default Grace Period:</span>
                  <strong style={{ color: '#0f172a' }}>{defaultShift?.gracePeriodMinutes || 15} minutes</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 8px', background: '#f8fafc', borderRadius: '4px' }}>
                  <span>Full-Day Attendance Threshold:</span>
                  <strong style={{ color: '#0f172a' }}>{(defaultShift?.fullDayThresholdMinutes || 480) / 60} hours</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 8px', background: '#f8fafc', borderRadius: '4px' }}>
                  <span>Half-Day Minimum Threshold:</span>
                  <strong style={{ color: '#0f172a' }}>{(defaultShift?.halfDayThresholdMinutes || 240) / 60} hours</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 8px', background: '#f8fafc', borderRadius: '4px' }}>
                  <span>Deductible Break Duration:</span>
                  <strong style={{ color: '#0f172a' }}>{defaultShift?.breakDurationMinutes || 60} minutes</strong>
                </div>
              </div>
            </div>
          </div>
        )}

        {error && <div style={{ color: '#dc2626', marginBottom: '12px' }}>{error}</div>}

        {loading ? (
          <div>Loading shifts...</div>
        ) : (
          <div className="table-responsive">
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
          </div>
        )}
      </div>

      {/* Assign Modal */}
      {showAssignModal && (
        <Modal onClose={() => setShowAssignModal(false)}>
          <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(4px)',
            display: 'flex', justifyContent: 'center', alignItems: 'center',
            zIndex: 1000, padding: '20px', boxSizing: 'border-box',
          }}>
            <div className="card" style={{ width: '480px', maxWidth: '100%', maxHeight: '90vh', overflowY: 'auto' }}>

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
        </Modal>
      )}

    </div>
  );
}
