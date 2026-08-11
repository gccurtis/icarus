import type { ResourceKind } from '$data/resources';

export type Role = 'owner' | 'editor' | 'viewer';
export type Visibility = 'private' | 'link';
export type Member = { id: string; name: string; email: string; role: Role };
/** One entry in a project's bounded member summary (Omega `memberSummaryJSON` — public
 *  fields only, no email/role). */
export type MemberSummaryItem = { userId: string; name: string; avatarUrl?: string };
/** The avatar-cluster projection returned with each project on `GET /projects`: a small
 *  stack of members plus the exact total. */
export type MemberSummary = { items: MemberSummaryItem[]; total: number };
export type ShareLink = { role: 'read' | 'edit'; token: string; url: string };
export type IconColor = 'action' | 'intel' | 'focus' | 'attention' | 'success' | 'danger' | 'neutral';
export const ICON_COLORS: IconColor[] = ['action', 'intel', 'focus', 'attention', 'success', 'danger', 'neutral'];

export type Project = {
  id: string;
  name: string;
  role: Role;
  members: Member[];
  /** The bounded avatar-cluster summary shown on the projects list (real, from
   *  `GET /projects`). Distinct from `members`, the full roster loaded on demand. */
  memberSummary: MemberSummary;
  visibility: Visibility;
  icon: IconColor;
  purpose: string;
  /** When the project was created (epoch ms). Omega sends it on every project
   *  response; optional here because the shell synthesizes a placeholder project
   *  from the route before `GET /projects` has answered. */
  createdAt?: number;
  /** Newest of the project's own update time and its latest activity (epoch ms) —
   *  Omega maxes the two, so this is "last touched", not "last renamed". */
  updatedAt?: number;
};

export type ActivityAction = 'created' | 'edited' | 'renamed' | 'deleted';
export type ActivityActor = { id: string; name: string };
export type ActivityTarget = { id: string; name: string; kind: ResourceKind };
export type ActivityEvent = {
  id: string;
  actor: ActivityActor;
  action: ActivityAction;
  target: ActivityTarget;
  occurredAt: number;
};
export type ActivityPage = { events: ActivityEvent[]; nextCursor: string | null };
export type PublicUser = { id: string; name: string };
export type ResourceMetadata = {
  id: string; name: string; kind: ResourceKind;
  createdAt: number; updatedAt: number;
};

// Icon color maps (Tailwind literal classes)
const ICON_DOT: Record<IconColor, string> = {
  action: 'bg-action', intel: 'bg-intel', focus: 'bg-focus', attention: 'bg-attention',
  success: 'bg-success', danger: 'bg-danger', neutral: 'bg-muted'
};
const ICON_TILE: Record<IconColor, string> = {
  action: 'bg-action/12 text-action', intel: 'bg-intel/12 text-intel', focus: 'bg-focus/12 text-focus',
  attention: 'bg-attention/12 text-attention', success: 'bg-success/12 text-success',
  danger: 'bg-danger/12 text-danger', neutral: 'bg-panel text-muted'
};
export const iconDotClass = (c: IconColor) => ICON_DOT[c];
export const iconTileClass = (c: IconColor) => ICON_TILE[c];
