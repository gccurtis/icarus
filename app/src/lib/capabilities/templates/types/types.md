# Templates Types

Lives at `types/types.md`.

| File | Holds |
| --- | --- |
| [`template.ts`](template.ts) | `Template`, `TemplateDefinition`, and `templateName` |
| [`body.ts`](body.ts) | `templateBodyValidator`, `TemplateBody`, `resourceBodyOf` |
| [`slot.ts`](slot.ts) | `templateSlotValidator`, `TemplateSlot`, `templateSlots` |

## The body is imported, never declared

A template body is one of the three general resources' own body validators with a
`target` literal spread beside it. Declaring the shapes here would be this
capability knowing what a slide is, and the two copies would drift the first time
a deck grew a field.

The fields are **spread rather than nested** because the body *is* the thing it
makes: a template is authored in the ordinary editor, and a generic
representation every resource had to be projected into would need a converter per
type. `resourceBodyOf` is the reverse — it strips the label off and gives back
exactly what a snapshot stores, which is why instantiation is a copy rather than
a conversion.

## `Template` is not the row

It carries `id`, drops `body`, and turns `projectId` into `global`.

Dropping the body is the point of keeping `target` on the row: listing a
project's templates costs the metadata alone however much has been authored into
them. And a caller already knows its own project — what it does not know is
whether this one came from everywhere, which is the answer to "may I edit it".

## `templateName` and `templateSlots` sit here rather than in `api/shared/`

Both say what a template *is* — a name that can be picked out of a list, keys that
name one hole each, a prompt exactly where one means something — which is a
statement about the model rather than a step in a procedure. Same reason
[`documents`](../../documents/types/types.md) keeps `documentTitle` in `types/`.
