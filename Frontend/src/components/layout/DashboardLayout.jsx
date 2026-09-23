import { useCallback, useEffect, useMemo, useState } from 'react';
import { getOverview, getStats } from '../../api/monitoringApi';
import { getErrorMessage } from '../../api/axios';
import Select from '../ui/Select';
import PageShell, { AlertBanner, PageHeader } from './PageShell';

const REFRESH_MS = 45000;

export default function DashboardLayout() {
  const [overview, setOverview] = useState(null);
  const [stats, setStats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [timeRange, setTimeRange] = useState('24h');
  const [chartMetric, setChartMetric] = useState('downCount');
  const [hoveredSection, setHoveredSection] = useState(null);
  const [selectedModalType, setSelectedModalType] = useState(null);

  const loadDashboard = useCallback(async () => {
    setError('');
    try {
      const [overviewRes, statsRes] = await Promise.all([
        getOverview(timeRange),
        getStats(timeRange),
      ]);
      setOverview(overviewRes.data);
      setStats(statsRes.data.stats || []);
    } catch (err) {
      setError(getErrorMessage(err, 'Unable to load dashboard. Please try again.'));
    } finally {
      setLoading(false);
    }
  }, [timeRange]);

  useEffect(() => {
    setLoading(true);
    loadDashboard();
  }, [loadDashboard]);

  useEffect(() => {
    const id = setInterval(loadDashboard, REFRESH_MS);
    return () => clearInterval(id);
  }, [loadDashboard]);

  const upCount = overview?.upWebsites ?? 0;
  const downCount = overview?.downWebsites ?? 0;
  const totalMonitored = overview?.totalWebsites ?? 0;
  const uptimePercentage = overview?.uptimePercentage ?? 0;

  const radius = 60;
  const strokeWidth = 14;
  const circumference = 2 * Math.PI * radius;
  const activePercentage = totalMonitored > 0 ? (upCount / totalMonitored) * 100 : 0;
  const activeOffset = circumference - (activePercentage / 100) * circumference;

  const centerDisplay = useMemo(() => {
    if (hoveredSection === 'active') return { count: upCount, label: 'UP' };
    if (hoveredSection === 'down') return { count: downCount, label: 'DOWN' };
    return { count: totalMonitored, label: 'SITES' };
  }, [hoveredSection, upCount, downCount, totalMonitored]);

  const chartSites = useMemo(() => {
    if (selectedModalType === 'active') {
      return stats.filter((s) => s.uptimePercentage >= 50);
    }
    if (selectedModalType === 'down') {
      return stats.filter((s) => s.downCount > 0);
    }
    return [];
  }, [selectedModalType, stats]);

  const maxChartCount = useMemo(() => {
    const values = stats.map((s) =>
      chartMetric === 'uptime' ? s.uptimePercentage : s.downCount
    );
    return Math.max(...values, 1);
  }, [stats, chartMetric]);

  const rangeLabel =
    timeRange === '48h' ? 'last 48 hours' : timeRange === '72h' ? 'last 72 hours' : 'last 24 hours';

  return (
    <PageShell>
      <PageHeader
        title="System Overview"
        description="Live health metrics · refreshes every 45 seconds"
        actions={
          <Select
            value={timeRange}
            onChange={(e) => setTimeRange(e.target.value)}
            className="w-auto min-w-[8rem]"
            aria-label="Time range"
            options={[
              { value: '24h', label: '24 Hours' },
              { value: '48h', label: '48 Hours' },
              { value: '72h', label: '72 Hours' },
            ]}
          />
        }
      />

      {error && <AlertBanner>{error}</AlertBanner>}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {[
          { label: 'Total Websites', value: totalMonitored },
          { label: 'UP', value: upCount },
          { label: 'DOWN', value: downCount },
          { label: 'Uptime %', value: `${uptimePercentage}%` },
        ].map((card) => (
          <div key={card.label} className="bg-gray-50 border border-gray-200 rounded-2xl p-4 sm:p-5 shadow-sm">
            <p className="text-sm font-semibold text-gray-500 uppercase tracking-wide">{card.label}</p>
            <p className="text-2xl sm:text-3xl font-bold text-gray-900 mt-1.5">
              {loading ? '…' : card.value}
            </p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-6">
        <div className="lg:col-span-5 bg-gray-50 border border-gray-200 rounded-2xl p-4 sm:p-6 flex flex-col justify-between shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900">Site Health</h2>

          <div className="relative my-4 sm:my-6 flex items-center justify-center">
            <svg className="w-40 h-40 sm:w-52 sm:h-52 -rotate-90 transform" viewBox="0 0 160 160">
              <circle
                cx="80"
                cy="80"
                r={radius}
                stroke={hoveredSection === 'down' ? '#EF4444' : '#F87171'}
                strokeWidth={hoveredSection === 'down' ? strokeWidth + 2 : strokeWidth}
                strokeLinecap="round"
                fill="transparent"
                className="cursor-pointer transition-all duration-300"
                onClick={() => setSelectedModalType('down')}
                onMouseEnter={() => setHoveredSection('down')}
                onMouseLeave={() => setHoveredSection(null)}
              />
              <circle
                cx="80"
                cy="80"
                r={radius}
                stroke={hoveredSection === 'active' ? '#059669' : '#10B981'}
                strokeWidth={hoveredSection === 'active' ? strokeWidth + 2 : strokeWidth}
                strokeDasharray={circumference}
                strokeDashoffset={activeOffset}
                strokeLinecap="round"
                fill="transparent"
                className="cursor-pointer transition-all duration-300"
                onClick={() => setSelectedModalType('active')}
                onMouseEnter={() => setHoveredSection('active')}
                onMouseLeave={() => setHoveredSection(null)}
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none">
              <span className="text-2xl sm:text-3xl font-bold text-gray-900">
                {loading ? '…' : centerDisplay.count}
              </span>
              <span className="text-sm font-semibold text-gray-500 uppercase tracking-wider mt-0.5">
                {centerDisplay.label}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 sm:gap-3 pt-2">
            <button
              type="button"
              onClick={() => setSelectedModalType('active')}
              className="flex items-center justify-between p-3 rounded-xl bg-emerald-50 border border-emerald-200/60"
            >
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" aria-hidden="true" />
                <span className="text-sm font-semibold text-emerald-900">UP</span>
              </div>
              <span className="text-base font-bold text-emerald-900">{upCount}</span>
            </button>
            <button
              type="button"
              onClick={() => setSelectedModalType('down')}
              className="flex items-center justify-between p-3 rounded-xl bg-red-50 border border-red-200/60"
            >
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-red-500" aria-hidden="true" />
                <span className="text-sm font-semibold text-red-900">DOWN</span>
              </div>
              <span className="text-base font-bold text-red-900">{downCount}</span>
            </button>
          </div>
        </div>

        <div className="lg:col-span-7 bg-gray-50 border border-gray-200 rounded-2xl p-4 sm:p-6 flex flex-col shadow-sm overflow-visible min-w-0">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Website Statistics</h2>
              <p className="text-sm text-gray-500">Performance for the {rangeLabel}</p>
            </div>
            <Select
              value={chartMetric}
              onChange={(e) => setChartMetric(e.target.value)}
              className="w-full sm:w-auto min-w-[10rem]"
              aria-label="Chart metric"
              options={[
                { value: 'downCount', label: 'Down Count' },
                { value: 'uptime', label: 'Uptime %' },
              ]}
            />
          </div>

          {loading ? (
            <p className="text-sm text-gray-500 py-12 text-center">Loading chart…</p>
          ) : stats.length === 0 ? (
            <p className="text-sm text-gray-500 py-12 text-center">No website stats yet.</p>
          ) : (
            <div className="h-52 sm:h-60 w-full pt-20 pb-2 flex items-end gap-2 overflow-visible">
              {stats.map((item, index) => {
                const value = chartMetric === 'uptime' ? item.uptimePercentage : item.downCount;
                const heightPercent = maxChartCount > 0 ? (value / maxChartCount) * 100 : 0;
                const isFirst = index === 0;
                const isLast = index === stats.length - 1;
                const tooltipAlign = isFirst
                  ? 'left-0 translate-x-0'
                  : isLast
                    ? 'right-0 left-auto translate-x-0'
                    : 'left-1/2 -translate-x-1/2';
                return (
                  <div
                    key={item.websiteId}
                    className="relative flex flex-col items-center h-full justify-end group flex-1 min-w-0"
                  >
                    <div
                      className={`opacity-0 group-hover:opacity-100 transition-opacity bg-black text-white text-sm font-medium p-2.5 rounded-lg mb-1.5 whitespace-nowrap pointer-events-none shadow-lg absolute bottom-full z-30 ${tooltipAlign}`}
                    >
                      <div className="font-bold">{item.name}</div>
                      <div>Uptime: {item.uptimePercentage}%</div>
                      <div>Down: {item.downCount}</div>
                      <div>Avg: {item.averageResponseTime} ms</div>
                    </div>
                    <div className="w-full bg-gray-200/70 rounded-t-md h-full flex items-end overflow-hidden">
                      <div
                        style={{ height: `${Math.max(heightPercent, 4)}%` }}
                        className={`w-full ${chartMetric === 'uptime' ? 'bg-emerald-500' : 'bg-red-500'}`}
                      />
                    </div>
                    <span className="text-sm font-medium text-gray-500 mt-2 truncate w-full text-center">
                      {item.name}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {selectedModalType && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white rounded-2xl shadow-xl border border-gray-200 w-full max-w-md max-h-[90vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-gray-100">
              <h3 className="font-bold text-gray-900 text-base">
                {selectedModalType === 'active' ? 'Higher uptime sites' : 'Sites with downtime'}{' '}
                ({chartSites.length})
              </h3>
              <button
                type="button"
                onClick={() => setSelectedModalType(null)}
                className="btn-ghost !px-2 !py-1"
                aria-label="Close"
              >
                ✕
              </button>
            </div>
            <div className="p-4 overflow-y-auto space-y-2 flex-grow">
              {chartSites.length === 0 ? (
                <p className="text-sm text-gray-500 text-center py-4">
                  No matching sites for this range.
                </p>
              ) : (
                chartSites.map((site) => (
                  <div
                    key={site.websiteId}
                    className="flex items-center justify-between p-3 rounded-xl bg-gray-50 border border-gray-200/60 gap-3"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-gray-900 truncate">{site.name}</p>
                      <p className="text-sm text-gray-500 capitalize">{site.type}</p>
                    </div>
                    <div className="text-right text-sm text-gray-600 shrink-0">
                      <div>Uptime {site.uptimePercentage}%</div>
                      <div>Down {site.downCount}</div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </PageShell>
  );
}
