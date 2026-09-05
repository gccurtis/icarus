# Stack Builder

**Date:** 2026-09-04
**Scope:** `app/src/lib/development-views/stack-builder/` and
`app/src/routes/demo/stack-builder/`
**Status:** Approved, not yet built.

## Problem

There is a composition vocabulary — 94 authored components across eight families,
plus the vendored registry underneath them — and no way to ask what an
arrangement of them would look like without building the arrangement.

Three surfaces already answer nearby questions and none answers this one.
`/demo` says what a colour and a size are. `/demo/vocabulary` says which shape
holds a given thing, one shape at a time. `/demo/context` and its siblings put
one finished panel on a stage and report what it read. All three are about a
component. Nothing is about a **composition** — this above that above the other,
each showing something specific — which is the unit a screen is actually
designed in.

Answering it today means writing the screen. That is expensive enough that
arrangements do not get compared, they get committed to; and the frontend
specifications describe roughly two hundred panels and nine screens whose
arrangements are still open.

## Goals

- Assemble a stack of component types by drag, and say in prose what each one
  should show.
- Save that stack as a manifest, reopen it, and keep every revision of it.
- Turn a manifest into a **static mock** that looks like Icarus — real tokens,
  real theme, real component markup — through OpenRouter, and revise it against
  written feedback.
- Stay legible as a development surface. The structural checks encode the
  *application* tree's contract; see "What the checks are for" below.

## Non-goals

- **Rendering the real components in the stack.** The manifest names a
  component; it does not mount one. A live composition is a different tool, and
  a builder that rendered would immediately become a way to write screens
  without writing them.
- **Producing committed code.** The mock is HTML for looking at. It is not a
  `.svelte` file, it is not imported by anything, and nothing generated here
  reaches `app-views/`.
- **A general intelligence integration.** See the third boundary below.
- **Ranking components by quality.** The vendored half of the catalogue is
  curated, but on the question of whether an entry is a *distinct thing to
  place* — never on whether it is any good.

## Three boundaries

These were stated as constraints, and each one closes off a design that would
otherwise have been the obvious next step.

**Nothing here is persisted.** The manifest is scratch. It does not go through
`representation/store`, it is not a table, it is not in `app/data/`, and no
capability reaches it. It is a development log in `logs/`, the same kind of
artifact as `logs/vocabulary-comments.jsonl`. The consequence: nothing in the
application can ever read a manifest, so no schema needs to be agreed with
anything, and the format can change whenever it is convenient.

**The demo tree is strictly separated from app-views.** `stack-builder` is a
development surface. It imports `$authored-components`, `$vendored-components`
and `$styles`, and never `$app-views`. `nothing-imports-development` holds the
trade in one direction — the builder may look at anything, and nothing looks at
the builder. The consequence: this cannot become load-bearing by accident.

**OpenRouter is used uniquely here.** A bespoke, development-only route handler.
Not a capability, not a server model object, not a provider under
`intelligence.bindings`. The vocabulary in
[`docs/processes/intelligence.md`](../../processes/intelligence.md) — providers,
bindings, `agent`/`fast`/`embedding` as named indirection — deliberately does not
apply, and the model dropdown is a direct model reference precisely because this
is not that system.

## Why it cannot be a capability

`requireScope()` reads the project token out of the pathname and accepts it only
from `/app/<token>`. Every capability procedure opens with that call, which is
what `no-procedure-acts-outside-a-scope` enforces. A capability invoked from
`/demo/stack-builder` therefore fails with a 400 before it does anything.

This is correct rather than an obstacle: a capability is the one audited
client→server crossing for project data, and a development tool writing scratch
files into the checkout has no business being one of those. The precedent is
already in the tree — `/demo/vocabulary` writes its notes through a plain
dev-only `+server.ts` for exactly this reason, and this surface follows it.

## What the checks are for

