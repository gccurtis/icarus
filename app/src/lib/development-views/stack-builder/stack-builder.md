# Stack Builder

Lives at `src/lib/development-views/stack-builder/stack-builder.md`. Concerns live in
the documents linked below.

## Purpose

An arrangement, argued with before it is built. Rendered at `/demo/stack-builder`.

There are a hundred shapes in the vocabulary and no way to ask what a particular
stack of them would look like without writing the screen. That is expensive
enough that arrangements get committed to rather than compared. Here a stack is
assembled by drag, each entry is described in prose, and the result is handed to
a model that returns a static mock.

A companion to `/demo/vocabulary`, and a different question. That page asks which
shape holds a given thing, one shape at a time. This asks what several of them
look like stacked, which is the unit a screen is actually designed in.

## Boundary

This view owns:

- the catalogue, read off the vocabulary indexes at load;
- the stack: what is in it, its order, and what each entry is said to show;
- the round — which model, what feedback, and what came back;
- the frame the mock is looked at in.

It does not own:

- the components. It names them and reads their source; it never mounts one.
- what the mock is. That is the model's answer, and it is data on disk.
- anything the application reads. Nothing here reaches a capability, the store,
  or `app/data/`.

## Why the manifest names a component rather than rendering one

A builder that rendered the real components would be a way to write screens
without writing them, and the arrangements worth having are the ones the
vocabulary cannot express yet. That is what a `custom` entry is for: it says the
vocabulary is missing a word, and a `custom` entry that keeps recurring is an
argument for a new component.

## Why the mock is a file

Our components are Svelte, so "use our components" would mean compiling generated
code before anyone could look at it — every round a build step, and a bad round a
broken page rather than an ugly one. The mock is HTML instead, written to
`logs/stack-builder/mock.html` and served by its own endpoint.

A file rather than an `srcdoc` attribute: no size limit, no escaping a document
inside an attribute, and the artifact is a page that opens in a browser on its
own. It also gives the frame something valid to show before the first round and
after a failed one.

The frame is `sandbox=""`. Same-origin gives CSS isolation but not script
isolation, and a generated `<script>` could otherwise reach the builder around
it. Nothing in a static mock needs to run.

## Why the token layer is read from disk

The eight files under `styles/chromatic-themes/` and `styles/semantic-tokens/`
are declared outside `@theme`, so they are plain CSS and need no build step to be
useful in a document that is not part of the application. They are read per
request rather than imported, which costs nothing on a development route and
means the mock can never be styled by a stale copy.

Their order is load-bearing. A theme selector and `:root` have the same
specificity, so the dark theme wins only by being loaded second.

The mock renders in the system font. `@font-face` is per-document and the
builder's IBM Plex does not reach the frame — a side-by-side comparison differs
in typeface, and that is stated rather than hidden.

## Why the catalogue's vendored half is six

Twenty-three of the forty-three vendored components are already wrapped by an
authored one, and where that is true the authored component *is* the word for
that job — listing both would give the manifest two ways to say one thing. Most
of the rest are opened by an interaction or laid over something, and a catalogue
entry is placed rather than attached. What survives is six, each carrying the
reason it survived as text the surface renders.

The authored half is discovered rather than listed: an export is an entry when it
is the default of a component file, which is the only test that separates the 94
components from the 107 names the indexes export.

## Public Contract

- **Entry:** [`stack-builder.svelte`](stack-builder.svelte)
- **Types:** [`types.ts`](types.ts)

| Kind | Name | Type | Required | Purpose |
| --- | --- | --- | --- | --- |
| Prop | `indexes` | `Record<string, Record<string, unknown>>` | Yes | The glob over the vocabulary indexes. Handed in because `import.meta.glob` needs a literal pattern |
| Prop | `files` | `Record<string, unknown>` | Yes | The glob over the component files, whose defaults identify which exports are components |

## Dependencies

### Objects

| Object | Usage |
| --- | --- |
| `None` | The stack is this view's own state and dies with the mount |

### Capabilities

| Capability | Usage |
| --- | --- |
| `None` | A capability is reached at `/app/<token>` and would be refused here. The three route handlers are development-only and speak to the filesystem |

### Presentation

| Dependency | Usage |
| --- | --- |
| `$authored-components/drag` | Picking a component up and putting it in the stack |
| `$vendored-components` | The controls, as shipped |
| Token domains: spacing, color, shape | Every dimension off the one spacing unit |

## Directory Documents

| Concern | Document | What it owns |
| --- | --- | --- |
| Components | [components.md](components/components.md) | The four regions and the frame |
| Procedures | [procedures.md](procedures/procedures.md) | The pure operations, and the two the server alone may load |
| Shared | [shared.md](shared/shared.md) | The stack, and why it is the only shared state |

## Rendered States

| State | Trigger | Visible result | Available recovery |
| --- | --- | --- | --- |
| Initial | The route rendered it | The catalogue, an empty stack, and a mock frame saying nothing has been generated | — |
| Empty | Nothing in the stack | The zone says what belongs in it; Generate is disabled | — |
| Running | A round is in flight | The button reads "Generating…" and is disabled | — |
| Failure | The model, the key, or the dev server refused | The reason, in the danger role, beside the button | Pick another model, or fix the key |
| Stale | `None` | — | — |
| Denied | `None` | — | — |

## Accessibility

- **Landmark and accessible name:** the stack is the `main` landmark; the
  catalogue, the generation column, and the detail pane are `aside` and
  `section`.
- **Initial focus:** the document.
- **Keyboard model:** nothing is drag-only. Every catalogue row declares where it
  may go and renders that as a menu, and every zone has an add menu; the model
  chooser is a native `select`.
- **Announcements:** `None`. A round's state is on the button that started it.
- **Focus restoration:** none needed; nothing here opens over the page.

## Layout and Overflow

- **Parent constraints:** it takes the viewport.
- **Responsive behavior:** the stack column absorbs the change; the flanks hold
  their track widths.
- **Scroll owner:** the catalogue, the stack, and the detail pane, each for
  itself. The frame sets `overflow: hidden` so the page never scrolls as a whole,
  and every region carries `min-width: 0` and `min-height: 0` — without the pair
  a grid item refuses to shrink below its content and takes the scroll with it.
- **Minimum and maximum geometry:** the detail row is `minmax(0, …)`. With
  `minmax(auto, …)` a long description grows the grid past the viewport and the
  overflow is clipped rather than scrolled.

## View Invariants

- **The manifest is scratch.** It is a development log, not application state,
  and nothing the application reads can see it.
- **A client string that becomes a path is admitted first.** The stack's file
  name and the saved mock's name are both segments, and the component sources are
  files the server opens.
- **The mock file is the one thing overwritten.** A round replaces it; keeping an
  attempt is the Save that copies it under a name.
- **Nothing outside `development-views/` imports this.**

## Supporting Documents

| Document | Subject |
| --- | --- |
| [`../vocabulary/vocabulary.md`](../vocabulary/vocabulary.md) | Which shape holds a given thing — the question below this one |
| [`../review/review.md`](../review/review.md) | The layout this grid is modelled on |
