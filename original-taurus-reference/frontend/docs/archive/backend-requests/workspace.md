# Backend request — per-user workspace state

**Priority:** Medium · **Status:** ✅ **Shipped** (Omega `GET/PUT /workspace`; Alpha uses it with a localStorage fallback)
**Unblocked:** a user's workspace following them across devices/browsers — open tabs,
panel geometry, and what each panel is showing. Today all of it persists only in
`localStorage`, per project (`src/lib/data/workspace.ts`), so a new device starts cold.

## What the front-end needs

Store and return, **per user per project**, the shell state the cockpit already keeps:

```jsonc
{
  "tabs": [
    { "id", "title", "closeable", "kind", "resourceId": "…", "resourceKind": "document" }
  ], // resource fields are present on resource tabs; tabs stay in order
  "activeTabId": "…",
  "context":   { "width": 280, "collapsed": false, "section": "outline" },
  "inspector": { "width": 300, "collapsed": true,  "section": "details" }
}
```

The shape is already JSON-serializable and stable-id based (section ids and tab
descriptors are plain strings — a deliberate design constraint, see
`docs/plans/2026-07-21-panel-system-design.md` § Workspace-ready). Transient state
(selection, drafts, hover) is deliberately excluded and stays client-side.

## Proposed API (Omega owns the final shape)

```http
GET /workspace              -> 200 { ...the object above }   # scoped to session user + selected project
PUT /workspace              { ...the object above } -> 200   # replace whole-state; idempotent
```

Notes / open questions for Omega:

- **Whole-object replace is fine.** The client debounces and writes the full state;
  no per-field patching needed. Last-write-wins is acceptable for v1 (same user).
- **Scoping**: per user × per project, keyed off the session (`to_session` cookie +
  the selected project cell) — no ids needed in the path.
- **Tab identity**: the [Resource catalog](resources.md) has landed. Current resource
  tabs carry canonical `resourceId` and `resourceKind`; titles remain presentation
  data and a compatibility fallback for tabs persisted before ids existed.
- A `updatedAt` on the response would let the client skip redundant writes — optional.

## Front-end follow-up when this lands

Swap the localStorage load/persist inside `src/lib/data/workspace.ts` for
`GET`/debounced `PUT` (keep localStorage as an offline fallback/cache). Nothing else
changes — the shell and panel system consume the same store.
