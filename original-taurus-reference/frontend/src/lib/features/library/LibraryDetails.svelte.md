# `LibraryDetails.svelte` — the right-hand detail panel

Identity, reach, and provenance for whichever asset is selected. One component for all three
spaces: contexts, templates, and the Agents space's personalities differ entirely in the center
of the screen and not at all here, so the panel takes the structural `LibraryAsset` type
(name / description / owner / sharing / origin / used-in) and renders anything that satisfies it.
The two per-space variations are copy, passed in: `descriptionHint` (a persona's description is
picker copy, not agent guidance, and the hint must not claim otherwise) and `copiesNote` (see
below).

It is **content only**: the `<aside>`, its scroll, and the Details/Assistant switch belong to
[`LibraryPanel`](LibraryPanel.svelte.md), so all three spaces share one frame.

It is called the **detail panel**, not the inspector — this is a route, not the workspace shell,
and there is no selection to inspect. It borrows `surface-inspector` for its material only.

## Three sections, one open

**Details** (name, description) · **Sharing** · **About**. Earlier passes had five; origin, last
edited, and used-in were three thin sections that did not each justify a collapsible of their own,
and a Danger zone held a single button that belongs with the other verbs in the header's `⋯`.

**Sharing and About are closed at rest** (`open={false}`). All three expanded filled the panel top
to bottom and read as crowding — the opposite of what this shell is for, and against the second
design law: *few things visible, right things visible.* Details is what you came for; the other two
answer questions you have to ask first, and a closed section still announces that the answer is
there.

## Owner is a fact, sharing is a verb

```svelte
<span class="… {iconTileClass(isOrg(asset.ownerId) ? 'intel' : 'action')}">
<span class="block text-caption text-muted">Owner</span>
<Button variant="primary" size="sm" class="w-full">Share</Button>
```

An earlier pass made owner a `<Select>`, which implied ownership was something you set from a
dropdown while quietly being the same act as sharing. Owner is now displayed — on `bg-work` with a
tinted tile, so the section is not one flat field of grey — and `Share` is a **primary** button,
because it is the one action here and the panel needs a point of colour to be readable at a
glance.

Who the asset reaches lives in its own bounded sub-section headed `Shared with N`, scrolled at
`max-h-36`: an asset shared with thirty people must not push About off the panel.

## About carries colour too

The origin project and the `Used in` chips are tinted (`text-action`, `Chip tone="action"`) so the
names read as names rather than dissolving into body text.

## The copy rule is a footer, not a section

```svelte
<p class="px-4 py-3 text-caption leading-relaxed text-muted">{copiesNote}</p>
```

**Library assets are copies** — the part of the model most likely to surprise someone, so the UI
says it out loud. It used to sit inside About, which was wrong twice over: it is a standing
condition of the whole screen rather than a detail about one asset, and now that About is closed at
rest it would have been hidden behind a disclosure. It sits at the foot of the panel, outside every
section, where it cannot be closed over.

**The caller words it**, because the rule genuinely differs by asset. A template can be *brought
into* a project — the console's header has that very button, a few inches up — so that clause
belongs on Templates. The Context screen offers no such motion (you reach for a context from inside
the project that needs it), so naming it there would describe a button that is not on the screen;
what is left is the sentence that matters, that your edits here stay here. A personality gets the
same single sentence.

Note that the note is about **copies**, not sharing: sharing grants access to the library original,
which is what the Share modal says. The two are independent, and neither text should imply the
other.

## Sharing has no backend

The Share modal is inert. Omega has no per-asset sharing model at all — `Can use` / `Can edit` are
this design's invention — which is why the console carries a Mock badge. See
[`library-mock.ts`](library-mock.ts.md) for the full list of what is invented.
