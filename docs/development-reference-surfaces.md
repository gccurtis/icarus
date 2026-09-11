# Development reference surfaces

This is the project standard for a development page whose job is to make a
system understandable and provable. It records the decisions behind the
Derived Output procedure flow, agent runtime, resource-reading contract,
semantic material layer, ingestion/tool sightline, executable proof, and slide Prompt Block pages. It is
not a layout template. Each page must take the visual form that best explains
its own subject.

The standard is the method and the quality bar:

1. establish what is true in the running branch;
2. choose a visual grammar that exposes the important relationships;
3. distinguish implemented behavior from target design and deferred work;
4. connect claims to executable code or an executable proof;
5. verify both Celestial appearances, narrow layouts, accessibility, and browser
   diagnostics;
6. leave a durable map from the page back to the code it describes.

## Why the Derived Output reference is seven pages

One long reference page could contain all the information, but it would force
seven different questions into one visual hierarchy. The pages are separated
by the kind of understanding they need to create.

| Surface | Question | Visual grammar | Proof level |
| --- | --- | --- | --- |
| Procedure flow | What calls what, from an authored resource to an editable generated block? | converging entry paths, call graphs, sequence, state machine, callable ledger | exact symbols and current/deferred status |
| Agent runtime | What does the agent know, what may it call, and how does evidence become durable? | context stack, control loop, interactive tool console, evidence chain, infrastructure priorities | executable system prompt and complete live tool grammar imported from the capability |
| Resource reading | How does the agent traverse a document or presentation, understand a slide, and obtain typed evidence? | authority grammar, interactive tool field, task routes, slide anatomy, evidence spectrum, projection seam | live orientation/evidence tools with current bounds and named renderer/upload limitations |
| Semantic material | How do tables, CSV data, images, charts, and code become semantically discoverable without replacing their native authority? | two-lane retrieval machine, interactive material record, processing track, evidence-distance ruler, schema wall | live registry, profiles, descriptors, image vectors, queues, index lane, retrieval, and readers |
| Intake and agent sightline | Which accepted writes queue semantic work, when does queued work become searchable, and exactly what can the writer observe? | four-signal switchboard, source/update matrix, processing control room, shared live tool catalogue, access recipes | exact production call sites, queue behavior, and all sixteen executable tools |
| Live proof | Does the vertical slice really work? | two-input laboratory, execution rail, stored result, evidence record | real project store, real resource write, real embedding/index query, real structured generation, real value read |
| Slide Prompt Blocks | How does one ordinary text box acquire generated behavior without changing its slide presentation or collaboration contract? | interactive four-state editor specimen, data-boundary X-ray, exact sequence, one-flight collaboration map, file ledger | real conversion/editing/publication procedures plus Chromium editor proof |

The pages link to one another, but each can stand on its own. Reusing navigation,
typography, or a diagram renderer is useful; forcing the same card grid or
section convention onto all seven is not.

## Source-of-truth pass

The first design task was not drawing. It was inventorying the branch and
writing a truth table.

For every behavior shown on the pages, classify it as:

- **existing** — inherited behavior this work directly uses;
- **extended** — a real boundary exists and this work changes it, but the target
  boundary has more to add;
- **new** — executable on the branch;
- **deferred** — a named next slice with a defined contract, not page decoration.

The status must describe the code at review time. A good design that is not
implemented is still `deferred`. An executable prototype is not called a
production worker. The current pages mark all sixteen agent tools and both
Semantic Overlay lanes as live, while separately naming the always-on worker,
transactional outbox, production slide renderer, content-addressed upload
adapter, and large-file partitioning as deferred.

Use exact function, message, table, and field names wherever a reader will need
to find code. Prose may explain a boundary, but should not replace its callable
name. Conversely, do not show line numbers as durable truth: they go stale after
ordinary edits. Prefer symbols and paths.

## The visual design process

### 1. State the load-bearing invariant

Every page needs one sentence that makes the rest of the design legible. For
Derived Output procedure flow it is “Commit first. Derive second.” That sentence
determines the direction of the diagrams, the entry-point comparison, and the
placement of the publication guard.

The invariant should be specific enough to reject a bad implementation. “Make
it scalable” cannot do that; “only an accepted authoritative revision can be
embedded, and publication must recheck that revision” can.

