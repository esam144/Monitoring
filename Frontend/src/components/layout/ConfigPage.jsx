import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
const SITE_SEARCH_DEBOUNCE_MS = 300;
const SITE_PICKER_LIMIT = 50;

const formatSiteLabel = (site) =>
  `${site.name} (${site.type === 'backend' ? 'Backend' : 'Frontend'})`;

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
  repeatInterval: 6,
  repeatUnit: 'hours',
  recoveryNotification: true,
};

export default function ConfigPage() {
  const [slack, setSlack] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [sites, setSites] = useState([]);
  const [selectedSite, setSelectedSite] = useState(null);
  const [catalogEmpty, setCatalogEmpty] = useState(false);
  const [sitesLoading, setSitesLoading] = useState(true);
  const [sitesSearching, setSitesSearching] = useState(false);
  const [siteSearchInput, setSiteSearchInput] = useState('');
  const [siteSearchQuery, setSiteSearchQuery] = useState('');
  const [selectedWebsiteId, setSelectedWebsiteId] = useState('');
  const [slackForm, setSlackForm] = useState(defaultSlackForm);
  const [settingsLoading, setSettingsLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [settingsError, setSettingsError] = useState('');
  const [settingsSuccess, setSettingsSuccess] = useState('');
  const successTimerRef = useRef(null);
  const sitesRequestIdRef = useRef(0);

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
    const timer = setTimeout(() => {
      setSiteSearchQuery(siteSearchInput.trim());
    }, SITE_SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [siteSearchInput]);

  useEffect(() => {
    let cancelled = false;
    const requestId = ++sitesRequestIdRef.current;
    const isInitial = !siteSearchQuery;

    const loadSites = async () => {
      if (isInitial) setSitesLoading(true);
      else setSitesSearching(true);

      try {
        const { data } = await getWebsites({
          page: 1,
          limit: SITE_PICKER_LIMIT,
          search: siteSearchQuery || undefined,
        });
        if (cancelled || requestId !== sitesRequestIdRef.current) return;

        const list = data?.data?.websites || [];
        setSites(list);

        if (isInitial) {
          setCatalogEmpty(list.length === 0);
          if (list.length > 0) {
            setSelectedWebsiteId((prev) => prev || list[0]._id);
            setSelectedSite((prev) => prev || list[0]);
          }
        }
      } catch (err) {
        if (cancelled || requestId !== sitesRequestIdRef.current) return;
        setSettingsError(
          getErrorMessage(err, 'Unable to load websites for Slack settings.')
        );
        if (isInitial) {
          setSites([]);
          setCatalogEmpty(true);
        }
      } finally {
        if (!cancelled && requestId === sitesRequestIdRef.current) {
          setSitesLoading(false);
          setSitesSearching(false);
        }
      }
    };

    loadSites();
    return () => {
      cancelled = true;
    };
  }, [siteSearchQuery]);

  const websiteOptions = useMemo(() => {
    const options = sites.map((site) => ({
      value: site._id,
      label: formatSiteLabel(site),
    }));

    if (
      selectedSite &&
      !options.some((opt) => String(opt.value) === String(selectedSite._id))
    ) {
      options.unshift({
        value: selectedSite._id,
        label: formatSiteLabel(selectedSite),
      });
    }

    return options;
  }, [sites, selectedSite]);

  const handleWebsiteChange = (e) => {
    const id = e.target.value;
    setSelectedWebsiteId(id);
    const fromList = sites.find((s) => String(s._id) === String(id));
    if (fromList) {
      setSelectedSite(fromList);
    } else if (selectedSite && String(selectedSite._id) === String(id)) {
      // keep current selectedSite
    } else {
      setSelectedSite(null);
    }
  };

  const handleWebsiteSearchChange = useCallback((query) => {
    setSiteSearchInput(query);
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
        repeatInterval: s.repeatInterval ?? 6,
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
  const formDisabled = settingsLoading || saving || !selectedWebsiteId;

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
        ) : catalogEmpty ? (
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
                  onChange={handleWebsiteChange}
                  disabled={formDisabled}
                  searchable
                  searchPlaceholder="Search websites…"
                  onSearchChange={handleWebsiteSearchChange}
                  searchLoading={sitesSearching}
                  className="w-full max-w-[18rem]"
                  aria-label="Website"
                  options={websiteOptions}
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
