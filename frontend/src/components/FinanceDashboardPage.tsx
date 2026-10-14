import React, { useEffect, useMemo, useState } from 'react';
import { api } from '../api';
import { BarChart } from './ReportCharts';
import { Icons } from './Icons';

interface Props {
  user: any;
  onNavigateTab: (tab: string, subView?: string) => void;
}

const money = (value: number | null | undefined) =>
  value == null
    ? '—'
    : new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR',
        maximumFractionDigits: 0,
      }).format(value);

const monthName = (month: number) =>
  new Date(2000, month - 1, 1).toLocaleDateString('en-IN', { month: 'short' });

export const FinanceDashboardPage: React.FC<Props> = ({ user, onNavigateTab }) => {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const [batches, setBatches] = useState<any[]>([]);
  const [report, setReport] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const [batchResult, reportResult] = await Promise.all([
        api.getBatches(),
        api.getPayrollReports({ year }),
      ]);
      setBatches(Array.isArray(batchResult) ? batchResult : []);
      setReport(reportResult);
    } catch (err: any) {
      setError(err?.message || 'Unable to load payroll overview.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const currentBatch = batches.find((batch) => Number(batch.year) === year && Number(batch.month) === month);
  const openBatches = batches.filter((batch) => batch.status !== 'DISBURSED');
  const monthlyData = useMemo(
    () =>
      [...(report?.monthlyTrends || [])]
        .sort((a: any, b: any) => Number(a.month) - Number(b.month))
        .map((item: any) => ({
          label: monthName(Number(item.month)),
          value: Number(item.totalNetPay || 0),
          sublabel: item.status,
        })),
    [report],
  );

  const kpis = [
    {
      label: 'Net payroll this year',
      value: loading ? '…' : money(report?.summary?.totalYearNet),
      helper: 'Across available payroll batches',
      icon: Icons.Wallet,
      tone: '#2563eb',
    },
    {
      label: 'Payroll batches',
      value: loading ? '…' : String(report?.summary?.batchCount ?? batches.length),
      helper: `${year} payroll periods`,
      icon: Icons.Calendar,
      tone: '#0f766e',
    },
    {
      label: 'Needs attention',
      value: loading ? '…' : String(openBatches.length),
      helper: 'Draft or locked batches not yet disbursed',
      icon: Icons.AlertTriangle,
      tone: openBatches.length ? '#b45309' : '#15803d',
    },
    {
      label: 'Statutory liabilities',
      value: loading ? '…' : money(report?.statutoryLiabilities?.totalStatutoryLiabilities),
      helper: 'PF and professional tax',
      icon: Icons.Shield,
      tone: '#7c3aed',
    },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <section
        style={{
          background: 'linear-gradient(135deg, #172554 0%, #1e40af 100%)',
          color: '#fff',
          borderRadius: 14,
          padding: '24px 26px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 16,
        }}
      >
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', color: '#bfdbfe', textTransform: 'uppercase' }}>
            Finance workspace
          </div>
          <h1 style={{ fontSize: 25, lineHeight: 1.25, margin: '6px 0', color: '#fff' }}>
            Welcome back{user?.employee?.firstName ? `, ${user.employee.firstName}` : ''}
          </h1>
          <p style={{ fontSize: 13, color: '#dbeafe', margin: 0 }}>
            Review payroll readiness, pending batches, and statutory totals for {year}.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button className="btn btn-secondary" onClick={load} disabled={loading}>Refresh</button>
          <button className="btn btn-primary" onClick={() => onNavigateTab('payroll')}>Open Payroll</button>
        </div>
      </section>

      {error && <div className="alert-error" role="alert">{error}</div>}

      <section aria-label="Finance key performance indicators" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(205px, 1fr))', gap: 14 }}>
        {kpis.map((kpi) => {
          const Icon = kpi.icon;
          return (
            <article key={kpi.label} className="card" style={{ padding: '17px 18px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                <span style={{ color: '#64748b', fontSize: 12, fontWeight: 650 }}>{kpi.label}</span>
                <span style={{ display: 'inline-flex', padding: 7, borderRadius: 8, background: '#f1f5f9', color: kpi.tone }}>
                  <Icon size={17} />
                </span>
              </div>
              <div style={{ color: '#0f172a', fontSize: 25, fontWeight: 800, margin: '8px 0 3px', overflowWrap: 'anywhere' }}>
                {kpi.value}
              </div>
              <p style={{ color: '#64748b', fontSize: 11, margin: 0 }}>{kpi.helper}</p>
            </article>
          );
        })}
      </section>

      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 16 }}>
        <article className="card" style={{ minWidth: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 12 }}>
            <div>
              <h2 style={{ fontSize: 16, margin: 0, color: '#0f172a' }}>Monthly net payroll</h2>
              <p style={{ fontSize: 12, color: '#64748b', margin: '4px 0 0' }}>Disbursement trend by payroll period</p>
            </div>
            <span style={{ fontSize: 12, color: '#64748b' }}>{year}</span>
          </div>
          {loading ? (
            <div className="skeleton" style={{ height: 220 }} />
          ) : monthlyData.length ? (
            <BarChart data={monthlyData} height={220} yAxisFormatter={(value) => money(value)} />
          ) : (
            <div style={{ padding: '32px 12px', textAlign: 'center', color: '#64748b', fontSize: 13 }}>
              No payroll batches are available for {year} yet.
            </div>
          )}
        </article>

        <article className="card" style={{ minWidth: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 14 }}>
            <div>
              <h2 style={{ fontSize: 16, margin: 0, color: '#0f172a' }}>Current payroll period</h2>
              <p style={{ fontSize: 12, color: '#64748b', margin: '4px 0 0' }}>{monthName(month)} {year}</p>
            </div>
            <span style={{ borderRadius: 999, padding: '4px 9px', fontSize: 11, fontWeight: 700, background: currentBatch ? '#dbeafe' : '#f1f5f9', color: currentBatch ? '#1d4ed8' : '#475569' }}>
              {currentBatch?.status || 'Not started'}
            </span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
            <div style={{ background: '#f8fafc', borderRadius: 8, padding: 12 }}>
              <div style={{ fontSize: 11, color: '#64748b' }}>Employees in batch</div>
              <div style={{ fontSize: 22, fontWeight: 800, color: '#0f172a', marginTop: 4 }}>
                {loading ? '…' : currentBatch?.totalEmployees ?? '—'}
              </div>
            </div>
            <div style={{ background: '#f8fafc', borderRadius: 8, padding: 12 }}>
              <div style={{ fontSize: 11, color: '#64748b' }}>Net pay</div>
              <div style={{ fontSize: 19, fontWeight: 800, color: '#0f172a', marginTop: 4 }}>
                {loading ? '…' : money(currentBatch ? Number(currentBatch.totalNetPay) : null)}
              </div>
            </div>
          </div>
          <h3 style={{ fontSize: 13, color: '#334155', margin: '0 0 8px' }}>Batches requiring follow-up</h3>
          {loading ? <div className="skeleton" style={{ height: 58 }} /> : openBatches.length ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {openBatches.slice(0, 4).map((batch) => (
                <button
                  type="button"
                  key={batch.id}
                  onClick={() => onNavigateTab('payroll')}
                  style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, padding: '10px 12px', border: '1px solid #e2e8f0', borderRadius: 8, background: '#fff', cursor: 'pointer', textAlign: 'left' }}
                >
                  <span style={{ color: '#334155', fontSize: 12, fontWeight: 600 }}>
                    {monthName(Number(batch.month))} {batch.year}
                  </span>
                  <span style={{ color: batch.status === 'DRAFT' ? '#b45309' : '#1d4ed8', fontSize: 11, fontWeight: 700 }}>
                    {String(batch.status || 'Unknown').replaceAll('_', ' ')}
                  </span>
                </button>
              ))}
            </div>
          ) : (
            <p style={{ color: '#64748b', fontSize: 12, margin: 0 }}>No undistributed payroll batches need follow-up.</p>
          )}
        </article>
      </section>
    </div>
  );
};