The 65 checks in `scripts/lint/` encode the **application** tree's contract —
what a capability may reach, what a view may not import, where a lifetime is
allowed to live. They exist so that the thing being shipped stays auditable.

A development surface is not that thing. It renders nothing a user reaches, it
holds no project state, and nothing outside `development-views/` may import it.
So a check is guidance here rather than law, and this surface follows one where
it is right and says so where it is not — rather than contorting to satisfy a
rule written about a tree it is not in.

In practice the difference is small, because most of the rules turn out to be
good design independently:

| rule | followed here, and why |
| --- | --- |
| entered at an index | yes — an export is the nameable unit regardless |
| five concerns, named grid | yes — it is how `review/` is legible |
| `shared/` constructs nothing at load | yes — two builder tabs must not share a stack |
| nothing imports development | yes — this is the boundary that keeps it free |

Where a check would cost something and buy nothing, the surface takes the
finding. It is worth noting that `no-deep-import` already records
`development-views/plot-demo` as one of its two findings, so a development
surface sitting outside a rule is the existing state rather than a new idea.

**Scoping the checks to the application tree is a separate change**, not part of
this work. It touches how every check enumerates its files, and it should be
proposed on its own.

## Where it lives

```text
development-views/stack-builder/
├── stack-builder.md
├── stack-builder.svelte          root; the named grid
├── types.ts                      StackNode, Manifest, GenerationRound
├── components/
│   ├── components.md
│   ├── catalogue.svelte          left — the 100 entries, grouped and filtered
│   ├── catalogue-entry.svelte    one Draggable row
│   ├── stack-tree.svelte         centre-top — zones, reorder, substacks
│   ├── stack-node.svelte         recursive
│   ├── entry-detail.svelte       centre-bottom — the selection's description
│   ├── generate-panel.svelte     right — model, generate, feedback, rounds
│   └── mock-frame.svelte         the iframe
├── shared/
│   ├── shared.md
│   ├── catalogue.svelte.ts       createCatalogue()
│   ├── stack.svelte.ts           createStack()
│   └── generation.svelte.ts      createGeneration()
├── procedures/
│   ├── procedures.md
│   ├── manifest.ts               node tree ⇄ manifest JSON. Pure.
│   ├── models.ts                 the ten model ids. Pure.
│   ├── vendored.ts               the six vendored entries. Pure.
│   └── prompt.ts                 assemble the request payload. Pure.
└── test/unit/{manifest,prompt}.test.ts
```

The root holds its document, its component, its types and its concerns, which is
what `concern-is-one-of-five · permitted-root-entries` asserts. No `effects/` and
no `interactions/`: nothing here reaches outside the component tree for a side
effect, and the gestures are ordinary handlers on the components that own them.

**Three factories, none constructed at module load.**
`shared-hands-out-no-instance` refuses an instance created when the module is
imported, because it would outlive the mount and be handed to the next one — two
builder tabs would then share a stack. `createCommentLog` in
`development-views/vocabulary/shared/` is the working precedent for the shape:
a factory returning an object of getters over `$state`, put into context by the
root.

Runes live in `shared/*.svelte.ts` and nowhere else. `effects-declare-runes ·
others-declare-no-rune` bans them under `procedures/`, which is what keeps
`manifest.ts` and `prompt.ts` pure and therefore unit-testable without a
component.

`documented-paths-resolve` reads every path named in a concern document, so each
of the three concern documents names only files that exist.

## The routes

```text
routes/demo/stack-builder/
├── +page.svelte                  four lines
├── manifest/+server.ts           GET read · POST append a revision
├── generate/+server.ts           POST a round → writes the mock file
└── mock/+server.ts               GET serve it · DELETE clear it · POST save a copy
```

Every handler opens with `if (!dev) return new Response("not found", { status:
404 })`. All of them read or write the checkout, and a running deployment must
never do either — absent verbs rather than guarded ones, following the comments
endpoint.

