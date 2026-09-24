import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { getSlackStatus } from '../../api/monitoringApi';
import {
  getSlackSettings,
  getWebsites,
  updateSlackSettings,
} from '../../api/websiteApi';
import { getErrorMessage } from '../../api/axios';
import Select from '../ui/Select';
import PageShell, { AlertBanner, PageHeader } from './PageShell';

const SUCCESS_DISMISS_MS = 2500;

/** Centered settings panel */
const configCardClass =
  'w-full max-w-[48rem] mx-auto bg-white rounded-2xl border border-gray-200 shadow-sm p-4 sm:p-5';

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

/**
 * Settings row: ~60/40 label/control, controls right-aligned in control column.
 */
const SettingRow = ({ title, hint, children }) => (
  <div className="grid grid-cols-1 sm:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] items-center gap-x-4 gap-y-1.5 py-2.5 border-b border-gray-100 last:border-0">
    <div className="min-w-0 flex flex-col gap-2">
      <p className="text-sm font-medium text-gray-900 leading-snug">{title}</p>
      {hint ? (
        <p className="text-xs text-gray-500 leading-snug">{hint}</p>
      ) : null}
    </div>
    <div className="flex w-full min-w-0 items-center justify-start sm:justify-end gap-2">
      {children}
    </div>
  </div>
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

      <section className={configCardClass}>
        <div className="flex items-start justify-between gap-3 mb-2">
          <div className="min-w-0 flex flex-col gap-2">
            <h2 className="text-lg font-semibold text-gray-900">
              Slack Notifications
            </h2>
            <p className="text-sm text-gray-500">
              Per-website alert timing. Backend owns all scheduling.
            </p>
          </div>
          {loading ? (
            <span className="text-sm text-gray-400 shrink-0 self-start">
              Checking…
            </span>
          ) : (
            <span
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-bold uppercase rounded-full border shrink-0 self-start ${
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

        {settingsError && (
          <div className="mb-2">
            <AlertBanner>{settingsError}</AlertBanner>
          </div>
        )}
        {settingsSuccess && (
          <div className="mb-2">
            <AlertBanner tone="success">{settingsSuccess}</AlertBanner>
          </div>
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
          <form onSubmit={handleSaveSlackSettings}>
            <div>
              <SettingRow
                title="Website"
                hint="Settings apply to the selected site."
              >
                <Select
                  id="slack-website"
                  value={selectedWebsiteId}
                  onChange={(e) => setSelectedWebsiteId(e.target.value)}
                  disabled={formDisabled}
                  className="w-full max-w-[14rem]"
                  aria-label="Website"
                  options={sites.map((site) => ({
                    value: site._id,
                    label: site.name,
                  }))}
                />
              </SettingRow>

              <SettingRow
                title="Enable Slack Notifications"
                hint="When off, this site will not send Slack alerts."
              >
                <Toggle
                  checked={slackForm.enabled}
                  onChange={(v) =>
                    setSlackForm((prev) => ({ ...prev, enabled: v }))
                  }
                  label="Enable Slack Notifications"
                  disabled={formDisabled}
                />
              </SettingRow>

              <SettingRow
                title="Initial alert"
                hint="Sent when the site first goes DOWN."
              >
                <span className="text-sm font-medium text-gray-900">
                  Immediately
                </span>
              </SettingRow>

              <SettingRow
                title="Repeat Slack Alert"
                hint="While still DOWN, send again after this interval."
              >
                <div className="flex w-full max-w-[14rem] items-center gap-2">
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
                    className="input-field w-16 text-center shrink-0"
                    aria-label="Repeat interval value"
                  />
                  <Select
                    value={slackForm.repeatUnit}
                    onChange={(e) =>
                      setSlackForm((prev) => ({
                        ...prev,
                        repeatUnit: e.target.value,
                      }))
                    }
                    disabled={formDisabled || !slackForm.enabled}
                    className="flex-1 min-w-0"
                    aria-label="Repeat interval unit"
                    options={[
                      { value: 'minutes', label: 'Minutes' },
                      { value: 'hours', label: 'Hours' },
                      { value: 'days', label: 'Days' },
                    ]}
                  />
                </div>
              </SettingRow>

              <SettingRow
                title="Recovery Notification"
                hint="Notify Slack when the site recovers to UP."
              >
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
              </SettingRow>
            </div>

            <div className="pt-3 flex justify-end">
              <button
                type="submit"
                disabled={formDisabled}
                className="btn-primary min-w-[8.5rem]"
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
