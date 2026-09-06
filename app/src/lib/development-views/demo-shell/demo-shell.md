# Demo Shell

The one frame every page under `/demo` wears: which demos exist, which one you
are on, and which material you are reading it in.

## Why it exists

Eleven demo pages were reachable only by typing their URL or by finding a card
buried at the bottom of one of them, and only two of them could switch
appearance. So a page could be reviewed in Helios and its neighbour in Selene
without anyone noticing, and comparing two treatments meant editing the address
bar.

Both problems are the same problem: **navigation and appearance are properties
of the demo surface, not of any one demo.** They belong to the frame.

## What it takes

| Prop | What it is |
| --- | --- |
| `current` | the active pathname, so the bar can mark where you are |
| `appearance`, `appearances`, `onappearance` | the choice, the options, and the setter |
| `children` | the page |

It holds no state and applies nothing. `routes/demo/+layout.svelte` reads the
appearance module and passes the choice down, because a route may reach a
surface's internals and a development view may not — see
[the top bar's effects](../../surfaces/top-bar/effects/effects.md).

## Grouping

Four groups, separated by a rule rather than labelled, because the kinds are
legible from the names once they are apart:

1. **System** — the design system, the composition vocabulary, and the template
   library. What things are made of, which shape holds what, and the one live
   reference page. Templates redirects into the application's own route, so it
   is the one entry that leaves this frame — deliberately, because the demo there
   *is* the live page.
2. **Objects** — blocks, analysis, plot, thread. A thing on a surface.
3. **Panels** — context, inspector, workspace. The app's own views, one at a
   time, in the harness that renders them alone.
4. **Tools** — the stack builder and the semantic overlay.

## Layout

Sticky, wearing the `.veil` surface so a scrolling page reads through it rather
than under a lid. The bar sits in flow rather than fixed, so the region below is
exactly the viewport minus the bar and a page that wants full height gets one.

The link row scrolls horizontally on its own below the width that holds it. The
appearance control never scrolls out: it is the one control on the bar that is
about the page you are looking at rather than about which page to look at.
