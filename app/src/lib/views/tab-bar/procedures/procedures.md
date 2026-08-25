# Tab Bar Procedures

Lives at `procedures/procedures.md`.

| File | Holds |
| --- | --- |
| [`screen-entries.ts`](screen-entries.ts) | `SCREEN_ENTRIES`, `labelOf` — what a tab is called and what it looks like |

## Why display copy is here and not in the model

The model publishes a `Screen` and never interprets it, exactly as it publishes a
context id and an inspection key. Each surface makes its own decision from that
one vocabulary: this one turns a screen into a label and an icon, the context
panel turns an id into a rail entry, and the workspace turns a screen and a
subscreen into a path. A name and a path are different decisions, and keeping
them out of the model is what stops its surface changing every time a screen
arrives.

## Why a label is a function of the whole tab

Every document tab would otherwise read "Document", which is the one thing a tab
strip exists to prevent. So `label` takes the tab: the permanent tabs ignore
it and answer with their name, New Tab does the same, and the four screens keyed
by a resource — a research thread, a document, a deck, a spreadsheet — answer
with what they hold.

What that resource is *called* is a question about data rather than about copy,
so it comes from the `naming` door. Two surfaces ask it — this one and the status
bar — and a name resolved here would make the tab strip the owner of a fact the
status bar also needs.

## Why it is a procedure rather than markup

`Record<Screen, ScreenEntry>` is total, so a screen with no label fails to
compile. That check is the reason the table is worth extracting: in the markup it
would be a lookup that silently rendered nothing.
