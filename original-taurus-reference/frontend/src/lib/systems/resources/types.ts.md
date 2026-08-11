# src/lib/systems/resources/types.ts — breakdown

Companion to [types.ts](types.ts). The domain vocabulary for the resources system: the closed `ResourceKind` union, the `AccessScope` visibility shape, the `Resource` entity itself, plus a default-scope factory, the labeled kind catalog used by the UI, and a `toKind` narrowing helper that clamps arbitrary backend strings to a known kind.

## Resource kind vocabulary

### The closed union of resource kinds

```ts
export type ResourceKind = 'document' | 'spreadsheet' | 'slides' | 'chat' | 'general';

```

`ResourceKind` is the exhaustive set of kinds the cockpit understands. Only `document` is fully backed by Omega today; `spreadsheet`, `slides`, `chat`, and `general` are front-end concepts (some mock-only) that the rest of the system branches on. Making it a string-literal union means every `switch`/lookup over kinds is checked at compile time. The trailing blank line separates it from the access type.

## Access scope

### A resource's project-wide-or-restricted visibility

```ts
/** A resource's access scope (Omega `AccessScope`). `projectWide` = every project
 *  member can see it; otherwise only the owner plus the listed users/orgs. */
export type AccessScope = { projectWide: boolean; orgIds: string[]; userIds: string[] };

```

`AccessScope` mirrors Omega's own `AccessScope`: when `projectWide` is true, every project member sees the resource and the id lists are irrelevant; when false, visibility is restricted to the owner plus the enumerated `userIds` and `orgIds`. Modeling both the flag and the lists lets the settings UI toggle between "everyone" and "restricted" without losing a previously entered grant.

## The Resource entity

### The core resource record surfaced to the UI

```ts
export type Resource = {
  id: string;
  name: string;
  kind: ResourceKind;
  updatedAt: number;
  createdAt: number;
  /** Rendered at the top of the table when true (a per-project pin). */
  pinned: boolean;
  /** Who can see the resource within the project (Omega `AccessScope`). */
  access: AccessScope;
  /** The resource owner's user id; only the owner may change access. */
  creatorId?: string;
};

```

`Resource` is the UI-facing shape (the API layer maps Omega's raw record onto it). `updatedAt` and `createdAt` are numeric epochs — parsed from the backend's ISO strings at the boundary — so components can sort and format them directly. `pinned` is a per-project pin the client renders first; `access` carries the visibility scope; and `creatorId` is optional because only the owner may edit access, and an absent creator is treated optimistically. The trailing blank line separates it from the default-scope factory.

`createdAt` was added for the Overview inspector's resource lens. Omega has always sent it on the catalog page and `toResource` simply dropped it, so keeping it costs nothing on the wire and spares the lens a second per-resource fetch to fill one line. The two locally-constructed `Resource`s in `api.ts` (the slides mock and the create-from-template path) stamp `Date.now()`, since neither has a server-issued creation time to quote.

## Default access factory

### Construct the default project-wide scope

```ts
/** A project-wide scope with no user/org restrictions (Omega's default). */
export const projectWideAccess = (): AccessScope => ({ projectWide: true, orgIds: [], userIds: [] });

```

`projectWideAccess` returns a fresh, unrestricted scope matching Omega's default. It is a factory (not a shared constant) so each caller gets its own arrays, avoiding accidental mutation aliasing when a new resource's access is later edited in place. Used when creating mock resources and as the reset target in the access editor.

## Kind catalog

### The labeled, ordered list of kinds for the UI

```ts
export const RESOURCE_KINDS: { id: ResourceKind; label: string }[] = [
  { id: 'document', label: 'Documents' },
  { id: 'spreadsheet', label: 'Sheets' },
  { id: 'slides', label: 'Slides' },
  { id: 'chat', label: 'Chats' },
  { id: 'general', label: 'General' }
];

```

`RESOURCE_KINDS` pairs each kind id with a human label and fixes their display order. It drives the filter dropdown and any kind pickers, keeping the plural, presentation-friendly labels (e.g. `spreadsheet` → "Sheets") out of the components and in one authoritative list. The trailing blank line separates it from the narrowing helper.

## Narrowing a raw kind string

### Clamp an arbitrary string to a known kind

```ts
const KNOWN_KINDS = new Set<string>(RESOURCE_KINDS.map((k) => k.id));
export function toKind(kind: string): ResourceKind {
  return KNOWN_KINDS.has(kind) ? (kind as ResourceKind) : 'general';
}
```

`KNOWN_KINDS` is a `Set` of the catalog's ids, built once for O(1) membership tests. `toKind` is the safe cast used at the API boundary: any backend `kind` string that is recognized passes through (narrowed to `ResourceKind`), and anything unknown falls back to `general` rather than corrupting the union. This keeps a future or misconfigured backend kind from crashing the kind-driven UI.
