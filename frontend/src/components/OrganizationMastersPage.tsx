import { useEffect, useState } from 'react';
import { api } from '../api';

export function OrganizationMastersPage() {
  const [activeTab, setActiveTab] = useState<'departments' | 'designations' | 'grades' | 'locations'>('departments');
  const [departments, setDepartments] = useState<any[]>([]);
  const [designations, setDesignations] = useState<any[]>([]);
  const [grades, setGrades] = useState<any[]>([]);
  const [locations, setLocations] = useState<any[]>([]);
  const [allEmployees, setAllEmployees] = useState<any[]>([]);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Department Form State
  const [deptName, setDeptName] = useState('');
  const [deptCodePrefix, setDeptCodePrefix] = useState('');
  const [deptHeadId, setDeptHeadId] = useState('');
  const [deptDescription, setDeptDescription] = useState('');

  // Department Profile Modal State
  const [selectedDeptProfile, setSelectedDeptProfile] = useState<any | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [editingHeadId, setEditingHeadId] = useState<string>('');
  const [savingHead, setSavingHead] = useState(false);
  const [profileSuccessMsg, setProfileSuccessMsg] = useState('');
  const [profileErrorMsg, setProfileErrorMsg] = useState('');
  const [employeeSearchTerm, setEmployeeSearchTerm] = useState('');

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
      const [deptRes, desigRes, gradeRes, locRes, empRes, meRes] = await Promise.all([
        api.getDepartments().catch(() => []),
        api.getDesignations().catch(() => []),
        api.getGrades().catch(() => []),
        api.getLocations().catch(() => []),
        api.getEmployees().catch(() => ({ data: [] })),
        api.getMe().catch(() => null),
      ]);
      setDepartments(deptRes || []);
      setDesignations(desigRes || []);
      setGrades(gradeRes || []);
      setLocations(locRes || []);
      setAllEmployees(empRes?.data || []);
      if (meRes) setCurrentUser(meRes);
    } catch (err: any) {
      setError(err?.message || 'Failed to load organization masters');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
  }, []);

  const handleOpenDepartmentProfile = async (deptId: string) => {
    setShowProfileModal(true);
    setProfileLoading(true);
    setProfileSuccessMsg('');
    setProfileErrorMsg('');
    setEmployeeSearchTerm('');
    try {
      const data = await api.getDepartmentById(deptId);
      setSelectedDeptProfile(data);
      setEditingHeadId(data.head?.id || '');
    } catch (err: any) {
      setProfileErrorMsg(err?.message || 'Failed to load department profile');
    } finally {
      setProfileLoading(false);
    }
  };

  const handleSaveHead = async () => {
    if (!selectedDeptProfile) return;
    setSavingHead(true);
    setProfileSuccessMsg('');
    setProfileErrorMsg('');
    try {
      await api.setDepartmentHead(
        selectedDeptProfile.id,
        editingHeadId || null,
      );
      const updatedProfile = await api.getDepartmentById(selectedDeptProfile.id);
      setSelectedDeptProfile(updatedProfile);
      setEditingHeadId(updatedProfile.head?.id || '');
      setProfileSuccessMsg(
        updatedProfile.head
          ? `Department Head updated to ${updatedProfile.head.firstName} ${updatedProfile.head.lastName} (${updatedProfile.head.employeeCode}) successfully!`
          : 'Department Head unassigned successfully.',
      );
      const updatedDepts = await api.getDepartments().catch(() => []);
      setDepartments(updatedDepts);
      setTimeout(() => setProfileSuccessMsg(''), 4000);
    } catch (err: any) {
      setProfileErrorMsg(err?.message || 'Failed to update department head');
    } finally {
      setSavingHead(false);
    }
  };

  const handleAddDepartment = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      await api.createDepartment({
        name: deptName.trim(),
        codePrefix: deptCodePrefix.trim().toUpperCase(),
        headId: deptHeadId.trim() ? deptHeadId.trim() : undefined,
        description: deptDescription.trim() || undefined,
      });
      setSuccessMsg(`Department '${deptName}' created successfully!`);
      setDeptName('');
      setDeptCodePrefix('');
      setDeptHeadId('');
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

  const filteredDeptEmployees = (selectedDeptProfile?.employees || []).filter((emp: any) => {
    if (!employeeSearchTerm.trim()) return true;
    const term = employeeSearchTerm.toLowerCase();
    const fullName = `${emp.firstName} ${emp.lastName}`.toLowerCase();
    const code = (emp.employeeCode || '').toLowerCase();
    const desig = (emp.designation?.name || '').toLowerCase();
    const role = (emp.user?.role || '').toLowerCase();
    const email = (emp.personalEmail || emp.user?.email || '').toLowerCase();
    return (
      fullName.includes(term) ||
      code.includes(term) ||
      desig.includes(term) ||
      role.includes(term) ||
      email.includes(term)
    );
  });

  const isSuperOrHrAdmin =
    !currentUser ||
    currentUser.role === 'CLIENT_SUPER_ADMIN' ||
    currentUser.role === 'HR_ADMIN';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Header Banner */}
      <div className="card" style={{ background: '#0f172a', color: '#f8fafc', border: '1px solid #1e293b' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <h2 style={{ fontSize: '20px', fontWeight: 800, color: '#38bdf8' }}>🏢 Organization & Masters Management</h2>
            <p style={{ fontSize: '13px', color: '#94a3b8', marginTop: '4px' }}>
              Configure company departments, designations, job grades, and office locations. Click on any department to view its profile and team roster.
            </p>
          </div>
          <span style={{ background: '#1e293b', color: '#38bdf8', padding: '6px 12px', borderRadius: '6px', fontSize: '12px', fontWeight: 600 }}>
            Active Tenant: PlanetU HRMS
          </span>
        </div>
      </div>

      {/* Navigation Subtabs */}
      <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid #e2e8f0', background: '#ffffff', padding: '8px 16px', borderRadius: '8px', flexWrap: 'wrap' }}>
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
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 360px', gap: '20px', alignItems: 'start' }}>
          <div className="card">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
              <div>
                <h3 style={{ fontSize: '16px', fontWeight: 700, margin: 0 }}>🏢 Active Departments</h3>
                <p style={{ fontSize: '12px', color: '#64748b', marginTop: '2px', margin: 0 }}>
                  Departments with their designated Heads and active employee counts
                </p>
              </div>
              <span style={{ fontSize: '12px', fontWeight: 600, color: '#2563eb', background: '#eff6ff', padding: '4px 10px', borderRadius: '12px' }}>
                {departments.length} Departments
              </span>
            </div>

            {loading ? (
              <div style={{ color: '#94a3b8', padding: '24px', textAlign: 'center' }}>Loading departments...</div>
            ) : departments.length === 0 ? (
              <div style={{ color: '#94a3b8', padding: '24px', textAlign: 'center' }}>No departments found.</div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table>
                  <thead>
                    <tr>
                      <th>Department</th>
                      <th>Prefix</th>
                      <th>Head / Manager</th>
                      <th>Team Size</th>
                      <th>Description</th>
                      <th style={{ textAlign: 'right' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {departments.map((d) => (
                      <tr key={d.id} style={{ transition: 'background 0.15s ease' }}>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: '#eff6ff', color: '#2563eb', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '12px' }}>
                              {d.codePrefix}
                            </div>
                            <strong>{d.name}</strong>
                          </div>
                        </td>
                        <td>
                          <span className="badge badge-role">{d.codePrefix}</span>
                        </td>
                        <td>
                          {d.head ? (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <div
                                style={{
                                  width: '28px',
                                  height: '28px',
                                  borderRadius: '50%',
                                  background: '#2563eb',
                                  color: '#ffffff',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  fontSize: '11px',
                                  fontWeight: 700,
                                  flexShrink: 0,
                                }}
                              >
                                {d.head.firstName?.[0]}
                                {d.head.lastName?.[0]}
                              </div>
                              <div>
                                <div style={{ fontWeight: 600, fontSize: '13px', color: '#0f172a' }}>
                                  {d.head.firstName} {d.head.lastName}
                                </div>
                                <div style={{ fontSize: '11px', color: '#64748b' }}>
                                  {d.head.employeeCode} {d.head.designation?.name ? `• ${d.head.designation.name}` : ''}
                                </div>
                              </div>
                            </div>
                          ) : (
                            <span style={{ color: '#94a3b8', fontSize: '12px', fontStyle: 'italic' }}>
                              Unassigned
                            </span>
                          )}
                        </td>
                        <td>
                          <span
                            style={{
                              background: '#f1f5f9',
                              color: '#334155',
                              padding: '4px 10px',
                              borderRadius: '12px',
                              fontSize: '12px',
                              fontWeight: 600,
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                            }}
                          >
                            👥 {d._count?.employees ?? 0}
                          </span>
                        </td>
                        <td style={{ color: '#64748b', fontSize: '13px', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {d.description || '—'}
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <button
                            type="button"
                            className="btn btn-secondary"
                            style={{
                              padding: '5px 12px',
                              fontSize: '12px',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '5px',
                              cursor: 'pointer',
                              fontWeight: 600,
                            }}
                            onClick={() => handleOpenDepartmentProfile(d.id)}
                          >
                            👁️ View Profile
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
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
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '3px' }}>
                  <label style={{ fontSize: '12px', fontWeight: 600, color: '#475569' }}>
                    Department Head / Manager
                  </label>
                  <span style={{ fontSize: '11px', color: '#059669', fontWeight: 600, background: '#ecfdf5', padding: '1px 6px', borderRadius: '4px' }}>
                    Optional
                  </span>
                </div>
                <select
                  value={deptHeadId}
                  onChange={(e) => setDeptHeadId(e.target.value)}
                  style={{ width: '100%', padding: '7px 10px', fontSize: '13px', border: '1px solid #cbd5e1', borderRadius: '4px', boxSizing: 'border-box', background: '#fff' }}
                >
                  <option value="">-- No Head / Manager (Leave Unassigned) --</option>
                  {allEmployees.map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.firstName} {emp.lastName} ({emp.employeeCode}) {emp.designation?.name ? `• ${emp.designation.name}` : ''}
                    </option>
                  ))}
                </select>
                <span style={{ fontSize: '11px', color: '#64748b', display: 'block', marginTop: '3px' }}>
                  Not required. You can create a department without a manager/head and assign one later at any time.
                </span>
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

      {/* DEPARTMENT PROFILE MODAL */}
      {showProfileModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9999,
            backgroundColor: 'rgba(15, 23, 42, 0.7)',
            backdropFilter: 'blur(3px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px',
          }}
          onClick={() => setShowProfileModal(false)}
        >
          <div
            style={{
              background: '#ffffff',
              borderRadius: '12px',
              width: '100%',
              maxWidth: '920px',
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
                padding: '16px 24px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                borderBottom: '1px solid #1e293b',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div
                  style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: '8px',
                    background: '#2563eb',
                    color: '#fff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 700,
                    fontSize: '14px',
                  }}
                >
                  {selectedDeptProfile?.codePrefix || 'DP'}
                </div>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 800, color: '#f8fafc' }}>
                      {selectedDeptProfile?.name || 'Department'} Profile
                    </h2>
                    <span
                      style={{
                        background: '#1e293b',
                        color: '#38bdf8',
                        padding: '2px 8px',
                        borderRadius: '6px',
                        fontSize: '11px',
                        fontWeight: 700,
                      }}
                    >
                      {selectedDeptProfile?.codePrefix}
                    </span>
                  </div>
                  <p style={{ margin: '2px 0 0', fontSize: '12px', color: '#94a3b8' }}>
                    Comprehensive department overview, designated leadership, and active employee roster
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowProfileModal(false)}
                style={{
                  background: '#1e293b',
                  color: '#94a3b8',
                  border: 'none',
                  borderRadius: '6px',
                  width: '32px',
                  height: '32px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '16px',
                  cursor: 'pointer',
                }}
              >
                ✕
              </button>
            </div>

            {/* Modal Content Body */}
            <div style={{ padding: '24px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {profileSuccessMsg && (
                <div style={{ padding: '10px 14px', background: '#ecfdf5', color: '#065f46', border: '1px solid #a7f3d0', borderRadius: '6px', fontSize: '13px', fontWeight: 600 }}>
                  ✅ {profileSuccessMsg}
                </div>
              )}
              {profileErrorMsg && (
                <div style={{ padding: '10px 14px', background: '#fef2f2', color: '#991b1b', border: '1px solid #fecaca', borderRadius: '6px', fontSize: '13px' }}>
                  ⚠️ {profileErrorMsg}
                </div>
              )}

              {profileLoading ? (
                <div style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>
                  <div style={{ fontSize: '24px', marginBottom: '8px' }}>⏳</div>
                  <div>Loading department profile and employee roster...</div>
                </div>
              ) : selectedDeptProfile ? (
                <>
                  {/* Department KPI Stats Row */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px' }}>
                    <div style={{ padding: '14px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                      <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>Department</div>
                      <div style={{ fontSize: '16px', fontWeight: 800, color: '#0f172a', marginTop: '4px' }}>
                        {selectedDeptProfile.name}
                      </div>
                      <div style={{ fontSize: '11px', color: '#2563eb', marginTop: '2px', fontWeight: 600 }}>
                        Prefix: {selectedDeptProfile.codePrefix}
                      </div>
                    </div>

                    <div style={{ padding: '14px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                      <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>Department Head</div>
                      <div style={{ fontSize: '16px', fontWeight: 800, color: '#0f172a', marginTop: '4px' }}>
                        {selectedDeptProfile.head
                          ? `${selectedDeptProfile.head.firstName} ${selectedDeptProfile.head.lastName}`
                          : 'Unassigned'}
                      </div>
                      <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>
                        {selectedDeptProfile.head?.designation?.name || 'Leadership Unassigned'}
                      </div>
                    </div>

                    <div style={{ padding: '14px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                      <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>Active Employees</div>
                      <div style={{ fontSize: '20px', fontWeight: 800, color: '#2563eb', marginTop: '2px' }}>
                        {selectedDeptProfile.employees?.length ?? 0}
                      </div>
                      <div style={{ fontSize: '11px', color: '#64748b' }}>Assigned Team Members</div>
                    </div>
                  </div>

                  {/* Description if present */}
                  {selectedDeptProfile.description && (
                    <div style={{ padding: '10px 14px', background: '#f1f5f9', borderRadius: '6px', fontSize: '12px', color: '#475569' }}>
                      <strong>Department Scope:</strong> {selectedDeptProfile.description}
                    </div>
                  )}

                  {/* Department Head Section */}
                  <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ fontSize: '16px' }}>👑</span>
                        <h4 style={{ margin: 0, fontSize: '14px', fontWeight: 700, color: '#0f172a' }}>
                          Department Head / Manager Profile
                        </h4>
                      </div>
                      {selectedDeptProfile.head && (
                        <span style={{ fontSize: '11px', background: '#dbeafe', color: '#1d4ed8', padding: '2px 8px', borderRadius: '10px', fontWeight: 600 }}>
                          Active Head
                        </span>
                      )}
                    </div>

                    {selectedDeptProfile.head ? (
                      <div
                        style={{
                          background: '#ffffff',
                          border: '1px solid #cbd5e1',
                          borderRadius: '8px',
                          padding: '14px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          flexWrap: 'wrap',
                          gap: '14px',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                          <div
                            style={{
                              width: '46px',
                              height: '46px',
                              borderRadius: '50%',
                              background: 'linear-gradient(135deg, #2563eb, #1d4ed8)',
                              color: '#ffffff',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: '16px',
                              fontWeight: 700,
                              flexShrink: 0,
                              boxShadow: '0 4px 6px -1px rgba(37, 99, 235, 0.3)',
                            }}
                          >
                            {selectedDeptProfile.head.firstName?.[0]}
                            {selectedDeptProfile.head.lastName?.[0]}
                          </div>
                          <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <span style={{ fontSize: '15px', fontWeight: 700, color: '#0f172a' }}>
                                {selectedDeptProfile.head.firstName} {selectedDeptProfile.head.lastName}
                              </span>
                              <span className="badge badge-role">{selectedDeptProfile.head.employeeCode}</span>
                              {selectedDeptProfile.head.user?.role && (
                                <span
                                  style={{
                                    fontSize: '10px',
                                    fontWeight: 700,
                                    background: '#f1f5f9',
                                    color: '#475569',
                                    padding: '2px 6px',
                                    borderRadius: '4px',
                                  }}
                                >
                                  {selectedDeptProfile.head.user.role}
                                </span>
                              )}
                            </div>
                            <div style={{ fontSize: '12px', color: '#475569', marginTop: '3px' }}>
                              <strong>Designation:</strong> {selectedDeptProfile.head.designation?.name || 'Not Specified'}
                            </div>
                            <div style={{ fontSize: '12px', color: '#64748b', marginTop: '1px' }}>
                              <strong>Email:</strong> {selectedDeptProfile.head.personalEmail || selectedDeptProfile.head.user?.email || '—'}
                            </div>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div style={{ padding: '12px', background: '#fffbeb', border: '1px solid #fef3c7', borderRadius: '8px', color: '#92400e', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span>⚠️</span>
                        <span>No Department Head has been assigned yet. You can assign any employee as the Head using the selector below.</span>
                      </div>
                    )}

                    {/* Change / Assign Head Control */}
                    {isSuperOrHrAdmin && (
                      <div style={{ marginTop: '14px', paddingTop: '12px', borderTop: '1px solid #e2e8f0' }}>
                        <label style={{ fontSize: '12px', fontWeight: 600, color: '#475569', display: 'block', marginBottom: '4px' }}>
                          Assign / Change Department Head:
                        </label>
                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                          <select
                            value={editingHeadId}
                            onChange={(e) => setEditingHeadId(e.target.value)}
                            style={{
                              flex: 1,
                              minWidth: '240px',
                              padding: '7px 10px',
                              fontSize: '13px',
                              border: '1px solid #cbd5e1',
                              borderRadius: '4px',
                              background: '#ffffff',
                            }}
                          >
                            <option value="">-- No Head (Unassigned) --</option>
                            {allEmployees.map((emp) => (
                              <option key={emp.id} value={emp.id}>
                                {emp.firstName} {emp.lastName} ({emp.employeeCode}) {emp.designation?.name ? `• ${emp.designation.name}` : ''}
                              </option>
                            ))}
                          </select>
                          <button
                            type="button"
                            className="btn btn-primary"
                            onClick={handleSaveHead}
                            disabled={savingHead || editingHeadId === (selectedDeptProfile.head?.id || '')}
                            style={{ fontSize: '12px', padding: '7px 14px', whiteSpace: 'nowrap' }}
                          >
                            {savingHead ? 'Saving...' : 'Update Head'}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Employees in this Department */}
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px', flexWrap: 'wrap', gap: '10px' }}>
                      <div>
                        <h4 style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: '#0f172a' }}>
                          👥 Employees Working in this Department
                        </h4>
                        <p style={{ margin: '2px 0 0', fontSize: '12px', color: '#64748b' }}>
                          Showing {filteredDeptEmployees.length} of {selectedDeptProfile.employees?.length ?? 0} members
                        </p>
                      </div>
                      {selectedDeptProfile.employees?.length > 0 && (
                        <input
                          type="text"
                          placeholder="🔍 Filter employees..."
                          value={employeeSearchTerm}
                          onChange={(e) => setEmployeeSearchTerm(e.target.value)}
                          style={{
                            padding: '6px 10px',
                            fontSize: '12px',
                            border: '1px solid #cbd5e1',
                            borderRadius: '6px',
                            width: '200px',
                          }}
                        />
                      )}
                    </div>

                    {!selectedDeptProfile.employees || selectedDeptProfile.employees.length === 0 ? (
                      <div
                        style={{
                          padding: '36px',
                          textAlign: 'center',
                          background: '#f8fafc',
                          borderRadius: '8px',
                          border: '1px dashed #cbd5e1',
                          color: '#64748b',
                        }}
                      >
                        <div style={{ fontSize: '28px', marginBottom: '8px' }}>👤</div>
                        <strong style={{ display: 'block', fontSize: '14px', color: '#334155' }}>
                          No Employees Currently in this Department
                        </strong>
                        <p style={{ fontSize: '12px', marginTop: '4px', maxWidth: '400px', margin: '4px auto 0' }}>
                          Employees can be assigned to the {selectedDeptProfile.name} department during onboarding or via the Employee Directory.
                        </p>
                      </div>
                    ) : filteredDeptEmployees.length === 0 ? (
                      <div style={{ padding: '24px', textAlign: 'center', color: '#94a3b8' }}>
                        No employees match your filter "{employeeSearchTerm}".
                      </div>
                    ) : (
                      <div style={{ overflowX: 'auto', border: '1px solid #e2e8f0', borderRadius: '8px' }}>
                        <table>
                          <thead>
                            <tr>
                              <th>Employee</th>
                              <th>Designation</th>
                              <th>Role</th>
                              <th>Email</th>
                              <th>Reporting Manager</th>
                              <th>Joining Date</th>
                              <th>Status</th>
                            </tr>
                          </thead>
                          <tbody>
                            {filteredDeptEmployees.map((emp: any) => {
                              const isDeptHead = emp.id === selectedDeptProfile.head?.id;
                              return (
                                <tr key={emp.id} style={{ background: isDeptHead ? '#f0f9ff' : 'transparent' }}>
                                  <td>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                      <div
                                        style={{
                                          width: '30px',
                                          height: '30px',
                                          borderRadius: '50%',
                                          background: isDeptHead ? '#0284c7' : '#3b82f6',
                                          color: '#ffffff',
                                          display: 'flex',
                                          alignItems: 'center',
                                          justifyContent: 'center',
                                          fontSize: '11px',
                                          fontWeight: 700,
                                          flexShrink: 0,
                                        }}
                                      >
                                        {emp.firstName?.[0]}
                                        {emp.lastName?.[0]}
                                      </div>
                                      <div>
                                        <div style={{ fontWeight: 600, fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                          <span>{emp.firstName} {emp.lastName}</span>
                                          {isDeptHead && (
                                            <span style={{ fontSize: '10px', background: '#dbeafe', color: '#1e40af', padding: '1px 5px', borderRadius: '4px', fontWeight: 700 }}>
                                              HEAD
                                            </span>
                                          )}
                                        </div>
                                        <div style={{ fontSize: '11px', color: '#64748b' }}>{emp.employeeCode}</div>
                                      </div>
                                    </div>
                                  </td>
                                  <td>
                                    <span style={{ fontSize: '13px', fontWeight: 500 }}>
                                      {emp.designation?.name || '—'}
                                    </span>
                                  </td>
                                  <td>
                                    <span className="badge badge-role" style={{ fontSize: '10px' }}>
                                      {emp.user?.role || 'EMPLOYEE'}
                                    </span>
                                  </td>
                                  <td style={{ fontSize: '12px', color: '#475569' }}>
                                    {emp.personalEmail || emp.user?.email || '—'}
                                  </td>
                                  <td>
                                    {emp.reportingManager ? (
                                      <span style={{ fontSize: '12px', color: '#334155' }}>
                                        {emp.reportingManager.firstName} {emp.reportingManager.lastName}
                                        <span style={{ fontSize: '10px', color: '#64748b', display: 'block' }}>
                                          {emp.reportingManager.employeeCode}
                                        </span>
                                      </span>
                                    ) : (
                                      <span style={{ fontSize: '12px', color: '#94a3b8', fontStyle: 'italic' }}>
                                        {isDeptHead ? 'Direct / Head' : '—'}
                                      </span>
                                    )}
                                  </td>
                                  <td style={{ fontSize: '12px', color: '#64748b' }}>
                                    {emp.dateOfJoining
                                      ? new Date(emp.dateOfJoining).toLocaleDateString('en-US', {
                                          year: 'numeric',
                                          month: 'short',
                                          day: 'numeric',
                                        })
                                      : '—'}
                                  </td>
                                  <td>
                                    <span className="badge badge-active" style={{ fontSize: '11px' }}>
                                      {emp.employmentStatus || 'ACTIVE'}
                                    </span>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </>
              ) : null}
            </div>

            {/* Modal Footer */}
            <div
              style={{
                padding: '14px 24px',
                background: '#f8fafc',
                borderTop: '1px solid #e2e8f0',
                display: 'flex',
                justifyContent: 'flex-end',
              }}
            >
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setShowProfileModal(false)}
                style={{ fontSize: '13px', padding: '6px 16px' }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
