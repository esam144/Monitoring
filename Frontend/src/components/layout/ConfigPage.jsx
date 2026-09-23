import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getSlackStatus } from '../../api/monitoringApi';
import { getErrorMessage } from '../../api/axios';
import PageShell, { AlertBanner, PageHeader } from './PageShell';

const Row = ({ label, value }) => (
  <div className="flex items-start justify-between gap-4 py-2.5 border-b border-gray-100 last:border-0">
    <span className="text-sm text-gray-500 shrink-0">{label}</span>
    <span className="text-sm font-medium text-gray-900 text-right">{value}</span>
  </div>
);

const Badge = ({ children, tone = 'neutral' }) => {
  const styles = {
    alert: 'bg-red-50 text-red-700 border-red-100',
    ok: 'bg-emerald-50 text-emerald-800 border-emerald-100',
    mute: 'bg-gray-100 text-gray-600 border-gray-200',
    neutral: 'bg-gray-50 text-gray-700 border-gray-200',
  };
  return (
    <span
      className={`inline-flex px-2.5 py-0.5 text-xs font-bold uppercase rounded-full border ${styles[tone] || styles.neutral}`}
    >
      {children}
    </span>
  );
};

export default function ConfigPage() {
  const [slack, setSlack] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setError('');
      try {
        const { data } = await getSlackStatus();
        if (!cancelled) setSlack(data);
      } catch (err) {
        if (!cancelled) {
          setError(getErrorMessage(err, 'Unable to load configuration. Please try again.'));
          setSlack(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const configured = Boolean(slack?.configured);

  return (
    <PageShell>
      <PageHeader
        title="Configuration"
        description="How monitoring and Slack alerts work"
      />

      {error && <AlertBanner>{error}</AlertBanner>}

      <section className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4 sm:p-5">
        <div className="flex items-center justify-between gap-3 mb-3">
          <h2 className="text-lg font-semibold text-gray-900">Monitoring</h2>
          <Link to="/sites" className="text-sm font-semibold text-gray-900 hover:underline">
            Go to Sites →
          </Link>
        </div>
        <div>
          <Row label="Who runs checks" value="Automatic background monitoring" />
          <Row label="Check intervals" value="Configured per site on Sites" />
          <Row label="This app" value="Shows status, history, and live activity" />
        </div>
      </section>

      <section className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4 sm:p-5 space-y-4">
        <h2 className="text-lg font-semibold text-gray-900">When Slack notifies</h2>
        <ul className="space-y-3">
          <li className="flex flex-wrap items-center gap-2 text-sm text-gray-700">
            <span className="font-medium bg-gray-50 border border-gray-200 rounded-lg px-2.5 py-1">
              Site goes DOWN
            </span>
            <Badge tone="alert">Alert</Badge>
            <span className="text-gray-500">
              Nearby failures are combined into one message
            </span>
          </li>
          <li className="flex flex-wrap items-center gap-2 text-sm text-gray-700">
            <span className="font-medium bg-gray-50 border border-gray-200 rounded-lg px-2.5 py-1">
              Still DOWN
            </span>
            <Badge tone="mute">No alert</Badge>
            <span className="text-gray-500">No repeat spam while remaining down</span>
          </li>
          <li className="flex flex-wrap items-center gap-2 text-sm text-gray-700">
            <span className="font-medium bg-gray-50 border border-gray-200 rounded-lg px-2.5 py-1">
              Site recovers
            </span>
            <Badge tone="ok">Recovery</Badge>
            <span className="text-gray-500">One recovery message per site</span>
          </li>
        </ul>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          <pre className="text-sm leading-relaxed font-mono bg-gray-950 text-gray-100 rounded-xl p-3.5 overflow-x-auto">
{`🚨 Websites DOWN
- HTTPBin | https://… | Status: DOWN | 23 September, 3:10 am`}
          </pre>
          <pre className="text-sm leading-relaxed font-mono bg-gray-950 text-gray-100 rounded-xl p-3.5 overflow-x-auto">
{`✅ Website RECOVERED — HTTPBin | https://… | Status: UP | 23 September, 3:12 am`}
          </pre>
        </div>
      </section>

      <section className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4 sm:p-5 space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-gray-900">Slack</h2>
          {loading ? (
            <span className="text-sm text-gray-400">Checking…</span>
          ) : (
            <span
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-bold uppercase rounded-full border ${
                configured
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-100'
                  : 'bg-gray-100 text-gray-600 border-gray-200'
              }`}
            >
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  configured ? 'bg-emerald-500' : 'bg-gray-400'
                }`}
              />
              {configured ? 'Connected' : 'Not configured'}
            </span>
          )}
        </div>
        <div>
          <Row
            label="Bot token"
            value={loading ? '…' : slack?.tokenConfigured ? 'Set on server' : 'Missing'}
          />
          <Row
            label="Channel"
            value={loading ? '…' : slack?.channelConfigured ? 'Set on server' : 'Missing'}
          />
        </div>
        <p className="text-sm text-gray-500">
          Credentials are stored on the server and never shown here. Missing Slack
          settings only disable notifications — monitoring still runs.
        </p>
      </section>

      <section className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4 sm:p-5">
        <h2 className="text-lg font-semibold text-gray-900 mb-3">Status rules</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="rounded-xl border border-gray-100 bg-gray-50 p-4 space-y-2">
            <p className="text-sm font-bold uppercase tracking-wide text-gray-500">
              Frontend sites
            </p>
            <p className="text-sm text-gray-800">HTTP 200 → UP</p>
            <p className="text-sm text-gray-800">Anything else / timeout → DOWN</p>
          </div>
          <div className="rounded-xl border border-gray-100 bg-gray-50 p-4 space-y-2">
            <p className="text-sm font-bold uppercase tracking-wide text-gray-500">
              Backend sites
            </p>
            <p className="text-sm text-gray-800">2xx / 3xx / 4xx → UP</p>
            <p className="text-sm text-gray-800">5xx / timeout → DOWN</p>
          </div>
        </div>
      </section>
    </PageShell>
  );
}
