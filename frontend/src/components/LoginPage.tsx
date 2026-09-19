import React, { useState } from 'react';
import { api } from '../api';

interface Props {
  onLoginSuccess: (user: any) => void;
}

interface DemoAccount {
  roleName: string;
  email: string;
  password: string;
  icon: string;
  color: string;
  bg: string;
  border: string;
  badge: string;
  desc: string;
}

const DEMO_ACCOUNTS: DemoAccount[] = [
  {
    roleName: 'Super Admin',
    email: 'admin@planetu.com',
    password: 'DevPassword123!',
    icon: '👑',
    color: '#7c3aed',
    bg: '#f5f3ff',
    border: '#ddd6fe',
    badge: 'CLIENT_SUPER_ADMIN',
    desc: 'Full access to all 10 modules, masters, leave allocation & configuration',
  },
  {
    roleName: 'HR Admin',
    email: 'hr@planetu.com',
    password: 'DevPassword123!',
    icon: '💼',
    color: '#059669',
    bg: '#ecfdf5',
    border: '#a7f3d0',
    badge: 'HR_ADMIN',
    desc: 'Employees, Masters, Onboarding, Offboarding, Leave policies & allocation',
  },
  {
    roleName: 'Manager',
    email: 'manager@planetu.com',
    password: 'DevPassword123!',
    icon: '👔',
    color: '#2563eb',
    bg: '#eff6ff',
    border: '#bfdbfe',
    badge: 'MANAGER',
    desc: 'Subordinate approvals, attendance records, shifts & leave queues',
  },
  {
    roleName: 'Finance',
    email: 'finance@planetu.com',
    password: 'DevPassword123!',
    icon: '💰',
    color: '#d97706',
    bg: '#fffbeb',
    border: '#fde68a',
    badge: 'FINANCE',
    desc: 'Payroll computation, salary structures, payslips & statutory reports',
  },
  {
    roleName: 'Employee',
    email: 'employee@planetu.com',
    password: 'DevPassword123!',
    icon: '👤',
    color: '#0284c7',
    bg: '#f0f9ff',
    border: '#bae6fd',
    badge: 'EMPLOYEE',
    desc: 'Self-service (ESS), attendance check-in/out, leave application & slips',
  },
];

