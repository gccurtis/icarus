# Tab Bar Procedures

Lives at `procedures/procedures.md`.

| File | Holds |
| --- | --- |
| [`screen-entries.ts`](screen-entries.ts) | `SCREEN_ENTRIES`, `labelOf` — what a tab is called and what it looks like |

## Why display copy is here and not in the model

The model publishes a `Screen` and never interprets it, exactly as it publishes a
context id and an inspection key. Three surfaces map that one vocabulary and each
makes its own decision from it: this one to a label and an icon, the workspace to
a component, the context panel to a rail entry. A label and a component are
different decisions, and the model's surface stops changing when a screen does.

## Why a label is a function of the whole tab

Every document tab would otherwise read "Document", which is the one thing a tab
strip exists to prevent. So `label` takes the tab: the seven singletons ignore it
and answer with their name, and the three editors answer with what they hold.

A resource tab currently answers with its id. A title lives on the metadata row
rather than in the body, so it becomes an ordinary query the day that table
answers — and a placeholder that reads as an id is better than one that reads as
a name and is not.

## Why it is a procedure rather than markup

`Record<Screen, ScreenEntry>` is total, so a screen with no label fails to
compile. That check is the reason the table is worth extracting: in the markup it
would be a lookup that silently rendered nothing.
