import { api } from '$data/api';
import type { User } from './types';
import { session } from './store';

function nameFromEmail(email: string): string {
  return (
    email
      .split('@')[0]
      .replace(/[._-]+/g, ' ')
      .replace(/\b\w/g, (c) => c.toUpperCase())
      .trim() || 'Explorer'
  );
}

export function displayName(name: string | undefined, email: string): string {
  return name?.trim() || nameFromEmail(email);
}

type MeResponse = { id: string; email: string; name: string };

function toUser(me: MeResponse): User {
  return { id: me.id, email: me.email, name: displayName(me.name, me.email) };
}

export async function hydrateSession(): Promise<void> {
  try {
    const me = await api<MeResponse>('/auth/me');
    session.set({ user: toUser(me), ready: true });
  } catch {
    session.set({ user: null, ready: true });
  }
}

export async function signIn(email: string, password: string): Promise<void> {
  await api('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) });
  const me = await api<MeResponse>('/auth/me');
  session.set({ user: toUser(me), ready: true });
}

export async function signOut(): Promise<void> {
  try {
    await api('/auth/logout', { method: 'POST' });
  } finally {
    session.set({ user: null, ready: true });
  }
}

export async function updateDisplayName(name: string): Promise<void> {
  const me = await api<MeResponse>('/auth/me', {
    method: 'PATCH',
    body: JSON.stringify({ name: name.trim() })
  });
  session.set({ user: toUser(me), ready: true });
}