**The model list is a named constant, not a fetch.** `procedures/models.ts`
holds ten entries. OpenRouter's own catalogue is 427 models; proxying it means an
endpoint, a searchable palette over several hundred rows, and a network
dependency before the dropdown can render at all — a lot of surface for a control
whose job is to pick between a handful of things.

The list, verified against OpenRouter's live catalogue on 2026-09-04:

| id | ctx | max out | image in | $/M in · out | why it is here |
| --- | --- | --- | --- | --- | --- |
| `anthropic/claude-opus-5` | 1M | 128k | yes | 5.00 · 25.00 | Claude, flagship |
| `anthropic/claude-sonnet-5` | 1M | 128k | yes | 2.00 · 10.00 | Claude, cheaper |
| `google/gemini-3.1-pro-preview` | 1M | 65k | yes | 2.00 · 12.00 | Gemini, strongest |
| `google/gemini-3.8-flash` | 1M | 65k | yes | 0.75 · 3.75 | Gemini, fast |
| `openai/gpt-5.5` | 1M | 128k | yes | 5.00 · 30.00 | ChatGPT |
| `moonshotai/kimi-k3` | 1M | 944k | yes | 3.00 · 15.00 | Kimi |
| `deepseek/deepseek-v4-pro-0813` | 1M | 384k | no | 1.12 · 3.35 | DeepSeek |
| `z-ai/glm-4.7` | 205k | 131k | no | 0.40 · 1.75 | strong coder, cheapest capable |
| `x-ai/grok-build-0.1` | 256k | 230k | yes | 1.00 · 2.00 | trained for coding; most output per dollar |
| `minimax/minimax-m2.7` | 205k | 131k | no | 0.30 · 1.20 | cheapest on the list |

**There is no "visual model" slot, because that is not a model trait.** The
concrete capability for design work is **image input** — handing the model a
screenshot of a reference — and seven of the ten have it. GLM, DeepSeek and
MiniMax are text-only, so if the builder ever grows a reference-image input,
those three stop being options and the table above is where that is visible.

Max output matters more than context here: a full HTML mock is a long single
response, and every entry clears it comfortably.

A list in the source does go stale — that is the argument
`docs/processes/intelligence.md` makes for named bindings, and it is true here
too. The mitigation is that this is a development surface and the file is one
array: a dead id is a one-line edit, and the failure is a clear 404 from
OpenRouter rather than a silent fallback. The last choice is remembered in
`localStorage`.

**The key is read as `env.OPENROUTER_API_KEY` from `$env/dynamic/private`**, and
never reaches a client bundle. Verified against the running dev server on
2026-09-04, and the two negatives matter as much as the positive:

- `process.env.OPENROUTER_API_KEY` is **undefined**. The plan must not use it.
- Vite's `envDir: ".."` alone is **not enough**. It governs `import.meta.env`;
  SvelteKit's `$env/*` modules read `kit.env.dir`, which is a separate setting.
  With only the Vite one set, the key was absent.

Both are now in place — `envDir` in `vite.config.ts` and `env: { dir: ".." }` in
`svelte.config.js` — and the key resolves. This is worth stating because the
failure is silent: an endpoint reading `process.env` gets `undefined` and reports
a missing key, which reads as a configuration problem rather than a wrong import.

`configuration/local.yaml` also carries
`intelligence.providers.openrouter.apiKey`, which is read by nothing; this
surface does not start reading it, because doing so would be the first step
toward the provider system this is explicitly not part of.

## The catalogue

**100 entries: 94 authored, discovered; 6 vendored, named.** The two halves are
built differently because they are different kinds of thing.

### Authored — the whole tree, from its indexes

`import.meta.glob("$authored-components/*/index.ts")`, and the catalogue entries
are the **exports** read off each module. A component added to a vocabulary's
index appears in the left list with no edit to this surface, which is how
`review/` gets its tree and how the three shell containers load their contents.

> The filesystem is the registry everywhere here — a list beside it would be a
> second answer to what exists, and the two would disagree the first time
> somebody added a directory without editing it.

