import { useEffect, useState, useMemo } from 'react';
import React from 'react';
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
import { OffboardingPage } from './components/OffboardingPage';
import { ReportsPage } from './components/ReportsPage';
import { OrganizationMastersPage } from './components/OrganizationMastersPage';
import { NotificationBell } from './components/NotificationBell';
import { GrievanceManagementPage } from './components/GrievanceManagementPage';
import { Icons } from './components/Icons';

type MainTab =
  | 'ess'
  | 'employees'
  | 'organization'
  | 'onboarding'
  | 'offboarding'
  | 'grievances'
  | 'shifts'
  | 'attendance'
  | 'leaves'
  | 'payroll'
  | 'reports';

type EmployeeSubView = 'list' | 'add' | 'profile';

interface NavTabItem {
  key: MainTab;
  label: string;
  icon: keyof typeof Icons;
  section: string;
  allowedRoles: string[];
}

const ALL_TABS: NavTabItem[] = [
  // 1. Self Service Workspace
  {
    key: 'ess',
    label: 'Employee Self-Service',
    icon: 'Home',
    section: 'WORKSPACE',
    allowedRoles: ['CLIENT_SUPER_ADMIN', 'HR_ADMIN', 'FINANCE', 'MANAGER', 'EMPLOYEE'],
  },
  // 2. Workforce Management
  {
    key: 'employees',
    label: 'Employees',
    icon: 'Users',
    section: 'WORKFORCE',
    allowedRoles: ['CLIENT_SUPER_ADMIN', 'HR_ADMIN', 'MANAGER'],
  },
  {
    key: 'organization',
    label: 'Organization & Masters',
    icon: 'Building',
    section: 'WORKFORCE',
    allowedRoles: ['CLIENT_SUPER_ADMIN', 'HR_ADMIN'],
  },
  {
    key: 'onboarding',
    label: 'Onboarding',
    icon: 'Rocket',
    section: 'WORKFORCE',
    allowedRoles: ['CLIENT_SUPER_ADMIN', 'HR_ADMIN'],
  },
  {
    key: 'offboarding',
    label: 'Offboarding & Exit',
    icon: 'DoorExit',
    section: 'WORKFORCE',
    allowedRoles: ['CLIENT_SUPER_ADMIN', 'HR_ADMIN', 'FINANCE', 'MANAGER'],
  },
  {
    key: 'grievances',
    label: 'Grievance Redressal',
    icon: 'Shield',
    section: 'WORKFORCE',
    allowedRoles: ['CLIENT_SUPER_ADMIN', 'HR_ADMIN'],
  },
  // 3. Time & Attendance
  {
    key: 'shifts',
    label: 'Shift Scheduling',
    icon: 'Clock',
    section: 'TIME & ATTENDANCE',
    allowedRoles: ['CLIENT_SUPER_ADMIN', 'HR_ADMIN', 'MANAGER'],
  },
  {
    key: 'attendance',
    label: 'Attendance',
    icon: 'MapPin',
    section: 'TIME & ATTENDANCE',
    allowedRoles: ['CLIENT_SUPER_ADMIN', 'HR_ADMIN', 'MANAGER', 'FINANCE'],
  },
  {
    key: 'leaves',
    label: 'Leave Management',
    icon: 'Calendar',
    section: 'TIME & ATTENDANCE',
    allowedRoles: ['CLIENT_SUPER_ADMIN', 'HR_ADMIN', 'FINANCE', 'MANAGER', 'EMPLOYEE'],
  },
  // 4. Finance & Statutory
  {
    key: 'payroll',
    label: 'Payroll & Compliance',
    icon: 'Dollar',
    section: 'FINANCE & COMPLIANCE',
    allowedRoles: ['CLIENT_SUPER_ADMIN', 'HR_ADMIN', 'FINANCE'],
  },
  // 5. Intelligence & Analytics
  {
    key: 'reports',
    label: 'Reports & Analytics',
    icon: 'BarChart',
    section: 'INTELLIGENCE',
    allowedRoles: ['CLIENT_SUPER_ADMIN', 'HR_ADMIN', 'FINANCE', 'MANAGER'],
  },
];

