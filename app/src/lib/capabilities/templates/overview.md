# Templates

A starting point for a resource. A template holds a body in the shape of the
thing it makes — a document template's body is a document body — with named slots
for the parts that get filled in.

## Public Surface

| Function | Kind | Answers |
| --- | --- | --- |
| `list` | query | the templates this project may start from |
| `create` | mutation | defines one in this project, returning its id |
| `revise` | mutation | replaces one, against the revision the author read |
| `instantiate` | mutation | makes a resource from one, returning its key |
| `remove` | mutation | deletes one |

Registered in
[`src/convex/capabilities/templates.ts`](../../../convex/capabilities/templates.ts),
all five built from `projectQuery` / `projectMutation`.

## Data Ownership

| Stored | Purpose |
| ------ | ------- |
| `templates` | one row per template: what it makes, the body it makes it from, and the holes it asks about |

The bodies of the resources it makes belong to `documents`, `slide-decks`, and
`spreadsheets`; this capability imports their validators and declares none of its
own.

## Instantiation is a copy, and that is the whole design

A resource created from a template is complete and independent from that moment.
It records `templateId` as provenance and nothing more, so editing the template
afterwards leaves it untouched and deleting the template costs it nothing.

The alternative — a resource holding a diff against a live template — means an
edit to a template someone has never seen silently rewrites their document, and
means no resource can be read without also reading its template.

**The row is written by the capability that owns it.** `instantiate` hands the
copied body to `documents.create`, `slideDecks.create`, or `spreadsheets.create`,
which write their own row, their own attribution, their own activity entry, and
the first snapshot through `revisions.start`. Writing those rows from here would
duplicate four things that would then be free to drift.

## `projectId` is optional, and still leads the index

This table's tenant column may be absent, and absent means available to every
project.

Convex has no partial index, so the readings were: an index over rows that have a
project plus some other path for the globals, a sentinel value `v.id("projects")`
cannot hold without giving up the reference, or a second table — which would make
`templateId` on a resource a union of two id types and force every reader to
choose between them.

**The column stays optional and stays first.** A missing field indexes as
`undefined` and sorts before every id, so the globals occupy their own key range:
`eq("projectId", undefined)` is exactly them, `eq("projectId", mine)` is exactly
mine, and neither range can reach another project's rows. That is the property
the projectId-leads rule exists for, and it survives here intact. What it costs is
that a read must say which range it wants, which is why
[`list`](api/list/list.md) is two reads and
[`requireTemplate`](api/shared/shared.md) states the visibility rule once.

**Nothing in this surface can make a global one.** `create` always stamps the
caller's project, because publishing to every project from inside one would let
any member put a row in everyone else's list. A project template that should be
global is copied, which is also what keeps "who can edit this" answerable from the
template alone.

## `target` is stored twice and cannot disagree

On the row, so a picker can offer the document templates without reading a body;
inside the body, as the union's discriminant, so a body cannot be the wrong kind
of thing for the label. The row's copy is **written from the body's, never
accepted as an argument** — which makes disagreement impossible rather than
merely refused.

## Capability Invariants

- **A refusal is "not found", never "forbidden"** for a template in another
  project. A global refused for editing is "not editable" instead, because it is
  in the list the caller just read and denying it exists would withhold the one
  thing they need told.
- **Attribution is built from the scope**, never accepted as an argument.
- **A slot key names one hole**, and a prompt belongs to a `derived` slot and to
  no other kind — a prompt on a text slot is an instruction nothing will read,
  which is worse than absent because it looks honoured.
- **`revision` is the stale-form check.** Convex's transactions cover a read and
  a write in one mutation; they do not cover a form opened before lunch, and a
  whole-body replacement is where that loses someone's work.
- **A template's target is fixed at creation.** One that starts making decks
  instead of documents is a different template, and every resource recording this
  one as provenance would point at something it did not come from.
- **Every refusal is thrown as `TemplatesError`.** Convex serializes a
  `ConvexError`'s payload and redacts everything else, so a refusal thrown as a
  plain `Error` arrives as a server fault and stops being a refusal.

## Deferred to later passes

| Today | When | Becomes |
| --- | --- | --- |
| a `derived` slot's prompt is carried and nothing consumes it | pass 7 | instantiation turns it into a prompt block generated on first open |
| slot values are not substituted into the copied body | pass 7 | filling a slot is an ordinary edit until then, which the body is authored to read sensibly without |
| a global template can only be seeded | — | there is no project-scoped path that should be able to write one |

## Related

[template](../../../../../docs/data-models/special-resources/template.md) — the
model this implements ·
[document](../documents/overview.md) ·
[slide decks](../slide-decks/overview.md) ·
[spreadsheets](../spreadsheets/overview.md) — whose bodies a template holds
