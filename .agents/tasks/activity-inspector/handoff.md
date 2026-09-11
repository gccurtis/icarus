# Activity inspector

## Snapshot

- Updated: 2026-09-11
- Status: approved typed Activity pipeline implemented and verified
- Worktree: `/tmp/icarus-activity-inspector`
- Branch: `work/activity-inspector`
- Starting head and base: `ab809ac647060f29c55afd99c0054ac311094f75`
- Previous published head: `660277bbab64c073dffbe8d03ae72ba838180f6c`
- Typed-activity implementation base: `f7764d53ee41abce39211dda40a31f0927c2cce1`
- Starting worktree/base record: `worktree.json` beside this handoff

## Request and completion criteria

Explain how Activity works, what creates it, how its fields become What and Where,
whether it supports undo, and which product surfaces depend on it. Serve the
answers as Icarus-style reference pages. Make current Where targets useful:
native resources and External Files open their owning surfaces; persona, task,
and automation open exact Agents details; findings and connectors expose clear
future placeholders; missing targets explain that they are unavailable.

The follow-up asks for a structured Activity capability design. The user settled
its remaining scope: Research Chat and prompt blocks do not emit Activity; Agents
tasks emit initial-start and completion events; retention remains a future
database/storage policy. This branch implements that current-only schema,
producer vocabulary, shared presentation, and replacement seed data.

## Decisions and authority

The user explicitly requested implementation in this worktree and a locally
served explanation. Root `AGENTS.md` permits scoped commits and publication to
`work/activity-inspector`. No rebase, main merge/push, deployment, production
data mutation, or live-provider use is authorized.

The user subsequently authorized the proposed Activity changes. Implementation
scope is a central typed event contract/recorder, the six existing External Files
events, Agents initial-start and completion events, shared presentation for all
consumers, and replacement seed rows limited to those real events. Research Chat,
prompt blocks, and application-level retention remain excluded.

Activity is an append-only viewing/audit feed. It is not part of editor undo or
redo. Historical labels remain readable after a target disappears, while link
eligibility comes from current project-scoped indexes and exact ID/kind matches.
External-file activity normalizes to the resource index's `file` kind.

Finding targets are verified against the resource index, then display a not-built
alert. Connector targets display the same kind of placeholder because no current
connector index/detail destination exists. Persona, task, and automation queries
start only for those target kinds and resolve through the scoped Agents library.

## Implemented state

- Activity persists a closed eight-event union: six External Files events plus
  one initial start and one completion per Agents task. Store admission rejects
  free-form verbs, malformed payloads, and incoherent actors.
- The Activity capability verifies current project ownership inside the caller's
  transaction, derives trusted actors, deduplicates task lifecycle events, and
  owns the shared `type`, `what`, `action`, target, context, and detail.
- All External mutations and Agents task creation/completion record atomically.
  Project, Agents, and External Files consume the same presentation.
- Seed data now contains only events that live writers can emit. Research Chat,
  prompt blocks, editor actions, and configuration changes do not emit Activity.

- The reference suite uses the established standalone Icarus reference-page
  language, shared CSS, numbered rail navigation, light/dark tokens, compact
  responsive behavior, and horizontally contained data tables:
  - `index.html`: direct answers and recommendation.
  - `01-system.html`: persisted pipeline, live writers, all direct readers,
    seed-only vocabulary, and rendering inconsistency.
  - `02-changes.html`: proposed typed event catalog, transaction boundary,
    destination contract, implementation sequence, and open product decisions.
  - `activity-map.html`: redirects the previous review URL to the new suite.
- The Activity inspector resolves current document, presentation, spreadsheet,
  research, External File, finding, persona, task, and automation targets by exact
  ID and kind.
- Documents, presentations, spreadsheets, and research open their editor.
  External Files opens its permanent singleton and focuses the exact file.
  Personas, tasks, and automations open their exact Agents detail.
- Existing findings and connector snapshots are links that explain their
  destinations are not wired yet. Known resource/Agents targets that do not
  resolve remain historical text with: “This item is missing, deleted, or
  otherwise unavailable.”
- The header action uses a resource label for resources and the specific Agents
  kind for Agents targets. The Agents index query is conditional on an Agents
  target.
- Unit coverage checks all resource mappings, Agents mappings, destination-source
  classification, exact matching, missing targets, and opening targets. Chromium
  covers native editors, all three Agents details, connector alert behavior,
  current External Files selection, and deleted-file history.

## Prior audit findings resolved by this implementation

The stored row is `{ projectId, actor, actorLabel, verb, target, context?, detail? }`.
The producer owns a free-text verb; the inspector special-cases four values and
otherwise trims and capitalizes it. Other consumers use raw verbs or duplicate
formatting, so visible language is inconsistent.

