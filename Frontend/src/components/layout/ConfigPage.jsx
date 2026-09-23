import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { getSlackStatus } from '../../api/monitoringApi';
import {
  getSlackSettings,
  getWebsites,
  updateSlackSettings,
} from '../../api/websiteApi';
import { getErrorMessage } from '../../api/axios';
import PageShell, { AlertBanner, PageHeader } from './PageShell';

const SUCCESS_DISMISS_MS = 2500;
const Row = ({ label, value }) => (
  <div className="flex items-start justify-between gap-4 py-2.5 border-b border-gray-100 last:border-0">
    <span className="text-sm text-gray-500 shrink-0">{label}</span>
    <span className="text-sm font-medium text-gray-900 text-right">{value}</span>
  </div>
);

const Toggle = ({ checked, onChange, label, disabled }) => (
  <button
    type="button"
    role="switch"
    aria-checked={checked}
    aria-label={label}
    disabled={disabled}
    onClick={() => onChange(!checked)}
    className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed ${
      checked ? 'bg-black' : 'bg-gray-300'
    }`}
  >
    <span
      className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform duration-150 ${
        checked ? 'translate-x-4' : 'translate-x-1'
      }`}
    />
  </button>
);

const defaultSlackForm = {
  enabled: true,
  repeatInterval: 1,
  repeatUnit: 'hours',
  recoveryNotification: true,
};

