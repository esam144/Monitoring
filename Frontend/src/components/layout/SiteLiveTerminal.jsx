import { useEffect, useRef, useState } from 'react';
import { openSiteMonitoringStream } from '../../api/monitoringApi';
import { useAuth } from '../../context/AuthContext';

const MAX_LINES = 250;

const formatClock = (iso) => {
  if (!iso) return '--:--:--';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '--:--:--';
  return d.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
};

/**
 * Build operator-friendly console lines from a live event.
 * Returns an array of { text, tone }.
 */
const linesFromEvent = (event) => {
  const time = formatClock(event.checkedAt || event.emittedAt);

  if (event.type === 'connected') {
    return [{ text: `${time}  Live monitor connected`, tone: 'muted' }];
  }

  if (event.type === 'check_started') {
    return [{ text: `${time}  Checking website…`, tone: 'muted' }];
  }

  if (event.type === 'check_completed') {
    const rows = [];
    const st = (event.status || '').toUpperCase();
    const tone = event.status === 'up' ? 'up' : 'down';

    rows.push({ text: `${time}  Status: ${st || 'DOWN'}`, tone });

    if (event.error) {
      const friendly =
        /timeout/i.test(event.error)
          ? 'Connection timed out'
          : /abort/i.test(event.error)
            ? 'Connection timed out'
            : 'Connection failed';
      rows.push({ text: `${time}  ${friendly}`, tone: 'down' });
      if (event.responseTime != null) {
        rows.push({
          text: `${time}  Response: ${event.responseTime}ms`,
          tone: 'muted',
        });
      }
      return rows;
    }

    if (event.statusCode != null) {
      rows.push({ text: `${time}  HTTP: ${event.statusCode}`, tone });
    }
    if (event.responseTime != null) {
      rows.push({
        text: `${time}  Response: ${event.responseTime}ms`,
        tone: 'muted',
      });
    }
    return rows;
  }

  if (event.type === 'alert') {
    return [
      {
        text:
          event.alertType === 'recovery'
            ? `${time}  Recovery notification sent to Slack`
            : `${time}  Down notification queued for Slack`,
        tone: event.alertType === 'recovery' ? 'up' : 'down',
      },
    ];
  }

  if (event.message) {
    return [{ text: `${time}  ${event.message}`, tone: 'muted' }];
  }

  return [];
};

const toneClass = {
  up: 'text-emerald-400',
  down: 'text-red-400',
  muted: 'text-slate-400',
};

/**
 * Live terminal for a single website (SSE filtered by websiteId).
 */
export default function SiteLiveTerminal({ websiteId, siteName }) {
  const { token } = useAuth();
  const [lines, setLines] = useState([]);
  const [connected, setConnected] = useState(false);
  const [paused, setPaused] = useState(false);
  const [streamError, setStreamError] = useState('');
  const bottomRef = useRef(null);
  const pausedRef = useRef(paused);

  useEffect(() => {
    pausedRef.current = paused;
  }, [paused]);

  useEffect(() => {
    if (!token || !websiteId) return undefined;

    setLines([]);
    setStreamError('');
    setConnected(false);

    const source = openSiteMonitoringStream(token, websiteId, {
      onOpen: () => setConnected(true),
      onError: () => {
        setConnected(false);
        setStreamError('Live connection interrupted. Reconnecting…');
      },
      onEvent: (event) => {
        setConnected(true);
        setStreamError('');
        const eventSiteId = event.websiteId != null ? String(event.websiteId) : null;
        if (
          eventSiteId &&
          eventSiteId !== String(websiteId) &&
          event.type !== 'connected'
        ) {
          return;
        }
        const nextLines = linesFromEvent(event);
        if (nextLines.length === 0) return;
        setLines((prev) => {
          const stamped = nextLines.map((line) => ({
            id: `${Date.now()}-${Math.random()}`,
            ...line,
          }));
          const merged = [...prev, ...stamped];
          return merged.length > MAX_LINES ? merged.slice(-MAX_LINES) : merged;
        });
      },
    });

    return () => {
      source.close();
      setConnected(false);
    };
  }, [token, websiteId]);

  useEffect(() => {
    if (pausedRef.current) return;
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [lines]);

  return (
    <div className="bg-[#0b1220] text-slate-100 rounded-2xl border border-slate-800 shadow-sm overflow-hidden flex flex-col h-[min(42vh,400px)] min-h-[280px] sm:min-h-[320px]">
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 border-b border-slate-800 bg-[#0f172a]">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-slate-200 truncate">
            Live activity · {siteName || 'Site'}
          </p>
          <p className="text-sm text-slate-500">
            Real-time check results for this site
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span
            className={`inline-flex items-center gap-1.5 text-sm font-semibold px-2.5 py-1 rounded-lg ${
              connected
                ? 'bg-emerald-500/10 text-emerald-400'
                : 'bg-slate-800 text-slate-500'
            }`}
          >
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                connected ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500'
              }`}
            />
            {connected ? 'Live' : 'Offline'}
          </span>
          <button
            type="button"
            onClick={() => setPaused((p) => !p)}
            className="px-3 py-1.5 text-sm font-semibold rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200"
          >
            {paused ? 'Resume' : 'Pause'}
          </button>
          <button
            type="button"
            onClick={() => setLines([])}
            className="px-3 py-1.5 text-sm font-semibold rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200"
          >
            Clear
          </button>
        </div>
      </div>

      {streamError && (
        <p className="px-4 py-2 text-sm text-amber-300 bg-amber-950/40 border-b border-amber-900/40">
          {streamError}
        </p>
      )}

      <div className="flex-1 overflow-y-auto overflow-x-hidden px-4 py-3 font-mono text-sm leading-6 min-h-0">
        {lines.length === 0 ? (
          <div className="h-full min-h-[200px] flex items-center justify-center text-center px-4">
            <div>
              <p className="text-slate-300 text-sm font-medium">Waiting for checks…</p>
              <p className="text-slate-500 text-sm mt-1.5 max-w-sm mx-auto">
                Enable monitoring or use Check Now. Live results for this site will appear here.
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-0.5 break-words">
            {lines.map((line) => (
              <div
                key={line.id}
                className={toneClass[line.tone] || toneClass.muted}
              >
                {line.text}
              </div>
            ))}
            <div ref={bottomRef} />
          </div>
        )}
      </div>
    </div>
  );
}