### 2. Identify relationships that need a visual

Use prose for a single fact. Use a visual only when spatial form makes a
relationship materially easier to inspect:

- a flowchart for two entry paths converging on one worker;
- a sequence diagram for calls crossing editor, capability, model, and store;
- a state diagram for stored and effective freshness;
- a layered stack for stable instructions plus per-run data;
- an interactive console for several exact tool contracts;
- a linear evidence chain for application issue → model selection → application
  validation → persisted citation;
- an execution rail for live progress through a vertical slice.

The first procedure-flow section originally put a vertical “merge” ornament
between two side-by-side cards. That did not clearly show where the paths
converged. The corrected composition places both complete entry paths in equal
columns, joins them with a horizontal rail labeled with the shared job shape,
then points at the shared worker call. The lesson is general: connector geometry
must describe the actual direction of the system, not merely fill the gap
between cards.

### 3. Let hierarchy encode certainty

Implemented paths receive the strongest continuity and complete contracts.
Deferred paths remain visible because they matter architecturally, but their
labels explicitly say `target` or `deferred`. Status cannot depend on color
alone; every status has text.

Large serif statements carry the conceptual thesis. Monospace labels carry
functions, types, states, IDs, ranges, and small operational annotations. Body
copy explains why a boundary exists. This division lets a reader scan the page
at three resolutions without turning every sentence into chrome.

### 4. Make the page useful without the diagram

Mermaid diagrams have an accessible label, a caption, loading and failure
states, and surrounding prose or ledgers that repeat the important contract in
searchable HTML. A failed diagram should degrade the page, not erase the
architecture.

The local Mermaid component dynamically imports the renderer so ordinary editor
routes do not pay for it. It accepts trusted constant definitions only; it is a
development-view tool, not an authored-content feature. Its adaptive palette
observes `html[data-appearance]` and rerenders when Helios or Selene changes.

## The Derived Output architecture recorded by the pages

### Resource ingestion

The normal entry is an accepted document or presentation revision. It persists the
leader, enqueues one coalesced semantic-sync job, and releases the editor before
provider work. The development entry enumerates seeded authoritative resources
and enqueues the same job shape. Both then use the same bounded worker,
projection, translation, guarded publication, and index staging path.

All supported resources become canonical UTF-16 text plus locator spans.
Translation sees text; citations and later resource reads can use locators to
return to blocks, slides, shapes, tables, captions, and notes. Prompt Blocks are
excluded from ingestion so generated responses cannot recursively become their
own project evidence.

### Prompt Block product entry

Prompt creation belongs to the authoring surface, not the context rail. In a
document:

1. place the caret on an empty line;
2. choose `Prompt` from the normal Block selector;
3. configure the prompt in the Prompt inspector;
4. create and link the Derived Output;
5. signal refresh by Derived Output ID;
6. let the coalesced server worker drain pending semantic work and generate;
7. replace the block's editable text while preserving its editor-owned mark
   ranges;
8. use the star in the pasteboard gutter to reopen Prompt settings.

The block looks like ordinary text. Its generated response is selectable,
formattable, and editable. The small star is an out-of-content control in the
same pasteboard gutter as comment pins; it is neither a ProseMirror decoration
nor part of the document text. An inline edit marks the block stale and becomes
the exact ungrounded previous-response continuity at the next refresh. Formatting
never crosses the Derived Output boundary: the editor reapplies the same absolute
mark ranges, clipping only endpoints beyond a shorter replacement. Evidence
remains canonical on the Derived Output, never on the edited document prose.

The first implementation put the star in a widget at the right edge of the text
block. That used the page margin's coordinate system, not the pasteboard gutter
the design intended. It also made the editor own a non-text control. The final
implementation measures each visible Prompt Block from `document.svelte`, draws
its star as a sibling of comment pins, and treats the gutter as an interactive
part of the editor surface. Without that last event boundary, the pasteboard's
outside-page handler cleared and remounted the inspector before the star's click
opened it again; that was the apparent jump to **Next letter** and the lost field
state. Clicking the already-open block is also a no-op, avoiding redundant
workspace operations.

