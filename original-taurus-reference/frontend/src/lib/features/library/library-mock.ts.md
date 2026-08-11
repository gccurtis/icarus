# `library-mock.ts` — the fixtures the library console runs on, and the kind table

The screens at `/library/context` and `/library/templates` are real and shipped; **the data behind
them is not**. This file holds the fixtures, and every surface that renders them carries a Mock
badge — a library that looked live while inventing its contents is exactly the kind of fake this
repo does not ship. Replace it with real clients as each slice is wired.

No store and no persistence: edits in the UI do not survive a reload, which is honest about the
state of the backing model.

## Shapes mirror Omega on purpose

```ts
export type LibraryContext = {
  name: string; description: string; ownerId: string;
  includes: Member[]; excludes: Member[];
  resolved: Resolved[];
  …
};
```

The types deliberately track Omega's real models so the UI cannot quietly assume something the
backend cannot express. A context is `{name, description, includes[], excludes[]}` over
`Ref{kind,id,name}` (`core/capability/contexts`), and `resolved` stands in for what
`GET /contexts/:contextID/resolved` returns. `description` is the single field this design asks
the backend to add to an existing record.

Templates follow `core/capability/document/template.go`: `TemplateVar` is `ContextVariable`, with
`bound` collapsing `BoundContext | BoundResource` into one display string.

## The two invented fields

```ts
export type Owner  = { id: string; label: string; kind: 'user' | 'org' };
export type Shared = { id: string; name: string; kind: 'user' | 'org'; access: 'Can use' | 'Can edit' };
```

Neither has an Omega equivalent. Every context and template route is **project-scoped** today, and
there is no per-asset sharing model at all. Both are the backend ask this design implies, and both
are isolated in named types here so the gaps stay visible rather than blending into the fixtures.

## `LibraryAsset` — the identity every space shares

The structural type behind `LibraryDetails`: name, description, owner, sharing, origin, used-in,
last-edited. Contexts and templates satisfy it here; the Agents space's personalities satisfy it
from [`agents-mock.ts`](agents-mock.ts.md). One type is what keeps the detail panel a single
component across all three spaces — every library asset has the same lifecycle (born in a
project, promoted, copied), so it has the same identity card.

## One kind table, extended not duplicated

```ts
export type MemberKind = ResourceKind | 'context';
export const memberMeta = { ...kindMeta, context: { icon: Layers, tone: 'intel', label: 'Context' } };
```

Resource kinds defer to the shared `features/shared/kinds.ts`, so a document looks the same in the
library as it does in the resource table and the Overview stage. The library adds exactly one kind
— `context`, in the AI/derived violet it carries everywhere else — rather than restating the
whole table and letting the two drift.

`formatCount` lives here too: a resolved set is rendered `7` / `1.2k` / `340k` / `1.4M`, because a
whole-project context resolves to as many resources as the project has.

## Templates are not document-only — and slides are deliberately absent

```ts
export type TemplateKind = 'document' | 'slides' | 'spreadsheet';
export type DocBlock = …; export type SheetPreview = …;   // no SlideFrame
```

Omega's template model is document-only today (`base.template.isTemplate` lives on a document),
so the other kinds are forward-looking — but the *screen* has to assume them, because a preview
that only knows how to draw paper quietly designs a document-only library.

`slides` is a declared kind with **no fixture and no preview type**. A slide template is either a
single slide or a whole deck, and either way its preview must be the actual rendered slide.
Faking it with a bulleted outline would have designed the wrong thing and then invited everyone
to react to the fake, so it is simply not mocked.

## Context slots, not prompt placeholders

`TemplateVar` is a named requirement for **background material** — "this brief needs Evidence to
reason over" — filled by a context from the library. It is not a token substituted into prompt
copy, which is why the fixtures name them in plain language (`Evidence`, `House style`) rather
than `{{evidence}}`, and why `DocBlock` carries an optional `context` field naming the slot a
prompt block *draws on*. That mirrors Omega: `BlockContext{Include, Exclude}` selects declared
variable names for a block's retrieval scope; it never rewrites the block's text.

Every `bound` is `null`. Choosing is the act of the person using the template; a library template
that arrived pre-bound would design that choice away. The field stays on the type because a
*project's* instantiated copy does carry bindings — it is the library view that must not.

## Why the fixtures are interlinked, three levels deep

`ctx-launch` includes `ctx-q3`, which includes `ctx-brand`, which includes `ctx-legal`. The
depth matters even though the screen shows only `via[0]`: it proves the resolved set really does
flatten arbitrary nesting, and it puts a leaf in the table whose first hop is two levels above
where it actually lives. Flat fixtures would have made the union/difference design look simpler
than it is. `ctx-q3` also carries five `sharedWith` entries so the detail panel's bounded
shared-with list has something to actually scroll.