export const LoginPage: React.FC<Props> = ({ onLoginSuccess }) => {
  const [email, setEmail] = useState('admin@planetu.com');
  const [password, setPassword] = useState('DevPassword123!');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [selectedRole, setSelectedRole] = useState('Super Admin');

  const executeLogin = async (loginEmail: string, loginPass: string) => {
    setError('');
    setLoading(true);
    try {
      const res = await api.login(loginEmail, loginPass);
      onLoginSuccess(res.user);
    } catch (err: any) {
      setError(err.message || 'Login failed. Please check credentials.');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await executeLogin(email, password);
  };

  const handleSelectRole = (acc: DemoAccount, autoSubmit: boolean = false) => {
    setEmail(acc.email);
    setPassword(acc.password);
    setSelectedRole(acc.roleName);
    setError('');
    if (autoSubmit) {
      executeLogin(acc.email, acc.password);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '88vh', padding: '24px 16px' }}>
      <div style={{ width: '100%', maxWidth: '860px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
        
        {/* Brand Header */}
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '38px', marginBottom: '4px' }}>🪐</div>
          <h1 style={{ fontSize: '26px', fontWeight: 800, color: '#0f172a', margin: 0 }}>PlanetU HRMS</h1>
          <p style={{ color: '#64748b', fontSize: '14px', marginTop: '6px' }}>
            Enterprise Human Resource Management Suite &amp; RBAC Portal
          </p>
        </div>

        {/* Main Grid: Testing Role Quick-Selector + Login Box */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px', alignItems: 'start' }}>
          
          {/* Quick Select Testing Credentials Panel */}
          <div className="card" style={{ border: '2px dashed #93c5fd', background: '#f8fafc' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontSize: '18px' }}>🧪</span>
                <span style={{ fontWeight: 700, fontSize: '14px', color: '#1e293b' }}>
                  Testing Credentials (1-Click Fill)
                </span>
              </div>
              <span style={{ fontSize: '10px', background: '#dbeafe', color: '#1e40af', padding: '2px 6px', borderRadius: '4px', fontWeight: 700 }}>
                TEST MODE
              </span>
            </div>
            <p style={{ fontSize: '12px', color: '#64748b', marginBottom: '14px' }}>
              Click any role below to automatically fill credentials, or click <strong>Login</strong> on the role card:
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {DEMO_ACCOUNTS.map((acc) => {
                const isSelected = selectedRole === acc.roleName;
                return (
                  <div
                    key={acc.roleName}
                    onClick={() => handleSelectRole(acc, false)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '10px 12px',
                      borderRadius: '6px',
                      background: isSelected ? acc.bg : '#ffffff',
                      border: isSelected ? `2px solid ${acc.color}` : `1px solid ${acc.border}`,
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                      boxShadow: isSelected ? '0 2px 4px rgba(0,0,0,0.06)' : 'none',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0, flex: 1 }}>
                      <span style={{ fontSize: '20px' }}>{acc.icon}</span>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span style={{ fontWeight: 700, fontSize: '13px', color: '#0f172a' }}>{acc.roleName}</span>
                          <span style={{ fontSize: '9px', fontWeight: 700, color: acc.color, background: acc.bg, padding: '1px 5px', borderRadius: '3px', border: `1px solid ${acc.border}` }}>
                            {acc.badge}
                          </span>
                        </div>
                        <div style={{ fontSize: '11px', color: '#64748b', fontFamily: 'monospace' }}>
                          {acc.email}
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      disabled={loading}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleSelectRole(acc, true);
                      }}
                      style={{
                        padding: '5px 10px',
                        fontSize: '11px',
                        fontWeight: 700,
                        background: acc.color,
                        color: '#ffffff',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      ⚡ Login
                    </button>
                  </div>
                );
              })}
            </div>

            <div style={{ marginTop: '12px', padding: '8px 10px', background: '#e2e8f0', borderRadius: '4px', fontSize: '11px', color: '#475569', display: 'flex', justifyContent: 'space-between' }}>
              <span>Default Password for all:</span>
              <strong style={{ fontFamily: 'monospace', color: '#0f172a' }}>DevPassword123!</strong>
            </div>
          </div>

          {/* Standard Sign In Form Card */}
          <div className="card" style={{ height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
            <h2 style={{ marginBottom: '4px', fontSize: '18px', fontWeight: 700 }}>Sign In</h2>
            <p style={{ color: '#64748b', fontSize: '13px', marginBottom: '16px' }}>
              Selected Role: <strong style={{ color: '#0f172a' }}>{selectedRole}</strong>
            </p>

            {error && (
              <div style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#dc2626', padding: '10px 12px', borderRadius: '6px', fontSize: '13px', marginBottom: '14px' }}>
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ fontSize: '12px', fontWeight: 600, display: 'block', marginBottom: '4px' }}>Email Address</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    setSelectedRole('Custom');
                  }}
                  style={{ width: '100%', padding: '9px 12px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '14px', boxSizing: 'border-box' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '12px', fontWeight: 600, display: 'block', marginBottom: '4px' }}>Password</label>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  style={{ width: '100%', padding: '9px 12px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '14px', boxSizing: 'border-box' }}
                />
              </div>

              <button
                type="submit"
                className="btn btn-primary"
                style={{ width: '100%', padding: '10px', fontSize: '14px', fontWeight: 700, marginTop: '6px' }}
                disabled={loading}
              >
                {loading ? 'Signing in...' : `Sign In as ${selectedRole}`}
              </button>
            </form>

            <div style={{ marginTop: '20px', padding: '12px', borderTop: '1px solid #e2e8f0', textAlign: 'center', fontSize: '11px', color: '#94a3b8' }}>
              🔒 HTTP-Only JWT Cookie Authentication &bull; AES-256 Passwords
            </div>
          </div>

        </div>

      </div>
    </div>
  );
};
