import React, { useState, useEffect } from 'react';
import { api } from '../api';
import {
  DonutChart,
  BarChart as SvgBarChart,
  MultiSeriesBarChart,
  CircularGauge,
  FunnelPipeline,
} from './ReportCharts';
import { Icons } from './Icons';

interface ReportsPageProps {
  user: any;
}

type ReportTab =
  | 'overview'
  | 'workforce'
  | 'attendance'
  | 'leaves'
  | 'payroll'
  | 'lifecycle'
  | 'exports';

export const ReportsPage: React.FC<ReportsPageProps> = ({ user }) => {
  const [activeTab, setActiveTab] = useState<ReportTab>('overview');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Selected filters
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getUTCFullYear());
  const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getUTCMonth() + 1);
  const [selectedDepartmentId, setSelectedDepartmentId] = useState<string>('');
  const [departments, setDepartments] = useState<Array<{ id: string; name: string }>>([]);

  // Data states
  const [overviewData, setOverviewData] = useState<any>(null);
  const [workforceData, setWorkforceData] = useState<any>(null);
  const [attendanceData, setAttendanceData] = useState<any>(null);
  const [leaveData, setLeaveData] = useState<any>(null);
  const [payrollData, setPayrollData] = useState<any>(null);
  const [lifecycleData, setLifecycleData] = useState<any>(null);

  const canSeePayroll =
    user.role === 'CLIENT_SUPER_ADMIN' ||
    user.role === 'HR_ADMIN' ||
    user.role === 'FINANCE';

  // Load departments list for filter
  useEffect(() => {
    api
      .getDepartments()
      .then((data) => setDepartments(Array.isArray(data) ? data : []))
      .catch(() => setDepartments([]));
  }, []);

  const loadData = async () => {
    setLoading(true);
    setErrorMsg('');
    try {
      const deptFilter = selectedDepartmentId || undefined;

      if (activeTab === 'overview') {
        const res = await api.getReportsOverview();
        setOverviewData(res);
      } else if (activeTab === 'workforce') {
        const res = await api.getWorkforceReports({ departmentId: deptFilter });
        setWorkforceData(res);
      } else if (activeTab === 'attendance') {
        const res = await api.getAttendanceReports({
          year: selectedYear,
          month: selectedMonth,
          departmentId: deptFilter,
        });
        setAttendanceData(res);
      } else if (activeTab === 'leaves') {
        const res = await api.getLeaveReports({
          year: selectedYear,
          departmentId: deptFilter,
        });
        setLeaveData(res);
      } else if (activeTab === 'payroll') {
        if (canSeePayroll) {
          const res = await api.getPayrollReports({ year: selectedYear });
          setPayrollData(res);
        }
      } else if (activeTab === 'lifecycle') {
        const res = await api.getLifecycleReports();
        setLifecycleData(res);
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to load report data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [activeTab, selectedYear, selectedMonth, selectedDepartmentId]);

  const handleExportCsv = async (reportType: string) => {
    try {
      await api.downloadReportCsv(reportType, {
        year: selectedYear,
        month: selectedMonth,
        departmentId: selectedDepartmentId || undefined,
      });
    } catch (err: any) {
      alert(`Export failed: ${err.message}`);
    }
  };

  const selectedDepartmentName =
    departments.find((d) => d.id === selectedDepartmentId)?.name || 'All Departments';

  const monthNames = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Top Header & Filter Toolbar */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '16px',
          background: '#ffffff',
          padding: '20px 24px',
          borderRadius: '8px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Icons.BarChart size={22} color="#2563eb" />
            <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 800, color: '#0f172a' }}>
              Reports & Dashboards Engine
            </h2>
          </div>
          <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#64748b' }}>
            Cross-module executive business intelligence, workforce demographics, statutory summaries, and CSV data exports.
          </p>
        </div>

        {/* Global Filters: Department, Year, Month */}
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
          {/* Department Filter (Applicable to Workforce, Attendance, Leaves, and Exports) */}
          {(activeTab === 'workforce' ||
            activeTab === 'attendance' ||
            activeTab === 'leaves' ||
            activeTab === 'exports') && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontSize: '12px', fontWeight: 600, color: '#64748b' }}>Dept:</span>
              <select
                value={selectedDepartmentId}
                onChange={(e) => setSelectedDepartmentId(e.target.value)}
                style={{
                  padding: '6px 12px',
                  borderRadius: '6px',
                  border: '1px solid #cbd5e1',
                  fontSize: '13px',
                  background: '#ffffff',
                  fontWeight: 500,
                  color: '#0f172a',
                }}
              >
                <option value="">All Departments</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Year Filter */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '12px', fontWeight: 600, color: '#64748b' }}>Year:</span>
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(Number(e.target.value))}
              style={{
                padding: '6px 12px',
                borderRadius: '6px',
                border: '1px solid #cbd5e1',
                fontSize: '13px',
                background: '#ffffff',
                fontWeight: 500,
                color: '#0f172a',
              }}
            >
              {[2024, 2025, 2026, 2027].map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </div>

          {/* Month Filter */}
          {(activeTab === 'attendance' || activeTab === 'exports') && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontSize: '12px', fontWeight: 600, color: '#64748b' }}>Month:</span>
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(Number(e.target.value))}
                style={{
                  padding: '6px 12px',
                  borderRadius: '6px',
                  border: '1px solid #cbd5e1',
                  fontSize: '13px',
                  background: '#ffffff',
                  fontWeight: 500,
                  color: '#0f172a',
                }}
              >
                {monthNames.map((name, idx) => (
                  <option key={idx + 1} value={idx + 1}>
                    {name}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>

      {/* Sub Navigation Bar */}
      <div
        className="subtabs-scroll"
        style={{
          display: 'flex',
          gap: '8px',
          borderBottom: '1px solid #e2e8f0',
          paddingBottom: '8px',
        }}
      >
        {[
          { key: 'overview', label: 'Executive Overview', icon: Icons.BarChart },
          { key: 'workforce', label: 'Workforce Demographics', icon: Icons.Users },
          { key: 'attendance', label: 'Attendance Patterns', icon: Icons.Clock },
          { key: 'leaves', label: 'Leave Utilization', icon: Icons.Calendar },
          ...(canSeePayroll ? [{ key: 'payroll', label: 'Payroll & Statutory', icon: Icons.Dollar }] : []),
          { key: 'lifecycle', label: 'Talent Lifecycle', icon: Icons.Rocket },
          { key: 'exports', label: 'CSV Data Exports', icon: Icons.Download },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as ReportTab)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '8px 16px',
                borderRadius: '6px',
                border: 'none',
                background: isActive ? '#2563eb' : '#ffffff',
                color: isActive ? '#ffffff' : '#475569',
                fontWeight: isActive ? 700 : 500,
                fontSize: '13px',
                cursor: 'pointer',
                flexShrink: 0,
                whiteSpace: 'nowrap',
                boxShadow: isActive ? '0 1px 3px rgba(37,99,235,0.3)' : 'none',
                transition: 'all 0.15s ease',
              }}
            >
              <Icon size={16} color={isActive ? '#ffffff' : '#64748b'} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Error Message */}
      {errorMsg && (
        <div
          style={{
            background: '#fef2f2',
            borderLeft: '4px solid #ef4444',
            padding: '12px 16px',
            color: '#991b1b',
            borderRadius: '4px',
            fontSize: '14px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <Icons.AlertTriangle size={18} color="#ef4444" />
          <span>
            <strong>Error:</strong> {errorMsg}
          </span>
        </div>
      )}

      {loading ? (
        <div style={{ padding: '60px', textAlign: 'center', color: '#64748b' }}>
          <div style={{ fontSize: '15px', fontWeight: 600 }}>Loading real-time analytics...</div>
          <div style={{ fontSize: '13px', marginTop: '4px', color: '#94a3b8' }}>
            Compiling live multi-module telemetry data
          </div>
        </div>
      ) : (
        <>
          {/* TAB 1: Executive Overview */}
          {activeTab === 'overview' && overviewData && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {/* KPI Cards & Presence Gauge Grid */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))',
                  gap: '16px',
                }}
              >
                <div style={{ background: '#ffffff', padding: '20px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                  <div style={{ fontSize: '12px', fontWeight: 600, color: '#64748b', textTransform: 'uppercase' }}>
                    Active Headcount
                  </div>
                  <div style={{ fontSize: '32px', fontWeight: 900, color: '#0f172a', margin: '6px 0' }}>
                    {overviewData.activeHeadcount}
                  </div>
                  <div style={{ fontSize: '12px', color: '#10b981', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Icons.Check size={14} color="#10b981" />
                    +{overviewData.newHiresThisMonth} joined • -{overviewData.exitsThisMonth} exited this month
                  </div>
                </div>

                <div style={{ background: '#ffffff', padding: '20px', borderRadius: '8px', border: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontSize: '12px', fontWeight: 600, color: '#64748b', textTransform: 'uppercase' }}>
                      Today's Presence
                    </div>
                    <div style={{ fontSize: '30px', fontWeight: 900, color: '#2563eb', margin: '4px 0' }}>
                      {overviewData.presenceRate}%
                    </div>
                    <div style={{ fontSize: '12px', color: '#64748b' }}>
                      {overviewData.todayPunches} clocked in ({overviewData.todayLatePunches} late)
                    </div>
                  </div>
                  <CircularGauge
                    value={overviewData.presenceRate}
                    label=""
                    size={80}
                    strokeWidth={8}
                  />
                </div>

                {overviewData.currentMonthPayrollExpense !== null && (
                  <div style={{ background: '#ffffff', padding: '20px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                    <div style={{ fontSize: '12px', fontWeight: 600, color: '#64748b', textTransform: 'uppercase' }}>
                      Current Month Net Payroll
                    </div>
                    <div style={{ fontSize: '32px', fontWeight: 900, color: '#059669', margin: '6px 0' }}>
                      ₹{Number(overviewData.currentMonthPayrollExpense).toLocaleString()}
                    </div>
                    <div style={{ fontSize: '12px', color: '#64748b' }}>
                      Approved / Disbursed expense
                    </div>
                  </div>
                )}

                <div style={{ background: '#ffffff', padding: '20px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                  <div style={{ fontSize: '12px', fontWeight: 600, color: '#64748b', textTransform: 'uppercase' }}>
                    Pending Approvals
                  </div>
                  <div style={{ fontSize: '32px', fontWeight: 900, color: '#f59e0b', margin: '6px 0' }}>
                    {overviewData.pendingApprovals.total}
                  </div>
                  <div style={{ fontSize: '12px', color: '#64748b' }}>
                    {overviewData.pendingApprovals.leaves} leaves • {overviewData.pendingApprovals.exits} resignations
                  </div>
                </div>
              </div>

              {/* Real-time telemetry summary */}
              <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '16px' }}>
                <h4 style={{ margin: '0 0 6px', fontSize: '14px', fontWeight: 700, color: '#0f172a' }}>
                  Cross-Module Telemetry Engine
                </h4>
                <p style={{ margin: 0, fontSize: '13px', color: '#475569' }}>
                  Live cross-module aggregations reflect instant database commits across Attendance (M4), Leaves (M5), Payroll (M6), Onboarding (M8), and Offboarding (M9).
                </p>
              </div>
            </div>
          )}

          {/* TAB 2: Workforce Demographics */}
          {activeTab === 'workforce' && workforceData && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {selectedDepartmentId && (
                <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '6px', padding: '10px 16px', fontSize: '13px', color: '#1e40af' }}>
                  Filtering demographics specifically for <strong>{selectedDepartmentName}</strong> ({workforceData.totalActive} active members).
                </div>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px' }}>
                {/* Department Distribution (Donut Chart) */}
                <div style={{ background: '#ffffff', padding: '20px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                  <h3 style={{ margin: '0 0 16px', fontSize: '16px', fontWeight: 700, color: '#0f172a' }}>
                    Headcount by Department
                  </h3>
                  <DonutChart
                    data={workforceData.byDepartment.map((d: any) => ({
                      label: d.name,
                      value: d.count,
                    }))}
                    centerTitle="Active Staff"
                    centerValue={workforceData.totalActive}
                    size={180}
                  />
                </div>

                {/* Gender Diversity (Donut Chart) */}
                <div style={{ background: '#ffffff', padding: '20px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                  <h3 style={{ margin: '0 0 16px', fontSize: '16px', fontWeight: 700, color: '#0f172a' }}>
                    Gender Diversity Ratio
                  </h3>
                  <DonutChart
                    data={workforceData.byGender.map((g: any) => ({
                      label: g.gender,
                      value: g.count,
                      color: g.gender === 'FEMALE' ? '#ec4899' : g.gender === 'MALE' ? '#3b82f6' : '#8b5cf6',
                    }))}
                    centerTitle="Workforce"
                    centerValue={workforceData.totalActive}
                    size={180}
                  />
                </div>

                {/* Grade Distribution (Bar Chart) */}
                <div style={{ background: '#ffffff', padding: '20px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                  <h3 style={{ margin: '0 0 16px', fontSize: '16px', fontWeight: 700, color: '#0f172a' }}>
                    Grade Level Distribution
                  </h3>
                  <SvgBarChart
                    data={workforceData.byGrade.map((gr: any) => ({
                      label: gr.name,
                      value: gr.count,
                      color: '#8b5cf6',
                    }))}
                    defaultColor="#8b5cf6"
                    height={200}
                    yAxisFormatter={(v) => `${v}`}
                  />
                </div>

                {/* Employment Types */}
                <div style={{ background: '#ffffff', padding: '20px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                  <h3 style={{ margin: '0 0 16px', fontSize: '16px', fontWeight: 700, color: '#0f172a' }}>
                    Employment Types
                  </h3>
                  <DonutChart
                    data={workforceData.byEmploymentType.map((et: any) => ({
                      label: et.employmentType,
                      value: et.count,
                    }))}
                    centerTitle="Contracts"
                    centerValue={workforceData.totalActive}
                    size={180}
                  />
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: Attendance Patterns */}
          {activeTab === 'attendance' && attendanceData && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {selectedDepartmentId && (
                <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '6px', padding: '10px 16px', fontSize: '13px', color: '#1e40af' }}>
                  Scoped to department: <strong>{selectedDepartmentName}</strong> for {monthNames[selectedMonth - 1]} {selectedYear}.
                </div>
              )}

              {/* Attendance Summary Cards */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
                  gap: '16px',
                }}
              >
                <div style={{ background: '#ffffff', padding: '16px', borderRadius: '8px', border: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>
                      Monthly Presence Rate
                    </div>
                    <div style={{ fontSize: '26px', fontWeight: 900, color: '#2563eb', margin: '4px 0' }}>
                      {attendanceData.overallPresenceRate}%
                    </div>
                    <div style={{ fontSize: '11px', color: '#64748b' }}>
                      {monthNames[selectedMonth - 1]} {selectedYear}
                    </div>
                  </div>
                  <CircularGauge
                    value={attendanceData.overallPresenceRate}
                    label=""
                    size={72}
                    strokeWidth={7}
                  />
                </div>

                <div style={{ background: '#ffffff', padding: '16px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                  <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>
                    Late Arrivals
                  </div>
                  <div style={{ fontSize: '26px', fontWeight: 900, color: '#f59e0b', margin: '4px 0' }}>
                    {attendanceData.lateness.lateCount}
                  </div>
                  <div style={{ fontSize: '12px', color: '#64748b' }}>
                    {attendanceData.lateness.totalLateMinutes} total late minutes
                  </div>
                </div>

                <div style={{ background: '#ffffff', padding: '16px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                  <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>
                    Unexcused Absences
                  </div>
                  <div style={{ fontSize: '26px', fontWeight: 900, color: '#ef4444', margin: '4px 0' }}>
                    {attendanceData.statusCounts.ABSENT || 0}
                  </div>
                  <div style={{ fontSize: '12px', color: '#64748b' }}>
                    LOP payroll deductions
                  </div>
                </div>

                <div style={{ background: '#ffffff', padding: '16px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                  <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>
                    Authorized Leaves
                  </div>
                  <div style={{ fontSize: '26px', fontWeight: 900, color: '#8b5cf6', margin: '4px 0' }}>
                    {attendanceData.statusCounts.ON_LEAVE || 0}
                  </div>
                  <div style={{ fontSize: '12px', color: '#64748b' }}>
                    Approved applications
                  </div>
                </div>
              </div>

              {/* Interactive Daily Punch Activity Stacked Bar Chart */}
              <div style={{ background: '#ffffff', padding: '24px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '8px' }}>
                  <div>
                    <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: '#0f172a' }}>
                      Daily Punch Activity ({monthNames[selectedMonth - 1]} {selectedYear})
                    </h3>
                    <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#64748b' }}>
                      Hover over any day column to view exact Present, Absent, and On-Leave headcounts.
                    </p>
                  </div>
                </div>

                {attendanceData.dailyTimeline.length === 0 ? (
                  <div style={{ padding: '36px', textAlign: 'center', color: '#94a3b8', fontSize: '13px' }}>
                    No punch records recorded for {monthNames[selectedMonth - 1]} {selectedYear}.
                  </div>
                ) : (
                  <MultiSeriesBarChart
                    stacked={true}
                    height={260}
                    data={attendanceData.dailyTimeline.map((d: any) => ({
                      label: d.date.slice(8), // Show day number '01', '02', etc.
                      series: [
                        { name: 'Present', value: d.present, color: '#10b981' },
                        { name: 'On Leave', value: d.onLeave, color: '#8b5cf6' },
                        { name: 'Absent', value: d.absent, color: '#ef4444' },
                      ],
                    }))}
                    yAxisFormatter={(v) => `${v}`}
                  />
                )}
              </div>
            </div>
          )}

          {/* TAB 4: Leave Utilization */}
          {activeTab === 'leaves' && leaveData && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {selectedDepartmentId && (
                <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '6px', padding: '10px 16px', fontSize: '13px', color: '#1e40af' }}>
                  Scoped to department: <strong>{selectedDepartmentName}</strong> for year {leaveData.year}.
                </div>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px' }}>
                {/* Leave Type Breakdown (Bar Chart) */}
                <div style={{ background: '#ffffff', padding: '20px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                  <h3 style={{ margin: '0 0 16px', fontSize: '16px', fontWeight: 700, color: '#0f172a' }}>
                    Days Consumed by Leave Type ({leaveData.year})
                  </h3>
                  <SvgBarChart
                    data={leaveData.byLeaveType.map((lt: any) => ({
                      label: lt.code,
                      value: lt.totalDays,
                      color: lt.isPaid ? '#10b981' : '#f59e0b',
                      sublabel: `${lt.name} (${lt.isPaid ? 'Paid' : 'Unpaid'}) • ${lt.count} applications`,
                    }))}
                    height={220}
                    yAxisFormatter={(v) => `${v}d`}
                  />
                </div>

                {/* Department Consumption (Bar Chart) */}
                <div style={{ background: '#ffffff', padding: '20px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                  <h3 style={{ margin: '0 0 16px', fontSize: '16px', fontWeight: 700, color: '#0f172a' }}>
                    Department Consumption ({leaveData.year})
                  </h3>
                  <SvgBarChart
                    data={leaveData.byDepartment.map((d: any) => ({
                      label: d.name,
                      value: d.totalDays,
                      color: '#2563eb',
                    }))}
                    defaultColor="#2563eb"
                    height={220}
                    yAxisFormatter={(v) => `${v}d`}
                  />
                </div>
              </div>
            </div>
          )}

          {/* TAB 5: Payroll & Statutory Liabilities */}
          {activeTab === 'payroll' && payrollData && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {/* Statutory Liabilities Summary Cards */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                  gap: '16px',
                }}
              >
                <div style={{ background: '#ffffff', padding: '16px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                  <div style={{ fontSize: '12px', color: '#64748b', fontWeight: 600 }}>EMPLOYEE EPF (12%)</div>
                  <div style={{ fontSize: '24px', fontWeight: 900, color: '#0f172a', margin: '4px 0' }}>
                    ₹{payrollData.statutoryLiabilities.totalEmployeePf.toLocaleString()}
                  </div>
                  <div style={{ fontSize: '11px', color: '#64748b' }}>Deducted from employee salaries</div>
                </div>

                <div style={{ background: '#ffffff', padding: '16px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                  <div style={{ fontSize: '12px', color: '#64748b', fontWeight: 600 }}>EMPLOYER EPF (12%)</div>
                  <div style={{ fontSize: '24px', fontWeight: 900, color: '#0f172a', margin: '4px 0' }}>
                    ₹{payrollData.statutoryLiabilities.totalEmployerPf.toLocaleString()}
                  </div>
                  <div style={{ fontSize: '11px', color: '#64748b' }}>Company statutory liability</div>
                </div>

                <div style={{ background: '#ffffff', padding: '16px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                  <div style={{ fontSize: '12px', color: '#64748b', fontWeight: 600 }}>PROFESSIONAL TAX (PT)</div>
                  <div style={{ fontSize: '24px', fontWeight: 900, color: '#0f172a', margin: '4px 0' }}>
                    ₹{payrollData.statutoryLiabilities.totalProfessionalTax.toLocaleString()}
                  </div>
                  <div style={{ fontSize: '11px', color: '#64748b' }}>State remittances</div>
                </div>

                <div style={{ background: '#eff6ff', padding: '16px', borderRadius: '8px', border: '1px solid #bfdbfe' }}>
                  <div style={{ fontSize: '12px', color: '#1d4ed8', fontWeight: 700 }}>TOTAL STATUTORY REMITTANCE</div>
                  <div style={{ fontSize: '24px', fontWeight: 900, color: '#1e40af', margin: '4px 0' }}>
                    ₹{payrollData.statutoryLiabilities.totalStatutoryLiabilities.toLocaleString()}
                  </div>
                  <div style={{ fontSize: '11px', color: '#1d4ed8' }}>PF (Combined) + PT Total</div>
                </div>
              </div>

              {/* Monthly Gross vs Net Pay Trend Chart */}
              <div style={{ background: '#ffffff', padding: '24px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                <h3 style={{ margin: '0 0 16px', fontSize: '16px', fontWeight: 700, color: '#0f172a' }}>
                  Month-on-Month Payroll Trends ({payrollData.year})
                </h3>
                {payrollData.monthlyTrends.length === 0 ? (
                  <div style={{ padding: '36px', textAlign: 'center', color: '#94a3b8', fontSize: '13px' }}>
                    No payroll batches generated for year {payrollData.year}.
                  </div>
                ) : (
                  <MultiSeriesBarChart
                    data={payrollData.monthlyTrends.map((b: any) => ({
                      label: monthNames[b.month - 1] || `M${b.month}`,
                      series: [
                        { name: 'Gross Pay', value: b.totalGross, color: '#3b82f6' },
                        { name: 'Net Pay', value: b.totalNetPay, color: '#10b981' },
                      ],
                    }))}
                    height={240}
                    yAxisFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`}
                  />
                )}
              </div>

              {/* Department Cost Distribution */}
              {payrollData.departmentDistribution && payrollData.departmentDistribution.length > 0 && (
                <div style={{ background: '#ffffff', padding: '20px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                  <h3 style={{ margin: '0 0 16px', fontSize: '16px', fontWeight: 700, color: '#0f172a' }}>
                    Department Payroll Cost Distribution ({payrollData.year})
                  </h3>
                  <DonutChart
                    data={payrollData.departmentDistribution.map((d: any) => ({
                      label: d.department,
                      value: d.totalNet,
                    }))}
                    centerTitle="Net Payroll"
                    centerValue={`₹${(payrollData.summary.totalYearNet / 1000).toFixed(0)}k`}
                    size={200}
                  />
                </div>
              )}
            </div>
          )}

          {/* TAB 6: Talent Lifecycle */}
          {activeTab === 'lifecycle' && lifecycleData && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px' }}>
              {/* Onboarding Funnel (FunnelChart) */}
              <div style={{ background: '#ffffff', padding: '20px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                  <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: '#0f172a' }}>
                    Onboarding Pipeline Conversion
                  </h3>
                  <span style={{ fontSize: '14px', fontWeight: 800, color: '#059669' }}>
                    {lifecycleData.onboarding.conversionRate}% Converted
                  </span>
                </div>

                <FunnelPipeline
                  steps={[
                    {
                      label: 'Invited Candidates',
                      count: lifecycleData.onboarding.totalCandidates,
                      percentage: 100,
                      color: '#3b82f6',
                    },
                    {
                      label: 'Pre-boarding In Progress',
                      count: lifecycleData.onboarding.funnel.IN_PROGRESS || 0,
                      percentage:
                        lifecycleData.onboarding.totalCandidates > 0
                          ? Math.round(
                              ((lifecycleData.onboarding.funnel.IN_PROGRESS || 0) /
                                lifecycleData.onboarding.totalCandidates) *
                                100,
                            )
                          : 0,
                      color: '#6366f1',
                    },
                    {
                      label: 'Form Submitted',
                      count: lifecycleData.onboarding.funnel.SUBMITTED || 0,
                      percentage:
                        lifecycleData.onboarding.totalCandidates > 0
                          ? Math.round(
                              ((lifecycleData.onboarding.funnel.SUBMITTED || 0) /
                                lifecycleData.onboarding.totalCandidates) *
                                100,
                            )
                          : 0,
                      color: '#f59e0b',
                    },
                    {
                      label: 'Converted to Official Employees',
                      count: lifecycleData.onboarding.convertedCount,
                      percentage: lifecycleData.onboarding.conversionRate,
                      color: '#10b981',
                    },
                  ]}
                />
              </div>

              {/* Exit Reasons & Ratings */}
              <div style={{ background: '#ffffff', padding: '20px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                <h3 style={{ margin: '0 0 16px', fontSize: '16px', fontWeight: 700, color: '#0f172a' }}>
                  Exit Interview Average Feedback Scores
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  {[
                    { label: 'Company Culture', val: lifecycleData.offboarding.averageRatings.culture },
                    { label: 'Management & Leadership', val: lifecycleData.offboarding.averageRatings.management },
                    { label: 'Work-Life Balance', val: lifecycleData.offboarding.averageRatings.workLifeBalance },
                    { label: 'Compensation & Benefits', val: lifecycleData.offboarding.averageRatings.compensation },
                  ].map((r) => (
                    <div key={r.label}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', marginBottom: '4px' }}>
                        <span style={{ fontWeight: 600, color: '#1e293b' }}>{r.label}</span>
                        <strong style={{ color: '#0f172a' }}>{r.val} / 5</strong>
                      </div>
                      <div style={{ background: '#f1f5f9', height: '8px', borderRadius: '4px', overflow: 'hidden' }}>
                        <div
                          style={{
                            width: `${(r.val / 5) * 100}%`,
                            background: r.val >= 4 ? '#10b981' : r.val >= 3 ? '#f59e0b' : '#ef4444',
                            height: '100%',
                            transition: 'width 0.4s ease',
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 7: CSV Data Exports */}
          {activeTab === 'exports' && (
            <div style={{ background: '#ffffff', padding: '24px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', flexWrap: 'wrap', gap: '8px' }}>
                <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: '#0f172a' }}>
                  1-Click Standard CSV Data Exports
                </h3>
                <div style={{ fontSize: '12px', background: '#f1f5f9', padding: '4px 10px', borderRadius: '4px', color: '#475569' }}>
                  Export Scope: <strong>{selectedDepartmentName}</strong> • Year <strong>{selectedYear}</strong> • Month <strong>{monthNames[selectedMonth - 1]}</strong>
                </div>
              </div>
              <p style={{ margin: '0 0 24px', fontSize: '13px', color: '#64748b' }}>
                Download compliance-ready, standardized RFC 4180 CSV data extracts for labor audits, accountant reviews, and tax filings.
              </p>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px' }}>
                <div style={{ border: '1px solid #e2e8f0', borderRadius: '6px', padding: '18px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                  <div>
                    <h4 style={{ margin: '0 0 8px', fontSize: '14px', fontWeight: 700, color: '#0f172a' }}>Headcount Master</h4>
                    <p style={{ fontSize: '12px', color: '#64748b', margin: '0 0 14px' }}>
                      Complete employee register: Code, Name, Email, Department, Designation, Grade, Status, Joining Date.
                    </p>
                  </div>
                  <button
                    className="btn btn-primary"
                    style={{ width: '100%', padding: '8px', fontSize: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                    onClick={() => handleExportCsv('headcount')}
                  >
                    <Icons.Download size={14} color="#ffffff" />
                    Download Headcount CSV
                  </button>
                </div>

                <div style={{ border: '1px solid #e2e8f0', borderRadius: '6px', padding: '18px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                  <div>
                    <h4 style={{ margin: '0 0 8px', fontSize: '14px', fontWeight: 700, color: '#0f172a' }}>Attendance Register</h4>
                    <p style={{ fontSize: '12px', color: '#64748b', margin: '0 0 14px' }}>
                      Punches for {monthNames[selectedMonth - 1]} {selectedYear}: Date, Employee, Check-In, Check-Out, Active Minutes, Lateness, Status.
                    </p>
                  </div>
                  <button
                    className="btn btn-primary"
                    style={{ width: '100%', padding: '8px', fontSize: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                    onClick={() => handleExportCsv('attendance')}
                  >
                    <Icons.Download size={14} color="#ffffff" />
                    Download Attendance CSV
                  </button>
                </div>

                {canSeePayroll && (
                  <div style={{ border: '1px solid #e2e8f0', borderRadius: '6px', padding: '18px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                    <div>
                      <h4 style={{ margin: '0 0 8px', fontSize: '14px', fontWeight: 700, color: '#0f172a' }}>Payroll Batches</h4>
                      <p style={{ fontSize: '12px', color: '#64748b', margin: '0 0 14px' }}>
                        Payroll history: Year, Month, Batch Name, Total Gross, Total Deductions, Total Net Pay.
                      </p>
                    </div>
                    <button
                      className="btn btn-primary"
                      style={{ width: '100%', padding: '8px', fontSize: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                      onClick={() => handleExportCsv('payroll')}
                    >
                      <Icons.Download size={14} color="#ffffff" />
                      Download Payroll CSV
                    </button>
                  </div>
                )}

                <div style={{ border: '1px solid #e2e8f0', borderRadius: '6px', padding: '18px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                  <div>
                    <h4 style={{ margin: '0 0 8px', fontSize: '14px', fontWeight: 700, color: '#0f172a' }}>Leave Applications</h4>
                    <p style={{ fontSize: '12px', color: '#64748b', margin: '0 0 14px' }}>
                      Annual leave records: Employee, Department, Leave Type, Dates, Total Days, Status, Reason.
                    </p>
                  </div>
                  <button
                    className="btn btn-primary"
                    style={{ width: '100%', padding: '8px', fontSize: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                    onClick={() => handleExportCsv('leaves')}
                  >
                    <Icons.Download size={14} color="#ffffff" />
                    Download Leaves CSV
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};
