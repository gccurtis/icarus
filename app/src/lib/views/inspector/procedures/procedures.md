# Inspector Procedures

Lives at `procedures/procedures.md`.

| File | Holds |
| --- | --- |
| [`inspection-family.ts`](inspection-family.ts) | `INSPECTION_KEYS`, `familyOf` |

## Why the vocabulary is here and not in the model

Same reason the context rail's is. The workbench holds one label per tab and
never reads it, so what the labels are and what each renders as belong to the
panel that renders them.

## A key carries no payload

`block.text-selection` used to hold `{ blockId, from, to }`, and that was a
second record of what the user has selected — beside the one already in
`viewState.selection`. So the key travels alone and the panel reads the detail
from where that family keeps it:

| Family | Detail comes from |
| --- | --- |
| `block` | the active tab's view state |
| `document` | the active tab's view state |
| `copilot` | the copilot object, since a conversation belongs to no tab |

## Why `familyOf` returns `undefined` rather than throwing

A key is a string the model never validated — that is the trade for the model not
owning this vocabulary. An unrouteable one is therefore a case this panel handles
rather than a defect it reports, and it renders as "no view for this yet", which
is the honest thing to say about a label some surface produced and nothing here
understands.
