# Type

> What the room sounds like. Type does not change with the appearance, so
> nothing here is ever restated by the material.

## Three voices, one family

IBM Plex, in three cuts, because the product has three kinds of thing to say
and they should not sound alike.

| Face | Voice | Where |
| --- | --- | --- |
| **Plex Sans** | the instrument | every control, label, panel, heading, and table |
| **Plex Serif** | the reading voice | document prose, quoted source text, long-form reading |
| **Plex Mono** | the identifier | ids, commits, addresses, keys, measured numbers |

The serif is the one that changes how the product feels, and it is the one most
easily skipped. **A document set in the interface font tells the reader the page
is part of the application.** It is not — it is the thing the application is
for, and it should look like it came from somewhere else. This is the same
claim [light](light.md) makes with planes, made with letterforms.

Mono is not for code. It is for anything a person might need to read character
by character, or compare down a column. A provenance string, a run id, and a
numeric column all qualify; a paragraph never does.

## Measure

Line length is the most reliable difference between a page that has been set
and a page that has been dumped. It is composed at every call site and named
nowhere, which is exactly how it goes wrong.

| Measure | For |
| --- | --- |
| `title` — 24ch | headings, so a display line breaks where it was meant to |
| `lede` — 62ch | the paragraph directly under a heading |
| `prose` — 70ch | body copy and document text |
| `note` — 52ch | captions, help text, and anything inside a panel |

A block of text with no measure is a defect, not a default.

## The scale

Eleven steps, each a size paired with a leading. **Setting one without the
other is a defect, because the rhythm is the point.**

| Step | Size | For |
| --- | --- | --- |
| `display` | fluid, 40–64px | one statement per page; the thing you read first |
| `h1`–`h4` | 34 / 28 / 24 / 20 | document and section structure |
| `body-lg` | 18 | a lede |
| `body` | 16 | the default |
| `body-sm` | 14 | dense rows, secondary copy |
| `label` | 13 | control labels |
| `caption` | 12 | metadata under content |
| `micro` | 11 | panel chrome, eyebrows, unit suffixes |
| `mono` | 13 | identifiers |

`display` is fluid and the rest are fixed, because a display line is the only
type on the page whose job depends on how much room it has.

`micro` exists because dense inspector chrome was being written at 9, 9.5, 10,
and 10.5 pixels by hand. Three fine steps — 13, 12, 11 — are enough for any
panel, and a fourth is a sign the panel is doing too much.

**The fine steps are for chrome, not for content.** A field label, a unit
suffix, a column header: those are `micro`. Anything a person actually reads —
a value, a name, a message, a note they typed themselves — starts at
`body-sm` and goes up. Beauty is legibility is a law, and the most common way
to break it is to keep shrinking type until a dense panel fits.

## Tracking

The dimension that was missing, and the reason hand-set pages looked designed
while token-set pages did not.

| Tracking | Value | Why |
| --- | --- | --- |
| `display` | −0.03em | large type at default tracking reads as unset |
| `heading` | −0.015em | headings tighten, but less than display |
| `body` | 0 | the face is drawn for this |
| `label` | 0.01em | a hair of air at small sizes |
| `caps` | 0.12em | uppercase without tracking is unreadable, not stylish |

Uppercase is legitimate for one thing: a short eyebrow above a section — set in
**mono**, at `micro`, with `caps` tracking and a role color. Mono rather than
sans because an eyebrow labels the structure rather than joining the prose, and
the monospaced face says so without needing a rule or a color to do it.
Uppercase for anything a person has to actually read is a mistake.

## Weight

Three weights are loaded: 400, 500, 600. A component asking for 700 gets a
face the browser invented, which is why eyebrows and emphasis stop at `strong`.
If a heading is not loud enough at 600, the problem is its size or its tracking,
not its weight.

## Copy voice

One word per state, everywhere, so it is learned once: **Resolved, Resolving,
Stale, Failed, Needs review, Accepted, Reverted.** The vocabulary belongs to
[states](states.md); this is the note that it is a typographic decision as much
as a semantic one — a state named two ways is two states to a reader.

Every error answers three questions: what happened, what can be done next, and
whether the person's work was preserved.

## Tokens this justifies

| Token | Job |
| --- | --- |
| `--token-font-sans`, `--token-font-reading`, `--token-font-mono` | the three voices |
| `--token-weight-regular`, `-medium`, `-strong` | the three loaded weights |
| `--token-text-display` … `--token-text-mono` | the eleven steps |
| `--token-text-*-leading` | the paired leading for each |
| `--token-reading-leading` | long-form leading for the serif |
| `--token-tracking-display` … `--token-tracking-caps` | the missing dimension |
| `--token-measure-title`, `-lede`, `-prose`, `-note` | line length, named |
