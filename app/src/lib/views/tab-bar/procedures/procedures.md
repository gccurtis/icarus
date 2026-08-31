# Tab Bar Procedures

Lives at `procedures/procedures.md`.

| File | Holds |
| --- | --- |
| [`screen-entries.ts`](screen-entries.ts) | `SCREEN_ENTRIES`, `labelOf` — what an opened tab is called and what it looks like |

## Why display copy is here and not in the model

The model publishes a `Screen` and never interprets it, exactly as it publishes a
context id and an inspection key. Each surface makes its own decision from that
one vocabulary: this one turns a screen into a label and an icon, the context
panel turns an id into a rail entry, and the workspace turns a screen and a
subscreen into a path. A name and a path are different decisions, and keeping
them out of the model is what stops its surface changing every time a screen
arrives.

## Why only the opened screens are here

The three permanent screens are written out in the strip. You cannot open a
fourth or close one of them, so a table entry for each would be a row that exists
to satisfy a loop, holding a label function that ignores its argument.

`Record<OpenedScreen, ScreenEntry>` is still total over what remains, so a new
screen that a person can open fails to compile until it has a label and an icon.

## Why a label is a function of the whole tab

Every document tab would otherwise read "Document", which is the one thing a tab
strip exists to prevent. So `label` takes the tab: New Tab ignores it, and the
five screens keyed by a resource — an analysis, a research thread, a document, a
deck, a spreadsheet — answer with what they hold.

What that resource is *called* is a question about data rather than about copy,
so it is a store read rather than something resolved here.

## Why three states and not two

The answer arrives from the server, so a label has to say which of three things
is true. `…` while it is on its way. The name when it arrives. `Disconnected`
when it arrives empty — a row with no name is a broken reference rather than a
slow one, and one word covering both would say the wrong thing about whichever
it was not.
