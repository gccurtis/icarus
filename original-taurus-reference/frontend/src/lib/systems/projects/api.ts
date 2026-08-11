import { get } from 'svelte/store';
import { api } from '$data/api';
import { session, displayName } from '$data/session';
import type { Role, Member, MemberSummary, ShareLink, IconColor, Visibility, Project } from './types';
import { ICON_COLORS } from './types';
import { projects } from './store';

function toUiRole(r: string): Role {
  return r === 'edit' ? 'editor' : r === 'read' ? 'viewer' : 'owner';
}

function toOmegaRole(r: Role): string {
  return r === 'editor' ? 'edit' : r === 'viewer' ? 'read' : 'owner';
}

export function currentUserId(): string {
  return get(session).user?.id ?? 'u_me';
}

function selfMember(role: Role): Member | null {
  const u = get(session).user;
  return u ? { id: u.id, name: u.name, email: u.email, role } : null;
}

type ApiMemberSummary = { items?: { userId: string; name: string; avatarUrl?: string }[]; total?: number };
type ApiProject = { id: string; name: string; role: string; icon: string; purpose: string; visibility: string; createdAt?: string; updatedAt?: string; members?: ApiMemberSummary };
type ApiMember = { userId: string; name: string; email: string; role: string };

function toMemberSummary(m: ApiMemberSummary | undefined): MemberSummary {
  return {
    items: (m?.items ?? []).map((it) => ({ userId: it.userId, name: it.name, avatarUrl: it.avatarUrl || undefined })),
    total: m?.total ?? 0
  };
}

/**
 * An Omega timestamp as epoch ms, or undefined when absent/unparseable.
 *
 * Omega sends `createdAt` as RFC3339 and `updatedAt` as RFC3339Nano on every
 * project response (`oneView` delegates to `views`, so a POST/PATCH carries them
 * too). Undefined rather than 0 keeps "we don't know" distinct from 1970 for the
 * Properties lens, which shows a dash.
 */
function toTime(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const ms = Date.parse(value);
  return Number.isFinite(ms) ? ms : undefined;
}

function toIcon(icon: string): IconColor {
  return (ICON_COLORS as string[]).includes(icon) ? (icon as IconColor) : 'focus';
}
function toVisibility(v: string): Visibility {
  return v === 'link' ? 'link' : 'private';
}

function toProject(p: ApiProject): Project {
  const role = toUiRole(p.role);
  const self = selfMember(role);
  return {
    id: p.id,
    name: p.name,
    role,
    members: self ? [self] : [],
    memberSummary: toMemberSummary(p.members),
    visibility: toVisibility(p.visibility),
    icon: toIcon(p.icon),
    purpose: p.purpose,
    createdAt: toTime(p.createdAt),
    updatedAt: toTime(p.updatedAt)
  };
}

function toMember(m: ApiMember): Member {
  return { id: m.userId, name: displayName(m.name, m.email), email: m.email, role: toUiRole(m.role) };
}

export async function fetchProjects(): Promise<void> {
  const res = await api<{ projects: ApiProject[] }>('/projects');
  projects.set(res.projects.map(toProject));
}

export async function createProject(name: string): Promise<string> {
  const p = await api<ApiProject>('/projects', { method: 'POST', body: JSON.stringify({ name }) });
  projects.update((all) => [toProject(p), ...all]);
  return p.id;
}

export async function deleteProject(id: string): Promise<void> {
  await api(`/projects/${id}`, { method: 'DELETE' });
  projects.update((all) => all.filter((p) => p.id !== id));
}

export async function leaveProject(id: string): Promise<void> {
  await api(`/projects/${id}/leave`, { method: 'POST' });
  projects.update((all) => all.filter((p) => p.id !== id));
}

export async function openProject(id: string): Promise<void> {
  await api('/session/project', { method: 'POST', body: JSON.stringify({ projectId: id }) });
}

function linkUrl(token: string): string {
  const base = typeof location !== 'undefined' ? location.origin : 'https://taurus.app';
  return `${base}/join/${token}`;
}

type ApiLink = { role: string; token: string };
function toShareLink(l: ApiLink): ShareLink {
  return { role: l.role === 'edit' ? 'edit' : 'read', token: l.token, url: linkUrl(l.token) };
}

export async function fetchLinks(projectId: string): Promise<ShareLink[]> {
  const res = await api<{ links: ApiLink[] }>(`/projects/${projectId}/links`);
  return res.links.map(toShareLink);
}

export async function rotateLink(projectId: string, role: 'read' | 'edit'): Promise<ShareLink> {
  const l = await api<ApiLink>(`/projects/${projectId}/links/${role}`, { method: 'PUT' });
  return toShareLink(l);
}