Linked settings intentionally contain only the prompt, a compact Scope selector,
Refresh, errors/progress when relevant, and evidence. The first selector has one
choice, `Whole project`, but keeps the control seam for saved Resource Sets.
Refresh remains available whenever the prompt is non-empty; clicking it drains
pending semantic work on the server before asking the pull-based freshness gate
to regenerate or return the current value. Every browser signal coalesces into
one durable job keyed by Derived Output ID, and concurrent callers join the same
server flight rather than racing a client-owned loading flag. Repeated signals
for the same definition and selection are pure joins. Only an actual input
change advances the job request version, while a server-side semantic watermark
catches authoritative resource changes that land during synthesis. The read API
projects value freshness separately from queued/running/failed refresh state;
the inspector polls that shared state, shows one progress treatment, and keeps
the last response readable. There is no
`Current`, placement, response-status, or internal-details presentation. Each citation shows only retrieved authored
content followed by the authoritative resource title; historical title locators
are removed from the visible quote, and clock suffixes use minute precision. The
title opens the resource in an app tab. Evidence IDs, source kinds, offsets,
generations, and Derived Output IDs remain stored implementation data rather than
routine inspector chrome.

The Prompts context panel is an index of Prompt Blocks already in the current
document. It can navigate and inspect; it does not create.

In a presentation, the same product rule takes a different editor-native form:

1. select a standalone text box;
2. choose `Prompt` beside `Comment` in its inspector;
3. convert only the inner content kind while retaining the outer element and
   every presentation field;
4. configure and generate from the dedicated slide Prompt inspector;
5. publish the response through native presentation atom/mark operations;
6. edit or format the response through the ordinary slide text path;
7. use the editor-only star or the Prompts index to reopen settings.

This interaction did not copy the document's empty-line mechanism because the
two editors have different creation grammars. It did preserve the system
contract: one ordinary editable presentation block holds one Derived Output ID,
while server generation and evidence remain outside the resource. The visual
reference makes that narrow conversion inspectable as a four-state specimen,
then separates the slide shell, Prompt content, and Derived Output record in a
data-boundary X-ray. Its Mermaid sequence and collaboration map name the actual
procedures and server job behavior rather than implying the browser owns work.

The implementation initially tried to publish slide responses by setting the
`atoms` and `marks` arrays directly, mirroring the document adapter. A focused
test through the real presentation operation applier rejected that: identified slide
lists must use native `insert` and `remove` operations. The adapter now removes
marks and atoms, inserts the response atom, and reinserts clipped mark ranges.
That test-driven correction preserves collaborative operation semantics instead
of weakening the applier for one feature.

The reference also draws the current collaboration boundary precisely: Derived
Output generation is coalesced and canonically published by the server, while a
mounted editor still mirrors that canonical value into slide atoms and marks
through normal collaborative presentation operations. A server-owned idempotent
single-writer presentation mirror is recorded as follow-up work so the page does
not imply duplicate client publication has already been eliminated.

The full design, exact before/after shape, call sequence, ownership decisions,
test contract, and explicit follow-ups are recorded in
`app/src/lib/development-views/slide-prompt-blocks/slide-prompt-blocks.md` and
served at `/demo/semantic-overlay/slide-prompt-blocks`.

### Agent evidence boundaries

The first agent page used one generic `read` sketch to establish the
direct-resource authority boundary. Resource-reading design refined and
implemented it as several narrow tools. Their names carry a stable grammar:

- `find_*`, `list_*`, `inspect_*`, and `view_*` orient the agent and never mint
  evidence IDs;
- `retrieve`, `retrieve_materials`, and every `read_*` tool return
  source-backed material and mint evidence IDs;
- `retrieve` queries the exact-text Semantic Overlay lane,
  `retrieve_materials` queries the interpreted-material lane, and every
  `read_*` call reads the authoritative project resource directly.

