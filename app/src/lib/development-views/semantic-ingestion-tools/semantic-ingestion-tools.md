# Semantic intake and agent sightline

This is the durable implementation record for the served reference at
`/demo/semantic-overlay/ingestion-and-tools`. It answers two concrete questions:

1. Which accepted project mutations currently cause Semantic Overlay work?
2. What can the answer-writing Derived Output agent actually observe, and by
   which executable tool?

It deliberately records current code separately from planned adapters. The
load-bearing invariant is:

> An accepted authoritative revision may queue semantic work; the agent may
> discover through processed semantic state, but factual reads resolve current
> authority and only evidence-producing tools can support its answer.

## Automatic authoring hooks

There are four automatic production call sites. All execute on the server and
all call `enqueueSemanticSync` after the authoritative write has succeeded.

| Signal | Owning procedure | Exact condition | Queued ref |
| --- | --- | --- | --- |
| document creation | `createProjectResource` | the `documents` row and revision-0 leader snapshot have been created | `{ kind: "document", id }` |
| document save | `submitDocumentChanges` | operations have been accepted, a change set has been written, the leader advanced, and resource metadata updated | `{ kind: "document", id }` |
| slide-deck creation | `createProjectResource` | the `slideDecks` row and revision-0 leader snapshot have been created | `{ kind: "slides", id }` |
| slide-deck save | `submitSlideDeckChanges` | operations have been accepted, a change set has been written, the leader advanced, and resource metadata updated | `{ kind: "slides", id }` |

Creation is a real signal even when the new resource is blank. In that case the
projector can legitimately publish no exact spans and no materials for revision
zero. The signal still names the authoritative source revision.

Embedded content does not need separate editor hooks. A document table or image
travels through the document save. A slide table, chart, image, or image
background travels through the slide-deck save.

## What `enqueueSemanticSync` does

The caller supplies only a project-scoped resource reference. The server:

1. resolves the newest authoritative revision;
2. determines whether the resource has an exact-text target;
3. determines its material-inventory target;
4. coalesces exact work into `semanticSyncJobs` when applicable;
5. coalesces material work into `semanticMaterialJobs`;
6. returns without reading native bodies, embedding content, or calling an
   intelligence provider.

Both queues key work by project and resource reference. A later accepted save
raises `requestedRevision` on the existing row rather than creating unbounded
parallel work. If a newer revision arrives while a worker is running, the
worker's revision check returns the job to `queued` for the newest revision.
Failed work remains durable and a later enqueue makes it eligible again.

This means “saved” and “searchable” are deliberately different states. Saving
signals work. A processor settles it.

## Sources and positive update conditions

| Source | Exact lane | Material lane | Current positive conditions |
| --- | --- | --- | --- |
| document | yes | tables and images | automatic creation; every accepted save; explicit enqueue; backfill |
| slide deck | yes | tables, charts, images, image backgrounds | automatic creation; every accepted save; explicit enqueue; backfill |
| external UTF-8 text | yes | inventory bookkeeping | explicit enqueue; backfill |
| spreadsheet | no | one table material | explicit enqueue; backfill |
| external CSV | no | profile, descriptors, native CSV authority | explicit enqueue; backfill |
| external code | no | profile, descriptors, native code authority | explicit enqueue; backfill |
| external image | no | profile, descriptors, image vector, native pixels | explicit enqueue; backfill |

Automatic spreadsheet persistence and automatic upload mutation hooks are not
present in this branch. The rows above describe implemented pipeline support,
not a claim that those authoring surfaces already signal every mutation.

## What exact projection contains

Documents and decks share one UTF-16 coordinate contract but own traversal.
The writer inserts real projected text and blank-line joins; it does not insert
synthetic labels such as `Slide 1`.

Document traversal includes header, body, footer, first-page variants, authored
text and formulas, image alt/caption text, and declared table header rows. Full
table bodies and image pixels remain material/native content.

Slide traversal excludes hidden slides, retains a hard boundary between visible
slides, and orders placed elements deterministically by frame (`y`, then `x`,
then source order). It includes authored text, formulas, shape text, image
alt/caption text, declared table header rows, and notes. Full tables, chart data,
and pixels remain material/native content.

