import { useEffect, useState } from 'react';
import { api } from './api';
import { LoginPage } from './components/LoginPage';
import { EmployeeListPage } from './components/EmployeeListPage';
import { AddEmployeeForm } from './components/AddEmployeeForm';
import { EmployeeProfileView } from './components/EmployeeProfileView';

type ViewMode = 'list' | 'add' | 'profile';

export default function App() {
  const [user, setUser] = useState<any>(null);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [view, setView] = useState<ViewMode>('list');
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
    setView('list');
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

  return (
    <div>
      {/* Top Header */}
      <header className="top-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <h1 style={{ fontSize: '18px', fontWeight: 700, color: '#0f172a' }}>PlanetU HRMS</h1>
          <span style={{ fontSize: '12px', background: '#f1f5f9', padding: '2px 8px', borderRadius: '4px', color: '#475569' }}>
            Prototype Viewing Layer
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ fontSize: '13px', color: '#334155' }}>{user.email}</span>
          <span className="badge badge-role">{user.role}</span>
          <button className="btn btn-secondary" style={{ padding: '4px 10px', fontSize: '12px' }} onClick={handleLogout}>
            Sign Out
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="container">
        {view === 'list' && (
          <EmployeeListPage
            onSelectEmployee={(id) => {
              setSelectedEmpId(id);
              setView('profile');
            }}
            onNavigateAdd={() => setView('add')}
          />
        )}

        {view === 'add' && (
          <AddEmployeeForm
            onSuccess={() => setView('list')}
            onCancel={() => setView('list')}
          />
        )}

        {view === 'profile' && selectedEmpId && (
          <EmployeeProfileView
            employeeId={selectedEmpId}
            onBack={() => {
              setSelectedEmpId(null);
              setView('list');
            }}
          />
        )}
      </main>
    </div>
  );
}
