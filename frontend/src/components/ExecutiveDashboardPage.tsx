import React, { useState, useEffect } from 'react';
import { api } from '../api';
import { DonutChart, MultiSeriesBarChart, CircularGauge } from './ReportCharts';
import type { DonutSlice, MultiSeriesBarDatum } from './ReportCharts';
import { Icons } from './Icons';

interface Props {
  user: any;
  onNavigateTab: (tab: string, subView?: string) => void;
}

export const ExecutiveDashboardPage: React.FC<Props> = ({ user, onNavigateTab }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [overview, setOverview] = useState<any>(null);
  const [workforce, setWorkforce] = useState<any>(null);
  const [attendance, setAttendance] = useState<any>(null);
  const [announcements, setAnnouncements] = useState<any[]>([]);

  const isSuperAdmin = user?.role === 'CLIENT_SUPER_ADMIN';
  const isHrAdmin = user?.role === 'HR_ADMIN';
  const isFinance = user?.role === 'FINANCE';
  const isManager = user?.role === 'MANAGER';
  const canSeePayroll = isSuperAdmin || isHrAdmin || isFinance;

  const departmentName = overview?.departmentName || user?.department?.name || 'Department';

  const loadDashboardData = async () => {
    setLoading(true);
    setError('');
    try {
      const now = new Date();
      const [overviewRes, workforceRes, attendanceRes, annRes] = await Promise.all([
        api.getReportsOverview().catch((e) => {
          console.error('Failed to load overview reports:', e);
          return null;
        }),
        api.getWorkforceReports().catch((e) => {
          console.error('Failed to load workforce reports:', e);
          return null;
        }),
        api.getAttendanceReports({
          year: now.getUTCFullYear(),
          month: now.getUTCMonth() + 1,
        }).catch((e) => {
          console.error('Failed to load attendance reports:', e);
          return null;
        }),
        api.getAnnouncements({ isActive: true }).catch(() => []),
      ]);

      setOverview(overviewRes);
      setWorkforce(workforceRes);
      setAttendance(attendanceRes);
      setAnnouncements(Array.isArray(annRes) ? annRes.slice(0, 3) : []);
    } catch (err: any) {
      setError(err?.message || 'Failed to load executive metrics');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboardData();
  }, []);

  const formatCurrency = (val: number | null | undefined) => {
    if (val === null || val === undefined) return '—';
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(val);
  };

  // Prepare Department Donut Data (for Admins)
  const departmentDonutData: DonutSlice[] = (workforce?.byDepartment || []).map((d: any) => ({
    label: d.name,
    value: d.count,
  }));

  // Prepare Designation Donut Data (for Department Manager)
  const designationDonutData: DonutSlice[] = (workforce?.byDesignation || []).map((d: any) => ({
    label: d.name,
    value: d.count,
  }));

  // Prepare 7-Day Attendance Trend
  const recentTimeline = (attendance?.dailyTimeline || []).slice(-7);
  const attendanceChartData: MultiSeriesBarDatum[] = recentTimeline.map((item: any) => {
    const dateObj = new Date(item.date);
    const label = isNaN(dateObj.getTime())
      ? item.date
      : dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    return {
      label,
      series: [
        { name: 'Present', value: item.present, color: '#10b981' },
        { name: 'Absent', value: item.absent, color: '#ef4444' },
        { name: 'On Leave', value: item.onLeave, color: '#f59e0b' },
      ],
    };
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* 1. Header Banner */}
      <div
        style={{
          background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
          color: '#ffffff',
          padding: '24px 28px',
          borderRadius: '12px',
          boxShadow: '0 4px 14px rgba(0,0,0,0.1)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '16px',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span
              style={{
                background: 'rgba(56, 189, 248, 0.15)',
                color: '#38bdf8',
                border: '1px solid rgba(56, 189, 248, 0.3)',
                padding: '2px 8px',
                borderRadius: '999px',
                fontSize: '11px',
                fontWeight: 700,
                letterSpacing: '0.04em',
              }}
            >
              {isManager ? `DEPARTMENT OVERVIEW — ${departmentName.toUpperCase()}` : 'EXECUTIVE COMMAND CENTER'}
            </span>
            <span style={{ color: '#94a3b8', fontSize: '12px' }}>
              {isManager ? 'Departmental operational telemetry & team status' : 'Real-time enterprise operational telemetry'}
            </span>
          </div>
          <h1 style={{ fontSize: '24px', fontWeight: 800, margin: '8px 0 4px', color: '#f8fafc' }}>
            Welcome back, {user?.name || user?.email?.split('@')[0]}
          </h1>
          <p style={{ fontSize: '13px', color: '#cbd5e1', margin: 0 }}>
            {isManager
              ? `Here is your live team summary for ${departmentName} covering active headcount, team attendance, and pending leave/exit requests.`
              : 'Here is your live enterprise summary covering headcount growth, shift presence, payroll, and pending approvals.'}
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
          <button
            className="btn btn-secondary"
            onClick={loadDashboardData}
            style={{
              background: 'rgba(255,255,255,0.08)',
              color: '#f8fafc',
              borderColor: 'rgba(255,255,255,0.2)',
              fontSize: '13px',
              padding: '8px 14px',
            }}
            title="Refresh dashboard metrics"
          >
            ↻ Refresh
          </button>
          {isManager ? (
            <>
              <button
                className="btn btn-primary"
                onClick={() => onNavigateTab('leaves')}
                style={{ fontSize: '13px', padding: '8px 16px' }}
              >
                Review Team Leaves
              </button>
              <button
                className="btn btn-secondary"
                onClick={() => onNavigateTab('shifts')}
                style={{
                  background: 'rgba(255,255,255,0.08)',
                  color: '#f8fafc',
                  borderColor: 'rgba(255,255,255,0.2)',
                  fontSize: '13px',
                  padding: '8px 14px',
                }}
              >
                Team Roster
              </button>
            </>
          ) : (
            <button
              className="btn btn-primary"
              onClick={() => onNavigateTab('employees', 'add')}
              style={{ fontSize: '13px', padding: '8px 16px' }}
            >
              + Onboard Employee
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="alert-error" style={{ margin: 0 }}>
          {error}
        </div>
      )}

      {/* 2. Top Metric Strip */}
      {loading ? (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))',
            gap: '16px',
          }}
        >
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="skeleton" style={{ height: '110px', borderRadius: '10px' }} />
          ))}
        </div>
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))',
            gap: '16px',
          }}
        >
          {/* Tile 1: Active Headcount */}
          <div
            onClick={() => onNavigateTab('employees')}
            style={{
              background: '#ffffff',
              borderRadius: '10px',
              border: '1px solid #e2e8f0',
              padding: '18px 20px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
              cursor: 'pointer',
              transition: 'transform 0.15s ease, box-shadow 0.15s ease',
            }}
            title="Click to view Employee Directory"
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '12px', fontWeight: 600, color: '#64748b', textTransform: 'uppercase' }}>
                {isManager ? `${departmentName} Headcount` : 'Active Headcount'}
              </span>
              <span
                style={{
                  background: '#eff6ff',
                  color: '#2563eb',
                  padding: '4px',
                  borderRadius: '6px',
                  display: 'flex',
                }}
              >
                <Icons.Users size={16} />
              </span>
            </div>
            <div style={{ fontSize: '32px', fontWeight: 900, color: '#0f172a', margin: '6px 0 2px' }}>
              {overview?.activeHeadcount ?? 0}
            </div>
            <div style={{ fontSize: '12px', color: '#10b981', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span style={{ fontWeight: 700 }}>+{overview?.newHiresThisMonth ?? 0}</span> joined this month
              {overview?.exitsThisMonth > 0 && (
                <span style={{ color: '#ef4444', marginLeft: '4px' }}>
                  • -{overview.exitsThisMonth} exited
                </span>
              )}
            </div>
          </div>

          {/* Tile 2: Today's Presence Rate */}
          <div
            onClick={() => onNavigateTab('attendance')}
            style={{
              background: '#ffffff',
              borderRadius: '10px',
              border: '1px solid #e2e8f0',
              padding: '18px 20px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              cursor: 'pointer',
            }}
            title="Click to view Attendance logs"
          >
            <div>
              <div style={{ fontSize: '12px', fontWeight: 600, color: '#64748b', textTransform: 'uppercase' }}>
                {isManager ? 'Department Presence Rate' : "Today's Presence Rate"}
              </div>
              <div style={{ fontSize: '30px', fontWeight: 900, color: '#2563eb', margin: '4px 0 2px' }}>
                {overview?.presenceRate ?? 0}%
              </div>
              <div style={{ fontSize: '12px', color: '#64748b' }}>
                {overview?.todayPunches ?? 0} clocked in ({overview?.todayLatePunches ?? 0} late)
              </div>
            </div>
            <CircularGauge
              value={overview?.presenceRate ?? 0}
              label=""
              size={68}
              strokeWidth={7}
            />
          </div>

          {/* Tile 3: Pending Approvals Action Hub */}
          <div
            style={{
              background: '#ffffff',
              borderRadius: '10px',
              border: '1px solid #e2e8f0',
              padding: '18px 20px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '12px', fontWeight: 600, color: '#64748b', textTransform: 'uppercase' }}>
                {isManager ? 'Team Pending Actions' : 'Pending Actions'}
              </span>
              <span
                style={{
                  background: (overview?.pendingApprovals?.total || 0) > 0 ? '#fff7ed' : '#ecfdf5',
                  color: (overview?.pendingApprovals?.total || 0) > 0 ? '#ea580c' : '#059669',
                  padding: '4px',
                  borderRadius: '6px',
                  display: 'flex',
                }}
              >
                <Icons.AlertTriangle size={16} />
              </span>
            </div>
            <div style={{ fontSize: '32px', fontWeight: 900, color: '#0f172a', margin: '6px 0 2px' }}>
              {overview?.pendingApprovals?.total ?? 0}
            </div>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '4px' }}>
              <button
                type="button"
                onClick={() => onNavigateTab('leaves')}
                style={{
                  background: '#f1f5f9',
                  border: 'none',
                  borderRadius: '4px',
                  padding: '2px 6px',
                  fontSize: '11px',
                  color: '#1e293b',
                  cursor: 'pointer',
                  fontWeight: 600,
                }}
                title="Review pending leaves"
              >
                Leaves: <strong>{overview?.pendingApprovals?.leaves ?? 0}</strong>
              </button>
              <button
                type="button"
                onClick={() => onNavigateTab('offboarding')}
                style={{
                  background: '#f1f5f9',
                  border: 'none',
                  borderRadius: '4px',
                  padding: '2px 6px',
                  fontSize: '11px',
                  color: '#1e293b',
                  cursor: 'pointer',
                  fontWeight: 600,
                }}
                title="Review exit requests"
              >
                Exits: <strong>{overview?.pendingApprovals?.exits ?? 0}</strong>
              </button>
              {!isManager && (
                <button
                  type="button"
                  onClick={() => onNavigateTab('onboarding')}
                  style={{
                    background: '#f1f5f9',
                    border: 'none',
                    borderRadius: '4px',
                    padding: '2px 6px',
                    fontSize: '11px',
                    color: '#1e293b',
                    cursor: 'pointer',
                    fontWeight: 600,
                  }}
                  title="Review onboarding candidates"
                >
                  Onboarding: <strong>{overview?.pendingApprovals?.onboardingCandidates ?? 0}</strong>
                </button>
              )}
            </div>
          </div>

          {/* Tile 4: Monthly Net Payroll Expense (Authorized Roles) or Shift Coverage */}
          {canSeePayroll && overview?.currentMonthPayrollExpense !== null ? (
            <div
              onClick={() => onNavigateTab('payroll')}
              style={{
                background: '#ffffff',
                borderRadius: '10px',
                border: '1px solid #e2e8f0',
                padding: '18px 20px',
                boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                cursor: 'pointer',
              }}
              title="Click to view Payroll & Compliance"
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '12px', fontWeight: 600, color: '#64748b', textTransform: 'uppercase' }}>
                  Payroll Net Expense
                </span>
                <span
                  style={{
                    background: '#f0fdf4',
                    color: '#16a34a',
                    padding: '4px',
                    borderRadius: '6px',
                    display: 'flex',
                  }}
                >
                  <Icons.Dollar size={16} />
                </span>
              </div>
              <div style={{ fontSize: '24px', fontWeight: 900, color: '#0f172a', margin: '8px 0 2px' }}>
                {formatCurrency(overview?.currentMonthPayrollExpense)}
              </div>
              <div style={{ fontSize: '12px', color: '#64748b' }}>
                Current month processed disbursements
              </div>
            </div>
          ) : (
            <div
              onClick={() => onNavigateTab('shifts')}
              style={{
                background: '#ffffff',
                borderRadius: '10px',
                border: '1px solid #e2e8f0',
                padding: '18px 20px',
                boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                cursor: 'pointer',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '12px', fontWeight: 600, color: '#64748b', textTransform: 'uppercase' }}>
                  {isManager ? 'Department Shift Coverage' : 'Shift Roster Operations'}
                </span>
                <span
                  style={{
                    background: '#eff6ff',
                    color: '#2563eb',
                    padding: '4px',
                    borderRadius: '6px',
                    display: 'flex',
                  }}
                >
                  <Icons.Clock size={16} />
                </span>
              </div>
              <div style={{ fontSize: '26px', fontWeight: 900, color: '#0f172a', margin: '8px 0 2px' }}>
                Active Shifts
              </div>
              <div style={{ fontSize: '12px', color: '#2563eb' }}>
                {isManager ? `Review ${departmentName} schedule & coverage ↗` : 'Review rotational & standard coverage ↗'}
              </div>
            </div>
          )}
        </div>
      )}

      {/* 3. Visual Charts Grid (Department Donut & 7-Day Attendance Trend) */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))',
          gap: '20px',
        }}
      >
        {/* Chart A: Department Distribution Donut (or Team Role Share for Manager) */}
        <div
          style={{
            background: '#ffffff',
            borderRadius: '10px',
            border: '1px solid #e2e8f0',
            padding: '20px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <div>
              <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: '#0f172a' }}>
                {isManager ? 'Team Role & Designation Share' : 'Department Distribution'}
              </h3>
              <p style={{ margin: '2px 0 0', fontSize: '12px', color: '#64748b' }}>
                {isManager
                  ? `Role allocation within ${departmentName}`
                  : 'Headcount share across active corporate divisions'}
              </p>
            </div>
            <button
              className="btn btn-secondary"
              onClick={() => onNavigateTab('reports')}
              style={{ fontSize: '11px', padding: '4px 8px' }}
            >
              Full Report ↗
            </button>
          </div>

          {loading ? (
            <div className="skeleton" style={{ height: '240px', borderRadius: '8px' }} />
          ) : (isManager ? designationDonutData : departmentDonutData).length === 0 ? (
            <div
              style={{
                height: '240px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#94a3b8',
                fontSize: '13px',
                border: '1px dashed #cbd5e1',
                borderRadius: '8px',
              }}
            >
              {isManager ? 'No designation data available for team' : 'No department data available'}
            </div>
          ) : (
            <DonutChart
              data={isManager ? designationDonutData : departmentDonutData}
              size={190}
              thickness={24}
              centerTitle={isManager ? 'Team Members' : 'Active Staff'}
              centerValue={overview?.activeHeadcount ?? workforce?.totalActive ?? 0}
            />
          )}
        </div>

        {/* Chart B: 7-Day Attendance Roll-Call Trend */}
        <div
          style={{
            background: '#ffffff',
            borderRadius: '10px',
            border: '1px solid #e2e8f0',
            padding: '20px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <div>
              <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: '#0f172a' }}>
                7-Day Attendance Trend
              </h3>
              <p style={{ margin: '2px 0 0', fontSize: '12px', color: '#64748b' }}>
                {isManager
                  ? `Recent shift volume for ${departmentName}`
                  : 'Recent shift volume: Present vs. Absent vs. On Leave'}
              </p>
            </div>
            <button
              className="btn btn-secondary"
              onClick={() => onNavigateTab('attendance')}
              style={{ fontSize: '11px', padding: '4px 8px' }}
            >
              Roll Call ↗
            </button>
          </div>

          {loading ? (
            <div className="skeleton" style={{ height: '240px', borderRadius: '8px' }} />
          ) : attendanceChartData.length === 0 ? (
            <div
              style={{
                height: '240px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#94a3b8',
                fontSize: '13px',
                border: '1px dashed #cbd5e1',
                borderRadius: '8px',
              }}
            >
              No punch activity recorded in current cycle
            </div>
          ) : (
            <MultiSeriesBarChart
              data={attendanceChartData}
              height={220}
              legendPosition="top"
            />
          )}
        </div>
      </div>

      {/* 4. Quick Actions Launchpad & Announcements */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
          gap: '20px',
        }}
      >
        {/* Quick Actions Launchpad */}
        <div
          style={{
            background: '#ffffff',
            borderRadius: '10px',
            border: '1px solid #e2e8f0',
            padding: '20px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
          }}
        >
          <h3 style={{ margin: '0 0 4px', fontSize: '15px', fontWeight: 700, color: '#0f172a' }}>
            Quick Actions Launchpad
          </h3>
          <p style={{ margin: '0 0 16px', fontSize: '12px', color: '#64748b' }}>
            Direct shortcuts to core enterprise workflows
          </p>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
              gap: '10px',
            }}
          >
            {!isManager && (
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => onNavigateTab('employees', 'add')}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '14px 10px',
                  gap: '8px',
                  textAlign: 'center',
                  height: '84px',
                }}
              >
                <Icons.Plus size={20} color="#2563eb" />
                <span style={{ fontSize: '12px', fontWeight: 600, color: '#1e293b' }}>Add Employee</span>
              </button>
            )}

            {isManager && (
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => onNavigateTab('shifts')}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '14px 10px',
                  gap: '8px',
                  textAlign: 'center',
                  height: '84px',
                }}
              >
                <Icons.Clock size={20} color="#2563eb" />
                <span style={{ fontSize: '12px', fontWeight: 600, color: '#1e293b' }}>Shift Roster</span>
              </button>
            )}

            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => onNavigateTab('employees', 'list')}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '14px 10px',
                gap: '8px',
                textAlign: 'center',
                height: '84px',
              }}
            >
              <Icons.Users size={20} color="#059669" />
              <span style={{ fontSize: '12px', fontWeight: 600, color: '#1e293b' }}>Directory</span>
            </button>

            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => onNavigateTab('attendance')}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '14px 10px',
                gap: '8px',
                textAlign: 'center',
                height: '84px',
              }}
            >
              <Icons.Clock size={20} color="#d97706" />
              <span style={{ fontSize: '12px', fontWeight: 600, color: '#1e293b' }}>Attendance</span>
            </button>

            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => onNavigateTab('leaves')}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '14px 10px',
                gap: '8px',
                textAlign: 'center',
                height: '84px',
              }}
            >
              <Icons.Calendar size={20} color="#7c3aed" />
              <span style={{ fontSize: '12px', fontWeight: 600, color: '#1e293b' }}>Leave Desk</span>
            </button>

            {canSeePayroll && (
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => onNavigateTab('payroll')}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '14px 10px',
                  gap: '8px',
                  textAlign: 'center',
                  height: '84px',
                }}
              >
                <Icons.Dollar size={20} color="#16a34a" />
                <span style={{ fontSize: '12px', fontWeight: 600, color: '#1e293b' }}>Run Payroll</span>
              </button>
            )}

            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => onNavigateTab('reports')}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '14px 10px',
                gap: '8px',
                textAlign: 'center',
                height: '84px',
              }}
            >
              <Icons.BarChart size={20} color="#0284c7" />
              <span style={{ fontSize: '12px', fontWeight: 600, color: '#1e293b' }}>Full Reports</span>
            </button>
          </div>
        </div>

        {/* Enterprise Announcements Pulse */}
        <div
          style={{
            background: '#ffffff',
            borderRadius: '10px',
            border: '1px solid #e2e8f0',
            padding: '20px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
            <div>
              <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: '#0f172a' }}>
                Enterprise Announcements
              </h3>
              <p style={{ margin: '2px 0 0', fontSize: '12px', color: '#64748b' }}>
                Latest broadcasts and operational bulletins
              </p>
            </div>
            <span
              style={{
                fontSize: '11px',
                background: '#eff6ff',
                color: '#2563eb',
                padding: '2px 8px',
                borderRadius: '999px',
                fontWeight: 600,
              }}
            >
              {announcements.length} Active
            </span>
          </div>

          {announcements.length === 0 ? (
            <div
              style={{
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#94a3b8',
                fontSize: '13px',
                border: '1px dashed #e2e8f0',
                borderRadius: '8px',
                padding: '20px',
                textAlign: 'center',
              }}
            >
              No active announcements at this time.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {announcements.map((ann) => (
                <div
                  key={ann.id}
                  style={{
                    background: '#f8fafc',
                    border: '1px solid #e2e8f0',
                    borderRadius: '8px',
                    padding: '12px 14px',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                    <strong style={{ fontSize: '13px', color: '#0f172a' }}>{ann.title}</strong>
                    {ann.priority === 'HIGH' || ann.priority === 'URGENT' ? (
                      <span
                        style={{
                          fontSize: '10px',
                          fontWeight: 700,
                          background: '#fee2e2',
                          color: '#b91c1c',
                          padding: '1px 6px',
                          borderRadius: '4px',
                        }}
                      >
                        URGENT
                      </span>
                    ) : null}
                  </div>
                  <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#475569', lineHeight: 1.4 }}>
                    {ann.content}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
