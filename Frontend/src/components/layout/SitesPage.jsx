import { useCallback, useEffect, useRef, useState } from 'react';
import {
  createWebsite,
  deleteWebsite,
  getWebsites,
  updateWebsite,
} from '../../api/websiteApi';
import { checkWebsiteNow, getHistory } from '../../api/monitoringApi';
import { getErrorMessage } from '../../api/axios';
import {
  formatDateTime,
  formatInterval,
  formatRelativeTime,
  formatResponseTime,
  personName,
} from '../../utils/format';
import SiteLiveTerminal from './SiteLiveTerminal';
import PageShell, { AlertBanner, PageHeader } from './PageShell';
import Select from '../ui/Select';
const PAGE_SIZE_OPTIONS = [10, 20, 50, 100];
const REFRESH_MS = 45000;
const SEARCH_DEBOUNCE_MS = 300;

const SearchIcon = () => (
  <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" aria-hidden="true">
    <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M11 18a7 7 0 100-14 7 7 0 000 14z" />
  </svg>
);

const ClearSearchIcon = () => (
  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.25" aria-hidden="true">
    <path strokeLinecap="round" strokeLinejoin="round" d="M6 6l12 12M18 6L6 18" />
  </svg>
);

const CopyIcon = () => (
  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" aria-hidden="true">
    <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
  </svg>
);

const CheckIcon = () => (
  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.25" aria-hidden="true">
    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
  </svg>
);

function CopyUrlButton({ url }) {
  const [copied, setCopied] = useState(false);
  const timerRef = useRef(null);

  useEffect(() => () => {
    if (timerRef.current) clearTimeout(timerRef.current);
  }, []);

  const handleCopy = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard may be blocked; keep UI quiet
    }
  };

  return (
    <button
      type="button"
      title="Copy URL"
      aria-label={copied ? 'URL copied' : 'Copy URL'}
      onClick={handleCopy}
      className={`inline-flex shrink-0 items-center justify-center rounded-md p-1 transition-colors ${
        copied
          ? 'text-emerald-600 bg-emerald-50'
          : 'text-gray-400 hover:text-gray-700 hover:bg-gray-100'
      }`}
    >
      {copied ? <CheckIcon /> : <CopyIcon />}
    </button>
  );
}

const emptyForm = {
  name: '',
  type: 'frontend',
  url: '',
  checkInterval: 10,
  checkIntervalUnit: 'minutes',
  monitoringEnabled: true,
};