The index rather than the files under it, because an export is the unit a
consumer can name and a vocabulary's internal filenames are its own business.
This happens to be what `vocabulary-is-entered-at-index` also asks for, but it
holds here on its own merits — see below on what the checks are for.

### Vendored — six, listed by name

Not a glob. A named list in `procedures/`, because the question "which of these
is a distinct thing to place" has an answer that a directory listing does not
contain.

**Twenty-three of the forty-three are already wrapped by an authored
component** — `button` appears inside eleven of them, `input` in five, `table`
in four, and so on through `dropdown-menu`, `avatar`, `select`, `popover`,
`command`, `dialog`, `carousel` and the rest. Where an authored component wraps
a vendored one, the authored component **is** the vocabulary word for that job.
Listing both would give the manifest two ways to say one thing, and the
description text would have to spend itself disambiguating what the entry should
already have settled.

A second rule removes most of the remainder: a catalogue entry is **placed**, not
attached. `dialog`, `alert-dialog`, `sheet`, `context-menu`, `hover-card` and
`tooltip` are opened by an interaction inside something else or laid over it, and
never sit in a stack. `review.md` already makes this argument for why there is no
modal route, and it is the same argument.

What survives:

| entry | why the authored vocabulary has no word for it |
| --- | --- |
| `accordion` | a disclosure list; `PanelBranch` is a tree node, not this |
| `checkbox` | `PanelToggle` is a switch, `PanelMarks` is independent marks |
| `pagination` | nothing in either family pages a list |
| `separator` | real structure in a stack |
| `tabs` | no authored word at all |
| `toggle` | a pressed state, distinct from a switch |

Also dropped: `aspect-ratio`, `resizable`, `scroll-area` and `sidebar` are layout
primitives with nothing to describe; `card`, `radio-group`, `field`, `label` and
`spinner` each have an authored word already (`ScreenCard` and `Panel`,
`PanelChoice`, `PanelField`, `PanelProgress`).

Because it is a list and not a glob, adding one back is a line — and the list is
the place to record *why* each is there, which a glob cannot hold.

### The two halves describe themselves unequally

Each authored vocabulary's `index.ts` is a long prose argument for what each
shape is for and why it is not its neighbour — 13 KB for `panel`, 7 KB for
`screen`, 27 KB in total. Vendored components carry none of that by design: they
are the CLI's output, taken as shipped. So a vendored entry shows its name and
the one-line reason from the table above, and its `description` field is doing
more work than an authored entry's. Presenting them identically would hide that.

## The manifest

```ts
type StackNode =
  | { kind: "component"; id: string; source: "authored" | "vendored";
      name: string; description: string }
  | { kind: "custom";    id: string; name: string; description: string }
  | { kind: "substack";  id: string; name: string; description: string;
      children: StackNode[] };

type Manifest = { slug: string; title: string; nodes: StackNode[] };
```

One union, three cases, one of them recursive.

`id` is the **node's** identity inside this manifest, minted on insert and stable
across reorders and renames — it is what selection, drag and the tree keys are
keyed on. It is never the component's identity: one stack holds three
`PanelStat`s showing three different things, and they are three nodes.

- **component** — a real entry from the catalogue. `name` is the export
  (`PanelStat`, `Accordion`); `source` decides which glob it came from and how
  much prose exists for it.
- **custom** — a shape the vocabulary does not have. Named and described by
  hand, and the mock invents it. This is also the surface's own feedback channel
  about the vocabulary: a custom entry that keeps recurring across manifests is
  an argument for a component.
- **substack** — a group. Recursion is the shape of the thing being drawn rather
  than a convenience: a card holding three stats is a stack inside a stack, and
  flattening it would lose the only structure the manifest carries.

`description` is the point of the whole surface. It is what the entry should
show, in prose, and it is the thing the model is actually being asked to
satisfy — the component name only says which shape to say it in.

