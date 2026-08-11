/**
 * Thin client for the Taurus Omega HTTP API. Requests go to `/api/*`, which the
 * Vite dev proxy forwards to the backend same-origin (so the session cookie
 * flows). Non-2xx responses throw an `ApiError` carrying the backend's
 * `{ "error": "..." }` message.
 */
export type ApiError = { status: number; message: string };

export function isApiError(e: unknown): e is ApiError {
  return typeof e === 'object' && e !== null && 'status' in e && 'message' in e;
}

/** The cookie Omega's gate issues, and the header it wants echoed back. */
const CSRF_COOKIE = 'to_csrf';
const CSRF_HEADER = 'X-CSRF-Token';

/** Mutating methods — the only ones Omega checks the token on. */
const MUTATING = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

/**
 * Paths where a 401 is an *answer* (bad credentials, already signed out), not
 * evidence that a live session has lapsed — they never trip the handler below.
 */
const AUTH_ENDPOINTS = new Set(['/auth/login', '/auth/register', '/auth/logout']);

type UnauthorizedHandler = () => void;
let onUnauthorized: UnauthorizedHandler | null = null;

/**
 * Register the app-wide reaction to a mid-session 401 — Omega no longer
 * recognizes the session cookie (expired or revoked), so continuing to render
 * signed-in UI would be a lie. The session system installs a handler that
 * bounces to sign-in; the ApiError still propagates to the caller.
 */
export function setUnauthorizedHandler(handler: UnauthorizedHandler | null): void {
  onUnauthorized = handler;
}

/**
 * Read Omega's CSRF token out of `document.cookie`.
 *
 * This cookie is deliberately **not** `HttpOnly` — that is the whole mechanism.
 * A cross-site page can make the browser *send* our cookies, but the same-origin
 * policy stops it *reading* them, so it cannot produce the matching header.
 * (`to_session` is `HttpOnly` and invisible here, by design.)
 *
 * Returns `''` when absent, which is correct for the two exempt routes
 * (`/auth/register`, `/auth/login`): the gate issues the cookie on the first
 * *authenticated* request, so there is genuinely no token yet at sign-in.
 */
function csrfToken(): string {
  if (typeof document === 'undefined') return '';
  const match = document.cookie.split('; ').find((c) => c.startsWith(`${CSRF_COOKIE}=`));
  return match ? decodeURIComponent(match.slice(CSRF_COOKIE.length + 1)) : '';
}

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const method = (init.method ?? 'GET').toUpperCase();
  // Double-submit CSRF (see taurus-omega docs/frontend-requests/csrf-token-header.md):
  // every authenticated mutation must echo the `to_csrf` cookie in a header, or
  // Omega answers 403 before the handler runs. Adding it here covers every call
  // in the app, since they all come through this wrapper. Safe methods are never
  // checked, so the header is omitted rather than sent empty.
  const csrf = MUTATING.has(method) ? csrfToken() : '';

  const res = await fetch(`/api${path}`, {
    credentials: 'include',
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(csrf ? { [CSRF_HEADER]: csrf } : {}),
      ...init.headers
    }
  });

  if (res.status === 204) return undefined as T;

  let body: unknown = null;
  try {
    body = await res.json();
  } catch {
    // non-JSON body (or empty) — leave body null
  }

  if (!res.ok) {
    if (res.status === 401 && !AUTH_ENDPOINTS.has(path)) onUnauthorized?.();
    const message =
      (body as { error?: string } | null)?.error ?? `Request failed (${res.status})`;
    throw { status: res.status, message } satisfies ApiError;
  }

  return body as T;
}
