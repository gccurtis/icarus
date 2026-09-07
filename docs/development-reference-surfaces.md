# Development reference surfaces

This is the project standard for a development page whose job is to make a
system understandable and provable. It records the decisions behind the
Derived Output procedure flow, agent runtime, and executable proof pages. It is
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

## Why the Derived Output reference is three pages

One long reference page could contain all the information, but it would force
three different questions into one visual hierarchy. The pages are separated
by the kind of understanding they need to create.

| Surface | Question | Visual grammar | Proof level |
| --- | --- | --- | --- |
| Procedure flow | What calls what, from an authored resource to an editable generated block? | converging entry paths, call graphs, sequence, state machine, callable ledger | exact symbols and current/deferred status |
| Agent runtime | What does the agent know, what may it call, and how does evidence become durable? | context stack, control loop, interactive tool console, evidence chain, infrastructure priorities | executable system prompt imported from the capability; target tools labeled as target |
| Live proof | Does the vertical slice really work? | two-input laboratory, execution rail, stored result, evidence record | real project store, real resource write, real embedding/index query, real structured generation, real value read |

The pages link to one another, but each can stand on its own. Reusing navigation,
typography, or a diagram renderer is useful; forcing the same card grid or
section convention onto all three is not.

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
production worker. This is why the agent page says that `retrieve` is live while
`read_selection`, `find_resources`, and `read` are target tools.

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

The normal entry is an accepted document or slide-deck revision. It persists the
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

Prompt creation belongs to the document, not the context rail:

1. place the caret on an empty line;
2. choose `Prompt` from the normal Block selector;
3. configure the prompt in the Prompt inspector;
4. create and link the Derived Output;
5. process pending semantic work and refresh;
6. copy the published response into the block's editable atoms, display, and
   marks;
7. use the right-edge star to reopen Prompt settings.

The block looks like ordinary text. Its generated response is selectable,
formattable, and editable. The small star is an out-of-content editor decoration,
like a comment affordance; it is not part of the document text. An inline edit
marks the block stale and becomes ungrounded previous-response continuity at the
next refresh. Evidence remains canonical on the Derived Output, never on the
edited document prose.

The Prompts context panel is an index of Prompt Blocks already in the current
document. It can navigate and inspect; it does not create.

### Agent evidence boundaries

The target agent remains one bounded agent with four narrow tools:

| Tool | Reads | Uses Semantic Overlay? | Evidence behavior |
| --- | --- | --- | --- |
| `read_selection` | current selected range in its authoritative project resource | no | application resolves the selection and issues an evidence ID |
| `find_resources` | scoped resource metadata | no | navigation only; no factual evidence |
| `retrieve` | semantically similar overlay spans | **yes** | every exact returned span receives an attempt-local evidence ID |
| `read` | authoritative resource text, outline, or allowlisted structure | no | every returned ranged chunk receives an evidence ID |

This distinction is non-negotiable: `retrieve` queries the Semantic Overlay;
`read` reads project resources. A `read` request can take the exact `from`/`to`
range returned by retrieval and ask for bounded characters before or after it,
but that is a direct resource read, not a second overlay operation.

When a selection exists, the run envelope carries `hasSelection: true`, not the
selected text. The target loop first calls `read_selection`; the application
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

The live editor scenario is separate and equally important: type a fact in one
ordinary document, create a Prompt Block in another, generate, see the answer as
normal text, reopen settings with the star, and inspect exact evidence. This
tests product composition, not only capability composition.

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
evidence—not just its outer background.

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
| Executable proof page | `app/src/lib/development-views/derived-output-architecture/components/live-proof.svelte` |
| Adaptive diagram renderer | `app/src/lib/development-views/derived-output-architecture/components/mermaid-diagram.svelte` |
| Exact executable agent instruction | `app/src/lib/capabilities/derived-output/api/shared/agent-instructions.ts` |
| Prompt Block inspector | `app/src/lib/app-views/categories/document-editor/inspector/prompt-block.svelte` |
| Linked Prompt settings | `app/src/lib/app-views/categories/document-editor/components/prompt-settings.svelte` |
| Prompt list context | `app/src/lib/app-views/categories/document-editor/context/prompts.svelte` |
| Inline Prompt marker | `app/src/lib/app-views/categories/document-editor/procedures/prompt-markers.ts` |
| Editable response synchronization | `app/src/lib/app-views/categories/document-editor/procedures/prompt-blocks.ts` |
| Durable blank-resource entry | `app/src/lib/app-views/categories/new-tab/procedures/creating.ts` |
| Represented first document block | `app/src/lib/capabilities/project-resources/api/create-project-resource/create-project-resource.ts` |
| DAG-safe store serialization | `app/src/lib/representation/store/path.ts` |
| Architecture browser proof | `app/test/browser/derived-output-architecture.spec.ts` |

Routes are served under:

- `/demo/semantic-overlay/derived-output-flow`
- `/demo/semantic-overlay/agent-runtime`
- `/demo/semantic-overlay/derived-output-live` (redirects into the project-scoped
  application route before executing writes)

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