## Layout

One grid, one track template, nothing hidden behind a mode:

```text
grid-template-areas:
  "head   head    head"      auto
  "list   stack   ai"        minmax(0, 1fr)
  "list   detail  ai"        minmax(auto, 20rem)
grid-template-columns: 20rem minmax(0, 1fr) 24rem;
```

The catalogue and the generation column span both content rows; the centre
splits into the stack above and the selected entry's description below. One
template means the columns cannot disagree about their widths as the rows change
— the alternative, two nested grids, is two answers to how wide the catalogue is.

Each region owns its own scroll and the frame is `overflow: hidden`, so the page
never scrolls as a whole. This is `review.svelte`'s arrangement with a fourth
region, and it is why that surface is the one to read before writing this one.

## Drag

`$authored-components/drag`, used as shipped.

That vocabulary carries a rule from the specifications, in these words:
**nothing is drag-only**, and **a thing is undraggable or it has a defined
result**. `Draggable` therefore takes `destinations` rather than emitting
`ondragstart`, and renders the same list as a menu on the item; `DropZone` takes
`additions` and renders an add menu. Declaring the destinations once is what
keeps the pointer path and the keyboard path from diverging.

Applied here:

- A catalogue entry's destinations are the stack and every substack in it, by
  name. So "add `PanelStat` to *Header*" is reachable from the item without a
  drag.
- The stack and each substack are `DropZone`s whose `additions` are… the
  catalogue, which is 100 entries and too many for a menu. This is the one place
  the vocabulary does not fit: the zone's add menu becomes **"Add a
  component…"**, opening the vendored `command` palette over the same list the
  catalogue filters. The rule is kept — the place-first path exists — and the
  affordance is the one that works at this cardinality.
- Reordering is `onreceive` on a node, because reordering and moving-to-a-zone
  are the same gesture with a different target. Its menu destinations are the
  ordinary pair, "Move up" and "Move down".

The transfer is HTML5's, which is what lets the catalogue on the left and the
zone in the centre exchange an item without sharing a store or a parent.

## The generation round

A round is one request. It carries three things.

**The fixed brief** — the token layer and
`app/docs/frontend-design/design-preferences.md`. About 34 KB of plain CSS and
the aesthetic discipline it serves. Identical on every call, which is what makes
it cheap.

**The manifest** — the stack as JSON, descriptions included.

**Evidence for each component in the stack** — two things, both of them files
already on disk:

1. its vocabulary `index.ts` prose for that export, where there is any;
2. its **source file**.

Source rather than an extracted prop signature, because extracting one means a
bespoke parser for `$props()` destructuring and its type annotation, and the
whole file is where the props block, its doc comment and its actual markup and
class list already are. An authored component averages 3.5 KB, so a fifteen-entry
stack is roughly 50 KB of source — bounded by the size of the stack, which is the
thing being designed and is therefore small.

**There is no render step.** An earlier draft ran each component through a
variant of `app/scripts/lint/shared/render-worker.mjs` to put its real SSR output
in the prompt. That worker spawns a Vite SSR server in a child process, and doing
that from inside the running dev server's own request handler is the most
elaborate and least certain thing in the design — for a marginal gain over source
that already contains the same markup.

The trade is honest: rendered output would have been strictly better evidence,
because it is what the component actually emits after its `$derived` and its
`cn()` calls resolve. Source is one step removed. But source cannot fail, cannot
hang, needs no child process, and works identically for the vendored components
that would not have server-rendered with an empty prop bag anyway. If mocks turn
out to drift from our markup, the render step is the first thing to add back.

### Revision

Feedback does not restart. The next round carries the manifest, the mock the
previous round produced, and the feedback text, and asks for a revision — so
"the header is too heavy" fixes the header and leaves the rest.

Each round overwrites the working mock file, and every round is recorded in the
log. The prompt carries only the immediately previous mock, so the request does
not grow with the session. Keeping an attempt is an explicit Save.

