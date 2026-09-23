export const formatRelativeTime = (dateValue) => {
  if (!dateValue) return '—';
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return '—';

  const diffMs = Date.now() - date.getTime();
  const sec = Math.floor(diffMs / 1000);
  if (sec < 60) return 'just now';
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min} min${min === 1 ? '' : 's'} ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} hour${hr === 1 ? '' : 's'} ago`;
  const days = Math.floor(hr / 24);
  return `${days} day${days === 1 ? '' : 's'} ago`;
};

export const formatDateTime = (dateValue) => {
  if (!dateValue) return '—';
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString();
};

export const formatResponseTime = (ms) => {
  if (ms === null || ms === undefined || Number.isNaN(Number(ms))) return '—';
  return `${Math.round(Number(ms))} ms`;
};

export const formatInterval = (value, unit) => {
  if (!value) return '—';
  const u = unit || 'minutes';
  return `${value} ${u}`;
};

export const personName = (person) => {
  if (!person) return '—';
  if (typeof person === 'string') return person;
  return person.name || person.email || '—';
};