Document and slide Prompt Block responses are excluded. Generated output cannot
become new project evidence merely because an editor displays it.

Resource titles are navigation metadata, not exact evidence text.

## Processing entry points

Queued work becomes searchable through four implemented paths:

- `prepareSemanticOverlay`, inside Derived Output refresh, drains exact and
  material work in batches of 50 for at most 20 passes. Retrieval starts only
  after both lanes report no remaining work; a failed job or a queue that never
  settles fails refresh.
- `processSemanticSyncQueue` is the scoped worker command. It processes one
  bounded exact batch and then one bounded material batch.
- `backfillSemanticOverlay` enumerates current document, deck, and spreadsheet
  leaders plus external files, coalesces the appropriate jobs, and immediately
  processes a bounded batch. It is the development/migration entry.
- `syncSemanticResource` directly projects, embeds, and guardedly publishes one
  exact-text resource. It bypasses the durable queue and does not process the
  material lane.

`rebuildSemanticIndex` is intentionally absent from that list: it rebuilds the
index over already published exact objects and is not a new content-ingestion
signal.

There is no always-on production worker/recovery host in this branch. Durable
jobs may therefore wait until an explicit worker, backfill, or Derived Output
refresh pulls them through.

## The answer-writing agent's complete tool surface

One synthesis attempt registers exactly sixteen tools. Nine can issue evidence;
seven provide orientation only. The application forces the first tool call:

- with a selection: `read_selection`;
- without a selection: `retrieve`.

### Evidence-producing tools

| Tool | What the agent can receive | Evidence contract |
| --- | --- | --- |
| `retrieve` | semantically matching, consolidated authored spans with source/revision, locators, score, and overlay generation | exact text |
| `retrieve_materials` | material kind/name/handle, semantic profile, description, matching facets, placement/source, and score | descriptor; appropriate only for broad relevance/inventory claims |
| `read_selection` | the authoritative text range selected when the run began, with source hash/revision and locators | exact text |
| `read_text` | up to 20,000 UTF-16 units from an authoritative document, slide deck, or external-text projection | exact text |
| `read_table` | at most 100 rows by 50 columns from a document/slide table or spreadsheet | structured |
| `read_csv` | at most 100 selected rows by 50 selected columns decoded from original content-addressed CSV bytes | structured |
| `read_chart` | current native slide-chart specification, optionally narrowed to at most 50 named series | structured |
| `read_code` | up to 500 exact lines from original content-addressed code | code |
| `read_image` | original content-addressed image pixels, optionally associated with a validated crop | visual |

`retrieve_materials` really does mint an evidence ID, but at evidence distance
2. It cites the matching interpreted descriptor, not the native cells, values,
code, or pixels. Exact claims must continue to the appropriate native reader.

### Orientation-only tools

| Tool | What the agent can receive | Deliberate limit |
| --- | --- | --- |
| `find_resources` | paged names and references for in-scope documents, decks, spreadsheets, and files | no content and no evidence ID |
| `list_document_blocks` | areas, block IDs/types, nested paths, and projected ranges in reading order | no factual block text |
| `list_deck_slides` | visible slide IDs and one-based positions in deck order | no slide anatomy or evidence ID |
| `inspect_slide` | element IDs/paths/types, frames, rotations, text ranges, notes, background, and material handles | supporting structure only |
| `view_slide` | a generated SVG schematic of boxes, rotations, type labels, and abbreviated authored text | not a production render and never citable |
| `inspect_dataset` | dimensions, headers, inferred types, nulls, sampling coverage, warnings, and native reader name | no native values as evidence |
| `inspect_code` | name, language, line count, and symbol inventory | no source content and no evidence ID |

`list_deck_slides` only supplies the visible-slide inventory. The element and
range anatomy belongs to `inspect_slide`; this separation prevents a broad
navigation call from returning a generic, oversized payload.

## Two observation planes

The agent is not handed project JSON.

The semantic discovery plane consists of `retrieve` and
`retrieve_materials`. These tools require current, processed overlay objects and
use embeddings/similarity to find likely sources.

The authoritative reading plane consists of `read_*`, list, inspect, find, and
view tools. They resolve current snapshots or content-addressed native bytes;
they do not run another semantic query. Orientation calls supply a range,
resource ref, material handle, or spatial understanding that makes the next
bounded read possible.

