import { writable } from 'svelte/store';
import type { Resource, ResourceKind } from './types';

export const resources = writable<Resource[]>([]);
export const availableKinds = writable<ResourceKind[]>([]);

/**
 * Whether `resources` currently holds an authoritative answer for the active
 * project. Omega filters the catalog by access scope, so this list is also the
 * definition of "what this user is allowed to know exists" — and the activity
 * feed reads it that way to decide which event targets to redact. Before the
 * catalog lands, an empty list is indistinguishable from "you may see nothing",
 * so surfaces that make an access decision must wait for this rather than
 * treating the initial `[]` as fact.
 */
export const resourcesLoaded = writable(false);
