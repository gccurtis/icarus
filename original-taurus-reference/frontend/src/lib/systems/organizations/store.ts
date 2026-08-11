import { writable } from 'svelte/store';
import type { Organization } from './types';

/**
 * The caller's organizations. Unlike project-scoped stores this is user-scoped —
 * organizations span projects — so it is loaded from the user menu, not on project
 * switch. Members are fetched per-org on demand (not held here).
 */
export const organizations = writable<Organization[]>([]);
