# Rich Content Capability

This is the backend capability that provides rich-text behavior. The code calls
it **Rich Content** because it owns canonical content objects rather than a
particular editor or HTML representation.

## Reading Order

1. Read this page for the capability boundary and basic mental model.
2. Read the [implementation flow](implementation.md) to follow calls from
   backend initialization through domain logic and persistence.
3. Use the [capability overview](rich-content-overview.md) as the complete API,
   type, persistence, and invariant reference.
4. Read the [behavior tests](../../../../../test/rich-content.test.ts) for
   executable examples of the behavior implemented today.

## Mental Model

```text
Resource capability
  owns a RichContentId
  calls the RichContentRuntime
    stores private Raw Content
      ordered atoms = canonical content
      marks = style, links, and list membership
    returns Display Content
      lines and styled text segments
      opaque handles for later mutations
```

A resource such as a document will own a `RichContentId`; it does not own the
text atoms or formatting marks. Rich Content owns those details and exposes
mutations plus a derived display projection.

The separation is deliberate:

- **Raw Content** is the persisted source of truth and stays private.
- **Display Content** is a read-only projection for consumers and editors.
- **Display handles** identify a position or range without exposing raw marks.
- **Expected versions** prevent one edit from silently overwriting another.

## What Runs Today

The runtime currently supports:

- creating content from plain text, including line breaks;
- replacing text inside a text atom;
- applying and removing style properties;
- setting and removing links;
- applying and removing ordered or unordered list presentation;
- splitting one content object into two new objects;
- consuming several single-line content objects to create one list object;
- rendering the latest Raw Content as Display Content;
- persisting all canonical state in PGlite with revision-gated writes.

There is no Rich Content HTTP endpoint. Other resource capabilities will decide
how their own transports expose this runtime.

## Capability Boundary

Rich Content owns:

- content, atom, mark, and list identifiers;
- the private atom and mark representation;
- content revisions and compare-and-swap behavior;
- display-range translation;
- display projection;
- the `rich_content` database table.

Consumers own:

- the resource record containing a `RichContentId`;
- authorization to view or mutate that resource;
- the editor interaction that selects an operation;
- rendering the returned Display Content in a user interface.

## Core Data Relationship

```text
RawContent
├── id
├── version
├── atoms[]
│   ├── TextAtom
│   └── LineBreakAtom
└── marks[]
    ├── StyleMark
    ├── LinkMark
    └── ListItemMark

renderDisplayContent(RawContent)
└── DisplayContent
    └── lines[]
        ├── optional rendered list marker
        └── text segments[]
            ├── text
            ├── resolved style
            ├── active links
            └── opaque atom handle
```

Atoms hold canonical content. Marks describe behavior over ranges of atoms.
A `LineBreakAtom` divides logical lines. List markers and separators are display
chrome derived from `ListItemMark`; they are not canonical text.

## Public Runtime

The public interface is
[`RichContentRuntime`](../../../../../src/capabilities/resources/support/rich-content/runtime.ts).
Its public input and output shapes are defined in
[`types.ts`](../../../../../src/capabilities/resources/support/rich-content/types.ts).

Mutation methods return only a content ID and version. The caller requests
Display Content separately with `display(contentId)`. Raw atoms and marks never
cross the runtime boundary.

