/**
 * Slack chat.postMessage integration for monitoring alerts.
 * Credentials: SLACK_BOT_TOKEN, SLACK_CHANNEL_ID (never logged).
 *
 * DOWN alerts may be batched into one message.
 * RECOVERY alerts are always sent one-at-a-time.
 */

const SLACK_API_URL = 'https://slack.com/api/chat.postMessage';

let missingCredentialsWarned = false;

const getSlackConfig = () => {
  const token = process.env.SLACK_BOT_TOKEN?.trim();
  const channel = process.env.SLACK_CHANNEL_ID?.trim();
  return { token, channel };
};

/**
 * @returns {boolean}
 */
export const isSlackConfigured = () => {
  const { token, channel } = getSlackConfig();
  return Boolean(token && channel);
};

const warnIfUnconfigured = () => {
  if (isSlackConfigured() || missingCredentialsWarned) return;
  missingCredentialsWarned = true;
  console.warn(
    '[SLACK] Alerts disabled — set SLACK_BOT_TOKEN and SLACK_CHANNEL_ID in .env'
  );
};

export const formatSlackTime = (checkedAt) => {
  const date = checkedAt instanceof Date ? checkedAt : new Date(checkedAt || Date.now());
  if (Number.isNaN(date.getTime())) return 'N/A';

  // e.g. "23 September, 1:48 am"
  return date.toLocaleString('en-GB', {
    day: 'numeric',
    month: 'long',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
};

/**
 * Post a text message to the configured Slack channel.
 * Never throws — returns { ok, error? }.
 */
export const postSlackMessage = async (text) => {
  warnIfUnconfigured();

  const { token, channel } = getSlackConfig();
  if (!token || !channel) {
    return { ok: false, error: 'not_configured' };
  }

  try {
    const response = await fetch(SLACK_API_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json; charset=utf-8',
      },
      body: JSON.stringify({
        channel,
        text,
        unfurl_links: false,
        unfurl_media: false,
      }),
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok || !data.ok) {
      const error = data.error || `http_${response.status}`;
      console.error(`[SLACK] chat.postMessage failed: ${error}`);
      return { ok: false, error };
    }

    return { ok: true };
  } catch (error) {
    console.error('[SLACK] chat.postMessage error:', error.message);
    return { ok: false, error: error.message };
  }
};

const formatDownLine = ({ website, checkedAt }) => {
  const name = website?.name || 'Unknown';
  const url = website?.url || 'N/A';
  const time = formatSlackTime(checkedAt || website?.lastCheckedAt);
  return `- ${name} | ${url} | Status: DOWN | ${time}`;
};

/**
 * One combined DOWN message for one or more websites.
 * @param {Array<{ website: object, checkedAt?: Date|string }>} entries
 */
export const sendCombinedDownAlert = async (entries = []) => {
  if (!entries.length) {
    return { ok: false, error: 'empty_batch' };
  }

  const lines = entries.map(formatDownLine);
  const text = ['🚨 Websites DOWN', ...lines].join('\n');
  return postSlackMessage(text);
};

/**
 * Single RECOVERY (or legacy single DOWN) alert.
 * Prefer sendCombinedDownAlert for DOWN transitions.
 */
export const sendMonitoringSlackAlert = async ({
  website,
  alertType,
  statusCode = null,
  responseTime = null,
  checkedAt = null,
}) => {
  void statusCode;
  void responseTime;

  const name = website?.name || 'Unknown';
  const url = website?.url || 'N/A';
  const time = formatSlackTime(checkedAt || website?.lastCheckedAt);

  let text;
  if (alertType === 'down') {
    // Fallback single-site format (batched path uses sendCombinedDownAlert)
    text = `🚨 Websites DOWN\n- ${name} | ${url} | Status: DOWN | ${time}`;
  } else if (alertType === 'recovery') {
    text = `✅ Website RECOVERED — ${name} | ${url} | Status: UP | ${time}`;
  } else {
    return { ok: false, error: 'invalid_alert_type' };
  }

  return postSlackMessage(text);
};
