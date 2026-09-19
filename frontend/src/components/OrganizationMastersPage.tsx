import { useEffect, useState } from 'react';
import { api } from '../api';

export function OrganizationMastersPage() {
  const [activeTab, setActiveTab] = useState<'departments' | 'designations' | 'grades' | 'locations'>('departments');
  const [departments, setDepartments] = useState<any[]>([]);
  const [designations, setDesignations] = useState<any[]>([]);
  const [grades, setGrades] = useState<any[]>([]);
  const [locations, setLocations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Department Form State
  const [deptName, setDeptName] = useState('');
  const [deptCodePrefix, setDeptCodePrefix] = useState('');
  const [deptDescription, setDeptDescription] = useState('');

  // Designation Form State
  const [desigName, setDesigName] = useState('');
  const [desigDescription, setDesigDescription] = useState('');

  // Grade Form State
  const [gradeName, setGradeName] = useState('');
  const [gradeLevel, setGradeLevel] = useState<number>(1);
  const [gradeDescription, setGradeDescription] = useState('');

  // Location Form State
  const [locName, setLocName] = useState('');
  const [locCity, setLocCity] = useState('');
  const [locCountry, setLocCountry] = useState('India');
  const [locAddress, setLocAddress] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

  const loadAll = async () => {
    try {
      setLoading(true);
      setError('');
      const [deptRes, desigRes, gradeRes, locRes] = await Promise.all([
        api.getDepartments().catch(() => []),
        api.getDesignations().catch(() => []),
        api.getGrades().catch(() => []),
        api.getLocations().catch(() => []),
      ]);
      setDepartments(deptRes || []);
      setDesignations(desigRes || []);
      setGrades(gradeRes || []);
      setLocations(locRes || []);
    } catch (err: any) {
      setError(err?.message || 'Failed to load organization masters');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
  }, []);

  const handleAddDepartment = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      await api.createDepartment({
        name: deptName.trim(),
        codePrefix: deptCodePrefix.trim().toUpperCase(),
        description: deptDescription.trim() || undefined,
      });
      setSuccessMsg(`Department '${deptName}' created successfully!`);
      setDeptName('');
      setDeptCodePrefix('');
      setDeptDescription('');
      await loadAll();
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (err: any) {
      setError(err?.message || 'Failed to create department');
    } finally {
      setSubmitting(false);
    }
  };

  const handleAddDesignation = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      await api.createDesignation({
        name: desigName.trim(),
        description: desigDescription.trim() || undefined,
      });
      setSuccessMsg(`Designation / Role '${desigName}' created successfully!`);
      setDesigName('');
      setDesigDescription('');
      await loadAll();
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (err: any) {
      setError(err?.message || 'Failed to create designation');
    } finally {
      setSubmitting(false);
    }
  };

  const handleAddGrade = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      await api.createGrade({
        name: gradeName.trim(),
        level: Number(gradeLevel) || undefined,
        description: gradeDescription.trim() || undefined,
      });
      setSuccessMsg(`Grade '${gradeName}' created successfully!`);
      setGradeName('');
      setGradeLevel(1);
      setGradeDescription('');
      await loadAll();
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (err: any) {
      setError(err?.message || 'Failed to create grade');
    } finally {
      setSubmitting(false);
    }
  };

  const handleAddLocation = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      await api.createLocation({
        name: locName.trim(),
        city: locCity.trim() || undefined,
        country: locCountry.trim() || undefined,
        address: locAddress.trim() || undefined,
      });
      setSuccessMsg(`Location '${locName}' created successfully!`);
      setLocName('');
      setLocCity('');
      setLocAddress('');
      await loadAll();
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (err: any) {
      setError(err?.message || 'Failed to create location');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Header Banner */}
      <div className="card" style={{ background: '#0f172a', color: '#f8fafc', border: '1px solid #1e293b' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <h2 style={{ fontSize: '20px', fontWeight: 800, color: '#38bdf8' }}>🏢 Organization & Masters Management</h2>
            <p style={{ fontSize: '13px', color: '#94a3b8', marginTop: '4px' }}>
              Configure company departments, designations, job grades, and office locations (Super Admin & HR Admin only).
            </p>
          </div>
          <span style={{ background: '#1e293b', color: '#38bdf8', padding: '6px 12px', borderRadius: '6px', fontSize: '12px', fontWeight: 600 }}>
            Active Tenant: PlanetU (Internal Prototype)
          </span>
        </div>
      </div>

      {/* Navigation Subtabs */}
      <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid #e2e8f0', background: '#ffffff', padding: '8px 16px', borderRadius: '8px' }}>
        {[
          { key: 'departments', label: `Departments (${departments.length})`, icon: '🏢' },
          { key: 'designations', label: `Designations / Job Roles (${designations.length})`, icon: '💼' },
          { key: 'grades', label: `Grades & Levels (${grades.length})`, icon: '🎖️' },
          { key: 'locations', label: `Locations (${locations.length})`, icon: '📍' },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key as any)}
            style={{
              padding: '8px 16px',
              border: 'none',
              background: activeTab === tab.key ? '#2563eb' : 'transparent',
              color: activeTab === tab.key ? '#ffffff' : '#64748b',
              fontWeight: activeTab === tab.key ? 700 : 500,
              fontSize: '13px',
              borderRadius: '6px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              transition: 'all 0.15s ease',
            }}
          >
            <span>{tab.icon}</span>
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Status Alerts */}
      {successMsg && (
        <div style={{ padding: '12px 16px', background: '#ecfdf5', color: '#065f46', border: '1px solid #a7f3d0', borderRadius: '6px', fontSize: '13px', fontWeight: 600 }}>
          ✅ {successMsg}
        </div>
      )}
      {error && (
        <div style={{ padding: '12px 16px', background: '#fef2f2', color: '#991b1b', border: '1px solid #fecaca', borderRadius: '6px', fontSize: '13px' }}>
          ⚠️ {error}
        </div>
      )}

      {/* TAB 1: DEPARTMENTS */}
      {activeTab === 'departments' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: '20px', alignItems: 'start' }}>
          <div className="card">
            <h3 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '16px' }}>🏢 Active Departments</h3>
            {loading ? (
              <div style={{ color: '#94a3b8' }}>Loading departments...</div>
            ) : departments.length === 0 ? (
              <div style={{ color: '#94a3b8' }}>No departments found.</div>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>Department Name</th>
                    <th>Code Prefix</th>
                    <th>Description</th>
                    <th>Created</th>
                  </tr>
                </thead>
                <tbody>
                  {departments.map((d) => (
                    <tr key={d.id}>
                      <td><strong>{d.name}</strong></td>
                      <td><span className="badge badge-role">{d.codePrefix}</span></td>
                      <td style={{ color: '#64748b', fontSize: '13px' }}>{d.description || '—'}</td>
                      <td style={{ color: '#94a3b8', fontSize: '12px' }}>{new Date(d.createdAt).toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          <div className="card" style={{ background: '#f8fafc' }}>
            <h3 style={{ fontSize: '15px', fontWeight: 700, marginBottom: '14px' }}>➕ Add New Department</h3>
            <form onSubmit={handleAddDepartment} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <label style={{ fontSize: '12px', fontWeight: 600, color: '#475569', display: 'block', marginBottom: '3px' }}>
                  Department Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Legal & Compliance"
                  value={deptName}
                  onChange={(e) => setDeptName(e.target.value)}
                  style={{ width: '100%', padding: '7px 10px', fontSize: '13px', border: '1px solid #cbd5e1', borderRadius: '4px', boxSizing: 'border-box' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '12px', fontWeight: 600, color: '#475569', display: 'block', marginBottom: '3px' }}>
                  Code Prefix (2-6 Uppercase) *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. LGL"
                  maxLength={6}
                  value={deptCodePrefix}
                  onChange={(e) => setDeptCodePrefix(e.target.value.toUpperCase())}
                  style={{ width: '100%', padding: '7px 10px', fontSize: '13px', border: '1px solid #cbd5e1', borderRadius: '4px', boxSizing: 'border-box' }}
                />
                <span style={{ fontSize: '11px', color: '#94a3b8' }}>Used for employee codes (e.g. LGL-0001)</span>
              </div>

              <div>
                <label style={{ fontSize: '12px', fontWeight: 600, color: '#475569', display: 'block', marginBottom: '3px' }}>
                  Description
                </label>
                <textarea
                  rows={2}
                  placeholder="Department responsibilities..."
                  value={deptDescription}
                  onChange={(e) => setDeptDescription(e.target.value)}
                  style={{ width: '100%', padding: '7px 10px', fontSize: '13px', border: '1px solid #cbd5e1', borderRadius: '4px', boxSizing: 'border-box' }}
                />
              </div>

              <button type="submit" className="btn btn-primary" disabled={submitting} style={{ marginTop: '6px' }}>
                {submitting ? 'Creating...' : 'Create Department'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* TAB 2: DESIGNATIONS */}
      {activeTab === 'designations' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: '20px', alignItems: 'start' }}>
          <div className="card">
            <h3 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '16px' }}>💼 Designations & Job Roles</h3>
            {loading ? (
              <div style={{ color: '#94a3b8' }}>Loading designations...</div>
            ) : designations.length === 0 ? (
              <div style={{ color: '#94a3b8' }}>No designations found.</div>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>Job Title / Designation</th>
                    <th>Description</th>
                    <th>Created</th>
                  </tr>
                </thead>
                <tbody>
                  {designations.map((d) => (
                    <tr key={d.id}>
                      <td><strong>{d.name}</strong></td>
                      <td style={{ color: '#64748b', fontSize: '13px' }}>{d.description || '—'}</td>
                      <td style={{ color: '#94a3b8', fontSize: '12px' }}>{new Date(d.createdAt).toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          <div className="card" style={{ background: '#f8fafc' }}>
            <h3 style={{ fontSize: '15px', fontWeight: 700, marginBottom: '14px' }}>➕ Add New Designation / Role</h3>
            <form onSubmit={handleAddDesignation} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <label style={{ fontSize: '12px', fontWeight: 600, color: '#475569', display: 'block', marginBottom: '3px' }}>
                  Designation / Role Title *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Principal Architect"
                  value={desigName}
                  onChange={(e) => setDesigName(e.target.value)}
                  style={{ width: '100%', padding: '7px 10px', fontSize: '13px', border: '1px solid #cbd5e1', borderRadius: '4px', boxSizing: 'border-box' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '12px', fontWeight: 600, color: '#475569', display: 'block', marginBottom: '3px' }}>
                  Description / Role Scope
                </label>
                <textarea
                  rows={2}
                  placeholder="Responsibilities & scope..."
                  value={desigDescription}
                  onChange={(e) => setDesigDescription(e.target.value)}
                  style={{ width: '100%', padding: '7px 10px', fontSize: '13px', border: '1px solid #cbd5e1', borderRadius: '4px', boxSizing: 'border-box' }}
                />
              </div>

              <button type="submit" className="btn btn-primary" disabled={submitting} style={{ marginTop: '6px' }}>
                {submitting ? 'Creating...' : 'Create Designation'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* TAB 3: GRADES */}
      {activeTab === 'grades' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: '20px', alignItems: 'start' }}>
          <div className="card">
            <h3 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '16px' }}>🎖️ Job Grades & Levels</h3>
            {loading ? (
              <div style={{ color: '#94a3b8' }}>Loading grades...</div>
            ) : grades.length === 0 ? (
              <div style={{ color: '#94a3b8' }}>No grades found.</div>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>Grade Code</th>
                    <th>Level</th>
                    <th>Description</th>
                  </tr>
                </thead>
                <tbody>
                  {grades.map((g) => (
                    <tr key={g.id}>
                      <td><span className="badge badge-active">{g.name}</span></td>
                      <td>Level {g.level || 1}</td>
                      <td style={{ color: '#64748b', fontSize: '13px' }}>{g.description || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          <div className="card" style={{ background: '#f8fafc' }}>
            <h3 style={{ fontSize: '15px', fontWeight: 700, marginBottom: '14px' }}>➕ Add New Grade</h3>
            <form onSubmit={handleAddGrade} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <label style={{ fontSize: '12px', fontWeight: 600, color: '#475569', display: 'block', marginBottom: '3px' }}>
                  Grade Name (e.g. L4, M2) *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. L4"
                  value={gradeName}
                  onChange={(e) => setGradeName(e.target.value.toUpperCase())}
                  style={{ width: '100%', padding: '7px 10px', fontSize: '13px', border: '1px solid #cbd5e1', borderRadius: '4px', boxSizing: 'border-box' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '12px', fontWeight: 600, color: '#475569', display: 'block', marginBottom: '3px' }}>
                  Hierarchy Level (1 = Entry, 5 = Executive)
                </label>
                <input
                  type="number"
                  min={1}
                  max={10}
                  value={gradeLevel}
                  onChange={(e) => setGradeLevel(parseInt(e.target.value, 10))}
                  style={{ width: '100%', padding: '7px 10px', fontSize: '13px', border: '1px solid #cbd5e1', borderRadius: '4px', boxSizing: 'border-box' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '12px', fontWeight: 600, color: '#475569', display: 'block', marginBottom: '3px' }}>
                  Description
                </label>
                <textarea
                  rows={2}
                  placeholder="Band details..."
                  value={gradeDescription}
                  onChange={(e) => setGradeDescription(e.target.value)}
                  style={{ width: '100%', padding: '7px 10px', fontSize: '13px', border: '1px solid #cbd5e1', borderRadius: '4px', boxSizing: 'border-box' }}
                />
              </div>

              <button type="submit" className="btn btn-primary" disabled={submitting} style={{ marginTop: '6px' }}>
                {submitting ? 'Creating...' : 'Create Grade'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* TAB 4: LOCATIONS */}
      {activeTab === 'locations' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: '20px', alignItems: 'start' }}>
          <div className="card">
            <h3 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '16px' }}>📍 Office Locations</h3>
            {loading ? (
              <div style={{ color: '#94a3b8' }}>Loading locations...</div>
            ) : locations.length === 0 ? (
              <div style={{ color: '#94a3b8' }}>No locations found.</div>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>Location Name</th>
                    <th>City</th>
                    <th>Country</th>
                    <th>Address</th>
                  </tr>
                </thead>
                <tbody>
                  {locations.map((l) => (
                    <tr key={l.id}>
                      <td><strong>{l.name}</strong></td>
                      <td>{l.city || '—'}</td>
                      <td>{l.country || 'India'}</td>
                      <td style={{ color: '#64748b', fontSize: '13px' }}>{l.address || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          <div className="card" style={{ background: '#f8fafc' }}>
            <h3 style={{ fontSize: '15px', fontWeight: 700, marginBottom: '14px' }}>➕ Add New Location</h3>
            <form onSubmit={handleAddLocation} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <label style={{ fontSize: '12px', fontWeight: 600, color: '#475569', display: 'block', marginBottom: '3px' }}>
                  Location Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Bengaluru Development Center"
                  value={locName}
                  onChange={(e) => setLocName(e.target.value)}
                  style={{ width: '100%', padding: '7px 10px', fontSize: '13px', border: '1px solid #cbd5e1', borderRadius: '4px', boxSizing: 'border-box' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 600, color: '#475569', display: 'block', marginBottom: '3px' }}>
                    City
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Bengaluru"
                    value={locCity}
                    onChange={(e) => setLocCity(e.target.value)}
                    style={{ width: '100%', padding: '7px 10px', fontSize: '13px', border: '1px solid #cbd5e1', borderRadius: '4px', boxSizing: 'border-box' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 600, color: '#475569', display: 'block', marginBottom: '3px' }}>
                    Country
                  </label>
                  <input
                    type="text"
                    placeholder="India"
                    value={locCountry}
                    onChange={(e) => setLocCountry(e.target.value)}
                    style={{ width: '100%', padding: '7px 10px', fontSize: '13px', border: '1px solid #cbd5e1', borderRadius: '4px', boxSizing: 'border-box' }}
                  />
                </div>
              </div>

              <div>
                <label style={{ fontSize: '12px', fontWeight: 600, color: '#475569', display: 'block', marginBottom: '3px' }}>
                  Address
                </label>
                <textarea
                  rows={2}
                  placeholder="Street & building..."
                  value={locAddress}
                  onChange={(e) => setLocAddress(e.target.value)}
                  style={{ width: '100%', padding: '7px 10px', fontSize: '13px', border: '1px solid #cbd5e1', borderRadius: '4px', boxSizing: 'border-box' }}
                />
              </div>

              <button type="submit" className="btn btn-primary" disabled={submitting} style={{ marginTop: '6px' }}>
                {submitting ? 'Creating...' : 'Create Location'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
