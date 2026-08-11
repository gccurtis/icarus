import { request, type APIRequestContext } from '@playwright/test';

/**
 * A signed-in `APIRequestContext` that carries Omega's CSRF token.
 *
 * Omega applies double-submit CSRF protection to every authenticated mutation
 * (`POST`/`PUT`/`PATCH`/`DELETE`): the request must echo the `to_csrf` cookie in
 * an `X-CSRF-Token` header, or the gate answers **403 before the handler runs**.
 * See `taurus-omega/docs/frontend-requests/csrf-token-header.md`.
 *
 * The app gets this for free — every call goes through `$data/api`, which adds
 * the header. These specs talk to Omega directly, so they have to do it too.
 *
 * The ordering matters and is the part that surprises: the token is issued by
 * the **gate**, not by the login handler, so it is NOT set on the login
 * response. A context must sign in, make one authenticated *safe* request to be
 * handed the cookie, and only then mutate.
 *
 * `extraHTTPHeaders` is fixed at context creation, so this bootstraps a throwaway
 * context to obtain the token, then returns a real one seeded with its cookies
 * and the header.
 */
export async function signedInApiContext(
  baseURL: string,
  account: { email: string; password: string; name: string }
): Promise<APIRequestContext> {
  const bootstrap = await request.newContext({ baseURL, ignoreHTTPSErrors: true });
  try {
    const registered = await bootstrap.post('/api/auth/register', { data: account });
    // 409 = already registered, which is the normal case on a warm dev database.
    if (![201, 409].includes(registered.status()))
      throw new Error(`register ${account.email}: ${registered.status()}`);
    const login = await bootstrap.post('/api/auth/login', {
      data: { email: account.email, password: account.password }
    });
    if (!login.ok()) throw new Error(`login ${account.email}: ${login.status()}`);

    // The authenticated GET that makes the gate issue `to_csrf`.
    await bootstrap.get('/api/auth/me');
    const state = await bootstrap.storageState();
    const token = state.cookies.find((cookie) => cookie.name === 'to_csrf')?.value;
    if (!token)
      throw new Error('no to_csrf cookie after an authenticated request — is the gate wired?');

    return await request.newContext({
      baseURL,
      ignoreHTTPSErrors: true,
      storageState: state,
      extraHTTPHeaders: { 'X-CSRF-Token': token }
    });
  } finally {
    await bootstrap.dispose();
  }
}