export default function ConfigPage() {
  const [slack, setSlack] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [sites, setSites] = useState([]);
  const [sitesLoading, setSitesLoading] = useState(true);
  const [selectedWebsiteId, setSelectedWebsiteId] = useState('');
  const [slackForm, setSlackForm] = useState(defaultSlackForm);
  const [settingsLoading, setSettingsLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [settingsError, setSettingsError] = useState('');
  const [settingsSuccess, setSettingsSuccess] = useState('');
  const successTimerRef = useRef(null);

  const clearSuccessTimer = useCallback(() => {
    if (successTimerRef.current) {
      clearTimeout(successTimerRef.current);
      successTimerRef.current = null;
    }
  }, []);

  useEffect(() => () => clearSuccessTimer(), [clearSuccessTimer]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setError('');
      try {
        const { data } = await getSlackStatus();
        if (!cancelled) setSlack(data);
      } catch (err) {
        if (!cancelled) {
          setError(
            getErrorMessage(err, 'Unable to load configuration. Please try again.')
          );
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

  useEffect(() => {
    let cancelled = false;
    const loadSites = async () => {
      setSitesLoading(true);
      try {
        const { data } = await getWebsites({ page: 1, limit: 100 });
        const list = data?.data?.websites || [];
        if (!cancelled) {
          setSites(list);
          if (list.length > 0) {
            setSelectedWebsiteId((prev) => prev || list[0]._id);
          }
        }
      } catch (err) {
        if (!cancelled) {
          setSettingsError(
            getErrorMessage(err, 'Unable to load websites for Slack settings.')
          );
          setSites([]);
        }
      } finally {
        if (!cancelled) setSitesLoading(false);
      }
    };
    loadSites();
    return () => {
      cancelled = true;
    };
  }, []);

  const loadSettingsForSite = useCallback(async (websiteId) => {
    if (!websiteId) {
      setSlackForm(defaultSlackForm);
      return;
    }
    setSettingsLoading(true);
    setSettingsError('');
    clearSuccessTimer();
    setSettingsSuccess('');
    try {
      const { data } = await getSlackSettings(websiteId);
      const s = data?.slackSettings || defaultSlackForm;
      setSlackForm({
        enabled: s.enabled !== false,
        repeatInterval: s.repeatInterval ?? 1,
        repeatUnit: s.repeatUnit || 'hours',
        recoveryNotification: s.recoveryNotification !== false,
      });
    } catch (err) {
      setSettingsError(
        getErrorMessage(err, 'Unable to load Slack settings for this site.')
      );
      setSlackForm(defaultSlackForm);
    } finally {
      setSettingsLoading(false);
    }
  }, [clearSuccessTimer]);

  useEffect(() => {
    if (selectedWebsiteId) {
      void loadSettingsForSite(selectedWebsiteId);
    }
  }, [selectedWebsiteId, loadSettingsForSite]);

  const handleSaveSlackSettings = async (e) => {
    e.preventDefault();
    if (!selectedWebsiteId) return;

    const interval = Number(slackForm.repeatInterval);
    if (!Number.isInteger(interval) || interval < 1) {
      setSettingsError('Repeat interval must be a positive integer.');
      return;
    }

    setSaving(true);
    setSettingsError('');
    clearSuccessTimer();
    setSettingsSuccess('');
    try {
      const { data } = await updateSlackSettings(selectedWebsiteId, {
        enabled: slackForm.enabled,
        repeatInterval: interval,
        repeatUnit: slackForm.repeatUnit,
        recoveryNotification: slackForm.recoveryNotification,
      });
      const s = data?.slackSettings || slackForm;
      setSlackForm({
        enabled: s.enabled !== false,
        repeatInterval: s.repeatInterval ?? interval,
        repeatUnit: s.repeatUnit || slackForm.repeatUnit,
        recoveryNotification: s.recoveryNotification !== false,
      });
      setSettingsSuccess('Slack settings saved.');
      successTimerRef.current = setTimeout(() => {
        setSettingsSuccess('');
        successTimerRef.current = null;
      }, SUCCESS_DISMISS_MS);
    } catch (err) {
      setSettingsError(
        getErrorMessage(err, 'Unable to save Slack settings. Please try again.')
      );
    } finally {
      setSaving(false);
    }
  };

  const configured = Boolean(slack?.configured);
  const formDisabled =
    sitesLoading || settingsLoading || saving || !selectedWebsiteId;

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
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">
              Slack Notifications
            </h2>
            <p className="mt-0.5 text-sm text-gray-500">
              Per-website alert timing. Backend owns all scheduling.
            </p>
          </div>
          {loading ? (
            <span className="text-sm text-gray-400 shrink-0">Checking…</span>
          ) : (
            <span
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-bold uppercase rounded-full border shrink-0 ${
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

        {settingsError && <AlertBanner>{settingsError}</AlertBanner>}
        {settingsSuccess && (
          <AlertBanner tone="success">{settingsSuccess}</AlertBanner>
        )}

        {sitesLoading ? (
          <p className="text-sm text-gray-500">Loading websites…</p>
        ) : sites.length === 0 ? (
          <p className="text-sm text-gray-500">
            No websites yet.{' '}
            <Link to="/sites" className="font-semibold text-gray-900 hover:underline">
              Add a site
            </Link>{' '}
            to configure Slack notifications.
          </p>
        ) : (
          <form onSubmit={handleSaveSlackSettings} className="space-y-5">
            <div className="space-y-1.5">
              <label
                htmlFor="slack-website"
                className="block text-sm font-medium text-gray-700"
              >
                Website
              </label>
              <select
                id="slack-website"
                value={selectedWebsiteId}
                onChange={(e) => setSelectedWebsiteId(e.target.value)}
                disabled={formDisabled}
                className="input-field w-full max-w-md"
              >
                {sites.map((site) => (
                  <option key={site._id} value={site._id}>
                    {site.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center justify-between gap-4 py-1">
              <div>
                <p className="text-sm font-medium text-gray-900">
                  Enable Slack Notifications
                </p>
                <p className="text-xs text-gray-500 mt-0.5">
                  When off, this site will not send Slack alerts.
                </p>
              </div>
              <Toggle
                checked={slackForm.enabled}
                onChange={(v) =>
                  setSlackForm((prev) => ({ ...prev, enabled: v }))
                }
                label="Enable Slack Notifications"
                disabled={formDisabled}
              />
            </div>

            <div className="flex items-center justify-between gap-4 py-1 border-t border-gray-100 pt-4">
              <div>
                <p className="text-sm font-medium text-gray-900">Initial alert</p>
                <p className="text-xs text-gray-500 mt-0.5">
                  Sent when the site first goes DOWN.
                </p>
              </div>
              <span className="text-sm font-semibold text-gray-900">
                Immediately
              </span>
            </div>

            <div className="border-t border-gray-100 pt-4 space-y-2">
              <div>
                <p className="text-sm font-medium text-gray-900">
                  Repeat Slack Alert
                </p>
                <p className="text-xs text-gray-500 mt-0.5">
                  While still DOWN, send again after this interval.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <input
                  type="number"
                  min={1}
                  step={1}
                  value={slackForm.repeatInterval}
                  onChange={(e) =>
                    setSlackForm((prev) => ({
                      ...prev,
                      repeatInterval: e.target.value,
                    }))
                  }
                  disabled={formDisabled || !slackForm.enabled}
                  className="input-field w-24"
                  aria-label="Repeat interval value"
                />
                <select
                  value={slackForm.repeatUnit}
                  onChange={(e) =>
                    setSlackForm((prev) => ({
                      ...prev,
                      repeatUnit: e.target.value,
                    }))
                  }
                  disabled={formDisabled || !slackForm.enabled}
                  className="input-field w-36"
                  aria-label="Repeat interval unit"
                >
                  <option value="minutes">Minutes</option>
                  <option value="hours">Hours</option>
                  <option value="days">Days</option>
                </select>
              </div>
            </div>

            <div className="flex items-center justify-between gap-4 py-1 border-t border-gray-100 pt-4">
              <div>
                <p className="text-sm font-medium text-gray-900">
                  Recovery Notification
                </p>
                <p className="text-xs text-gray-500 mt-0.5">
                  Notify Slack when the site recovers to UP.
                </p>
              </div>
              <Toggle
                checked={slackForm.recoveryNotification}
                onChange={(v) =>
                  setSlackForm((prev) => ({
                    ...prev,
                    recoveryNotification: v,
                  }))
                }
                label="Recovery Notification"
                disabled={formDisabled || !slackForm.enabled}
              />
            </div>

            <div className="pt-1">
              <button
                type="submit"
                disabled={formDisabled}
                className="btn-primary"
              >
                {saving ? 'Saving…' : settingsLoading ? 'Loading…' : 'Save Settings'}
              </button>
            </div>
          </form>
        )}
      </section>
    </PageShell>
  );
}