## The mock frame

**The mock is a file.** `logs/stack-builder/mock.html` is the working mock and
always exists; the iframe's `src` is `/demo/stack-builder/mock`, which serves it.
Generate overwrites it, Clear replaces it with an empty document, and Save copies
it to `logs/stack-builder/mocks/<name>.html`.

A file rather than `srcdoc`: no attribute size limit, no HTML escaping of a
document inside an attribute, and the artifact is a real page that opens in a
browser on its own — which is what makes it a static mock rather than a thing
that exists only while the builder is up. It also means the iframe has something
valid to show before the first generation and after a failed one, instead of the
builder having to model an empty state.

The endpoint writes a complete document: doctype, `data-theme`, a `<style>`
holding the token layer, then the model's body. The token CSS is **read from disk
per request** rather than imported at build time — it is dev-only, the read costs
nothing that matters, and it means the mock can never be styled by a stale copy
of the tokens. It also avoids needing Vite's `?raw` machinery at all.

`/demo/stack-builder/mock?theme=cyberpunk` stamps the attribute, so the builder's
theme switcher moves the mock by changing the iframe's `src`.

**This endpoint has been proven end to end** against the running dev server on
2026-09-04: a throwaway route reading the eight CSS files off disk, joining them
into a `<style>`, and stamping `data-theme` from the query parameter returned a
valid 35,425-byte `text/html` document with the tokens resolving. It was a probe
and has been deleted, but it means the mock frame is the least uncertain part of
this design rather than a guess — which is why the build order proves it at step
5, before anything generates into it.

### Why HTML rather than our actual components

Our components are Svelte. Using them means the model emits Svelte, which has to
be compiled and mounted before anyone can look at it — so every generation
becomes a build step, a bad generation is a *broken page* rather than an ugly
one, and a saved mock is no longer a file you can open. The isolation the iframe
exists for would also go: a Svelte mock has to run inside the application to run
at all.

The alternative worth naming, because it is genuinely different from both: have
the model return a **composition** — which component, what props — and SSR our
real components into the mock server-side. No compilation of generated code, and
the mock is literally made of our components' output.

It was rejected because it can only produce what the vocabulary can already
express. Novel layout is unreachable, and the `custom` node kind stops working
entirely — which is the case that matters most, since a `custom` entry is how the
builder says the vocabulary is missing something. A tool for designing
arrangements that do not exist yet cannot be limited to arrangements that do.

The cost of the choice is that the model can drift from our markup, and the
component source in the payload is the mitigation.

**Why tokens and not utility classes.** Tailwind v4 emits only the utilities it
has scanned in source files. A generated mock reaching for `bg-surface-panel`
renders unstyled unless some existing file already uses that exact class — a
failure that is silent, intermittent, and depends on code the mock has nothing
to do with. The canonical tokens have no such dependency, and `color.css` says
so directly:

> Canonical tokens are ordinary root custom properties, so their availability
> does not depend on Tailwind's scanner.

**Why the token layer can simply be inlined.** Eight files —
`chromatic-themes/{celestial,cyberpunk,slots}.css` and the five
`semantic-tokens/*.css` — are all declared *outside* `@theme`, on purpose:

> Declared OUTSIDE @theme on purpose. Tailwind generates no utilities from
> these, which mechanically enforces the rule that nothing references the
> palette directly.

They are therefore plain CSS, 35,193 bytes, requiring no build step to be useful
in a document that is not part of the app. Copying `data-theme` across means the
theme switcher in the builder's head moves the mock too, and both themes are in
the payload already because `slots.css` resolves them with `light-dark()` off the
theme's own `color-scheme`.

**Why an iframe rather than inline.** A generated `<style>` block or a stray
selector would otherwise reach the builder chrome that is reviewing it. The
isolation is the point: what is on the stage must not be able to change the
instrument.

## Persistence

