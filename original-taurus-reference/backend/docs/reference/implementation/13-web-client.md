# Stage 13 — Web client and design system

## Outcome

Build the accessible Svelte client as a replaceable synchronized projection of
the Product API: sign-in, Project selection, shell, Overview/Data/Agents/New
Tab, tabs/context/inspector/Quarterback, and Resource-family editors as their
backend contracts become available.

The normative interaction baseline is the [product design system](../product/design-system.md).

## Non-goals

- client-owned complete canonical Resource state
- direct provider/database/object-store calls
- `/dev` compatibility API
- one monolithic application component coordinating every domain
- hiding backend unsupported behavior behind clickable placeholders

## Toolchain selection

At this stage re-check official supported releases and choose the current Node
LTS, Svelte stable line, package manager, Vite, TypeScript, editor/grid/canvas
libraries, and testing/browser toolchain. Pin exact versions and record each
dependency purpose, license, security posture, and update path. Do not inherit
Nova pins without current review.

## Target tree and client architecture

```text
web/src/
  bootstrap/             session/provider/project entry
  routing/               route registry and typed params
  api/                   generated Product client and error mapping
  state/                 session/project generations and query coordination
  workspace/             durable shell/tab/panel projection
  screens/               sign-in, project selection, Overview, Data, Agents
  resources/
    documents/
    workbooks/
    decks/
    boards/
    chats/
    files/
  context/               rail/inspector projections and commands
  quarterback/           Ask/Action/Plan surface
  design/                tokens and accessible primitives
  realtime/              optional hint/resnapshot client
```

Generated transport types are the wire authority. Family view models remain
local projections; they do not redefine backend canonical models.

## Versioned client contracts and request flow

Generated OpenAPI types, operation versions and stable errors are the only
Product wire contract. Route params are typed stable IDs; stores hold bounded
projections plus observed canonical versions, never provider/SQL/internal
values. Bootstrap resolves session → Project list → selected Project/Cell →
workspace/Overview. Each screen request captures session, Project and request
generation; command results replace or reconcile against the returned
canonical version.

## Experience contract

- two-row top chrome with Project identity, route, tabs, and session controls;
- sacred central work stage;
- permanent Overview/Data/Agents destinations;
- transient New Tab and durable Resource tabs;
- selection-aware Context and Inspector;
- compact Quarterback that expands upward and always shows mode/scope/target/
  consequence/destination;
- explicit current/stale/resolving/failed-with-last-good/needs-review states;
- visible error recovery and canonical version/conflict handling.

The design language is calm, luminous, precise “angelic citadel/AstroTech,” not
neon cyberpunk. Semantic state uses labels and accessible styling, never color
alone.

### Project Overview and New Tab

Overview renders the complete Stage 03 section contract: editable description;
five create actions; unified catalog with upload/search/filter/sort/archive;
members; Activity/history; data health; Project Agent recommendations; and a
selection-aware Inspector. The first browser slice enables only sections whose
backend handlers are registered and visibly labels unavailable/degraded ones.

New Tab is a transient route/view. It offers Document/Workbook/Deck/Board
Templates, Chat starter/settings presets, File upload and authorized recent/
searched Resources. Create/open replaces it with the resulting Resource tab.
Launcher query/filter/selection/template/draft/upload interaction state never
enters Workspace persistence.

## Synchronization

Session, Project, Resource, and request generations fence asynchronous work.
Project switch/sign-out aborts old calls and discards late results. Mutation
responses converge to returned canonical versions. Realtime hints cause
authorized resnapshot/suffix reads; missed messages do not lose truth.

Editors maintain only bounded interaction state and pending command intent.
Offline behavior, if enabled, is family-specific and cannot claim a commit
until canonical backend acknowledgement.

Failures map to safe actionable states: unauthorized/not-found, stale/conflict,
unavailable/degraded, offline/retrying and integrity failure. Reload/resnapshot
is the recovery authority. Cached data is cleared on scope change; service
workers or local persistence, if later enabled, must be Project-keyed and
cannot display revoked content.

## Production and test composition

Production uses generated clients, secure cookie transport, real bootstrap and
only promoted backend descriptors. Mock Service Worker/test providers are
test-only and cannot enter production bundles. Component tests use deterministic
fixtures; promotion requires real browsers, identity/Project isolation,
network/outage/conflict, accessibility, responsive and performance evidence.

## Accessibility and input

- complete keyboard paths and visible focus;
- no essential right-click, hover, drag, or shortcut-only action;
- semantic landmarks/names/status announcements;
- focus management for dialogs, route changes, errors, and conflict/review;
- 200% zoom, responsive narrow layouts, forced colors, reduced motion;
- minimum target sizing and non-color state;
- screen-reader-accessible editor/grid/canvas alternatives appropriate to each
  family; and
- user appearance/accessibility preferences in Account scope.

## Proof matrix

- generated contract drift and strict TypeScript/Svelte checks;
- state/store unit tests including hostile late-response generations;
- component keyboard/focus/accessibility tests;
- browser journeys for sign-in/project/workspace and each promoted family;
- two tabs/two Users/two Projects isolation and canonical convergence;
- responsive/zoom/forced-colors/reduced-motion/screen-reader audits;
- conflict, stale, offline/outage, retry, sign-out/everywhere behavior;
- no secret/provider/SQL/internal error leakage;
- bundle/performance budgets and large Resource virtualization; and
- visual regression at the design-system primitives and critical screens.

## Completion boundary

Each screen is considered complete only with its real backend capability and
browser evidence. Unimplemented families remain clearly unavailable.

## Consequential decisions and source grounding

- **The client is a replaceable projection.** Backend canonical versions win;
  offline intent never masquerades as a commit.
- **Overview degrades by named optional section.** Authority/catalog/workspace
  failure blocks entry; an unavailable optional owner does not fabricate empty
  success.
- **New Tab stays transient.** Only the resulting Resource tab persists.

Grounding: [Workspace](../capabilities/workspace.md),
[Stage 03](03-workspace-resource-entry.md),
[design system](../product/design-system.md), and
[project-entry flow](../flows/project-entry.md).