export default function SitesPage() {
  const [websites, setWebsites] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchInput, setSearchInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [checkingId, setCheckingId] = useState(null);
  const [menuOpenId, setMenuOpenId] = useState(null);

  const [selectedSite, setSelectedSite] = useState(null);
  const [history, setHistory] = useState([]);
  const [historyRange, setHistoryRange] = useState('24h');
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyPage, setHistoryPage] = useState(1);
  const [historyPagination, setHistoryPagination] = useState(null);
  const HISTORY_PAGE_SIZE = 8;

  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const loadWebsites = useCallback(async () => {
    setError('');
    try {
      const { data } = await getWebsites({
        page,
        limit: pageSize,
        status: statusFilter,
        search: searchQuery || undefined,
      });
      setWebsites(data.data?.websites || []);
      setPagination(data.data?.pagination || null);
      const returnedPage = data.data?.pagination?.page ?? data.data?.pagination?.currentPage;
      if (returnedPage && returnedPage !== page) {
        setPage(returnedPage);
      }
    } catch (err) {
      setError(getErrorMessage(err, 'Unable to load websites. Please try again.'));
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, statusFilter, searchQuery]);

  useEffect(() => {
    const timer = setTimeout(() => {
      const next = searchInput.trim();
      if (next === searchQuery) return;
      setPage(1);
      setSearchQuery(next);
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [searchInput, searchQuery]);

  useEffect(() => {
    setLoading(true);
    loadWebsites();
  }, [loadWebsites]);

  useEffect(() => {
    const id = setInterval(loadWebsites, REFRESH_MS);
    return () => clearInterval(id);
  }, [loadWebsites]);

  const loadHistory = useCallback(async (siteId, range, page = 1) => {
    setHistoryLoading(true);
    try {
      const historyRes = await getHistory(siteId, range, page, HISTORY_PAGE_SIZE);
      setHistory(historyRes.data.history || []);
      setHistoryPagination(historyRes.data.pagination || null);
      const returnedPage = historyRes.data.pagination?.page;
      if (returnedPage && returnedPage !== page) {
        setHistoryPage(returnedPage);
      }
      if (historyRes.data.website) {
        setSelectedSite((prev) =>
          prev
            ? {
                ...prev,
                name: historyRes.data.website.name,
                url: historyRes.data.website.url,
                type: historyRes.data.website.type,
              }
            : prev
        );
      }
    } catch (err) {
      setError(getErrorMessage(err, 'Unable to load history. Please try again.'));
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  useEffect(() => {
    if (selectedSite?._id) {
      loadHistory(selectedSite._id, historyRange, historyPage);
    }
  }, [selectedSite?._id, historyRange, historyPage, loadHistory]);

  useEffect(() => {
    if (!success) return undefined;
    const timer = setTimeout(() => setSuccess(''), 2500);
    return () => clearTimeout(timer);
  }, [success]);

  useEffect(() => {
    if (!menuOpenId) return undefined;
    const close = () => setMenuOpenId(null);
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, [menuOpenId]);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setShowForm(true);
    setSuccess('');
  };

  const openEdit = (site, e) => {
    e?.stopPropagation();
    setEditing(site);
    setForm({
      name: site.name || '',
      type: site.type || 'frontend',
      url: site.url || '',
      checkInterval: site.checkInterval || 10,
      checkIntervalUnit: site.checkIntervalUnit || 'minutes',
      monitoringEnabled: Boolean(site.monitoringEnabled),
    });
    setShowForm(true);
    setSuccess('');
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const payload = {
        name: form.name.trim(),
        type: form.type,
        url: form.url.trim(),
        active: true,
        monitoringEnabled: form.monitoringEnabled,
        checkInterval: Number(form.checkInterval),
        checkIntervalUnit: form.checkIntervalUnit,
      };
      if (editing) {
        await updateWebsite(editing._id, payload);
        setSuccess('Website updated.');
      } else {
        await createWebsite(payload);
        setSuccess(
          payload.monitoringEnabled
            ? 'Website saved with immediate health check.'
            : 'Website saved. Monitoring is OFF.'
        );
      }
      setShowForm(false);
      setEditing(null);
      await loadWebsites();
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to save website.'));
    } finally {
      setSaving(false);
    }
  };

  const handleToggleMonitoring = async (e, site) => {
    e.stopPropagation();
    setError('');
    const nextEnabled = !site.monitoringEnabled;

    // Optimistic update — switch flips immediately
    setWebsites((prev) =>
      prev.map((w) =>
        w._id === site._id ? { ...w, monitoringEnabled: nextEnabled } : w
      )
    );
    setSelectedSite((prev) =>
      prev && prev._id === site._id
        ? { ...prev, monitoringEnabled: nextEnabled }
        : prev
    );
    setSuccess(
      nextEnabled
        ? `Monitoring enabled for ${site.name}.`
        : `Monitoring disabled for ${site.name}.`
    );

    try {
      await updateWebsite(site._id, { monitoringEnabled: nextEnabled });
    } catch (err) {
      // Rollback on failure
      setWebsites((prev) =>
        prev.map((w) =>
          w._id === site._id
            ? { ...w, monitoringEnabled: site.monitoringEnabled }
            : w
        )
      );
      setSelectedSite((prev) =>
        prev && prev._id === site._id
          ? { ...prev, monitoringEnabled: site.monitoringEnabled }
          : prev
      );
      setSuccess('');
      setError(getErrorMessage(err, 'Failed to update monitoring.'));
    }
  };

  const openDelete = (e, site) => {
    e?.stopPropagation();
    setMenuOpenId(null);
    setDeleteTarget(site);
  };

  const closeDelete = () => {
    if (deleting) return;
    setDeleteTarget(null);
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    setError('');
    try {
      await deleteWebsite(deleteTarget._id);
      setSuccess(`Deleted ${deleteTarget.name}.`);
      if (selectedSite?._id === deleteTarget._id) setSelectedSite(null);
      setDeleteTarget(null);
      await loadWebsites();
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to delete website.'));
    } finally {
      setDeleting(false);
    }
  };

  const handleCheckNow = async (e, site) => {
    e.stopPropagation();
    setCheckingId(site._id);
    setError('');
    try {
      const { data } = await checkWebsiteNow(site._id);
      const result = data.result;
      setSuccess(
        result?.status === 'up'
          ? `${site.name}: UP — ${result.responseTime ?? '—'} ms`
          : `${site.name}: DOWN`
      );
      if (selectedSite?._id === site._id && result) {
        setSelectedSite((prev) =>
          prev
            ? {
                ...prev,
                lastStatus: result.status,
                lastResponseTime: result.responseTime,
                lastCheckedAt: result.checkedAt || new Date().toISOString(),
              }
            : prev
        );
        await loadHistory(site._id, historyRange, historyPage);
      }
      await loadWebsites();
    } catch (err) {
      setError(getErrorMessage(err, 'Website check failed.'));
    } finally {
      setCheckingId(null);
    }
  };

  const statusBadge = (site) => {
    if (!site.monitoringEnabled) {
      return <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-gray-100 text-gray-600">OFF</span>;
    }
    if (site.lastStatus === 'up') {
      return <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-emerald-100 text-emerald-800">UP</span>;
    }
    if (site.lastStatus === 'down') {
      return <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-red-100 text-red-800">DOWN</span>;
    }
    return <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-gray-100 text-gray-600">UNKNOWN</span>;
  };

  const ActionsMenu = ({ site }) => {
    const open = menuOpenId === site._id;
    const buttonRef = useRef(null);
    const [coords, setCoords] = useState(null);

    useEffect(() => {
      if (!open || !buttonRef.current) {
        setCoords(null);
        return undefined;
      }

      const place = () => {
        const rect = buttonRef.current.getBoundingClientRect();
        const menuHeight = 120;
        const openUp = window.innerHeight - rect.bottom < menuHeight + 8;
        setCoords({
          top: openUp ? rect.top - menuHeight - 4 : rect.bottom + 4,
          right: window.innerWidth - rect.right,
        });
      };

      place();
      window.addEventListener('resize', place);
      window.addEventListener('scroll', place, true);
      return () => {
        window.removeEventListener('resize', place);
        window.removeEventListener('scroll', place, true);
      };
    }, [open]);

    return (
      <div className="relative inline-flex justify-end">
        <button
          ref={buttonRef}
          type="button"
          aria-label="Actions"
          onClick={(e) => {
            e.stopPropagation();
            setMenuOpenId(open ? null : site._id);
          }}
          className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-gray-600 hover:bg-gray-100 hover:text-gray-900"
        >
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="12" cy="5" r="1.75" />
            <circle cx="12" cy="12" r="1.75" />
            <circle cx="12" cy="19" r="1.75" />
          </svg>
        </button>
        {open && coords && (
          <div
            style={{ position: 'fixed', top: coords.top, right: coords.right }}
            className="z-50 w-36 overflow-hidden rounded-xl border border-gray-200 bg-white py-1 shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              disabled={checkingId === site._id}
              onClick={(e) => {
                setMenuOpenId(null);
                handleCheckNow(e, site);
              }}
              className="block w-full px-3 py-2 text-left text-xs font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-60"
            >
              {checkingId === site._id ? 'Checking...' : 'Check'}
            </button>
            <button
              type="button"
              onClick={(e) => {
                setMenuOpenId(null);
                openEdit(site, e);
              }}
              className="block w-full px-3 py-2 text-left text-xs font-semibold text-gray-700 hover:bg-gray-50"
            >
              Edit
            </button>
            <button
              type="button"
              onClick={(e) => {
                openDelete(e, site);
              }}
              className="block w-full px-3 py-2 text-left text-xs font-semibold text-red-600 hover:bg-red-50"
            >
              Delete
            </button>
          </div>
        )}
      </div>
    );
  };

  if (selectedSite) {
    const metrics = [
      {
        label: 'Status',
        value: (selectedSite.lastStatus || 'unknown').toUpperCase(),
        accent:
          selectedSite.lastStatus === 'up'
            ? 'text-emerald-700'
            : selectedSite.lastStatus === 'down'
              ? 'text-red-700'
              : 'text-gray-800',
      },
      {
        label: 'Monitoring',
        value: selectedSite.monitoringEnabled ? 'Enabled' : 'Disabled',
        accent: selectedSite.monitoringEnabled ? 'text-gray-900' : 'text-amber-700',
      },
      {
        label: 'Type',
        value: selectedSite.type === 'backend' ? 'Backend' : 'Frontend',
        accent: 'text-gray-900',
      },
      {
        label: 'Interval',
        value: formatInterval(selectedSite.checkInterval, selectedSite.checkIntervalUnit),
        accent: 'text-gray-900',
      },
      {
        label: 'Last checked',
        value: formatRelativeTime(selectedSite.lastCheckedAt),
        accent: 'text-gray-900',
      },
      {
        label: 'Response',
        value: formatResponseTime(selectedSite.lastResponseTime),
        accent: 'text-gray-900',
      },
    ];

    const historyTotal = historyPagination?.total ?? 0;
    const historyTotalPages = historyPagination?.totalPages ?? 1;
    const historyPageSafe = historyPagination?.page ?? historyPage;
    const historyLimit = historyPagination?.limit ?? HISTORY_PAGE_SIZE;

    return (
      <PageShell>
        <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
          <div className="min-w-0 space-y-2">
            <button
              type="button"
              onClick={() => setSelectedSite(null)}
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-gray-500 hover:text-gray-900"
            >
              <span aria-hidden="true">←</span> Back to Sites
            </button>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2.5">
                <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-gray-900">
                  {selectedSite.name}
                </h1>
                {statusBadge(selectedSite)}
              </div>
              <div className="mt-1 flex items-center gap-1.5 min-w-0 max-w-full">
                <CopyUrlButton url={selectedSite.url} />
                <a
                  href={selectedSite.url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-sm text-blue-600 hover:underline truncate min-w-0"
                >
                  {selectedSite.url}
                </a>
              </div>
              <p className="mt-1 text-sm text-gray-500">
                Created by {personName(selectedSite.createdBy)}
                {selectedSite.updatedBy
                  ? ` · Updated by ${personName(selectedSite.updatedBy)}`
                  : ''}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={(e) => handleCheckNow(e, selectedSite)}
              disabled={checkingId === selectedSite._id}
              className="btn-primary"
            >
              {checkingId === selectedSite._id ? 'Checking…' : 'Check Now'}
            </button>
          </div>
        </div>

        {error && <AlertBanner>{error}</AlertBanner>}
        {success && <AlertBanner tone="success">{success}</AlertBanner>}

        <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-px bg-gray-200 border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
          {metrics.map((m) => (
            <div key={m.label} className="bg-white px-4 py-3.5 min-w-0">
              <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">
                {m.label}
              </p>
              <p className={`mt-1 text-sm font-semibold truncate ${m.accent}`}>{m.value}</p>
            </div>
          ))}
        </div>

        <SiteLiveTerminal websiteId={selectedSite._id} siteName={selectedSite.name} />

        <section className="border border-gray-200 rounded-2xl bg-white shadow-sm overflow-hidden">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-4 py-3 border-b border-gray-100 bg-gray-50/80">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Check History</h2>
              <p className="text-sm text-gray-500">
                {historyLoading
                  ? 'Loading…'
                  : `${historyTotal} check${historyTotal === 1 ? '' : 's'} in range`}
              </p>
            </div>
            <Select
              value={historyRange}
              onChange={(e) => {
                setHistoryRange(e.target.value);
                setHistoryPage(1);
              }}
              className="w-full sm:w-auto min-w-[9rem]"
              aria-label="History range"
              options={[
                { value: '24h', label: '24 Hours' },
                { value: '48h', label: '48 Hours' },
                { value: '72h', label: '72 Hours' },
              ]}
            />
          </div>

          <div className="overflow-x-auto max-h-[280px] overflow-y-auto">
            <table className="w-full text-left text-sm text-gray-600">
              <thead className="bg-white text-xs font-semibold text-gray-500 uppercase border-b border-gray-200 sticky top-0 z-10">
                <tr>
                  <th className="px-4 py-2.5 bg-white">Checked At</th>
                  <th className="px-4 py-2.5 bg-white">Status</th>
                  <th className="px-4 py-2.5 bg-white">Status Code</th>
                  <th className="px-4 py-2.5 bg-white">Response Time</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {historyLoading ? (
                  <tr>
                    <td colSpan="4" className="px-4 py-10 text-center text-gray-400 text-sm">
                      Loading history…
                    </td>
                  </tr>
                ) : history.length === 0 ? (
                  <tr>
                    <td colSpan="4" className="px-4 py-10 text-center text-gray-400 text-sm">
                      No history for this range.
                    </td>
                  </tr>
                ) : (
                  history.map((row, idx) => (
                    <tr key={`${row.checkedAt}-${idx}`} className="hover:bg-gray-50/80">
                      <td className="px-4 py-2.5 text-sm font-mono">
                        {formatDateTime(row.checkedAt)}
                      </td>
                      <td className="px-4 py-2.5">
                        <span
                          className={`px-2 py-0.5 text-xs font-bold rounded-full ${
                            row.status === 'up'
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-red-100 text-red-800'
                          }`}
                        >
                          {row.status.toUpperCase()}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-sm">{row.statusCode ?? '—'}</td>
                      <td className="px-4 py-2.5 text-sm">
                        {formatResponseTime(row.responseTime)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {!historyLoading && historyTotal > 0 && (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-4 py-2.5 border-t border-gray-100 bg-gray-50/50">
              <p className="text-sm text-gray-500">
                Showing {(historyPageSafe - 1) * historyLimit + 1}–
                {Math.min(historyPageSafe * historyLimit, historyTotal)} of {historyTotal}
              </p>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  disabled={!historyPagination?.hasPreviousPage}
                  onClick={() => setHistoryPage((p) => Math.max(1, p - 1))}
                  className="btn-secondary !px-3 !py-1.5 !text-sm"
                >
                  Previous
                </button>
                <span className="text-sm font-semibold text-gray-600 px-1">
                  {historyPageSafe} / {historyTotalPages}
                </span>
                <button
                  type="button"
                  disabled={!historyPagination?.hasNextPage}
                  onClick={() => setHistoryPage((p) => p + 1)}
                  className="btn-secondary !px-3 !py-1.5 !text-sm"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </section>
      </PageShell>
    );
  }

  return (
    <PageShell>
      <PageHeader
        title="Monitored Sites"
        description="Click a site to view live activity and history"
        actions={
          <button type="button" onClick={openCreate} className="btn-primary">
            + Add Website
          </button>
        }
      />

      {error && <AlertBanner>{error}</AlertBanner>}
      {success && <AlertBanner tone="success">{success}</AlertBanner>}

      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-gray-50 p-3 rounded-2xl border border-gray-200">
        <div className="relative w-full sm:flex-1 sm:min-w-0 sm:max-w-xl md:max-w-2xl">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2">
            <SearchIcon />
          </span>
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search websites..."
            aria-label="Search websites by name or URL"
            className="input-field pl-9 pr-9 py-2 text-sm"
          />
          {searchInput ? (
            <button
              type="button"
              onClick={() => {
                setSearchInput('');
                setSearchQuery('');
                setPage(1);
              }}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-md text-gray-400 hover:text-gray-700 hover:bg-gray-100"
              aria-label="Clear search"
            >
              <ClearSearchIcon />
            </button>
          ) : null}
        </div>
        <div className="flex gap-2 w-full sm:w-auto sm:shrink-0 justify-start sm:justify-end">
          {['all', 'up', 'down'].map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => {
                setStatusFilter(s);
                setPage(1);
              }}
              className={`px-3.5 py-2 text-sm font-semibold rounded-xl border ${
                statusFilter === s ? 'bg-black text-white border-black' : 'bg-white text-gray-700 border-gray-300'
              }`}
            >
              {s.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      {/* Desktop table */}
      <div className="hidden lg:block overflow-x-auto border border-gray-200 rounded-2xl bg-white shadow-sm">
        <table className="w-full text-left text-sm text-gray-600 min-w-[980px]">
          <thead className="bg-gray-50 text-xs font-semibold text-gray-500 uppercase border-b border-gray-200">
            <tr>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Type</th>
              <th className="px-4 py-3">URL</th>
              <th className="px-4 py-3">Monitoring</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Interval</th>
              <th className="px-4 py-3">Last Checked</th>
              <th className="px-4 py-3">Response</th>
              <th className="px-4 py-3">Created By</th>
              <th className="px-4 py-3">Updated By</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              <tr><td colSpan="11" className="px-4 py-8 text-center text-gray-400 text-sm">Loading websites…</td></tr>
            ) : websites.length === 0 ? (
              <tr>
                <td colSpan="11" className="px-4 py-8 text-center text-gray-400 text-sm">
                  {searchQuery ? (
                    <span className="inline-flex flex-col items-center gap-1">
                      <span>No websites found</span>
                      <span className="text-xs">Try searching by website name or URL.</span>
                    </span>
                  ) : (
                    'No websites added yet.'
                  )}
                </td>
              </tr>
            ) : (
              websites.map((site) => (
                <tr
                  key={site._id}
                  onClick={() => {
                    setHistoryPage(1);
                    setHistoryPagination(null);
                    setSelectedSite(site);
                  }}
                  className="hover:bg-blue-50/40 cursor-pointer transition-colors"
                >
                  <td className="px-4 py-3 font-semibold text-gray-900">{site.name}</td>
                  <td className="px-4 py-3 capitalize">{site.type}</td>
                  <td className="px-4 py-3 max-w-[200px]" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center gap-1.5 min-w-0">
                      <CopyUrlButton url={site.url} />
                      <a
                        href={site.url}
                        target="_blank"
                        rel="noreferrer"
                        title={site.url}
                        className="text-xs text-blue-600 hover:underline truncate min-w-0"
                      >
                        {site.url}
                      </a>
                    </div>
                  </td>
                  <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                    <button
                      type="button"
                      onClick={(e) => handleToggleMonitoring(e, site)}
                      aria-label={
                        site.monitoringEnabled
                          ? 'Disable monitoring'
                          : 'Enable monitoring'
                      }
                      className={`relative inline-flex h-5 w-9 cursor-pointer items-center rounded-full transition-colors duration-150 ${
                        site.monitoringEnabled ? 'bg-black' : 'bg-gray-300'
                      }`}
                    >
                      <span
                        className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform duration-150 ${
                          site.monitoringEnabled ? 'translate-x-4' : 'translate-x-1'
                        }`}
                      />
                    </button>
                  </td>
                  <td className="px-4 py-3">{statusBadge(site)}</td>
                  <td className="px-4 py-3 text-xs">{formatInterval(site.checkInterval, site.checkIntervalUnit)}</td>
                  <td className="px-4 py-3 text-xs">{formatRelativeTime(site.lastCheckedAt)}</td>
                  <td className="px-4 py-3 text-xs">{formatResponseTime(site.lastResponseTime)}</td>
                  <td className="px-4 py-3 text-xs">{personName(site.createdBy)}</td>
                  <td className="px-4 py-3 text-xs">{personName(site.updatedBy)}</td>
                  <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                    <ActionsMenu site={site} />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Mobile / tablet cards — all authenticated users can edit/delete any site */}
      <div className="lg:hidden space-y-3">
        {loading ? (
          <p className="text-sm text-gray-500 text-center py-6">Loading websites…</p>
        ) : websites.length === 0 ? (
          <div className="text-sm text-gray-500 text-center py-6 space-y-1">
            {searchQuery ? (
              <>
                <p>No websites found</p>
                <p className="text-xs">Try searching by website name or URL.</p>
              </>
            ) : (
              <p>No websites added yet.</p>
            )}
          </div>
        ) : (
          websites.map((site) => (
            <div
              key={site._id}
              className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm space-y-3"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <button
                    type="button"
                    onClick={() => {
                      setHistoryPage(1);
                      setHistoryPagination(null);
                      setSelectedSite(site);
                    }}
                    className="w-full text-left"
                  >
                    <p className="font-bold text-gray-900 text-sm truncate">{site.name}</p>
                  </button>
                  <div className="mt-0.5 flex items-center gap-1.5 min-w-0">
                    <CopyUrlButton url={site.url} />
                    <a
                      href={site.url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-[11px] text-blue-600 hover:underline truncate min-w-0"
                    >
                      {site.url}
                    </a>
                  </div>
                </div>
                {statusBadge(site)}
              </div>
              <button
                type="button"
                onClick={() => {
                  setHistoryPage(1);
                  setHistoryPagination(null);
                  setSelectedSite(site);
                }}
                className="w-full text-left"
              >
                <div className="grid grid-cols-2 gap-2 text-[11px] text-gray-600">
                  <p><span className="font-semibold text-gray-700">Type:</span> <span className="capitalize">{site.type}</span></p>
                  <p><span className="font-semibold text-gray-700">Interval:</span> {formatInterval(site.checkInterval, site.checkIntervalUnit)}</p>
                  <p><span className="font-semibold text-gray-700">Last:</span> {formatRelativeTime(site.lastCheckedAt)}</p>
                  <p><span className="font-semibold text-gray-700">Response:</span> {formatResponseTime(site.lastResponseTime)}</p>
                  <p><span className="font-semibold text-gray-700">Created:</span> {personName(site.createdBy)}</p>
                  <p><span className="font-semibold text-gray-700">Updated:</span> {personName(site.updatedBy)}</p>
                </div>
              </button>
              <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-gray-100">
                <button
                  type="button"
                  onClick={(e) => handleToggleMonitoring(e, site)}
                  className={`relative inline-flex h-5 w-9 cursor-pointer items-center rounded-full transition-colors duration-150 ${
                    site.monitoringEnabled ? 'bg-black' : 'bg-gray-300'
                  }`}
                  title="Toggle monitoring"
                  aria-label={
                    site.monitoringEnabled
                      ? 'Disable monitoring'
                      : 'Enable monitoring'
                  }
                >
                  <span
                    className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform duration-150 ${
                      site.monitoringEnabled ? 'translate-x-4' : 'translate-x-1'
                    }`}
                  />
                </button>
                <span className="text-[10px] text-gray-500 mr-auto">
                  Monitoring {site.monitoringEnabled ? 'ON' : 'OFF'}
                </span>
                <ActionsMenu site={site} />
              </div>
            </div>
          ))
        )}
      </div>

      {pagination && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
          <div className="flex flex-wrap items-center gap-3 text-xs text-gray-600">
            <label className="inline-flex items-center gap-2">
              <span className="font-semibold text-gray-700">Rows per page</span>
              <Select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setPage(1);
                }}
                className="w-[4.5rem]"
                aria-label="Page size"
                options={PAGE_SIZE_OPTIONS.map((size) => ({
                  value: size,
                  label: String(size),
                }))}
              />
            </label>
            <span>
              {(() => {
                const total = pagination.total ?? pagination.totalItems ?? 0;
                const current = pagination.page ?? pagination.currentPage ?? page;
                const limit = pagination.limit ?? pageSize;
                if (total === 0) return 'Showing 0 of 0';
                const from = (current - 1) * limit + 1;
                const to = Math.min(current * limit, total);
                return `Showing ${from}–${to} of ${total}`;
              })()}
            </span>
          </div>

          <div className="flex flex-wrap items-center justify-center sm:justify-end gap-1.5">
            <button
              type="button"
              disabled={!pagination.hasPreviousPage}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="px-3 py-1.5 text-xs font-semibold rounded-xl border border-gray-300 disabled:opacity-40 hover:bg-gray-50"
            >
              Previous
            </button>
            {Array.from({ length: pagination.totalPages || 0 }, (_, i) => i + 1)
              .filter((n) => {
                const current = pagination.page ?? pagination.currentPage ?? page;
                const totalPages = pagination.totalPages || 0;
                if (totalPages <= 7) return true;
                if (n === 1 || n === totalPages) return true;
                return Math.abs(n - current) <= 1;
              })
              .reduce((acc, n, idx, arr) => {
                if (idx > 0 && n - arr[idx - 1] > 1) acc.push('…');
                acc.push(n);
                return acc;
              }, [])
              .map((item, idx) =>
                item === '…' ? (
                  <span key={`ellipsis-${idx}`} className="px-1 text-xs text-gray-400">
                    …
                  </span>
                ) : (
                  <button
                    key={item}
                    type="button"
                    onClick={() => setPage(item)}
                    className={`min-w-[2rem] px-2.5 py-1.5 text-xs font-semibold rounded-xl border ${
                      (pagination.page ?? pagination.currentPage ?? page) === item
                        ? 'bg-black text-white border-black'
                        : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    {item}
                  </button>
                )
              )}
            <button
              type="button"
              disabled={!pagination.hasNextPage}
              onClick={() => setPage((p) => p + 1)}
              className="px-3 py-1.5 text-xs font-semibold rounded-xl border border-gray-300 disabled:opacity-40 hover:bg-gray-50"
            >
              Next
            </button>
          </div>
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-3">
          <div className="bg-white rounded-2xl shadow-2xl border border-gray-200 w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-4 border-b border-gray-100">
              <h3 className="font-bold text-gray-900 text-base">{editing ? 'Edit Website' : 'Add Website'}</h3>
              <button type="button" onClick={() => setShowForm(false)} className="text-gray-400 p-1" aria-label="Close">✕</button>
            </div>
            <form onSubmit={handleSave} className="p-4 space-y-3">
              <div>
                <label className="label-field">Name</label>
                <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="input-field" />
              </div>
              <div>
                <label className="label-field">Type</label>
                <Select
                  value={form.type}
                  onChange={(e) => setForm({ ...form, type: e.target.value })}
                  options={[
                    { value: 'frontend', label: 'Frontend' },
                    { value: 'backend', label: 'Backend' },
                  ]}
                />
              </div>
              <div>
                <label className="label-field">URL</label>
                <input required type="url" value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} className="input-field" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label-field">Interval</label>
                  <input required type="number" min="1" value={form.checkInterval} onChange={(e) => setForm({ ...form, checkInterval: e.target.value })} className="input-field" />
                </div>
                <div>
                  <label className="label-field">Unit</label>
                  <Select
                    value={form.checkIntervalUnit}
                    onChange={(e) => setForm({ ...form, checkIntervalUnit: e.target.value })}
                    options={[
                      { value: 'minutes', label: 'Minutes' },
                      { value: 'hours', label: 'Hours' },
                    ]}
                  />
                </div>
              </div>
              <label className="flex items-center justify-between text-sm font-medium text-gray-700 pt-1">
                Enable Monitoring
                <input type="checkbox" checked={form.monitoringEnabled} onChange={(e) => setForm({ ...form, monitoringEnabled: e.target.checked })} />
              </label>
              <div className="flex justify-end gap-2 pt-3 border-t border-gray-100">
                <button type="button" onClick={() => setShowForm(false)} className="btn-ghost">Cancel</button>
                <button type="submit" disabled={saving} className="btn-primary">
                  {saving ? 'Saving…' : 'Save Website'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {deleteTarget && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-3">
          <div className="bg-white rounded-2xl shadow-2xl border border-gray-200 w-full max-w-md">
            <div className="flex items-center justify-between p-4 border-b border-gray-100">
              <h3 className="font-bold text-gray-900 text-base">Delete Website</h3>
              <button type="button" onClick={closeDelete} disabled={deleting} className="text-gray-400 p-1 disabled:opacity-40" aria-label="Close">
                ✕
              </button>
            </div>
            <div className="p-4 space-y-4">
              <p className="text-sm text-gray-600 leading-relaxed">
                Are you sure you want to delete{' '}
                <span className="font-semibold text-gray-900">{deleteTarget.name}</span>? This
                action cannot be undone.
              </p>
              <div className="flex justify-end gap-2 pt-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={closeDelete}
                  disabled={deleting}
                  className="btn-ghost"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={confirmDelete}
                  disabled={deleting}
                  className="btn-danger"
                >
                  {deleting ? 'Deleting…' : 'Delete'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </PageShell>
  );
}
