# Document Capability Design

## Status

This directory describes the planned first Document capability increment. No
Document runtime is implemented today: `document/` holds `docs/` and nothing
else, which is what a capability looks like when a design exists and code does
not.

The first increment explicitly excludes formulas, formula atoms, prompt
blocks, Derived Outputs, and background execution.

## Design Documents

Read the design in this order:

1. This overview establishes scope and ownership.
2. [Aggregate model](model.md) defines Documents, Rows, Blocks, page settings,
   and line-break behavior.
3. [Layout](layout.md) defines row width normalization and text measurement.
4. [Document Style Library](styles.md) defines reusable and ad hoc Rich Content
   and block-layout styling.
5. [Runtime procedures](runtime-procedures.md) defines the public APIs and
   mutation flows.
6. [Endpoints](endpoints.md) defines request admission, endpoint jobs, status
   mapping, and registration.
7. [Persistence](persistence.md) defines tables, transactions, revision gates,
   and cross-capability atomicity.
8. [Implementation plan](implementation-plan.md) defines the expected file tree
   and build order.

All eight sit in `docs/` because the directories they describe do not exist yet.
Under
[the capability directory standard](../../../../../docs/capability-directory/capability-directory.md)
every directory carries a document named after itself and sitting inside it, so
each of these moves as its directory lands: this overview becomes `overview.md`
at the capability root, `endpoints.md` becomes `endpoints/endpoints.md`,
`persistence.md` becomes `persistence/persistence.md`, and the per-method trees
in `runtime-procedures.md` become the twenty-two `runtime-api/<method>/` method
documents. `model.md`, `layout.md`, `styles.md`, and `implementation-plan.md`
stay in `docs/`: each belongs to no single directory.

## Purpose

Document owns the composition of authored content:

```text
Document
├── page settings
├── Document Style Library
└── ordered Rows
    └── ordered Blocks
        ├── Rich Content Block ──owns──> one Rich Content object
        ├── Horizontal Rule Block
        └── Page Break Block
```

A Row is one horizontal layout band. Its blocks share that band's usable width
through normalized proportions. Most ordinary prose will use one Rich Content
Block per Row. Multiple blocks in a Row support side-by-side content.

Rich Content still owns text, line-break atoms, inline styles, links, and list
marks. Document owns where Rich Content objects occur, how wide their Blocks
are, their block-wide Rich Content styling, and their relational block layout.

## First-Increment Scope

The first increment supports:

- a revisioned Document title;
- mutable page dimensions and margins;
- font-size-derived character width and height estimates;
- calculation of characters per line and lines per page;
- block-scoped line spacing and text alignment;
- a managed Document Style Library with separate Rich Content and relational
  block-layout entries;
- reusable library styles and ad hoc Block styling;
- ordered Rows containing ordered Blocks;
- normalized block-width proportions within each Row;
- Rich Content Blocks;
- Horizontal Rule Blocks;
- Page Break Blocks;
- empty Rich Content Blocks for editable blank lines;
- splitting Rich Content into separate Rows as the normal editing behavior;
- preserving multiline Rich Content when explicitly requested;
- text, style, link, and list mutations routed through an owned Block;
- atomically creating, splitting, combining, and deleting owned Rich Content;
- PGlite persistence with optimistic revision gates.
- registered Document command and query HTTP endpoints.

The first increment does not support:

- formulas, formula evaluation, or formula atoms;
- prompt blocks, prompt execution, or Derived Outputs;
- other block variants such as tables, images, charts, code, or callouts;
- nested Rows;
- pagination or final typography measurement;
- history, undo, compensation, soft deletion, or purge;
- jobs, queues, or activity publication;
- real-time collaboration beyond optimistic concurrency.

## Capability Boundary

Document owns:

- Document, Row, Block, and Document Style IDs — their kinds, their names, their
  prefixes, and when each is created and destroyed. Only the underlying values
  come from elsewhere, through
  [Platform ID Factory](../../../platform/id-factory/overview.md);
- mutable page geometry and layout-estimation policy;
- Row and Block ordering;
- normalized Block widths;
- Block-to-Rich-Content ownership;
- the Document Style Library and Block style applications;
- the Document structural revision;
- Document persistence and structural invariants;
- the composed Display Document projection.

[Rich Content](../../../resource-support/rich-content/overview.md) owns:

- Rich Content, atom, mark, and list IDs;
- canonical text and line-break atoms;
- inline style and link marks;
- list semantics and markers;
- Rich Content revisions;
- atom and mark transformations;
- its capability-owned persistence.

Document never reads or stores raw Rich Content atoms or marks. It holds only a
`RichContentId` and uses Rich Content APIs for creation, mutation, display, and
ownership-changing operations.

## Core Decisions

- The canonical hierarchy is `Document → Row → Block`.
- Rows are vertical; Blocks inside a Row are horizontal.
- A Rich Content Block exclusively owns one Rich Content object.
- Empty visual lines are empty Rich Content Blocks, not Line Break Blocks.
- A Horizontal Rule Block renders a rule and occupies its own full-width Row.
- A Page Break Block forces the following Row onto a new page.
- Normal editor flows select separate-rows handling for Rich Content line breaks.
- Preserving multiple lines in one Rich Content object is an explicit option.
- Widths use fixed integer units canonically and expose normalized proportions.
- A Block independently applies Rich Content characteristics and relational
  Document styling from the library, ad hoc properties, or both.
- Block-wide Rich Content characteristics form the base; inline marks apply
  afterward.
- Character estimates begin with resolved Rich Content font size rather than a
  page-level average stored as canonical state.
- Document revisions protect title, page settings, Style Library, Rows, and Blocks.
- Rich Content revisions independently protect text and inline marks.
- Any operation that changes both ownership domains uses one shared PGlite
  transaction.

## Dependency Ports

| Capability | Usage |
| ---------- | ----- |
| [Rich Content](../../../resource-support/rich-content/overview.md) | Creates, displays, mutates, partitions, combines, and destroys content owned by Document Blocks. |
| [Platform ID Factory](../../../platform/id-factory/overview.md) | Supplies the collision-resistant values behind Document, Row, Block, and Style IDs. Document names the kinds. |
| Platform Persistence | Supplies the shared Kysely/PGlite database the capability-owned store runs against. Document owns its five tables; Platform Persistence owns the client. |

Each is reached through its bare alias — `#rich-content`, `#id-factory`,
`#persistence` — never through a path inside it.

Document does not depend on Formula, Derived Outputs, Intelligence, or a work
queue in this increment. Its endpoint registration integrates with the existing
[registry](../../../../../src/registry/registry.ts) and
[web-server transport](../../../platform/web-server/runtime-api/register-transport/register-transport.md).

## Runtime Objects

`DocumentRuntime` will be created once per backend runtime after Rich Content,
by `runtime-objects/document/constructor.ts` — the only place that performs
Document startup work. It coordinates Document persistence with the Rich Content
public runtime and a narrow Rich Content transaction-participation port. It is
the only Document object `index.ts` exports; the store, the transaction
participant, and the internal ID factory stay inside the capability.

The internal `DocumentIdFactory` is the second runtime object. It names the ID
kinds Document allocates and takes their values from Platform ID Factory. It
is never re-exported, so no consumer can hold one or substitute one — which is
exactly what lets a test supply a counting factory. See
[the implementation plan](implementation-plan.md).

The initial HTTP API consists of `POST /documents/command` and
`POST /documents/query`. See [Endpoints](endpoints.md).