Common routes are therefore:

```text
prose fact       retrieve → exact evidence
selected text    read_selection → exact evidence
table/CSV value  retrieve_materials → inspect_dataset → read_table/read_csv
slide context    find_resources → list_deck_slides → inspect_slide → view/read
image meaning    retrieve_materials or inspect_slide → read_image
```

## Authority, scope, and evidence lifecycle

Every call is gated by the current project and the Derived Output's stored
Resource Set. Resource references outside that set are rejected server-side.
Material handles and evidence IDs are application-issued and attempt-local; a
model cannot manufacture or reuse one from another attempt.

The provider returns a structured decision containing:

```ts
type SynthesisDecision = {
  status: "answered" | "insufficient";
  response: string;
  evidence: { evidenceId: string; use: string }[];
};
```

For `answered`, at least one selected ID must have been issued in that attempt.
The application validates every selection, resolves canonical citation values,
and consolidates touching or overlapping compatible text citations across all
tool calls. For `insufficient`, application code supplies the coded result rather
than trusting explanatory provider prose.

## Current visual and native limits

- `view_slide` gives the model a real image input, but the image is a schematic
  generated from represented geometry. It is useful spatial context, not slide
  evidence and not a production-fidelity screenshot.
- `read_image` is the citable visual path. It currently requires imported,
  file-backed pixels. Mutable URL-backed image sources are rejected until an
  import/content-addressed storage adapter exists.
- `read_chart` reads native chart data instead of inferring values from pixels.
- large native inputs remain bounded by each typed reader rather than being
  copied wholesale into the model context.

## Shared catalogue and drift prevention

`src/lib/capabilities/derived-output/api/shared/tool-catalog.ts` is client-safe and contains the sixteen names,
runtime descriptions, visibility summaries, inputs, outputs, evidence kinds,
and gates. `synthesis.ts` and `resource-reading.ts` consume its names and
descriptions when they register executable tools. The served reference imports
the same catalogue.

The executable schema and function body remain server-owned. The client-safe
catalogue documents their observation contract without importing server stores
or provider code into the development page.

## Code map

| Concern | Source |
| --- | --- |
| document/deck create hooks | `capabilities/project-resources/api/create-project-resource/create-project-resource.ts` |
| accepted document save hook | `capabilities/document/api/submit-document-changes/submit-document-changes.ts` |
| accepted deck save hook | `capabilities/slide-deck/api/submit-slide-deck-changes/submit-slide-deck-changes.ts` |
| revision resolution and enqueue | `capabilities/semantic-overlay/api/enqueue-semantic-sync/` |
| exact queue coalescing | `capabilities/semantic-overlay/api/shared/sync-queue.ts` |
| material queue coalescing | `capabilities/semantic-overlay/api/shared/material-queue.ts` |
| bounded worker | `capabilities/semantic-overlay/api/shared/queue-processor.ts` |
| document/deck traversal | `representation/data/behavior/semantic/projection/resources/` |
| refresh pull boundary | `capabilities/derived-output/api/refresh-derived-output/refresh-derived-output.ts` |
| shared live tool catalogue | `capabilities/derived-output/api/shared/tool-catalog.ts` |
| exact/material discovery tools | `capabilities/derived-output/api/shared/synthesis.ts` |
| direct/orientation tools | `capabilities/derived-output/api/shared/resource-reading.ts` |

## Why the served page looks like a control room

This reference does not reuse a page convention. Its subject is an operational
boundary, so the visual grammar is a switchboard:

- four selectable signal keys expose the precise post-authority hook;
- a forked wire makes one enqueue call and two durable lanes visible;
- the source matrix distinguishes automatic authoring from explicit pipeline
  support;
- a dark processing bay makes queued-versus-searchable state a separate phase;
- the interactive tool console separates evidence from orientation and exposes
  one exact observation contract at a time;
- access recipes show that information becomes available through deliberate
  routes, not a generic omniscient context payload.

All color, ink, border, surface, type, and shadow choices use project tokens.
The same hierarchy therefore responds to Helios and Selene without maintaining
a second hard-coded palette. Narrow layouts stack the switchboard and tool
console; only the wide source matrix scrolls inside its own bounded frame.
