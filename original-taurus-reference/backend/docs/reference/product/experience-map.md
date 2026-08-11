# Product experience and feature map

This page connects visible product behavior to the backend capability that owns
truth. It is a coverage map, not a frontend specification.

| Surface | User-visible behavior | Canonical owner |
| --- | --- | --- |
| Sign-in and account security | Google/Microsoft OIDC, enterprise OIDC/SAML, session/device continuity, passkey/TOTP step-up, governed recovery, current-device and everywhere sign-out | Control identity, security and sessions |
| Project entry | Search/filter/group/sort, pin, create, select, rename, share/link, leave, duplicate, archive, restore and delete Projects according to authority | Control projects, placement, provisioning |
| Project shell | Overview, Data, Agents, New Tab, Resource tabs, private Resource/Data favorites, panels and command surfaces | User workspace capability plus Host routing |
| Document | Structured authoring, rich blocks, prompt blocks, sources, comments, templates, render/export | Documents for content/anchor semantics; Collaboration for comment/private-Note records |
| Workbook | Worksheets, cells, ranges, tables, formula bindings, analysis, import/export | Workbooks plus Formula |
| Deck | Slides, layouts, elements, speaker notes, themes, declarative transitions/animations with reduced-motion fallback, sources and presentation/export | Decks |
| Board | Freeform whiteboard and dashboard canvases, shapes, connectors, embeds, views | Boards |
| Chat | Threaded/branched Project conversation, attachments, grounded replies, static/standing SavedOutputs with revision history, governed delete/redact and promoted outputs | Chats |
| Files | Multi-file/folder Upload Batches, collisions/retries, immutable versions, metadata, previews, extraction, source registration and connector intake | Files, Sources, Connectors |
| Data | Browse structured data objects, named tables, sources, corpora, and derived outputs | Data catalog plus family owners |
| Knowledge | Search and retrieve authorized exact-version artifacts; expose staleness | Knowledge |
| Prompt resolution | Plan, retrieve, reason, decide, generate, seal evidence, refresh, pause/resume | Resolution using Knowledge and Intelligence |
| Formula | Typed deterministic expressions, named formulas/tables, dependency evaluation | Formula |
| Agents | Define immutable Instructions, Personas, declared triggers and Routines; plan/retry/query Tasks and attempts; use a policy-shaped tool catalog; propose/review/resume bounded work | Agents |
| History and review | Inspect attributed Resource/component history and safe family diffs; review Proposal/ChangeGroup rows; preview and request owner-specific revert/compensation | Change control coordinates; each Resource family owns canonical history, diff and inverse/compensation meaning |
| Context and inspector | Selection-aware details, sources, history, decisions, properties, actions | Workspace projection of owning capabilities |
| Activity | Human-readable project actions and task progress | Activity projection |
| Notifications | Needs action, mentions/replies, Agent/task work, data/refresh, system/Project and recommendation attention; read, dismiss, snooze and delivery preferences | Collaboration notification records over owner SemanticFacts; source owners remain canonical |
| Search | Authorized search across Resources, content, sources, and activity | Search projection over family-owned truth |
| Import/export | Office formats, Markdown/JSON, native Taurus packages, Project archive | Translation and each Resource family |
| Admin | User/Organization policy, enterprise identity, authenticators/recovery, entitlement, subscription/usage reconciliation, provider policy, security, sharing and Control/Project Audit views | Control and operations surfaces |

## Permanent destinations and tabs

Overview, Data, and Agents are permanent Project destinations. New Tab is
transient. Resource tabs are durable per User and Project and may point to any
openable Resource family. Selection, hover, incomplete launcher state, pending
requests, and live clients are transient and must not enter a workspace
snapshot.

## Contextual interaction

The context rail and inspector do not own hidden copies of Resource state. They
request bounded projections from the selected Resource and expose operations
the owning capability supports. For example, a selected Document prompt block
can expose evidence, provider usage, refresh, decision, and source-version
details; a workbook range can expose formula and provenance details.

History and review surfaces show the exact actor/delegator, reason, owner
version, family-rendered diff, verification and Task/Proposal/ChangeGroup
lineage. Undo begins with a no-effect preview. It may return an owner-specific
inverse, a compensation, an explicit conflict, or not-revertible; accepting it
creates a new attributable owner command. It never removes history or silently
restores an old snapshot. A multi-Resource group exposes each applied,
accepted, rejected, reverted, conflicted and uncompensated row.

## Attention and notification experience

The global inbox is useful but optional: a person can keep working without
opening it. Its hierarchy is ambient, actionable, time-sensitive, then blocking
only for security, integrity, required approval or an irreversible decision.
Success generally confirms in the changed surface rather than creating a toast;
recommendations are never blocking.

Every notification names Project, subject, reason, time, current attention
state and a safe destination without copying sensitive source content. Opening
or acting rechecks current authorization. Revoked access removes the summary/
destination rather than leaking stale cached content. Read, dismiss and snooze
change only the recipient's delivery record. Preferences cover category,
channel, quiet hours and Project scope; mandatory security messages follow
Control policy. In-product is the default channel. Email or another external
channel is enabled only after explicit consent, verification, minimum-content
templates, retry/dead-letter behavior and an expiring authenticated route are
implemented and proven.

Notifications, Activity, Audit, family-owned canonical history, Tasks and
Recommendations remain separate. A committed redacted `SemanticFact` may inform Activity and a
Notification independently, but replaying Activity cannot redeliver mail and a
notification cannot authorize a Product action. Repetitive Task/job/batch
progress coalesces into one row; reconnect/resync deduplicates rather than
flooding the User.

## Quarterback interaction

Ask, Action, and Plan are interaction modes over explicit backend operations:

- **Ask** returns grounded information without changing user-visible canonical
  Product content or workflow state. It cannot create or change a Resource,
  Task, Activity item, Memory entry, `SemanticFact`, or tool effect; saving an
  answer is a separate explicit command. A real provider call may durably
  reserve and settle usage, retain a minimized route receipt or short-lived
  continuation, consume an exact one-use metering permit, and append required
  metering Audit. Those accounting records cannot authorize or masquerade as a
  Product effect. A deterministic local Ask may be literally zero-write.
- **Action** invokes one bounded command and reports the resulting canonical
  version or proposal.
- **Plan** creates an inspectable multi-step execution plan whose steps can run,
  pause, resume, fail, or require approval.

The Quarterback is not an alternate authority path. It uses the same current
User, Project, entitlement, capability, and version checks as direct UI
operations; Action/Plan effects also use the same permits and required Audit.
Ask's metering authority is narrower than Product mutation authority and can
be used only for the exact admitted call's accounting lifecycle.

## Capability completion standard

A visible feature is not complete merely because a screen exists. Completion
requires:

1. a backend-owned canonical model;
2. explicit versioned commands and queries;
3. authorization and Project scoping;
4. persistence and concurrency behavior;
5. deterministic headless execution or rendering;
6. stable errors and retry semantics;
7. attribution, provenance, and required Audit where applicable;
8. browser behavior that converges to canonical state; and
9. live evidence appropriate to its production risk.
