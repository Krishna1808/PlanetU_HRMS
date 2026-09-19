import React, { useState, useEffect } from 'react';
import { api } from '../api';

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

  const loadData = async () => {
    setLoading(true);
    setErrorMsg('');
    try {
      if (activeTab === 'overview') {
        const res = await api.getReportsOverview();
        setOverviewData(res);
      } else if (activeTab === 'workforce') {
        const res = await api.getWorkforceReports();
        setWorkforceData(res);
      } else if (activeTab === 'attendance') {
        const res = await api.getAttendanceReports({
          year: selectedYear,
          month: selectedMonth,
        });
        setAttendanceData(res);
      } else if (activeTab === 'leaves') {
        const res = await api.getLeaveReports({ year: selectedYear });
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
  }, [activeTab, selectedYear, selectedMonth]);

  const handleExportCsv = async (reportType: string) => {
    try {
      await api.downloadReportCsv(reportType, {
        year: selectedYear,
        month: selectedMonth,
      });
    } catch (err: any) {
      alert(`Export failed: ${err.message}`);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Top Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          background: '#ffffff',
          padding: '20px 24px',
          borderRadius: '8px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
        }}
      >
        <div>
          <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 800, color: '#0f172a' }}>
            📊 Reports & Dashboards Engine
          </h2>
          <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#64748b' }}>
            Cross-module executive business intelligence, workforce demographics, statutory summaries, and CSV data exports.
          </p>
        </div>

        {/* Global Year/Month Filter */}
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(Number(e.target.value))}
            style={{ padding: '6px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px' }}
          >
            {[2024, 2025, 2026, 2027].map((y) => (
              <option key={y} value={y}>
                Year {y}
              </option>
            ))}
          </select>

          {(activeTab === 'attendance' || activeTab === 'exports') && (
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(Number(e.target.value))}
              style={{ padding: '6px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px' }}
            >
              {[
                { m: 1, name: 'Jan' },
                { m: 2, name: 'Feb' },
                { m: 3, name: 'Mar' },
                { m: 4, name: 'Apr' },
                { m: 5, name: 'May' },
                { m: 6, name: 'Jun' },
                { m: 7, name: 'Jul' },
                { m: 8, name: 'Aug' },
                { m: 9, name: 'Sep' },
                { m: 10, name: 'Oct' },
                { m: 11, name: 'Nov' },
                { m: 12, name: 'Dec' },
              ].map((item) => (
                <option key={item.m} value={item.m}>
                  {item.name}
                </option>
              ))}
            </select>
          )}
        </div>
      </div>

      {/* Sub Navigation Bar */}
      <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', borderBottom: '1px solid #e2e8f0', paddingBottom: '8px' }}>
        {[
          { key: 'overview', label: '📊 Executive Overview' },
          { key: 'workforce', label: '👥 Workforce Demographics' },
          { key: 'attendance', label: '📍 Attendance Patterns' },
          { key: 'leaves', label: '🌴 Leave Utilization' },
          ...(canSeePayroll ? [{ key: 'payroll', label: '💰 Payroll & Statutory' }] : []),
          { key: 'lifecycle', label: '🚀 Talent Lifecycle' },
          { key: 'exports', label: '📥 CSV Data Exports' },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key as ReportTab)}
            style={{
              padding: '8px 16px',
              borderRadius: '6px',
              border: 'none',
              background: activeTab === tab.key ? '#2563eb' : '#ffffff',
              color: activeTab === tab.key ? '#ffffff' : '#475569',
              fontWeight: activeTab === tab.key ? 700 : 500,
              fontSize: '13px',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              boxShadow: activeTab === tab.key ? '0 1px 3px rgba(37,99,235,0.3)' : 'none',
            }}
          >
            {tab.label}
          </button>
        ))}
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
          }}
        >
          <strong>Error:</strong> {errorMsg}
        </div>
      )}

      {loading ? (
        <div style={{ padding: '48px', textAlign: 'center', color: '#64748b' }}>
          Loading real-time analytics...
        </div>
      ) : (
        <>
          {/* TAB 1: Executive Overview */}
          {activeTab === 'overview' && overviewData && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {/* KPI Cards Grid */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
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
                  <div style={{ fontSize: '12px', color: '#10b981' }}>
                    +{overviewData.newHiresThisMonth} joined • -{overviewData.exitsThisMonth} exited this month
                  </div>
                </div>

                <div style={{ background: '#ffffff', padding: '20px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                  <div style={{ fontSize: '12px', fontWeight: 600, color: '#64748b', textTransform: 'uppercase' }}>
                    Today's Presence Rate
                  </div>
                  <div style={{ fontSize: '32px', fontWeight: 900, color: '#2563eb', margin: '6px 0' }}>
                    {overviewData.presenceRate}%
                  </div>
                  <div style={{ fontSize: '12px', color: '#64748b' }}>
                    {overviewData.todayPunches} clocked in ({overviewData.todayLatePunches} late arrivals)
                  </div>
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

              {/* Quick Summary Info */}
              <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '16px' }}>
                <h4 style={{ margin: '0 0 8px', fontSize: '14px', fontWeight: 700 }}>Real-Time System Health</h4>
                <p style={{ margin: 0, fontSize: '13px', color: '#475569' }}>
                  Live cross-module aggregations reflect instant database commits across Attendance (M4), Leaves (M5), Payroll (M6), Onboarding (M8), and Offboarding (M9).
                </p>
              </div>
            </div>
          )}

          {/* TAB 2: Workforce Demographics */}
          {activeTab === 'workforce' && workforceData && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '20px' }}>
              {/* Department Breakdown */}
              <div style={{ background: '#ffffff', padding: '20px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                <h3 style={{ margin: '0 0 16px', fontSize: '16px', fontWeight: 700 }}>Headcount by Department</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {workforceData.byDepartment.map((d: any) => (
                    <div key={d.departmentId}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', marginBottom: '4px' }}>
                        <span style={{ fontWeight: 600 }}>{d.name}</span>
                        <span>{d.count} ({d.percentage}%)</span>
                      </div>
                      <div style={{ background: '#f1f5f9', height: '8px', borderRadius: '4px', overflow: 'hidden' }}>
                        <div style={{ width: `${d.percentage}%`, background: '#3b82f6', height: '100%' }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Gender Diversity */}
              <div style={{ background: '#ffffff', padding: '20px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                <h3 style={{ margin: '0 0 16px', fontSize: '16px', fontWeight: 700 }}>Gender Diversity Ratio</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {workforceData.byGender.map((g: any) => (
                    <div key={g.gender}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', marginBottom: '4px' }}>
                        <span style={{ fontWeight: 600 }}>{g.gender}</span>
                        <span>{g.count} ({g.percentage}%)</span>
                      </div>
                      <div style={{ background: '#f1f5f9', height: '8px', borderRadius: '4px', overflow: 'hidden' }}>
                        <div
                          style={{
                            width: `${g.percentage}%`,
                            background: g.gender === 'FEMALE' ? '#ec4899' : '#3b82f6',
                            height: '100%',
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Grade Distribution */}
              <div style={{ background: '#ffffff', padding: '20px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                <h3 style={{ margin: '0 0 16px', fontSize: '16px', fontWeight: 700 }}>Grade Levels</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {workforceData.byGrade.map((gr: any) => (
                    <div key={gr.gradeId}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', marginBottom: '4px' }}>
                        <span style={{ fontWeight: 600 }}>{gr.name}</span>
                        <span>{gr.count} ({gr.percentage}%)</span>
                      </div>
                      <div style={{ background: '#f1f5f9', height: '8px', borderRadius: '4px', overflow: 'hidden' }}>
                        <div style={{ width: `${gr.percentage}%`, background: '#8b5cf6', height: '100%' }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Employment Types */}
              <div style={{ background: '#ffffff', padding: '20px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                <h3 style={{ margin: '0 0 16px', fontSize: '16px', fontWeight: 700 }}>Employment Types</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {workforceData.byEmploymentType.map((et: any) => (
                    <div key={et.employmentType}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', marginBottom: '4px' }}>
                        <span style={{ fontWeight: 600 }}>{et.employmentType}</span>
                        <span>{et.count} ({et.percentage}%)</span>
                      </div>
                      <div style={{ background: '#f1f5f9', height: '8px', borderRadius: '4px', overflow: 'hidden' }}>
                        <div style={{ width: `${et.percentage}%`, background: '#10b981', height: '100%' }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: Attendance Patterns */}
          {activeTab === 'attendance' && attendanceData && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                  gap: '16px',
                }}
              >
                <div style={{ background: '#ffffff', padding: '16px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                  <div style={{ fontSize: '12px', color: '#64748b', fontWeight: 600 }}>OVERALL PRESENCE RATE</div>
                  <div style={{ fontSize: '28px', fontWeight: 800, color: '#2563eb', margin: '4px 0' }}>
                    {attendanceData.overallPresenceRate}%
                  </div>
                  <div style={{ fontSize: '12px', color: '#64748b' }}>For {selectedMonth}/{selectedYear}</div>
                </div>

                <div style={{ background: '#ffffff', padding: '16px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                  <div style={{ fontSize: '12px', color: '#64748b', fontWeight: 600 }}>TOTAL LATE ARRIVALS</div>
                  <div style={{ fontSize: '28px', fontWeight: 800, color: '#f59e0b', margin: '4px 0' }}>
                    {attendanceData.lateness.lateCount}
                  </div>
                  <div style={{ fontSize: '12px', color: '#64748b' }}>
                    {attendanceData.lateness.totalLateMinutes} late minutes
                  </div>
                </div>

                <div style={{ background: '#ffffff', padding: '16px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                  <div style={{ fontSize: '12px', color: '#64748b', fontWeight: 600 }}>ABSENT DAYS (UNEXCUSED)</div>
                  <div style={{ fontSize: '28px', fontWeight: 800, color: '#ef4444', margin: '4px 0' }}>
                    {attendanceData.statusCounts.ABSENT || 0}
                  </div>
                  <div style={{ fontSize: '12px', color: '#64748b' }}>Flagged for payroll deduction</div>
                </div>

                <div style={{ background: '#ffffff', padding: '16px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                  <div style={{ fontSize: '12px', color: '#64748b', fontWeight: 600 }}>AUTHORIZED LEAVE DAYS</div>
                  <div style={{ fontSize: '28px', fontWeight: 800, color: '#8b5cf6', margin: '4px 0' }}>
                    {attendanceData.statusCounts.ON_LEAVE || 0}
                  </div>
                  <div style={{ fontSize: '12px', color: '#64748b' }}>Approved leaves</div>
                </div>
              </div>

              {/* Day-by-Day Volume Timeline */}
              <div style={{ background: '#ffffff', padding: '20px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                <h3 style={{ margin: '0 0 16px', fontSize: '16px', fontWeight: 700 }}>Daily Punch Activity</h3>
                {attendanceData.dailyTimeline.length === 0 ? (
                  <div style={{ color: '#94a3b8', fontSize: '13px' }}>No punch records recorded for this month.</div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {attendanceData.dailyTimeline.map((d: any) => (
                      <div
                        key={d.date}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '12px',
                          fontSize: '12px',
                          borderBottom: '1px solid #f1f5f9',
                          paddingBottom: '4px',
                        }}
                      >
                        <span style={{ width: '90px', fontWeight: 600 }}>{d.date}</span>
                        <span style={{ color: '#15803d', width: '80px' }}>🟢 {d.present} Present</span>
                        <span style={{ color: '#b91c1c', width: '80px' }}>🔴 {d.absent} Absent</span>
                        <span style={{ color: '#6b21a8', width: '90px' }}>🟣 {d.onLeave} On Leave</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 4: Leave Utilization */}
          {activeTab === 'leaves' && leaveData && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '20px' }}>
              {/* Leave Type Breakdown */}
              <div style={{ background: '#ffffff', padding: '20px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                <h3 style={{ margin: '0 0 16px', fontSize: '16px', fontWeight: 700 }}>
                  Days Consumed by Leave Type ({leaveData.year})
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  {leaveData.byLeaveType.map((lt: any) => (
                    <div key={lt.code} style={{ borderBottom: '1px solid #f1f5f9', paddingBottom: '8px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                        <div>
                          <strong>{lt.name} ({lt.code})</strong>
                          <span style={{ fontSize: '11px', marginLeft: '6px', color: lt.isPaid ? '#059669' : '#d97706' }}>
                            {lt.isPaid ? 'PAID' : 'UNPAID'}
                          </span>
                        </div>
                        <span style={{ fontWeight: 700, color: '#0f172a' }}>{lt.totalDays} days</span>
                      </div>
                      <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>
                        {lt.count} approved applications
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Department Comparison */}
              <div style={{ background: '#ffffff', padding: '20px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                <h3 style={{ margin: '0 0 16px', fontSize: '16px', fontWeight: 700 }}>Department Consumption</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {leaveData.byDepartment.map((d: any) => (
                    <div key={d.name} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', borderBottom: '1px solid #f1f5f9', paddingBottom: '6px' }}>
                      <span style={{ fontWeight: 600 }}>{d.name}</span>
                      <strong style={{ color: '#2563eb' }}>{d.totalDays} days</strong>
                    </div>
                  ))}
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
                  <div style={{ fontSize: '11px', color: '#64748b' }}>State government remittances</div>
                </div>

                <div style={{ background: '#eff6ff', padding: '16px', borderRadius: '8px', border: '1px solid #bfdbfe' }}>
                  <div style={{ fontSize: '12px', color: '#1d4ed8', fontWeight: 700 }}>TOTAL STATUTORY REMITTANCE</div>
                  <div style={{ fontSize: '24px', fontWeight: 900, color: '#1e40af', margin: '4px 0' }}>
                    ₹{payrollData.statutoryLiabilities.totalStatutoryLiabilities.toLocaleString()}
                  </div>
                  <div style={{ fontSize: '11px', color: '#1d4ed8' }}>PF (Combined) + PT Total</div>
                </div>
              </div>

              {/* Monthly Batches Trend Table */}
              <div style={{ background: '#ffffff', padding: '20px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                <h3 style={{ margin: '0 0 16px', fontSize: '16px', fontWeight: 700 }}>Monthly Payroll Runs ({payrollData.year})</h3>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
                  <thead>
                    <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                      <th style={{ padding: '10px 14px' }}>Month</th>
                      <th style={{ padding: '10px 14px' }}>Batch</th>
                      <th style={{ padding: '10px 14px' }}>Employees</th>
                      <th style={{ padding: '10px 14px' }}>Total Gross</th>
                      <th style={{ padding: '10px 14px' }}>Total Deductions</th>
                      <th style={{ padding: '10px 14px' }}>Net Pay</th>
                      <th style={{ padding: '10px 14px' }}>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {payrollData.monthlyTrends.map((b: any) => (
                      <tr key={b.batchName} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '10px 14px' }}>Month {b.month}</td>
                        <td style={{ padding: '10px 14px', fontWeight: 600 }}>{b.batchName}</td>
                        <td style={{ padding: '10px 14px' }}>{b.employeeCount}</td>
                        <td style={{ padding: '10px 14px' }}>₹{b.totalGross.toLocaleString()}</td>
                        <td style={{ padding: '10px 14px', color: '#dc2626' }}>-₹{b.totalDeductions.toLocaleString()}</td>
                        <td style={{ padding: '10px 14px', fontWeight: 700, color: '#059669' }}>₹{b.totalNetPay.toLocaleString()}</td>
                        <td style={{ padding: '10px 14px' }}>
                          <span style={{ fontSize: '11px', fontWeight: 700, padding: '2px 6px', borderRadius: '4px', background: '#dcfce7', color: '#166534' }}>
                            {b.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 6: Talent Lifecycle */}
          {activeTab === 'lifecycle' && lifecycleData && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '20px' }}>
              {/* Onboarding Funnel */}
              <div style={{ background: '#ffffff', padding: '20px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                  <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700 }}>Onboarding Pipeline Conversion</h3>
                  <span style={{ fontSize: '14px', fontWeight: 800, color: '#059669' }}>
                    {lifecycleData.onboarding.conversionRate}% Converted
                  </span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '13px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>1. Invited Candidates</span>
                    <strong>{lifecycleData.onboarding.totalCandidates}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>2. In Progress / Pre-boarding</span>
                    <strong>{lifecycleData.onboarding.funnel.IN_PROGRESS || 0}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>3. Form Submitted</span>
                    <strong>{lifecycleData.onboarding.funnel.SUBMITTED || 0}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: '#059669', fontWeight: 700 }}>
                    <span>4. Converted to Official Employees</span>
                    <strong>{lifecycleData.onboarding.convertedCount}</strong>
                  </div>
                </div>
              </div>

              {/* Exit Reasons & Ratings */}
              <div style={{ background: '#ffffff', padding: '20px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                <h3 style={{ margin: '0 0 16px', fontSize: '16px', fontWeight: 700 }}>Exit Interview Average Ratings</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {[
                    { label: 'Company Culture', val: lifecycleData.offboarding.averageRatings.culture },
                    { label: 'Management & Leadership', val: lifecycleData.offboarding.averageRatings.management },
                    { label: 'Work-Life Balance', val: lifecycleData.offboarding.averageRatings.workLifeBalance },
                    { label: 'Compensation & Benefits', val: lifecycleData.offboarding.averageRatings.compensation },
                  ].map((r) => (
                    <div key={r.label}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', marginBottom: '4px' }}>
                        <span>{r.label}</span>
                        <strong>{r.val} / 5</strong>
                      </div>
                      <div style={{ background: '#f1f5f9', height: '6px', borderRadius: '3px', overflow: 'hidden' }}>
                        <div style={{ width: `${(r.val / 5) * 100}%`, background: '#f59e0b', height: '100%' }} />
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
              <h3 style={{ margin: '0 0 12px', fontSize: '18px', fontWeight: 700 }}>1-Click CSV Report Exports</h3>
              <p style={{ margin: '0 0 24px', fontSize: '13px', color: '#64748b' }}>
                Download compliance-ready, standardized tabular CSV data extracts for labor audits, accountant reviews, and tax filings.
              </p>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px' }}>
                <div style={{ border: '1px solid #e2e8f0', borderRadius: '6px', padding: '16px' }}>
                  <h4 style={{ margin: '0 0 8px', fontSize: '14px', fontWeight: 700 }}>👥 Headcount Master</h4>
                  <p style={{ fontSize: '12px', color: '#64748b', margin: '0 0 14px' }}>
                    Complete employee register: Code, Name, Email, Department, Designation, Grade, Status, Joining Date.
                  </p>
                  <button
                    className="btn btn-primary"
                    style={{ width: '100%', padding: '8px', fontSize: '12px' }}
                    onClick={() => handleExportCsv('headcount')}
                  >
                    Download Headcount CSV
                  </button>
                </div>

                <div style={{ border: '1px solid #e2e8f0', borderRadius: '6px', padding: '16px' }}>
                  <h4 style={{ margin: '0 0 8px', fontSize: '14px', fontWeight: 700 }}>📍 Attendance Register</h4>
                  <p style={{ fontSize: '12px', color: '#64748b', margin: '0 0 14px' }}>
                    Selected month punches: Date, Employee, Check-In, Check-Out, Active Minutes, Lateness, Status.
                  </p>
                  <button
                    className="btn btn-primary"
                    style={{ width: '100%', padding: '8px', fontSize: '12px' }}
                    onClick={() => handleExportCsv('attendance')}
                  >
                    Download Attendance CSV
                  </button>
                </div>

                {canSeePayroll && (
                  <div style={{ border: '1px solid #e2e8f0', borderRadius: '6px', padding: '16px' }}>
                    <h4 style={{ margin: '0 0 8px', fontSize: '14px', fontWeight: 700 }}>💰 Payroll Batches</h4>
                    <p style={{ fontSize: '12px', color: '#64748b', margin: '0 0 14px' }}>
                      Payroll history: Year, Month, Batch Name, Total Gross, Total Deductions, Total Net Pay.
                    </p>
                    <button
                      className="btn btn-primary"
                      style={{ width: '100%', padding: '8px', fontSize: '12px' }}
                      onClick={() => handleExportCsv('payroll')}
                    >
                      Download Payroll CSV
                    </button>
                  </div>
                )}

                <div style={{ border: '1px solid #e2e8f0', borderRadius: '6px', padding: '16px' }}>
                  <h4 style={{ margin: '0 0 8px', fontSize: '14px', fontWeight: 700 }}>🌴 Leave Applications</h4>
                  <p style={{ fontSize: '12px', color: '#64748b', margin: '0 0 14px' }}>
                    Annual leave records: Employee, Department, Leave Type, Dates, Total Days, Status, Reason.
                  </p>
                  <button
                    className="btn btn-primary"
                    style={{ width: '100%', padding: '8px', fontSize: '12px' }}
                    onClick={() => handleExportCsv('leaves')}
                  >
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
