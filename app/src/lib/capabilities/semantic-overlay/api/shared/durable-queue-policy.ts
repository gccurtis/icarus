/** Retry and ownership timing policy shared by both semantic job tables. */
export const MAX_ATTEMPTS = 3;
export const LEASE_MS = 5 * 60_000;
export const HEARTBEAT_MS = Math.floor(LEASE_MS / 3);
