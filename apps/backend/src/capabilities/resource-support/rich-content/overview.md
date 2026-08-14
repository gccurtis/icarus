# Rich Content Overview

## Description

Rich Content owns canonical editable content for resource capabilities. It is
named for the content objects it owns rather than for an editor or an HTML
representation, because no consumer's rendering choice belongs to it.

Each content object has a runtime-generated ID and a private representation of
ordered **atoms** (canonical text and line breaks) and **marks** (style, links,
and list membership over ranges of atoms). Consumers never see either. They
receive `DisplayContent` — a derived, versioned projection carrying opaque
handles — and hand those handles back to request the next mutation.

## Boundary

Rich Content owns:

- content, atom, mark, and list identifiers — their kinds, their prefixes, and
  every decision to allocate one — over values from Platform ID Factory;
- the private atom and mark representation, and every rule for changing it;
- content revisions and the compare-and-swap behavior that gates them;
- translation from a display selection to a private raw range;
- the display projection;
- the `rich_content` table.

Consumers own:

- the resource record holding a `RichContentId`;
- authorization to view or mutate the resource that refers to it;
- the editor interaction that chooses an operation;
- rendering the returned `DisplayContent`, including list markers and
  separators, which are display chrome and never canonical text.

## File Tree

```text
rich-content/
├── overview.md
├── index.ts
├── errors.ts
├── types/
├── runtime-objects/
├── runtime-api/
├── persistence/
└── test/
```

There is no `endpoints/`: Rich Content registers no HTTP endpoint. Resource
capabilities decide which of these mutations their own transports expose, so
there is no Bruno collection either.

## Dependency Ports

| Capability | Usage |
| ---------- | ----- |
| `Platform Persistence` | Supplies the shared Kysely/PGlite database that the capability-owned store runs against. Rich Content owns its table; Platform Persistence owns the client. |
| `Platform ID Factory` | Supplies the collision-resistant values behind every ID Rich Content allocates. Rich Content owns the kinds, the names, and the prefixes; Platform ID Factory owns only the generation scheme. |

## Runtime Objects

One instance per backend runtime, constructed by
[`build-runtime.ts`](../../../runtime/runtime.md) during startup.

| Object | Exported | Description | Document |
| ------ | -------- | ----------- | -------- |
| `RichContentRuntime` | yes | The public API: eleven methods over content objects. | [rich-content.md](runtime-objects/rich-content/rich-content.md) |
| `RichContentIdFactory` | internal | Names every content, atom, mark, and list ID, over values from Platform ID Factory. | [id-factory.md](runtime-objects/id-factory/id-factory.md) |

The ID factory is injected into the runtime and never leaves the capability, so
it has a `runtime-objects/` directory and no `runtime-api/` directories. It in
turn takes the runtime's shared `IdFactory`: generation is infrastructure and is
shared, while deciding that a content, atom, mark, or list ID is wanted is a
Rich Content decision and stays here.

## Public API

| API | Kind | Owner | Description | Document |
| --- | ---- | ----- | ----------- | -------- |
| `create` | runtime method | `RichContentRuntime` | Creates one content object from plain text. | [create.md](runtime-api/create/create.md) |
| `replaceText` | runtime method | `RichContentRuntime` | Replaces a range inside one text atom. | [replace-text.md](runtime-api/replace-text/replace-text.md) |
| `applyStyle` | runtime method | `RichContentRuntime` | Adds style properties over a display selection. | [apply-style.md](runtime-api/apply-style/apply-style.md) |
| `removeStyle` | runtime method | `RichContentRuntime` | Removes named style properties over a selection. | [remove-style.md](runtime-api/remove-style/remove-style.md) |
| `setLink` | runtime method | `RichContentRuntime` | Replaces the links over a selection. | [set-link.md](runtime-api/set-link/set-link.md) |
| `removeLink` | runtime method | `RichContentRuntime` | Removes links over a selection. | [remove-link.md](runtime-api/remove-link/remove-link.md) |
| `setList` | runtime method | `RichContentRuntime` | Makes the selected lines list items. | [set-list.md](runtime-api/set-list/set-list.md) |
| `removeList` | runtime method | `RichContentRuntime` | Removes list membership from the selected lines. | [remove-list.md](runtime-api/remove-list/remove-list.md) |
| `split` | runtime method | `RichContentRuntime` | Consumes one object and creates two. | [split.md](runtime-api/split/split.md) |
| `combineAsList` | runtime method | `RichContentRuntime` | Consumes several objects and creates one list. | [combine-as-list.md](runtime-api/combine-as-list/combine-as-list.md) |
| `display` | runtime method | `RichContentRuntime` | Renders the current revision as `DisplayContent`. | [display.md](runtime-api/display/display.md) |

Mutations return a content ID and version only. A caller that wants the result
asks for `display(contentId)`, which is what keeps raw atoms and marks off every
mutation path.

## Data Ownership

| Table | Purpose |
| ----- | ------- |
| `rich_content` | One row per content object: its ID, its current revision, and its atoms and marks as JSONB. |

Details in [`persistence/persistence.md`](persistence/persistence.md).

## Capability Invariants

- Every content, atom, mark, and list ID is allocated by Rich Content, through
  its own ID factory. A consumer never supplies one.
- Raw atoms and marks never cross the runtime boundary. An `AtomId` crosses only
  as an opaque handle.
- Every mutation states the revision it expects, and is rejected with
  `stale-version` if the stored revision differs — before anything is written.
- Every successful in-place mutation advances the revision by exactly one, under
  a compare-and-swap, so at most one writer can commit against a given revision.
- A failed mutation leaves stored content unchanged. `split` and `combineAsList`
  achieve that with a transaction rather than a single conditional update.
- Style and link selections are versioned display ranges; a handle from one
  revision cannot address another.
- List mutations affect complete logical lines, never a partial line.
- `DisplayContent` is derived on every read and is never stored.
