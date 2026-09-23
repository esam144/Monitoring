const ALLOWED_UNITS = ['minutes', 'hours'];

const LIMITS = {
  minutes: { min: 1, max: 1440 }, // 1 minute → 24 hours
  hours: { min: 1, max: 168 }, // 1 hour → 7 days
};

const SLACK_REPEAT_UNITS = ['minutes', 'hours', 'days'];

const SLACK_REPEAT_LIMITS = {
  minutes: { min: 1, max: 1440 },
  hours: { min: 1, max: 168 },
  days: { min: 1, max: 30 },
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
  const unit = String(checkIntervalUnit || 'minutes').toLowerCase();
  if (unit === 'days') {
    return Number(checkInterval) * 24 * 60 * 60 * 1000;
  }
  if (unit === 'hours') {
    return Number(checkInterval) * 60 * 60 * 1000;
  }
  return Number(checkInterval) * 60 * 1000;
};

/**
 * Validate Slack repeat interval + unit from request body.
 * @returns {{ value: number, unit: string } | { error: string }}
 */
export const parseSlackRepeatInterval = (repeatInterval, repeatUnit) => {
  const raw = Number(repeatInterval);
  const unit = String(repeatUnit ?? 'hours').toLowerCase();

  if (!SLACK_REPEAT_UNITS.includes(unit)) {
    return { error: 'repeatUnit must be minutes, hours, or days' };
  }

  if (!Number.isInteger(raw)) {
    return { error: 'repeatInterval must be an integer' };
  }

  const { min, max } = SLACK_REPEAT_LIMITS[unit];
  if (raw < min || raw > max) {
    return {
      error: `repeatInterval for ${unit} must be between ${min} and ${max}`,
    };
  }

  return { value: raw, unit };
};

/** Normalize slackSettings from a website document (with defaults). */
export const getSlackSettings = (website) => {
  const s = website?.slackSettings || {};
  return {
    enabled: s.enabled !== false,
    repeatInterval:
      Number.isInteger(s.repeatInterval) && s.repeatInterval > 0
        ? s.repeatInterval
        : 1,
    repeatUnit: SLACK_REPEAT_UNITS.includes(s.repeatUnit)
      ? s.repeatUnit
      : 'hours',
    recoveryNotification: s.recoveryNotification !== false,
  };
};

export const computeNextCheckAt = (
  fromDate,
  checkInterval,
  checkIntervalUnit = 'minutes'
) => {
  const base = fromDate instanceof Date ? fromDate : new Date(fromDate);
  return new Date(base.getTime() + intervalToMs(checkInterval, checkIntervalUnit));
};