| Tool | Authority | Purpose | Evidence behavior |
| --- | --- | --- | --- |
| `read_selection` | authoritative resource | resolve the user's current selection | exact selected content receives an evidence ID |
| `find_resources` | project navigation | find scoped resource handles | no evidence ID |
| `retrieve` | Semantic Overlay | find exact semantically similar text | consolidated exact spans receive evidence IDs |
| `retrieve_materials` | material index lane | find semantically relevant tables, CSV data, charts, images, and code | source-bound matching facets receive explicitly interpreted evidence IDs |
| `list_document_blocks` | resource navigation | traverse document order and handles | no evidence ID and no factual payload |
| `list_presentation_slides` | resource navigation | obtain neighboring slide handles | no evidence ID |
| `inspect_slide` | contextual structure | list typed items, bounds, text ranges, and content handles | no evidence ID |
| `inspect_dataset` | contextual structure | list bounded sheets, tables, partitions, columns, and native-read handles | no evidence ID |
| `inspect_code` | contextual structure | list parser-derived symbols and exact source ranges | no evidence ID |
| `view_slide` | contextual rendering | inspect the current schematic spatial view | explicitly non-citable; no evidence ID |
| `read_text` | authoritative resource | read a bounded block, shape, note, or range | exact text evidence |
| `read_table` | authoritative resource | read native cells and relationships | structured evidence |
| `read_chart` | authoritative resource | read native axes, series, labels, and values | structured evidence |
| `read_image` | authoritative resource | read content-addressed original pixels and optionally bind crop coordinates | visual evidence |
| `read_csv` | authoritative external file | read bounded rows and columns | structured evidence |
| `read_code` | authoritative external file | read exact line or symbol ranges | verbatim code evidence |

The distinction between `view_slide` and `read_image` is deliberate. The live
`view_slide` adapter is a schematic SVG for association, layout, and hierarchy;
it is not a production-fidelity render and cannot be selected in the final
evidence array. The content-addressed original image returned by `read_image`
is visual evidence. URL-backed images must first be imported because a mutable
remote URL cannot anchor a durable citation. Crop coordinates are currently
validated and stored while the original raster is sent; server-side raster
cropping remains deferred.
Likewise, native chart data from `read_chart` is preferred to reconstructing a
chart from pixels.

Exact-text retrieval does not preload `hasImages`, `hasCharts`, or a whole
resource inventory. Its existing locator tells the agent where exact text
lives. When the question explicitly asks for relevant non-prose material,
`retrieve_materials` searches a separate lane of deterministic profiles,
user-authored descriptions, generated summaries, and native image vectors.
When the question requires more context, `inspect_slide`, `inspect_dataset`, or
`inspect_code` exposes bounded typed handles, and the agent chooses the
corresponding view or evidentiary reader.

When a selection exists, the run envelope carries `hasSelection: true`, not the
selected text. The live loop forces `read_selection` first; the application
resolves the current authoritative range and registers it. This gives the agent
an explicit focus and makes that focus citable without placing mutable source
content in the stable instruction.

The structured result says whether the task was answered:

```ts
type SynthesisDecision = {
  status: "answered" | "insufficient";
  response: string;
  evidence: { evidenceId: string; use: string }[];
};
```

For `answered`, at least one selected ID must have been issued in the same
attempt. For `insufficient`, application code ignores provider prose and uses a
fixed coded response. The model selects evidence IDs and describes their use;
the application resolves immutable source/revision/range values and stores
citations by value.

Consolidation runs again after evidence selection, across all tool calls in the
attempt. Touching or overlapping citations from the same source snapshot and
overlay generation become one durable citation; all selected IDs and use
annotations remain attached to it.

Text, structured, visual, and descriptor evidence share the attempt-local
registry but not one generic payload. Text and code are verbatim. Structured
and visual claims are interpretations grounded in native cells/series or
original pixels. A semantic descriptor is farther from authority: it can
support broad relevance or inventory claims, is always labeled interpreted,
and retains its source, input hash, model, and prompt version. Exact values or
depicted details still require a native read. Durable citations therefore
retain different source shapes, and the UI can distinguish all four without
treating contextual slide renders as evidence.

### Resource projection seam

The live projector is rooted at
`app/src/lib/representation/data/behavior/semantic/projection/project-resource.ts`.
Callers consume its exact or material output directly. The projector uses one
UTF-16 coordinate space, joins actual text units with blank lines, retains
document/slide locators, records hard slide boundaries out of band, omits
synthetic labels such as `Slide 1`, and excludes Prompt Blocks.
It projects authored table header labels and image alt/caption text, while raw
table bodies, chart values, and pixels remain native material.

The implemented extension point is:

