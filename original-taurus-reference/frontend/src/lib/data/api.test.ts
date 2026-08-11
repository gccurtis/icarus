import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { api, setUnauthorizedHandler } from './api';

// Omega applies double-submit CSRF protection to authenticated mutations: the
// request must echo the `to_csrf` cookie in an `X-CSRF-Token` header or the gate
// answers 403 before the handler runs. Every call in the app goes through this
// wrapper, so this is the one place that has to be right.

const fetchMock = vi.fn();

// The suite runs on the `node` environment, so there is no real `document`.
// `csrfToken()` only ever reads `document.cookie`, so a one-property stand-in is
// the whole surface — and it lets a test set the cookie jar directly.
function setCookies(cookie: string) {
  vi.stubGlobal('document', { cookie });
}

function lastInit(): RequestInit {
  return fetchMock.mock.calls.at(-1)?.[1] as RequestInit;
}

function headers(): Record<string, string> {
  return (lastInit().headers ?? {}) as Record<string, string>;
}

beforeEach(() => {
  fetchMock.mockReset();
  fetchMock.mockResolvedValue({ ok: true, status: 200, json: async () => ({ ok: true }) });
  vi.stubGlobal('fetch', fetchMock);
  setCookies('to_csrf=abc123');
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('api — CSRF header', () => {
  it('sends the token on every mutating method', async () => {
    for (const method of ['POST', 'PUT', 'PATCH', 'DELETE']) {
      await api('/projects', { method });
      expect(headers()['X-CSRF-Token'], `${method} should carry the token`).toBe('abc123');
    }
  });

  it('omits the header on safe methods', async () => {
    await api('/projects');
    expect(headers()['X-CSRF-Token']).toBeUndefined();
    await api('/projects', { method: 'GET' });
    expect(headers()['X-CSRF-Token']).toBeUndefined();
  });

  it('accepts a lowercase method', async () => {
    await api('/projects', { method: 'post' });
    expect(headers()['X-CSRF-Token']).toBe('abc123');
  });

  it('omits the header rather than sending an empty one when no cookie exists', async () => {
    // The real case: `/auth/register` and `/auth/login` run before the gate has
    // issued a token, and both are exempt.
    setCookies('');
    await api('/auth/login', { method: 'POST' });
    expect(headers()['X-CSRF-Token']).toBeUndefined();
  });

  it('reads to_csrf even when other cookies are present', async () => {
    setCookies('other=1; to_csrf=xyz789; another=2');
    await api('/projects', { method: 'POST' });
    expect(headers()['X-CSRF-Token']).toBe('xyz789');
  });
});

describe('api — request shape', () => {
  it('keeps the JSON content type and the caller’s init', async () => {
    await api('/documents', { method: 'POST', body: '{"name":"x"}' });
    const init = lastInit();
    expect(init.method).toBe('POST');
    expect(init.body).toBe('{"name":"x"}');
    expect(init.credentials).toBe('include');
    expect(headers()['Content-Type']).toBe('application/json');
  });

  it('merges caller headers instead of replacing them', async () => {
    // Previously `...init` came AFTER `headers`, so passing any header dropped
    // Content-Type (and would now drop the CSRF token with it).
    await api('/documents', { method: 'POST', headers: { 'X-Trace': 't1' } });
    expect(headers()['X-Trace']).toBe('t1');
    expect(headers()['Content-Type']).toBe('application/json');
    expect(headers()['X-CSRF-Token']).toBe('abc123');
  });

  it('throws the backend error message on a non-2xx response', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 403,
      json: async () => ({ error: 'missing or invalid CSRF token' })
    });
    await expect(api('/projects', { method: 'POST' })).rejects.toMatchObject({
      status: 403,
      message: 'missing or invalid CSRF token'
    });
  });
});

describe('api — unauthorized hook', () => {
  // A 401 mid-session means Omega no longer recognizes the cookie (expired or
  // revoked). The registered handler is the app-wide reaction — bounce to
  // sign-in — while the ApiError still propagates to the caller.
  const handler = vi.fn();

  function respondWith(status: number) {
    fetchMock.mockResolvedValue({
      ok: false,
      status,
      json: async () => ({ error: 'nope' })
    });
  }

  beforeEach(() => {
    handler.mockReset();
    setUnauthorizedHandler(handler);
  });

  afterEach(() => {
    setUnauthorizedHandler(null);
  });

  it('fires on a 401 from a protected path and still throws', async () => {
    respondWith(401);
    await expect(api('/sessions', { method: 'POST' })).rejects.toMatchObject({ status: 401 });
    expect(handler).toHaveBeenCalledOnce();
  });

  it('stays quiet on the auth endpoints, where 401 means bad credentials, not expiry', async () => {
    respondWith(401);
    for (const path of ['/auth/login', '/auth/register', '/auth/logout']) {
      await expect(api(path, { method: 'POST' })).rejects.toMatchObject({ status: 401 });
    }
    expect(handler).not.toHaveBeenCalled();
  });

  it('ignores non-401 failures', async () => {
    respondWith(403);
    await expect(api('/projects', { method: 'POST' })).rejects.toMatchObject({ status: 403 });
    respondWith(500);
    await expect(api('/projects')).rejects.toMatchObject({ status: 500 });
    expect(handler).not.toHaveBeenCalled();
  });

  it('does nothing when no handler is registered', async () => {
    setUnauthorizedHandler(null);
    respondWith(401);
    await expect(api('/sessions')).rejects.toMatchObject({ status: 401 });
  });
});
