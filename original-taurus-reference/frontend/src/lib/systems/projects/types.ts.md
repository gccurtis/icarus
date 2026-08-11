# src/lib/systems/projects/types.ts — breakdown

Companion to [types.ts](types.ts). The type vocabulary for the projects system — roles,
visibility, members, share links, the project shape, and the activity feed — plus the
icon-color palette and the Tailwind class maps that render it.

## Imports

### Import the resource-kind union used by activity targets

```ts
import type { ResourceKind } from '$data/resources';

```

`ResourceKind` is the shared enumeration of resource types (documents, etc.) defined in the
data layer; it is reused here to type the `kind` of an activity target and a resource's
metadata. The blank line separates the import from the first type.

## Project and sharing types

### Roles, visibility, members, share links, and the icon-color palette

```ts
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

```

`Role` is the UI-facing permission level (mapped to/from Omega's wire names in `api.ts`), and
`Visibility` says whether a project is private or reachable by share link. `Member` and
`ShareLink` are the flattened UI shapes for a collaborator and a sharing token.
`MemberSummaryItem` and `MemberSummary` are the bounded avatar-cluster projection Omega
returns with each project on `GET /projects` (its `memberSummaryJSON`): a small stack of
public-only member fields — no email or role — plus the exact `total`, distinct from the
full `members` roster. `IconColor`
is the closed palette a project icon may use, and `ICON_COLORS` is its runtime array form so
`api.ts` can validate an incoming icon string against the allowed set.

### The Project shape

```ts
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

```

`Project` is the fully-resolved UI model stored in the `projects` store: identity (`id`,
`name`), the current user's `role`, the known `members`, the bounded `memberSummary` avatar
cluster (real, from `GET /projects` — distinct from the on-demand full roster), sharing
`visibility`, the chosen `icon` color, and a free-text `purpose`. The blank line separates it
from the activity types.

The two timestamps are **epoch ms and optional**, and both facts are deliberate. Omega has always
sent them (`projectJSON.createdAt` as RFC3339, `updatedAt` as RFC3339Nano) — Alpha's edge type
simply dropped them until the context rail's Properties lens needed them, so this is a field
Alpha was already being given rather than a new backend ask. They are optional because
`ShellTopBar` synthesizes a placeholder `Project` from the route while `GET /projects` is still in
flight, and that object genuinely does not know them; `undefined` keeps "not known yet" distinct
from a `0` that would render as 1970. `updatedAt` is *not* a rename stamp — Omega maxes the
project's own update time against its latest activity, so it reads as "last activity" in the UI.

## Activity and resource types

### Activity actions, actors, targets, events, pages, public users, and resource metadata

```ts
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

```

These describe the activity feed and its lookups. An `ActivityEvent` records who
(`ActivityActor`) did what (`ActivityAction`) to which resource (`ActivityTarget`), with
`occurredAt` as a parsed numeric timestamp. `ActivityPage` is the cursor-paginated feed
response. `PublicUser` and `ResourceMetadata` are the shapes returned by the user- and
resource-lookup endpoints, both also carrying parsed numeric timestamps. The blank line
separates the type declarations from the icon class maps.

## Icon color class maps

### Tailwind literal-class lookups for icon dots and tiles, with accessor helpers

```ts
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
```

Tailwind can only see class names that appear as complete literals, so each `IconColor` maps
to fully-spelled utility strings rather than an interpolated `bg-${color}`. `ICON_DOT` is the
small solid swatch (a colored dot), and `ICON_TILE` is the larger tinted tile (a 12%-opacity
background with a matching text color). The two exported accessors, `iconDotClass` and
`iconTileClass`, are the public helpers components call to turn an `IconColor` into its class
string, keeping the raw maps private to this module.