```text
logs/stack-builder/<slug>.jsonl          append-only; the last record wins
logs/stack-builder/mock.html             the working mock; always exists
logs/stack-builder/mocks/<name>.html     saved copies
```

The log is append-only for the reason the comments log gives — appending is the
only write that cannot lose earlier work — and because it makes history free: a
mock record says which manifest revision produced it, and that reference stays
true.

**The mock file is the one thing that is overwritten**, and deliberately so. It
is the current state of one working document; a generation replaces it, Clear
empties it, and keeping an attempt is the explicit Save that copies it under a
name. Accumulating every attempt automatically would make the interesting one
harder to find, not easier.

Three record kinds in one log, in the order things happened:

```jsonc
{ "at": "…", "kind": "manifest", "title": "…", "nodes": [ … ] }
{ "at": "…", "kind": "mock", "revision": 4, "model": "…", "feedback": "…" }
{ "at": "…", "kind": "saved", "file": "mocks/header-v2.html" }
```

`revision` is the ordinal of the `manifest` record the mock was generated from,
counted within the file. That is the reference that makes history worth keeping:
a mock says which arrangement produced it, and appending never invalidates it.

The server stamps `at`; the client never does, because two clocks disagree. A
line that no longer parses is skipped on read rather than fatal, so the file
survives being opened and edited by hand while the page is up.

`logs/` is git-ignored scratch. Nothing here is a project artifact, and a
manifest worth keeping is one somebody copies out deliberately.

## Testing

`procedures/manifest.ts` and `procedures/prompt.ts` are pure, and are written
test-first:

- **manifest** — insert at a position, insert into a substack, reorder within a
  level, move between levels, remove a node with children, round-trip a tree
  through JSON and back. The recursive cases are where this will actually break.
- **prompt** — assembling a payload from a manifest and a set of render results,
  including the fallback when a render failed and the revision shape when a
  previous mock is present.

The three `shared/` factories are exercised through the components. The route
handlers are thin development I/O over `node:fs` and `fetch`, and are tested by
use rather than by a suite that would mostly assert the shape of a mock of the
filesystem.

## Risks

**Nested drag.** `Draggable` and `DropZone` were built for flat lists and for
zones on a plane. A tree that both reorders *and* nests is the one interaction
here with no precedent in the codebase, and it is where this is most likely to
need a second attempt. The flat stack is built and proven first; substacks come
after, so a nesting problem cannot block everything else.

**A dead model id.** The list is a constant, so an id retired by OpenRouter fails
at call time. It surfaces as an error from the endpoint naming the id, not as a
silent substitution, and the fix is one line.

**Prompt size on a large stack.** Fifty entries would be ~175 KB of source before
the brief. The stack is the thing being designed and is not expected to be that
large, but the payload should report its own size so the failure is legible
rather than a truncated response.

**The model writes Tailwind anyway.** Likely on the first attempts, since it is
what the training data contains. The brief has to state the rule directly, and
the mock frame's isolation means the failure is visible — an unstyled mock — not
subtle.

## Build order

1. `types.ts`, then `procedures/manifest.ts` test-first — flat operations only.
2. The catalogue globs and the vendored list; `shared/catalogue.svelte.ts`.
3. The grid, the catalogue column, a **flat** stack with drag and reorder, the
   detail pane. The surface now builds a stack and does nothing else, which is a
   useful thing on its own.
4. `manifest/+server.ts` and reopening a saved stack.
5. `mock/+server.ts` and the iframe, against a hand-written placeholder
   `mock.html`. The frame is proven before anything generates into it.
6. `procedures/prompt.ts` test-first, then `generate/+server.ts` and the
   generation column.
7. The revision loop.
8. Substacks — nesting in `manifest.ts` test-first, then in the tree.

Steps 1–5 have no dependency on OpenRouter, which keeps the part that can be
verified locally separate from the part that cannot. Nesting is last because it
is the least certain interaction and nothing else needs it.