export async function disableLink(projectId: string, role: 'read' | 'edit'): Promise<void> {
  await api(`/projects/${projectId}/links/${role}`, { method: 'DELETE' });
}

export async function joinByToken(token: string): Promise<string> {
  const p = await api<ApiProject>(`/join/${token}`, { method: 'POST' });
  await fetchProjects();
  return p.id;
}

export async function updateProject(
  id: string,
  changes: { name?: string; icon?: IconColor; visibility?: Visibility; purpose?: string }
): Promise<void> {
  const p = await api<ApiProject>(`/projects/${id}`, { method: 'PATCH', body: JSON.stringify(changes) });
  projects.update((all) => all.map((x) => x.id === id ? { ...x, name: p.name, icon: toIcon(p.icon), visibility: toVisibility(p.visibility), purpose: p.purpose, updatedAt: toTime(p.updatedAt) ?? x.updatedAt } : x));
}

export async function fetchMembers(projectId: string): Promise<Member[]> {
  const res = await api<{ members: ApiMember[] }>(`/projects/${projectId}/members`);
  return res.members.map(toMember);
}

export async function addMember(projectId: string, email: string, role: Role): Promise<Member> {
  const m = await api<ApiMember>(`/projects/${projectId}/members`, { method: 'POST', body: JSON.stringify({ email: email.trim(), role: toOmegaRole(role) }) });
  return toMember(m);
}

export async function setMemberRole(projectId: string, userId: string, role: Role): Promise<void> {
  await api(`/projects/${projectId}/members/${userId}`, { method: 'PATCH', body: JSON.stringify({ role: toOmegaRole(role) }) });
}

export async function removeMember(projectId: string, userId: string): Promise<void> {
  await api(`/projects/${projectId}/members/${userId}`, { method: 'DELETE' });
}

// --- project names / formulas -----------------------------------------------

export type NamesEntry = {
  name: string;
  type: 'null' | 'number' | 'text' | 'logic' | 'table' | 'function';
  value: unknown;
  source?: string;
  createdAt: string;
  updatedAt: string;
};

export async function fetchProjectNames(projectId: string): Promise<NamesEntry[]> {
  const res = await api<{ names: NamesEntry[] }>(`/projects/${projectId}/names`);
  return res.names;
}

/**
 * Omega's formula values are TAGGED, not bare JSON scalars. Verified against
 * `formula.Value.UnmarshalJSON` and a live backend, the envelope requires:
 *
 * - `kind` — one of `null` / `number` / `text` / `logic` (for scalars);
 * - exactly the ONE payload field that kind allows, and no other;
 * - `shape`, which is **mandatory** and must equal the payload's own shape:
 *   `if (raw.Shape == nil || *raw.Shape != decoded.Shape())` → error. Every
 *   scalar is a 1×1, so `{ fields: 1, rows: 1 }`.
 *
 * A number is a STRING, because formula arithmetic is exact rational and must
 * never round-trip through a binary float.
 *
 * Sending a bare scalar (`42`, `"text"`, `true`) — which is what this did — is
 * rejected as `400 invalid JSON body` every single time, so saving a literal
 * name value could never have worked.
 */
const SCALAR_SHAPE = { fields: 1, rows: 1 };

export function taggedValue(value: unknown): Record<string, unknown> {
  const shape = { ...SCALAR_SHAPE };
  if (value === null || value === undefined) return { kind: 'null', shape };
  if (typeof value === 'boolean') return { kind: 'logic', shape, logic: value };
  if (typeof value === 'number') {
    // A non-finite number has no exact rational spelling; store it as null
    // rather than sending something Omega will reject.
    if (!Number.isFinite(value)) return { kind: 'null', shape };
    return { kind: 'number', shape, number: String(value) };
  }
  return { kind: 'text', shape, text: String(value) };
}

export async function setNameValue(projectId: string, name: string, value: unknown): Promise<void> {
  await api(`/projects/${projectId}/names/${encodeURIComponent(name)}/value`, {
    method: 'PUT',
    body: JSON.stringify(taggedValue(value))
  });
}

export async function setNameFunction(projectId: string, name: string, source: string): Promise<void> {
  await api(`/projects/${projectId}/names/${encodeURIComponent(name)}/function`, {
    method: 'PUT',
    body: JSON.stringify({ source })
  });
}

export async function evaluateExpression(
  projectId: string,
  source: string
): Promise<{ value: string; type: string }> {
  return api<{ value: string; type: string }>(`/projects/${projectId}/evaluate`, {
    method: 'POST',
    body: JSON.stringify({ source })
  });
}

export async function deleteProjectName(projectId: string, name: string): Promise<void> {
  await api(`/projects/${projectId}/names/${encodeURIComponent(name)}`, { method: 'DELETE' });
}