```text
representation/data/behavior/semantic/projection/
├── contract.ts
├── writer.ts
├── project-resource.ts
├── shared.ts
└── resources/
    ├── document.ts
    └── presentation.ts
```

Resource adapters determine traversal and locators. Shared content rules decide
what narrative content contributes to the exact text lane. The same resource
walk emits first-class tables, charts, and images into the independently queued
material pipeline. The presentation retains one coordinate space, while translation,
direct reads, and citation consolidation cannot cross an out-of-band slide
boundary. External UTF-8 text uses the same exact contract with an immutable
`contentHash`; CSV, code, image, and spreadsheet adapters join the material
pipeline through `readMaterialInventoryFor`.

Shared native assets are global identities, but their aggregate context is not
global authority. The material page now exposes the facet gate explicitly:
identity/profile/native-visual facets can be discovered through any in-set
source or placement, while authored/generated facets persist `scopeRefs` and
require every contributor in the active Resource Set. This distinction emerged
from implementation review; without it, deduplicating one image used in two
resources could leak neighboring text from the excluded resource.

The same review tightened the performance claim: material vectors are reused
per facet kind and input hash, not only per whole record. A new placement can
change aggregate context without recomputing the immutable image vector or
unchanged identity/profile vectors. Descriptor enablement, disablement, model,
prompt, and input changes each have an explicit migration path.

The complete material identity, profiling, description, facet, two-lane index,
freshness, tool, evidence-distance, and migration design lives in
`docs/semantic-material-layer.md`. The development surface is
`/demo/semantic-overlay/material-layer`.

### Instructions as an application-owned runtime skill

The agent is single-purpose, so its stable system instruction functions as a
small runtime skill. It lives in
`app/src/lib/capabilities/derived-output/api/shared/agent-instructions.ts`, behind the
capability that executes it. The agent reference page imports that exact export
instead of maintaining a transcription.

Tool-specific abilities belong to the tool schemas supplied in a run. The
instruction must not claim that a deferred tool exists. Per-run task text,
selection presence, previous response, examples, and output limits are data and
remain outside the stable instruction.

This is documented as project code rather than a Codex skill because it governs
an Icarus runtime agent and depends on Icarus evidence types. Extract a general
development-reference skill only after at least one other project needs the same
method and the reusable parts can be separated from this project's vocabulary.

## Executable proof pattern

A visual architecture claim is strongest when a neighboring surface runs the
same boundaries:

1. create a real project resource;
2. submit a real authoritative document change;
3. process the real semantic queue;
4. embed and publish through configured providers;
5. create either a direct or templated Derived Output;
6. run structured synthesis with evidence IDs;
7. store the response and citations;
8. read through the consumer-facing value API;
9. render the answer, IDs, ranges, variables, and evidence.

The proof intentionally creates persistent development rows. It says so on the
page. Provider-backed browser tests are opt-in because they spend network calls;
the mocked lifecycle tests remain the fast required proof for all branches.
Automated provider tests use explicitly synthetic equipment facts. Do not put
personal or confidential content in an external-provider smoke test merely
because the product can accept that content at runtime.

The editor does not own the generation procedure. It submits one refresh intent
and renders the canonical result; semantic draining, freshness, retry,
deduplication, and synthesis all execute behind the server capability boundary.
The current JSON runtime serializes active work in one process and persists the
job for recovery. A production multi-process store must implement the same
claim/version transition atomically.

The live editor scenario is separate and equally important: type a fact in one
ordinary document, create a Prompt Block in another, generate, see the answer as
normal text, reopen settings from the gutter, refresh again, and follow the
evidence title back to its resource. This tests product composition, not only
capability composition.

## Failure found by the proof

The first editor run exposed `a cycle is not storable`. The generated citation
graph was acyclic but reused the same source snapshot object in more than one
place. The serializer kept one global `WeakSet` of every object it had ever
visited, so it treated a repeated reference in a directed acyclic graph as a
cycle.

The corrected serializer tracks only ancestors on the current recursion path:
add before descending and remove after returning. A self-reference is still
rejected; shared references are accepted and serialized by value. Unit tests
cover both cases. This is exactly why the live proof is part of the reference
standard: a coherent diagram could not reveal this persistence defect.

