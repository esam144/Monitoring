const RANGE_HOURS = {
  '24h': 24,
  '48h': 48,
  '72h': 72,
};

/**
 * Parse range query (24h | 48h | 72h) into a start Date.
 * @returns {{ startDate: Date, range: string } | { error: string }}
 */
export const parseTimeRange = (rangeQuery) => {
  const range = rangeQuery || '24h';

  if (!RANGE_HOURS[range]) {
    return { error: 'Invalid range. Use 24h, 48h, or 72h.' };
  }

  const startDate = new Date(Date.now() - RANGE_HOURS[range] * 60 * 60 * 1000);

  return { startDate, range };
};