export default function App() {
  const [user, setUser] = useState<any>(null);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [activeTab, setActiveTab] = useState<MainTab>('ess');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [employeeSubView, setEmployeeSubView] = useState<EmployeeSubView>('list');
  const [selectedEmpId, setSelectedEmpId] = useState<string | null>(null);

  // Responsive mobile/tablet viewport detection (< 1024px)
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth < 1024 : false
  );
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);

  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth < 1024;
      setIsMobile(mobile);
      if (!mobile) {
        setMobileDrawerOpen(false);
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Close drawer on Escape key press
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && mobileDrawerOpen) {
        setMobileDrawerOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [mobileDrawerOpen]);

  // Check existing session via httpOnly cookie on mount
  useEffect(() => {
    api
      .getMe()
      .then((profile) => setUser(profile))
      .catch(() => setUser(null))
      .finally(() => setCheckingAuth(false));
  }, []);

  // Compute visible tabs based on user role (Super Admin gets access to all)
  const isSuperAdmin = user?.role === 'CLIENT_SUPER_ADMIN';
  const visibleTabs = useMemo(() => {
    if (!user) return [];
    if (isSuperAdmin) return ALL_TABS;
    return ALL_TABS.filter((t) => t.allowedRoles.includes(user.role));
  }, [user, isSuperAdmin]);

  // If current activeTab is not accessible by the logged-in role, auto-switch to first available tab
  useEffect(() => {
    if (visibleTabs.length > 0 && !visibleTabs.some((t) => t.key === activeTab)) {
      setActiveTab(visibleTabs[0].key);
    }
  }, [visibleTabs, activeTab]);

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
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          minHeight: '100vh',
          background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
          color: '#f8fafc',
          gap: '16px',
        }}
      >
        <div
          style={{
            width: '84px',
            height: '84px',
            borderRadius: '20px',
            background: '#ffffff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '12px',
            boxShadow: '0 0 35px rgba(56, 189, 248, 0.25)',
            animation: 'pulseGlow 2s infinite ease-in-out',
          }}
        >
          <img src="/logo.png" alt="PlanetU" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontWeight: 800, fontSize: '18px', color: '#38bdf8', letterSpacing: '-0.02em' }}>
            PlanetU HRMS
          </div>
          <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '3px' }}>
            Initializing Workspace...
          </div>
        </div>
        <div style={{ width: '130px', height: '3px', background: '#334155', borderRadius: '999px', overflow: 'hidden', marginTop: '6px' }}>
          <div
            className="skeleton"
            style={{
              width: '100%',
              height: '100%',
              background: 'linear-gradient(90deg, #38bdf8 0%, #818cf8 50%, #38bdf8 100%)',
            }}
          />
        </div>
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

  // Group visible tabs by section for clean rendering
  const sections = Array.from(new Set(visibleTabs.map((t) => t.section)));
  const currentTabItem = ALL_TABS.find((t) => t.key === activeTab);

  return (
    <div style={{ minHeight: '100vh', display: 'flex', background: '#f8fafc', color: '#1e293b' }}>
      {/* Mobile Drawer Backdrop Overlay */}
      {isMobile && mobileDrawerOpen && (
        <div
          className="mobile-sidebar-backdrop"
          onClick={() => setMobileDrawerOpen(false)}
          aria-label="Close navigation overlay"
        />
      )}

      {/* --------------------------------------------------------------------- */}
      {/* Left Navigation Sidebar Drawer (Responsive)                           */}
      {/* --------------------------------------------------------------------- */}
      <aside
        style={{
          width: isMobile ? '280px' : sidebarCollapsed ? '68px' : '250px',
          background: '#0f172a',
          color: '#f8fafc',
          display: 'flex',
          flexDirection: 'column',
          transition: isMobile
            ? 'transform 0.25s cubic-bezier(0.16, 1, 0.3, 1)'
            : 'width 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
          borderRight: '1px solid #1e293b',
          zIndex: isMobile ? 1050 : 40,
          position: isMobile ? 'fixed' : 'sticky',
          top: 0,
          left: 0,
          bottom: isMobile ? 0 : undefined,
          height: '100vh',
          flexShrink: 0,
          userSelect: 'none',
          transform: isMobile ? (mobileDrawerOpen ? 'translateX(0)' : 'translateX(-100%)') : 'none',
          boxShadow: isMobile && mobileDrawerOpen ? '4px 0 25px rgba(0, 0, 0, 0.5)' : 'none',
        }}
      >
        {/* Brand & Toggle Header */}
        <div
          style={{
            padding: (!isMobile && sidebarCollapsed) ? '16px 0' : '16px 18px',
            borderBottom: '1px solid #1e293b',
            display: 'flex',
            alignItems: 'center',
            justifyContent: (!isMobile && sidebarCollapsed) ? 'center' : 'space-between',
            height: '60px',
            boxSizing: 'border-box',
          }}
        >
          {isMobile || !sidebarCollapsed ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
              <div style={{ background: '#ffffff', padding: '3px 6px', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <img src="/logo.png" alt="PlanetU" style={{ height: '24px', maxWidth: '85px', objectFit: 'contain' }} />
              </div>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 800, fontSize: '13px', color: '#38bdf8', letterSpacing: '-0.02em', lineHeight: 1.1 }}>
                  HRMS Suite
                </div>
                <div style={{ fontSize: '10px', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Enterprise
                </div>
              </div>
            </div>
          ) : (
            <div style={{ background: '#ffffff', padding: '4px', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center' }} title="PlanetU HRMS">
              <img src="/logo.png" alt="PlanetU" style={{ height: '22px', maxWidth: '32px', objectFit: 'cover', objectPosition: 'left' }} />
            </div>
          )}

          {isMobile ? (
            <button
              onClick={() => setMobileDrawerOpen(false)}
              title="Close navigation"
              style={{
                background: '#1e293b',
                border: '1px solid #334155',
                borderRadius: '6px',
                color: '#cbd5e1',
                cursor: 'pointer',
                padding: '4px 8px',
                fontSize: '14px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              ✕
            </button>
          ) : (
            <button
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              title={sidebarCollapsed ? 'Expand Navigation' : 'Collapse Navigation'}
              style={{
                background: 'transparent',
                border: '1px solid #334155',
                borderRadius: '6px',
                color: '#94a3b8',
                cursor: 'pointer',
                padding: '5px 7px',
                fontSize: '12px',
                display: sidebarCollapsed ? 'none' : 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Icons.ChevronLeft size={14} color="#94a3b8" />
            </button>
          )}
        </div>

        {/* Navigation Modules List */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '12px 8px' }}>
          {sections.map((secName) => {
            const tabsInSection = visibleTabs.filter((t) => t.section === secName);
            return (
              <div key={secName} style={{ marginBottom: '14px' }}>
                {(isMobile || !sidebarCollapsed) && (
                  <div
                    style={{
                      fontSize: '10px',
                      fontWeight: 700,
                      letterSpacing: '0.08em',
                      color: '#64748b',
                      padding: '4px 10px',
                      textTransform: 'uppercase',
                    }}
                  >
                    {secName}
                  </div>
                )}

                <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                  {tabsInSection.map((t) => {
                    const isActive = activeTab === t.key;
                    const showCollapsed = !isMobile && sidebarCollapsed;
                    return (
                      <button
                        key={t.key}
                        onClick={() => {
                          setActiveTab(t.key);
                          if (t.key === 'employees') {
                            setEmployeeSubView('list');
                            setSelectedEmpId(null);
                          }
                          if (isMobile) {
                            setMobileDrawerOpen(false);
                          }
                        }}
                        title={showCollapsed ? t.label : undefined}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: showCollapsed ? '0' : '10px',
                          justifyContent: showCollapsed ? 'center' : 'flex-start',
                          padding: showCollapsed ? '10px 0' : '9px 12px',
                          borderRadius: '6px',
                          border: 'none',
                          background: isActive ? '#2563eb' : 'transparent',
                          color: isActive ? '#ffffff' : '#cbd5e1',
                          fontWeight: isActive ? 600 : 500,
                          fontSize: '13px',
                          cursor: 'pointer',
                          transition: 'all 0.15s ease',
                          textAlign: 'left',
                          width: '100%',
                          position: 'relative',
                        }}
                        onMouseEnter={(e) => {
                          if (!isActive) e.currentTarget.style.background = '#1e293b';
                        }}
                        onMouseLeave={(e) => {
                          if (!isActive) e.currentTarget.style.background = 'transparent';
                        }}
                      >
                        <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          {React.createElement(Icons[t.icon], { size: 17, color: isActive ? '#ffffff' : '#94a3b8' })}
                        </span>
                        {(isMobile || !sidebarCollapsed) && (
                          <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {t.label}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        {/* Sidebar Footer / User Profile Card */}
        <div
          style={{
            padding: (!isMobile && sidebarCollapsed) ? '12px 0' : '12px 14px',
            borderTop: '1px solid #1e293b',
            background: '#090d16',
            display: 'flex',
            flexDirection: (!isMobile && sidebarCollapsed) ? 'column' : 'row',
            alignItems: 'center',
            justifyContent: (!isMobile && sidebarCollapsed) ? 'center' : 'space-between',
            gap: '8px',
          }}
        >
          {!isMobile && sidebarCollapsed ? (
            <button
              onClick={() => setSidebarCollapsed(false)}
              title="Expand Sidebar"
              style={{
                background: 'none',
                border: 'none',
                color: '#94a3b8',
                fontSize: '14px',
                cursor: 'pointer',
                padding: '4px',
              }}
            >
              ▶
            </button>
          ) : (
            <div style={{ overflow: 'hidden', minWidth: 0, flex: 1 }}>
              <div
                style={{
                  fontSize: '12px',
                  fontWeight: 600,
                  color: '#f8fafc',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
                title={user.email}
              >
                {user.email}
              </div>
              <div style={{ marginTop: '2px' }}>
                <span
                  style={{
                    fontSize: '10px',
                    fontWeight: 700,
                    padding: '1px 6px',
                    borderRadius: '4px',
                    background:
                      user.role === 'CLIENT_SUPER_ADMIN'
                        ? '#7c3aed'
                        : user.role === 'HR_ADMIN'
                        ? '#059669'
                        : user.role === 'FINANCE'
                        ? '#d97706'
                        : '#3b82f6',
                    color: '#ffffff',
                    display: 'inline-block',
                  }}
                >
                  {user.role}
                </span>
              </div>
            </div>
          )}

          {(isMobile || !sidebarCollapsed) && (
            <button
              onClick={handleLogout}
              title="Sign Out"
              style={{
                background: '#1e293b',
                border: '1px solid #334155',
                borderRadius: '6px',
                color: '#94a3b8',
                padding: '5px 8px',
                fontSize: '11px',
                cursor: 'pointer',
                flexShrink: 0,
              }}
            >
              Logout
            </button>
          )}
        </div>
      </aside>

      {/* --------------------------------------------------------------------- */}
      {/* Right Area: Top Header + Main Content Area                            */}
      {/* --------------------------------------------------------------------- */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        {/* Top Header */}
        <header
          style={{
            height: '60px',
            background: '#0f172a',
            borderBottom: '1px solid #1e293b',
            color: '#f8fafc',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: isMobile ? '0 12px' : '0 24px',
            position: 'sticky',
            top: 0,
            zIndex: 30,
            boxSizing: 'border-box',
          }}
        >
          {/* Breadcrumb & Module Indicator */}
          <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? '8px' : '12px', minWidth: 0 }}>
            <button
              onClick={() => {
                if (isMobile) {
                  setMobileDrawerOpen(!mobileDrawerOpen);
                } else {
                  setSidebarCollapsed(!sidebarCollapsed);
                }
              }}
              title="Toggle navigation"
              style={{
                background: '#1e293b',
                border: '1px solid #334155',
                borderRadius: '6px',
                color: '#f8fafc',
                cursor: 'pointer',
                padding: '6px 9px',
                fontSize: '14px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <Icons.Menu size={16} color="#f8fafc" />
            </button>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
              {currentTabItem && (
                <span style={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>
                  {React.createElement(Icons[currentTabItem.icon], { size: 18, color: '#38bdf8' })}
                </span>
              )}
              <span
                style={{
                  fontWeight: 700,
                  fontSize: isMobile ? '14px' : '15px',
                  color: '#f8fafc',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {currentTabItem?.label || 'PlanetU HRMS'}
              </span>
              <span
                className="header-section-badge"
                style={{
                  fontSize: '11px',
                  background: '#1e293b',
                  color: '#94a3b8',
                  padding: '2px 8px',
                  borderRadius: '4px',
                  marginLeft: '4px',
                  flexShrink: 0,
                }}
              >
                {currentTabItem?.section}
              </span>
            </div>
          </div>

          {/* Right Header Controls */}
          <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? '8px' : '14px', flexShrink: 0 }}>
            {/* Module 11 Notification Bell with Live Unread Counter */}
            <NotificationBell user={user} onNavigateTab={(tab) => setActiveTab(tab as MainTab)} />

            <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? '6px' : '10px', borderLeft: '1px solid #334155', paddingLeft: isMobile ? '8px' : '16px' }}>
              <div
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '50%',
                  background:
                    user.role === 'CLIENT_SUPER_ADMIN'
                      ? 'linear-gradient(135deg, #7c3aed, #a855f7)'
                      : user.role === 'HR_ADMIN'
                      ? 'linear-gradient(135deg, #059669, #10b981)'
                      : user.role === 'FINANCE'
                      ? 'linear-gradient(135deg, #d97706, #f59e0b)'
                      : user.role === 'MANAGER'
                      ? 'linear-gradient(135deg, #2563eb, #3b82f6)'
                      : 'linear-gradient(135deg, #0284c7, #38bdf8)',
                  color: '#ffffff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '11px',
                  fontWeight: 700,
                  boxShadow: '0 2px 6px rgba(0,0,0,0.25)',
                  flexShrink: 0,
                }}
                title={`${user.email} (${user.role})`}
              >
                {user.email?.slice(0, 2).toUpperCase() || 'U'}
              </div>
              <div className="header-user-text">
                <span style={{ fontSize: '12px', fontWeight: 600, color: '#f8fafc', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '140px' }}>
                  {user.email}
                </span>
                <span
                  style={{
                    fontSize: '10px',
                    fontWeight: 700,
                    color:
                      user.role === 'CLIENT_SUPER_ADMIN'
                        ? '#c4b5fd'
                        : user.role === 'HR_ADMIN'
                        ? '#6ee7b7'
                        : user.role === 'FINANCE'
                        ? '#fde68a'
                        : '#93c5fd',
                    letterSpacing: '0.04em',
                  }}
                >
                  {user.role}
                </span>
              </div>
              <button
                className="btn btn-secondary"
                style={{
                  padding: isMobile ? '5px 8px' : '5px 12px',
                  fontSize: isMobile ? '11px' : '12px',
                  background: '#1e293b',
                  color: '#cbd5e1',
                  borderColor: '#334155',
                  marginLeft: '2px',
                }}
                onClick={handleLogout}
                title="Sign Out"
              >
                {isMobile ? 'Exit' : 'Sign Out'}
              </button>
            </div>
          </div>
        </header>

        {/* Main Content Area */}
        <main className="app-main-content" style={{ flex: 1, padding: isMobile ? '14px 12px' : '24px 28px', overflowY: 'auto' }}>
          <div key={activeTab} className="tab-page-enter" style={{ maxWidth: '1240px', margin: '0 auto', width: '100%' }}>
            {activeTab === 'ess' && <EssDashboardPage />}

            {activeTab === 'organization' && <OrganizationMastersPage />}

            {activeTab === 'onboarding' && <OnboardingPage user={user} />}

            {activeTab === 'employees' && (
              <div key={employeeSubView} className="tab-page-enter">
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

            {activeTab === 'offboarding' && <OffboardingPage user={user} />}

            {activeTab === 'grievances' && <GrievanceManagementPage user={user} />}

            {activeTab === 'reports' && <ReportsPage user={user} />}
          </div>
        </main>
      </div>
    </div>
  );
}