The editor proof found two more preconditions in blank-resource creation. The
launcher had historically opened a title-shaped tab ID such as `Untitled
document 1`; a later browser session could reuse that name and collide with an
old leader. It now creates the represented resource first and opens the opaque
ID returned by Project Resources. The revision-zero snapshot also has to own its
first row, block, and literal atom. A client-only painted paragraph gives the
caret an ID that the authoritative body cannot resolve, so it looks editable
while every change fails. New documents now persist that first editable block.

Persisted Prompt Blocks from the earlier prototype exposed the complementary
migration case: they could legitimately be linked to a fresh Derived Output
while still carrying `atoms: []`. The ProseMirror-to-representation projection
used to mint a fallback atom ID each time it read such an empty block. Selection
signaling therefore produced a different caret address on every pass. The
workspace wrote that address back to ProseMirror, ProseMirror signaled another
new address, and Svelte eventually stopped the recursive inspector updates with
`effect_update_depth_exceeded`. Projection reads now derive a stable fallback ID
from the block ID and literal-run index. The fallback becomes represented data
on the next real document edit, while repeated reads are pure and selection
synchronization settles. A unit regression uses the exact legacy empty-Prompt
shape, and the persisted two-Prompt review document is exercised separately in
Chromium.

The same live document exposed a second orchestration defect. Refresh originally
ran semantic draining and generation as separate client commands. Updating a
query could remount the inspector between those calls, reset its local running
flag, and allow repeated clicks to collide with the output's generating state.
The failed block then retained its earlier SSR error because no successful
publication replaced it. Refresh is now one coalesced server operation keyed by
Derived Output ID. Inspector remounts and concurrent users join that backend
job; only a changed definition or selection advances it, and they cannot create
competing provider runs.

Finally, persistent review data and resettable fixture data answer different
questions. The server accepts an opt-in `ICARUS_STORE_DIRECTORY` override so a
browser regression can use a disposable copy of `app/seed` without deleting or
rewriting the live review store. With no override, ordinary development and
production continue to use configured storage.

## Helios and Selene contract

Every page under `/demo` inherits appearance from the Demo Shell. A reference
surface may establish its own art direction, but all of its semantic colors and
grounds must react to both:

- Helios: warm paper, dark ink, restrained colored washes;
- Selene: cool dimensional ground, light ink, brighter semantic accents;
- never assume a page is permanently light or permanently dark;
- rerender graphics whose colors are embedded in generated SVG, not only their
  surrounding CSS;
- preserve hierarchy without relying on hue alone;
- test the actual top-bar switch, not a manually edited stylesheet class.

The procedure page begins from Helios and has an explicit Selene palette. The
agent page begins from the same visual concept but expresses it in both
materials. The live proof adapts its laboratory cards, inputs, rail, result, and
evidence—not just its outer background. The slide Prompt Block page uses only
semantic surface, ink, border, status, intelligence, typography, radius, and
shadow tokens, so its mini editor, inverted X-ray, and collaboration map all
respond to the active Celestial appearance without a parallel hard-coded
palette.

## Responsive and interaction contract

- Wide diagrams scroll inside their own stage; they must not widen the page.
- At narrow widths, parallel comparisons stack while preserving reading order.
- Tool tabs retain native tab/listbox semantics and visible selected state.
- Every icon-only action has an accessible name and keyboard focus treatment.
- Loading, empty, insufficient, stale, generating, fresh, and error states use
  text in addition to color.
- Reduced-motion settings stop ornamental animation.
- A context or inspector control owns the behavior it edits; do not duplicate a
  creation flow in a navigation/index panel.

## File map

