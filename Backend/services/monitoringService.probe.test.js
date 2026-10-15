import assert from 'node:assert/strict';
import { afterEach, describe, it, mock } from 'node:test';
import {
  probeBackend,
  resolveBackendCheckUrls,
} from './monitoringService.js';

const okResponse = (status) =>
  Promise.resolve({
    status,
    ok: status >= 200 && status < 300,
  });

afterEach(() => {
  mock.restoreAll();
});

describe('resolveBackendCheckUrls', () => {
  it('appends /health for base URLs and marks explicitHealth false', () => {
    const result = resolveBackendCheckUrls('https://dqs.easylife.co.za/api/');
    assert.equal(result.explicitHealth, false);
    assert.equal(result.baseUrl, 'https://dqs.easylife.co.za/api');
    assert.equal(result.healthUrl, 'https://dqs.easylife.co.za/api/health');
  });

  it('does not double-append /health for explicit health URLs', () => {
    const result = resolveBackendCheckUrls(
      'https://example.com/Checkin-Backend/api/health'
    );
    assert.equal(result.explicitHealth, true);
    assert.equal(result.baseUrl, null);
    assert.equal(
      result.healthUrl,
      'https://example.com/Checkin-Backend/api/health'
    );
  });
});

describe('probeBackend', () => {
  it('marks UP when auto /health returns 200', async () => {
    mock.method(globalThis, 'fetch', async (url) => {
      assert.match(String(url), /\/health$/);
      return okResponse(200);
    });

    const result = await probeBackend('https://example.com/api', 5000, Date.now());
    assert.equal(result.status, 'up');
    assert.equal(result.statusCode, 200);
    assert.equal(result.checkedUrl, 'https://example.com/api/health');
  });

  it('falls back to base when auto /health returns 401 and base is reachable', async () => {
    mock.method(globalThis, 'fetch', async (url) => {
      const href = String(url);
      if (href.endsWith('/health')) return okResponse(401);
      if (href === 'https://dqs.easylife.co.za/api') return okResponse(200);
      throw new Error(`unexpected url ${href}`);
    });

    const result = await probeBackend(
      'https://dqs.easylife.co.za/api/',
      5000,
      Date.now()
    );
    assert.equal(result.status, 'up');
    assert.equal(result.statusCode, 200);
    assert.equal(result.checkedUrl, 'https://dqs.easylife.co.za/api');
  });

  it('falls back to base when auto /health returns 403 and base is non-5xx', async () => {
    mock.method(globalThis, 'fetch', async (url) => {
      const href = String(url);
      if (href.endsWith('/health')) return okResponse(403);
      return okResponse(401); // base answered — backend reachable
    });

    const result = await probeBackend('https://example.com/api', 5000, Date.now());
    assert.equal(result.status, 'up');
    assert.equal(result.statusCode, 401);
    assert.equal(result.checkedUrl, 'https://example.com/api');
  });

  it('falls back to base when auto /health returns 404 (existing behavior)', async () => {
    mock.method(globalThis, 'fetch', async (url) => {
      const href = String(url);
      if (href.endsWith('/health')) return okResponse(404);
      return okResponse(200);
    });

    const result = await probeBackend('https://example.com/api', 5000, Date.now());
    assert.equal(result.status, 'up');
    assert.equal(result.checkedUrl, 'https://example.com/api');
  });

  it('does not fall back when auto /health returns 500', async () => {
    let calls = 0;
    mock.method(globalThis, 'fetch', async () => {
      calls += 1;
      return okResponse(500);
    });

    const result = await probeBackend('https://example.com/api', 5000, Date.now());
    assert.equal(result.status, 'down');
    assert.equal(result.statusCode, 500);
    assert.equal(calls, 1);
  });

  it('does not fall back for explicit /health URLs on 401', async () => {
    let calls = 0;
    mock.method(globalThis, 'fetch', async () => {
      calls += 1;
      return okResponse(401);
    });

    const result = await probeBackend(
      'https://example.com/api/health',
      5000,
      Date.now()
    );
    assert.equal(result.status, 'down');
    assert.equal(result.statusCode, 401);
    assert.equal(result.checkedUrl, 'https://example.com/api/health');
    assert.equal(calls, 1);
  });

  it('marks DOWN when /health is 401 and base is 5xx', async () => {
    mock.method(globalThis, 'fetch', async (url) => {
      const href = String(url);
      if (href.endsWith('/health')) return okResponse(401);
      return okResponse(503);
    });

    const result = await probeBackend('https://example.com/api', 5000, Date.now());
    assert.equal(result.status, 'down');
    assert.equal(result.statusCode, 503);
    assert.equal(result.checkedUrl, 'https://example.com/api');
  });

  it('marks DOWN on /health timeout without falling back', async () => {
    mock.method(globalThis, 'fetch', async () => {
      const err = new Error('aborted');
      err.name = 'AbortError';
      throw err;
    });

    const result = await probeBackend('https://example.com/api', 1000, Date.now());
    assert.equal(result.status, 'down');
    assert.equal(result.errorMessage, 'Request timeout');
    assert.equal(result.checkedUrl, 'https://example.com/api/health');
  });
});
