# Design system and interaction contract

## Design doctrine

Taurus uses an “angelic citadel / AstroTech” language: calm, luminous, precise,
elevated, and easy to think in. It should not read as neon cyberpunk, game UI,
or decorative futurism. Hierarchy comes from geometry, spacing, typography,
material contrast, and restrained semantic light.

The center work surface is sacred. Complexity is disclosed through permanent
destinations, Context, Inspector, Quarterback, detail views, and Settings rather
than filling the editor with controls.

## Shell geometry baseline

These are starting desktop dimensions subject to responsive and accessibility
validation, not unchangeable pixel law.

| Surface | Default | Range/behavior |
| --- | ---: | --- |
| Top chrome row | 44 px | Product/Project identity, global actions, session |
| Navigation/tab row | 36 px | Permanent destinations and Resource tabs |
| Context/Inspector icon rail | 44 px | Persistent labeled icon actions |
| Context panel | 280 px | Resizable 220–380 px |
| Inspector panel | 320 px | Resizable 280–440 px |
| Status line | 24 px | Canonical version/state, sync/operation status |
| Quarterback compact | 48 px | Preserves primary work surface |
| Quarterback engaged | 88–220 px | Expands upward within the stage |

At narrow widths, panels become deliberate drawers/sheets with focus handling;
they do not merely squeeze the Resource to unusability.

## Information architecture

- **Top chrome:** product/session, Project identity, routing and global account
  entry.
- **Permanent Project destinations:** Overview, Data, Agents.
- **New Tab:** transient launcher, never a persisted destination.
- **Resource tabs:** durable per-User/per-Project references to open Resources.
- **Context:** selection-aware nearby material, sources, activity, suggestions,
  and quick operations.
- **Inspector:** precise properties, versions, provenance, decisions, bindings,
  history, and advanced actions.
- **Quarterback:** Ask/Action/Plan interaction over the currently disclosed
  scope, target, consequence, verification, and destination.
- **Status:** explicit current/stale/resolving/needs-review/failed/offline and
  canonical-version feedback.

Context and Inspector show projections/commands from the owning backend
capability. They never accumulate hidden authoritative copies.

## Semantic states

Every meaningful state uses text/icon/structure in addition to color:

| Semantic | Visual tendency | Required label examples |
| --- | --- | --- |
| Focus/live work | Cyan | Focused, Running, Live |
| Intelligence/Agent attribution | Violet | Generated, Agent, Inference |
| Review/stale/attention | Amber | Needs review, Stale, Waiting approval |
| Accepted/current/success | Green | Current, Accepted, Completed |
| Failure/destructive | Red | Failed, Revoked, Delete |

Resource-derived content preserves authored versus Formula/Prompt/Agent
provenance. Last-good output remains visible with a stale/error label instead of
disappearing or appearing current.

## Quarterback

The Quarterback remains compact during ordinary reading/editing and expands
only for deliberate interaction. Before submission it shows:

- Ask, Action, or Plan mode;
- current User/Agent/Persona attribution;
- Project and selected Resource/component scope;
- target and proposed destination;
- expected consequence and whether it can mutate;
- verification/review/approval behavior;
- provider/budget disclosures required by policy; and
- current evidence/context controls.

It never becomes an unscoped second Chat panel inside every editor. Ask cannot
quietly mutate; Action/Plan cannot hide consequence or destination.

## Resource-family interaction

### Documents

Print-aware page geometry, outline, semantic blocks, stable selections,
comments/Notes, Prompt/Formula provenance, source/evidence inspection, conflict
and refresh diff, and keyboard-complete rich editing.

### Workbooks

Virtualized grid plus accessible cell/range/table representation; Formula/name/
provenance inspection; deterministic navigation/editing; visible calculation/
stale/errors; non-grid alternatives for charts and complex ranges.

### Decks

Slide filmstrip/outline, stage, layout/theme, element tree, notes, exact
geometry, binding/provenance, rendered preview, and keyboard-accessible element
selection/position/property editing.

### Boards

Canvas plus semantic element/connector tree and property editing alternative;
whiteboard/dashboard modes, zoom/pan, layers/frames, binding/stale state, and
non-pointer-only creation/manipulation.

### Chats

Durable thread/branch lineage, author/inference/evidence attribution,
attachments, referenced/unreferenced state, spawned outputs/tasks, and promote
actions with explicit target/consequence.

### Files/Data/Agents

Clear processing/provenance/current-state tables and detail views; no facade
actions for backend capabilities that do not exist. Long operations show
durable job status and survive navigation/reload.

## Disclosure and destructive behavior

- Primary/common actions remain visible.
- Secondary actions may use menus, but never hover/right-click only.
- Advanced properties appear in Inspector with scope and effective version.
- Destructive/high-risk actions show exact object/name, consequence, affected
  users/resources, reversibility/retention, required authority, and durable
  status; name confirmation or step-up is used where policy requires.
- Errors state what happened, whether canonical state changed, and the safe
  recovery action.

## Accessibility baseline

- complete keyboard access and logical order;
- strongly visible focus and focus restoration;
- semantic landmarks, names, roles, descriptions, and live announcements;
- no essential right-click, hover, drag, gesture, color, animation, or shortcut;
- 200% zoom and reflow without hidden primary behavior;
- forced-colors/high-contrast support;
- reduced-motion behavior with no essential information in animation;
- adequate touch/pointer target sizes and spacing;
- screen-reader alternatives for grids, canvases, charts, slide scenes, and
  visual provenance;
- accessible conflicts, stale state, progress, approval, and errors; and
- user-scoped appearance/accessibility preferences honored before shell paint
  where feasible.

## Motion and performance

Motion explains spatial continuity, focus, or state; it is short, interruptible,
and reduced/removed under preference. Loading uses truthful skeleton/progress
only when state is known. Large Resources virtualize bounded projections while
retaining keyboard/assistive access and canonical version feedback.

Performance budgets cover shell startup, route transition, input latency,
scroll/pan/zoom, grid/canvas virtualization, Resource render, large conflicts,
and Quarterback streaming. Optimistic UI cannot report a canonical commit
before backend acknowledgement.

## Component families

The design system should supply accessible primitives for application frame,
navigation/tabs, panels/rails, command controls, fields, menus, dialogs/sheets,
tables/trees, badges/status, toasts/inline recovery, progress/jobs, comments/
Notes, evidence/provenance, diffs/review, empty/unsupported states, and Resource
mount frames. Resource editors own their specialized editing primitives.

## Proof

- token/component documentation and visual fixtures;
- keyboard/focus/screen-reader component tests;
- automated accessibility plus manual assistive-technology audits;
- 200% zoom, forced colors, reduced motion, narrow/large viewport matrices;
- no pointer-only or color-only primary action;
- browser tests for late-response fencing, conflicts, stale/last-good,
  offline/outage, sign-out, and durable job continuity;
- representative large-Resource performance measurements; and
- visual regression of primitives and canonical journeys without treating pixel
  snapshots as semantic correctness.

## Source grounding

- [Taurus Design System Index](https://app.notion.com/p/392b6410e50281f1a374fa89a941626a)
- [Original Taurus Product Vision](https://app.notion.com/p/377b6410e50280c69389e5763939cbf0)
- [SOL X Master Blueprint](https://app.notion.com/p/39ab6410e5028158b555c9a34752e292)
- [Omega experience map](experience-map.md)
- [Web construction stage](../implementation/13-web-client.md)
