import { chromium } from 'playwright';

let browser = null;
let browserLaunchPromise = null;

const getBrowser = async () => {
  if (browser?.isConnected()) {
    return browser;
  }

  if (!browserLaunchPromise) {
    browserLaunchPromise = chromium
      .launch({
        headless: true,
        args: ['--disable-dev-shm-usage'],
      })
      .then((instance) => {
        browser = instance;
        instance.on('disconnected', () => {
          if (browser === instance) {
            browser = null;
          }
        });
        return instance;
      })
      .finally(() => {
        browserLaunchPromise = null;
      });
  }

  return browserLaunchPromise;
};

/**
 * Retry a frontend check in a real Chromium browser.
 * The browser process is shared, while every check gets an isolated context.
 */
export const probeWithBrowser = async (url, timeoutMs, startedAt) => {
  let context;

  try {
    const activeBrowser = await getBrowser();
    const browserVersion = activeBrowser.version();
    const remainingTimeout = timeoutMs - (Date.now() - startedAt);

    if (remainingTimeout <= 0) {
      return {
        statusCode: null,
        responseTime: timeoutMs,
        errorMessage: 'Request timeout',
        checkedUrl: url,
      };
    }

    context = await activeBrowser.newContext({
      locale: 'en-US',
      userAgent:
        `Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 ` +
        `(KHTML, like Gecko) Chrome/${browserVersion} Safari/537.36`,
    });

    const page = await context.newPage();
    const response = await page.goto(url, {
      waitUntil: 'domcontentloaded',
      timeout: remainingTimeout,
    });

    return {
      statusCode: response?.status() ?? null,
      responseTime: Date.now() - startedAt,
      errorMessage: response ? null : 'Navigation returned no response',
      checkedUrl: page.url() || url,
    };
  } catch (error) {
    const timedOut = error.name === 'TimeoutError';
    const errorMessage =
      error.message?.split('\n', 1)[0] || 'Browser check failed';

    return {
      statusCode: null,
      responseTime: timedOut ? timeoutMs : Date.now() - startedAt,
      errorMessage: timedOut ? 'Request timeout' : errorMessage,
      checkedUrl: url,
    };
  } finally {
    await context?.close().catch(() => {});
  }
};