There are two production creation paths and eight live verb values:

- External Files: `uploaded`, `re-uploaded`, `renamed`, `moved`,
  `context-updated`, and `deleted`.
- Agents task execution: `answered` and `found insufficient evidence for`.

Research Chat does not write Activity. Agents tasks are separate stored task
objects. `reviewed`, `started`, `recalculated`, and the other broad demo verbs are
seed-only; the seed has 17 rows and 14 distinct verb values. Only `renamed`
overlaps a live producer, and the live producer applies it to External Files.

Seven product areas directly consume Activity: Overview feed, Project History,
Project Activity inspector, project-resource details, person details, Agents
library/inspector, and External Files history. Editor undo/redo has no dependency.

The proposed design keeps useful history while moving event ownership into an
Activity capability. Producers submit a discriminated event and structured facts
through a transaction-aware recorder. Activity owns validation, frozen target
construction, display formatting, and destinations. The recorder must use the
originating Store unit of work so the domain mutation and history remain atomic.
Its settled task events are `agents.task-started` and `agents.task-completed`;
completion outcome is structured detail rather than a verb. Research Chat and
prompt blocks stay outside Activity, and retention is deferred to storage policy.

## Verification evidence

| Command / check | Scope | Result | Evidence |
| --- | --- | --- | --- |
| `verify.mjs unit -- .../activity-target.test.ts` | Destination resolution | 1 file, 16 tests passed | `.agents/runtime/runs/1789104160520-unit-e206dc21` |
| `verify.mjs quick` | TypeScript/Svelte + architecture | 0 diagnostics; 90/90 checks clean; 0 findings | `.agents/runtime/runs/1789104109881-quick-6355853a` |
| `verify.mjs browser --port 5249 -- activity-inspector-navigation.spec.ts` | Real Chromium with disposable Store | 3 tests passed; no browser diagnostics | `.agents/runtime/runs/1789104136829-browser-030a4f51` |
| Local reference Playwright check | Three served pages, nav, filters, search, 1440px + 390px | Passed; no document overflow at 390px | `.agents/runtime/activity-reference-{wide,compact}.png` |
| Visual inspection | Reference suite and Activity inspector at 125% compact zoom | Inspected; content remains legible and contained | Browser evidence screenshots plus local reference screenshots |
| `verify.mjs agents` | Worktree, handoff, and helper contracts | 45 tests passed | `.agents/runtime/runs/1789104218668-agents-02e10a28` |
| `verify.mjs unit` | Complete unit and non-functional suite | 2,074 passed; 2 existing skips | `.agents/runtime/runs/1789110109342-unit-f2d68e89` |
| `verify.mjs quick` | Final TypeScript/Svelte + architecture | 0 diagnostics; 90/90 checks clean; 0 findings | `.agents/runtime/runs/1789110540407-quick-56a2421e` |
| `verify.mjs browser --port 5327 -- ...` | Activity navigation, External lifecycle/history, Project panels, compact/zoom states | 12 Chromium tests passed | `.agents/runtime/runs/1789110311930-browser-a9cffdf6` |

No live-provider tests ran. The complete unit suite, final quick profile, and
targeted Chromium suite cover the changed contracts and interactions; a full
production build was not run separately.

## Server and data ownership

- Owned reference server: `http://127.0.0.1:5311/`, rooted at
  `.agents/tasks/activity-inspector`
- Previous URL: `/activity-map.html` redirects to `/index.html`
- Review app server: none running
- Store/native-file mode: disposable browser fixtures only; verifier cleaned them
- Worktree lease: none after verification
- Human review data: untouched
- Local configuration: the worktree's ignored local configuration remains linked
  to the primary checkout; tracked YAML was not edited through it
- Ignored local artifacts: independent dependencies/caches, verification output,
  screenshots, and local Nix lock output

## Risks and next executable step

The schema change is current only, so an existing development Store with old
Activity rows must be reset or reseeded. Retention remains a future storage-layer
policy. Connector and finding destinations remain documented placeholders, but
no current producer emits those event types.

Review `http://127.0.0.1:5311/` and `work/activity-inspector`. Main integration
still needs explicit authorization.

## Publication / handoff

- Existing commits: `45e49e3`, `6a8533c`, `2b1220e`, `660277b`
- Follow-up implementation commit: `e01853b` (`Expand activity destinations and reference`)
- Settled scope: no Research Chat/prompt-block activity; Agents initial start and
  completion; retention deferred to the future storage layer
- Publication target: `origin/work/activity-inspector`; no main integration
- Worktree cleanup: retain because the local reference server and review remain active
- Next owner: review the published implementation; integrate only with explicit authorization