| Concern | Source |
| --- | --- |
| Procedure flow page | `app/src/lib/development-views/derived-output-architecture/components/procedure-flow.svelte` |
| Agent runtime page | `app/src/lib/development-views/derived-output-architecture/components/agent-runtime.svelte` |
| Resource-reading page | `app/src/lib/development-views/derived-output-architecture/components/resource-reading.svelte` |
| Semantic-material page | `app/src/lib/development-views/derived-output-architecture/components/material-layer.svelte` |
| Executable proof page | `app/src/lib/development-views/derived-output-architecture/components/live-proof.svelte` |
| Slide Prompt Block visual reference | `app/src/lib/development-views/slide-prompt-blocks/slide-prompt-blocks.svelte` |
| Slide Prompt Block design record | `app/src/lib/development-views/slide-prompt-blocks/slide-prompt-blocks.md` |
| Adaptive diagram renderer | `app/src/lib/components/development/mermaid-diagram.svelte` |
| Exact executable agent instruction | `app/src/lib/capabilities/derived-output/api/shared/agent-instructions.ts` |
| Coalesced server refresh queue | `app/src/lib/capabilities/derived-output/api/shared/refresh-queue.ts` |
| Prompt Block inspector | `app/src/lib/app-views/categories/document-editor/inspector/prompt-block.svelte` |
| Linked Prompt settings | `app/src/lib/app-views/categories/document-editor/components/prompt-settings.svelte` |
| Prompt list context | `app/src/lib/app-views/categories/document-editor/context/prompts.svelte` |
| Prompt and comment gutter | `app/src/lib/app-views/categories/document-editor/content/document.svelte` |
| Editable response synchronization | `app/src/lib/app-views/categories/document-editor/procedures/prompt-blocks.ts` |
| Slide Prompt conversion and publication | `app/src/lib/app-views/categories/presentation-editor/procedures/prompt-blocks.ts` |
| Slide Prompt inspector and refresh | `app/src/lib/app-views/categories/presentation-editor/inspector/prompt-block.svelte` and `components/prompt-settings.svelte` |
| Slide Prompt marker and navigation | `app/src/lib/components/authored/slide-surface/slide-surface.svelte` and `app/src/lib/app-views/categories/presentation-editor/context/prompts.svelte` |
| Durable blank-resource entry | `app/src/lib/app-views/categories/new-tab/procedures/creating.ts` |
| Represented first document block | `app/src/lib/capabilities/project-resources/api/create-project-resource/create-project-resource.ts` |
| DAG-safe store serialization | `app/src/lib/representation/store/path.ts` |
| Architecture and live-provider proof | `app/test/browser/derived-output-architecture.spec.ts` |
| Gutter and inspector-stability proof | `app/test/browser/document-editor.spec.ts` |
| Slide conversion, direct editing, and navigation proof | `app/test/browser/presentation-editor.spec.ts` |

Routes are served under:

- `/demo/semantic-overlay/derived-output-flow`
- `/demo/semantic-overlay/agent-runtime`
- `/demo/semantic-overlay/resource-reading`
- `/demo/semantic-overlay/material-layer`
- `/demo/semantic-overlay/derived-output-live` (redirects into the project-scoped
  application route before executing writes)
- `/demo/semantic-overlay/slide-prompt-blocks`

## Review checklist

Before calling a development reference surface complete:

- [ ] Every implemented claim resolves to current code.
- [ ] Every target or deferred claim is labeled in words.
- [ ] Function/tool inputs and outputs include the ranges, IDs, and bounds that
      affect correctness.
- [ ] The page answers its own primary question without requiring a neighboring
      page.
- [ ] Diagrams have labels, captions, loading states, and failure states.
- [ ] Helios and Selene both preserve legibility and hierarchy.
- [ ] A 390px viewport has no page-level horizontal overflow.
- [ ] Controls work by keyboard and have native accessible roles/names.
- [ ] Browser console, page errors, failed requests, and HTTP errors are clean.
- [ ] Unit tests cover the deterministic boundaries behind the visual claims.
- [ ] The real-provider proof is run when credentials are available and the
      change affects the provider path.
- [ ] Screenshots are reviewed at full desktop width and narrow width; they are
      evidence for review, not committed source-of-truth artifacts.

Typical verification from the repository root:

```bash
nix develop ./infra/devshell --command pnpm --dir app typecheck
nix develop ./infra/devshell --command pnpm --dir app test
nix develop ./infra/devshell --command pnpm --dir app lint
nix develop ./infra/devshell --command pnpm --dir app build

ICARUS_BROWSER_BASE_URL=http://127.0.0.1:3112 \
ICARUS_CHROMIUM_EXECUTABLE=/etc/profiles/per-user/jakul/bin/chromium \
nix develop ./infra/devshell --command pnpm --dir app test:browser -- \
  derived-output-architecture.spec.ts
```

Set `ICARUS_LIVE_DERIVED_OUTPUT=1` only for the opt-in provider-backed cases.
