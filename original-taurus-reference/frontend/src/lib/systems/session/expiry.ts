import { get } from 'svelte/store';
import { api, setUnauthorizedHandler } from '$data/api';
import { session } from './store';

/**
 * App-wide reaction to session expiry.
 *
 * Omega sessions lapse server-side (dev config: 24h). The client hydrates its
 * session store once per page life, so without this watcher an expired session
 * keeps rendering signed-in UI on stale state until a manual refresh — API
 * calls just fail one by one ("Presence join failed", silent fetch errors).
 *
 * Two triggers, one exit:
 * - any API call answered 401 (via the api client's unauthorized hook), and
 * - the tab becoming visible again while the store still thinks it is signed
 *   in — a cheap `/auth/me` probe catches sessions that lapsed while the tab
 *   sat idle, before the user touches anything.
 *
 * The exit is a HARD navigation to /login (not a SvelteKit goto): expiry must
 * discard every client store, poller, and editor runtime, exactly like the
 * refresh that already bounced correctly. `?expired=1` tells the sign-in
 * screen to say why (a toast would not survive the reload), and `?next=`
 * brings the user back to where they were after signing in again.
 */

let bouncing = false;

function bounceToSignIn(): void {
  // Only a *lapsed* signed-in session bounces. During anonymous bootstrap
  // (first /auth/me on the login screen) the store has no user — that 401 is
  // the expected answer, not an expiry.
  if (bouncing || !get(session).user) return;
  bouncing = true;
  const here = location.pathname + location.search;
  const next = here.startsWith('/login') ? '' : `&next=${encodeURIComponent(here)}`;
  location.assign(`/login?expired=1${next}`);
}

function probeOnReturn(): void {
  if (document.visibilityState !== 'visible' || !get(session).user) return;
  // Outcome-only probe: a 401 trips the unauthorized hook above; any other
  // failure (offline, server restart) is not an auth verdict, so ignore it.
  api('/auth/me').catch(() => {});
}

/** Install the watcher (root layout, once). Returns the teardown. */
export function watchSessionExpiry(): () => void {
  setUnauthorizedHandler(bounceToSignIn);
  document.addEventListener('visibilitychange', probeOnReturn);
  return () => {
    setUnauthorizedHandler(null);
    document.removeEventListener('visibilitychange', probeOnReturn);
  };
}
