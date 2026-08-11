# Stage 10 — Boards and Chats

## Outcome

Build two remaining primary Resource families without forcing them into one
model: Boards for freeform whiteboard/dashboard canvases and Chats for durable
Project/Resource conversation, grounded answers, attachments, and promoted
outputs.

## Non-goals

- one shared Board/Chat aggregate or concurrency protocol
- browser canvas, viewport, selection, presence or chat draft as canonical state
- comment/private Note records inside either Resource family
- a Chat Template model, catalog, native Template package or Template import/
  export; Chat may expose only starter/settings presets
- model/provider clients or privileged Agent storage paths inside either family

## Target tree and files

```text
internal/
  capabilities/resources/{boards,chats}/
  capabilities/resources/chats/{messages,savedoutputs}/
  cell/handlers/{boards,chats}/
  cell/handlers/chats/{messages,savedoutputs,resolution}/
  cell/handlers/{boards,chats}/mysql/
  wiring/{testing,development,production}/{boards,chats}.go
migrations/project/*_{boards,chats}.sql
api/openapi/product-v1.yaml
test/{integration,recovery,golden}/{boards,chats}/
```

## Versioned contracts and schemas

Register the exact operation tables in [Boards](../capabilities/boards.md#commands-and-queries)
and [Chats](../capabilities/chats.md#commands-and-queries), with no shared
generic payload. Board schemas version mode/scene/object/geometry/binding/render
and Board Template state. Chat schemas version conversation/branch/message/
reference/attachment/lineage, deletion/redaction, SavedOutput/OutputRevision/
ResolutionMountRef and starter-preset refs; there is no Chat Template
schema. Both version family-native Collaboration anchors only. Board Template
publication and instantiation register the five `boards.templates.*.v1`
operations from
[Translation and Templates](../capabilities/translation-and-templates.md#family-templates);
Chat exposes no corresponding Template operations.

## Board construction

### Canonical state

- Whiteboard (infinite) or Dashboard (bounded/grid/printable) mode;
- page/grid/theme/view definitions independent of one browser viewport;
- stable objects: text, sticky, image, connector, ink, table, chart, metric,
  frame, group, embedded Resource reference;
- geometry, transforms, style, layers/z-order, endpoints, grouping;
- Formula/Data/Resolution/asset bindings with last-good state;
- family-native Collaboration anchors/rebase semantics, provenance, Board
  templates, history and render versions. Collaboration owns comment/private
  Note records and commands in Stage 12.

### Operations

Create/from template or exact-version same-Project duplicate under a new
independent Board identity; change mode/page/grid/theme; add/update/delete/move/resize/
rotate/group/order/align/distribute objects; duplicate a bounded exact
element/connector subgraph with fresh IDs and explicit external-edge policy;
connect endpoints; edit authored
content; bind/refresh values; validate/rebase Collaboration anchors; extract authored text/image
descriptions; render bounded region/whole Board; deterministic JSON outline.
`boards.render.v1` is the bounded read-only surface. An over-bound render
returns `board_render_async_required` without side effects;
`boards.render_jobs.request.v1` freezes and admits the exact durable render and
`boards.render_jobs.status.get.v1` observes typed result metadata.

Template preview/publish/plan/instantiate/list are Board-family operations.
They validate Board mode, theme, asset/binding requirements, stripping and
lineage without delegating recipe ownership to Translation.

### Concurrency

Stable object/property identities allow disjoint editing. Geometry changes may
coexist when they target different objects/properties; delete-versus-edit,
group membership, connector endpoint, and simultaneous ink/object replacement
need explicit conflict rules. Viewport/pan/selection/presence are transient and
never canonical Board state.

## Chat construction

### Canonical state

- Chat identity and Project/optional Resource scope;
- ordered stable messages with User/Agent/delegator provenance;
- authored content, references/attachments, exact source/evidence links;
- edit/delete policy, branch/regeneration lineage, referenced flag;
- Persona/steering/context-setting references and versions;
- spawned Resolution/artifact/Task/Resource links; and
- static/standing SavedOutputs, immutable Output revisions, exact
  `chat.saved_output/{SavedOutputID}` Resolution mount references, current/
  last-good/User-edit pointers;
- distinct governed deletion and privileged redaction records; and
- history and starter/settings-preset reference. Chat has no Template model;
  reactions or other collaboration records require later explicit acceptance.

### Operations

Create blank/from a starter/settings preset or exact-branch/cutoff same-Project
duplicate under a new independent Chat identity; open/archive; append/edit; ordinary
governed delete or separately privileged redact; branch/regenerate/copy; mark
referenced/unreferenced; attach File/Resource; request a grounded
Chat reply with `chats.request_reply.v1` and conditionally append it only with
`chats.commit_reply.v1`;
promote a sealed Result into a new or existing Resource through that family's
command; create Agent Task; adopt Persona for subsequent requests; list spawned
outputs/tasks; validate/rebase message and branch anchors through
`chats.validate_anchor.v1`; create a static SavedOutput from one exact Message
revision; create or convert to standing with explicit instruction/source scope;
attach/detach the exact Resolution mount; edit, get/list and page immutable
Output history; append a Resolution settlement; restore an old Output by
appending a new revision based on it.
`chats.render.v1` is a bounded read-only transcript render. An over-bound
render returns `chat_render_async_required` without side effects;
`chats.render_jobs.request.v1` freezes and admits the exact durable render and
`chats.render_jobs.status.get.v1` observes typed result metadata.

### Invariants

- Chat is durable and independent of a browser session.
- Only explicitly referenced/committed messages may become a Knowledge Source.
- Model replies remain inference-provenance; Chat never presents them as source
  fact merely because a User saw them.
- Regeneration creates lineage and a new message/version; it does not overwrite
  the earlier response.
- Promotion calls the destination capability under current authority and
  records exact source lineage.
- `chats.promote.v1` is never a substitute for SavedOutput: promotion changes a
  different canonical owner, while SaveOutput creates Chat-owned presentation
  history and standing mode additionally mounts Resolution.
- Static SavedOutputs never become Resolvables. Only explicit standing mode can
  own a `chat.saved_output/{id}` mount; ordinary/referenced Messages cannot.
- Delete tombstones ordinary presentation/context while preserving topology,
  attribution and required retention. Redact is a privileged erasure action
  with exact consequence preview and cache/preview revocation. Neither silently
  deletes a SavedOutput, another branch or sealed historical Evidence.

## Ports and persistence

Boards own ports for Formula/Data/Resolution/assets/rendering. Chats own ports
for Resolution Ask/standing-mount operations, Agent Task creation and
destination promotion. Chat never calls Knowledge retrieval or Intelligence
providers directly. Each
has its own repository and concurrency model; they share only kernel,
catalog/access/Audit mechanics.

## Request, authority, failure, and recovery

Each handler authorizes and loads only its own aggregate, adapts exact external
values through owner operations, calls its pure capability, then consumes a
fresh permit and commits owner state, idempotency, required Project Audit and
jobs in one Project transaction. Board conflicts use stable object/property
revisions; Chat uses ordered immutable append and conditional message/settings
transitions. SavedOutput uses immutable Output append and conditional current/
last-good/mount pointers; Resolution owns Resolvable/Result/Evidence state.
Promotion to another Resource is a separate owner command with
exact lineage, never a cross-repository write.

Crashes reconstruct render/Resolution jobs and preserve committed messages/
scene edits. Stale jobs cannot publish. Corrupt projections rebuild; canonical
Board/Chat history uses Project backup/restore. Missing assets/providers expose
stable unavailable/last-good states rather than fabricating content.

Grounded Chat reply generation instantiates the non-Agent durable-work saga:

1. `chats.request_reply.v1` (and regeneration as a new sibling request)
   preselects stable `ReplyRequestID`, `WorkAuthorityID` and `JobID` values plus
   the exact Chat/branch/context/settings/source digest.
2. Under the current session, Control creates a bounded
   `DurableWorkAuthority{PendingProjectReceipt}`. One Project transaction
   consumes a fresh session-sourced permit and commits the ReplyRequest/context
   snapshot, exact Job, non-authoritative receipt, idempotency, required
   Project Audit, declared fact and closed `durable_job@1` record.
3. Trusted acknowledgement of that exact receipt alone activates the work. A
   missing Project receipt leaves an unusable expiring/revoked Control orphan;
   a lost acknowledgement reconciles only from that exact trusted receipt.
4. The worker reconstructs the active WorkAuthority and matching Job/receipt/
   generation and invokes Resolution Ask through Chat's consumer-owned adapter.
   Resolution—not Chat—owns retrieval, sealed Evidence, contradiction handling,
   Reasoning/provider admission, accounting and its own recovery.
5. `chats.commit_reply.v1` obtains another fresh work-sourced permit and, in one
   Project transaction, revalidates the exact branch/context/request and work
   dependencies, appends at most one normalized reply with evidence/lineage,
   consumes the permit, records idempotency, Audit and the declared fact, and
   settles the ReplyRequest.

A standing SavedOutput additionally proves an explicit two-owner mount and
settlement protocol: Chat first commits stable `SavedOutputID`, exact source
revision/instruction/source-scope digest and `mount_pending`; its adapter calls
`resolution.create_resolvable.v1` with the stable
`chat.saved_output/{SavedOutputID}` owner key; Chat attaches only the exact
returned definition. Resolution later supplies a `SettlementProposal`, and
`chats.saved_outputs.revisions.append.v1` consumes a fresh current permit to
append at most one Output revision and advance current/last-good atomically.
Restore and User edits append presentation revisions and cannot rewrite
Resolution history or manufacture Evidence. Lost calls/acknowledgements
reconcile by stable IDs/digests; a mismatched or absent mount fails closed.

The pending authority and bare Project receipt can never issue an ordinary
permit. Current-family sign-out preserves the accepted reply job. Sign out
everywhere, User disable/removal, Project-grant/policy/entitlement loss,
cancel, expiry or explicit revoke denies new permits and fences issued ones;
therefore no reply can append after revocation is effective.

`durable_job@1` may only terminalize the exact pre-admitted Job bookkeeping;
success requires prebound proof that the ordinary reply effect already
settled. It cannot change ReplyRequest or Chat state. The Intelligence finalizer
inside Resolution may settle only its exact spent provider call and
reservation. Neither may
invoke/retry inference, append a message, change Chat settings, promote output,
create a Task/Resource, enqueue work or widen authority. Capability state must
commit under a fresh permit before revocation or remain nonterminal.

An asynchronous effectful `boards.resolve_binding.v1` uses the same admission
shape with stable binding-work/WorkAuthority/Job identities and registered
`durable_job@1`; every accepted canonical Board value commit consumes a fresh
work-sourced effect permit. Board and Chat render Queries never create work or
change class. Their separate idempotent durable requests freeze exact owner
revisions, targets, options and policy and atomically admit the Job/work
receipt/idempotency/Audit envelope; status Queries remain read-only. Ready
results are family-owned typed render metadata, while publishing a File remains
Translation/Files work. Ask cannot submit either durable request.

## Production and test composition

Production advertises only binding, rendering, grounded Chat reply and Agent actions
with real registered adapters and durable repositories. Pure tests use
deterministic ports. Live database concurrency/crash/restore plus headless SVG/
outline/transcript/evidence goldens are required; browser canvas/chat UI is
Stage 13.

## Proof matrix

- Board geometry/object/group/connector/layer invariants and race conflicts;
- whiteboard/dashboard geometry and deterministic rendering;
- bounded Board render zero-write, `board_render_async_required`, durable-
  request replay/restart/status and typed-result ownership;
- transient viewport/selection/presence never persists;
- bound last-good/stale/error and generated extraction markers;
- Board and Chat anchor validation/rebase without family-owned comment/private
  Note content;
- Chat ordering/edit/branch/regeneration/reference lifecycle;
- governed Delete versus privileged Redact, including legal hold/reference
  withdrawal, inaccessible citations, cache revocation and branch/history
  preservation;
- static versus standing SavedOutput, explicit Resolution mount identity,
  Result settlement, current/last-good/User-edit divergence, paged Output
  history, retention pins and append-only restore;
- grounded Chat reply uses `chats.request_reply.v1`/
  `chats.commit_reply.v1`, consumes one exact Resolution Result backed by sealed
  Evidence and appends at most one reply;
- stable reply/binding Work/Job IDs, pending→receipt→ack activation, lost-ack
  reconciliation, orphan expiry and denial of pending/bare-receipt permits;
- current-family sign-out survival, broader revocation fencing and exact
  Chat `durable_job@1` confinement plus independently proven Resolution-owned
  provider-call/finalizer confinement, with no unauthorized Chat or Board
  capability-state change;
- only referenced messages enter source acquisition;
- attachment and promotion authorization/lineage across Resources;
- independent-Cell concurrency, idempotency, permit/Audit, crash/retry; and
- bounded Chat render zero-write, `chat_render_async_required`, durable-request
  replay/restart/status and typed-result ownership; and
- headless Board render/outline and Chat transcript/evidence golden outputs.

## Completion boundary

Both Resources work headlessly. Rich realtime presence and browser canvas/chat
interfaces are Stage 13; native/export translations are Stage 11.

## Consequential decisions and source grounding

- **Board and Chat stay separate families.** Their canonical models and
  concurrency protocols are not forced into one abstraction.
- **Only Board has Templates.** Chat starter/settings presets are convenience
  input, not Template catalog/package/import/export state.
- **Collaboration owns comments/private Notes.** Families provide anchor
  validation/rebase, while Stage 12 owns records and commands.

Grounding: [Boards](../capabilities/boards.md),
[Chats](../capabilities/chats.md),
[Collaboration and Search](../capabilities/collaboration-and-search.md), and
[resource-mutation flow](../flows/resource-mutation.md). Exact Chat behavior is
grounded by [SOL X 30 — Chat & Conversation](https://app.notion.com/p/39ab6410e50281b4971bfb5c1b5a38f1).
