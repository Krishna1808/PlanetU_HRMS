import { useEffect, useState } from 'react';
import { api } from './api';
import { LoginPage } from './components/LoginPage';
import { EssDashboardPage } from './components/EssDashboardPage';
import { EmployeeListPage } from './components/EmployeeListPage';
import { AddEmployeeForm } from './components/AddEmployeeForm';
import { EmployeeProfileView } from './components/EmployeeProfileView';
import { ShiftsPage } from './components/ShiftsPage';
import { AttendancePage } from './components/AttendancePage';
import { LeavesPage } from './components/LeavesPage';
import { PayrollPage } from './components/PayrollPage';
import { OnboardingPage } from './components/OnboardingPage';

type MainTab = 'ess' | 'onboarding' | 'employees' | 'shifts' | 'attendance' | 'leaves' | 'payroll';
type EmployeeSubView = 'list' | 'add' | 'profile';

export default function App() {
  const [user, setUser] = useState<any>(null);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [activeTab, setActiveTab] = useState<MainTab>('ess');
  const [employeeSubView, setEmployeeSubView] = useState<EmployeeSubView>('list');
  const [selectedEmpId, setSelectedEmpId] = useState<string | null>(null);

  // Check existing session via httpOnly cookie on mount
  useEffect(() => {
    api
      .getMe()
      .then((profile) => setUser(profile))
      .catch(() => setUser(null))
      .finally(() => setCheckingAuth(false));
  }, []);

  const handleLogout = async () => {
    try {
      await api.logout();
    } catch {
      // ignore
    }
    setUser(null);
    setActiveTab('ess');
    setEmployeeSubView('list');
  };

  if (checkingAuth) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', color: '#64748b' }}>
        Loading PlanetU HRMS...
      </div>
    );
  }

  if (!user) {
    return (
      <div className="container">
        <LoginPage onLoginSuccess={(u) => setUser(u)} />
      </div>
    );
  }

  const tabs: { key: MainTab; label: string; icon: string; minRole?: string }[] = [
    { key: 'ess', label: 'ESS Workspace (M7)', icon: '🏠' },
    { key: 'onboarding', label: 'Onboarding (M8)', icon: '🚀' },
    { key: 'employees', label: 'Employees (M1)', icon: '👥' },
    { key: 'shifts', label: 'Shifts (M3)', icon: '⏱️' },
    { key: 'attendance', label: 'Attendance (M4)', icon: '📍' },
    { key: 'leaves', label: 'Leaves (M5)', icon: '🌴' },
    { key: 'payroll', label: 'Payroll (M6)', icon: '💰' },
  ];

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Top Header */}
      <header className="top-header" style={{ background: '#0f172a', color: 'white', borderBottom: '1px solid #1e293b' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ fontWeight: 900, fontSize: '18px', letterSpacing: '-0.02em', color: '#38bdf8' }}>
            PlanetU HRMS
          </div>
          <span style={{ fontSize: '11px', background: '#1e293b', color: '#94a3b8', padding: '2px 8px', borderRadius: '4px' }}>
            Prototype Viewing Layer (All 8 Modules)
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <span style={{ fontSize: '13px', color: '#cbd5e1' }}>{user.email}</span>
          <span className="badge badge-role" style={{ background: '#3b82f6', color: 'white' }}>
            {user.role}
          </span>
          <button
            className="btn btn-secondary"
            style={{ padding: '4px 10px', fontSize: '12px', background: '#334155', color: '#f8fafc', borderColor: '#475569' }}
            onClick={handleLogout}
          >
            Sign Out
          </button>
        </div>
      </header>

      {/* Navigation Tab Bar */}
      <nav style={{ background: '#ffffff', borderBottom: '1px solid #e2e8f0', padding: '0 16px' }}>
        <div style={{ maxWidth: '1100px', margin: '0 auto', display: 'flex', gap: '8px', overflowX: 'auto' }}>
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => {
                setActiveTab(t.key);
                if (t.key === 'employees') {
                  setEmployeeSubView('list');
                  setSelectedEmpId(null);
                }
              }}
              style={{
                padding: '12px 16px',
                border: 'none',
                background: 'none',
                borderBottom: activeTab === t.key ? '3px solid #2563eb' : '3px solid transparent',
                color: activeTab === t.key ? '#2563eb' : '#64748b',
                fontWeight: activeTab === t.key ? 700 : 500,
                fontSize: '13px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                whiteSpace: 'nowrap',
              }}
            >
              <span>{t.icon}</span>
              <span>{t.label}</span>
            </button>
          ))}
        </div>
      </nav>

      {/* Main Content Area */}
      <main className="container" style={{ maxWidth: '1100px', flex: 1, padding: '24px 16px' }}>
        {activeTab === 'ess' && <EssDashboardPage />}

        {activeTab === 'onboarding' && <OnboardingPage user={user} />}

        {activeTab === 'employees' && (
          <div>
            {employeeSubView === 'list' && (
              <EmployeeListPage
                onSelectEmployee={(id) => {
                  setSelectedEmpId(id);
                  setEmployeeSubView('profile');
                }}
                onNavigateAdd={() => setEmployeeSubView('add')}
              />
            )}

            {employeeSubView === 'add' && (
              <AddEmployeeForm
                onSuccess={() => setEmployeeSubView('list')}
                onCancel={() => setEmployeeSubView('list')}
              />
            )}

            {employeeSubView === 'profile' && selectedEmpId && (
              <EmployeeProfileView
                employeeId={selectedEmpId}
                onBack={() => {
                  setSelectedEmpId(null);
                  setEmployeeSubView('list');
                }}
              />
            )}
          </div>
        )}

        {activeTab === 'shifts' && <ShiftsPage />}

        {activeTab === 'attendance' && <AttendancePage />}

        {activeTab === 'leaves' && <LeavesPage user={user} />}

        {activeTab === 'payroll' && <PayrollPage user={user} />}
      </main>
    </div>
  );
}
