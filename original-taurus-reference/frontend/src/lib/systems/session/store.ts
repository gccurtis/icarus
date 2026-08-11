import { writable } from 'svelte/store';
import type { User } from './types';

export const session = writable<{ user: User | null; ready: boolean }>({
  user: null,
  ready: false
});
