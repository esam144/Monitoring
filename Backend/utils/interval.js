const ALLOWED_UNITS = ['minutes', 'hours'];

const LIMITS = {
  minutes: { min: 1, max: 1440 }, // 1 minute → 24 hours
  hours: { min: 1, max: 168 }, // 1 hour → 7 days
};

/**
 * Validate checkInterval + checkIntervalUnit from request body.
 * @returns {{ value: number, unit: string } | { error: string }}
 */
export const parseCheckInterval = (checkInterval, checkIntervalUnit) => {
  const raw = Number(checkInterval);

  let unit;
  if (
    checkIntervalUnit !== undefined &&
    checkIntervalUnit !== null &&
    String(checkIntervalUnit).trim() !== ''
  ) {
    unit = String(checkIntervalUnit).toLowerCase();
  } else {
    // Legacy clients sent 6/12 without a unit (meant hours)
    unit = raw === 6 || raw === 12 ? 'hours' : 'minutes';
  }

  if (!ALLOWED_UNITS.includes(unit)) {
    return { error: 'checkIntervalUnit must be minutes or hours' };
  }

  if (!Number.isInteger(raw)) {
    return { error: 'checkInterval must be an integer' };
  }

  const { min, max } = LIMITS[unit];
  if (raw < min || raw > max) {
    return {
      error: `checkInterval for ${unit} must be between ${min} and ${max}`,
    };
  }

  return { value: raw, unit };
};

export const intervalToMs = (checkInterval, checkIntervalUnit = 'minutes') => {
  const unit = checkIntervalUnit === 'hours' ? 'hours' : 'minutes';
  if (unit === 'hours') {
    return Number(checkInterval) * 60 * 60 * 1000;
  }
  return Number(checkInterval) * 60 * 1000;
};

export const computeNextCheckAt = (
  fromDate,
  checkInterval,
  checkIntervalUnit = 'minutes'
) => {
  const base = fromDate instanceof Date ? fromDate : new Date(fromDate);
  return new Date(base.getTime() + intervalToMs(checkInterval, checkIntervalUnit));
};
