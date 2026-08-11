import { writable } from 'svelte/store';
import type { Tone } from './components/types';

export type Toast = { id: number; message: string; tone: Tone; duration: number };

let seq = 0;

export const toasts = writable<Toast[]>([]);

/** Push a toast. Returns its id. duration <= 0 keeps it until dismissed. */
export function toast(message: string, opts: { tone?: Tone; duration?: number } = {}): number {
  const id = ++seq;
  const t: Toast = { id, message, tone: opts.tone ?? 'neutral', duration: opts.duration ?? 4000 };
  toasts.update((all) => [...all, t]);
  if (t.duration > 0) setTimeout(() => dismiss(id), t.duration);
  return id;
}

export function dismiss(id: number): void {
  toasts.update((all) => all.filter((t) => t.id !== id));
}
