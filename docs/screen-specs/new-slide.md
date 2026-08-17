# New Slide

## Role in the deck editor

New Slide is a focused chooser owned by a slide-deck tab. It is not a persistent screen kind and should not create a second tab. It may appear as a large anchored dialog, command-palette result, or temporary center overlay; all entry points use the same content.

## Center surface

### Destination

- Insert after current slide by default.
- Insert before current slide.
- Insert at end of current section, or the unsectioned leading region when the current slide has no section.
- Insert at end of deck.
- Destination section, including an explicit Unsectioned option, if different from the current section.

### Layout gallery

Layouts appear as visual cards derived from their actual definition:

- Thumbnail with locked elements and placeholder frames.
- Layout name.
- Placeholder-role summary.
- Theme/background inheritance.

The first card is the current slide's layout when invoked as Duplicate layout. A Blank card is always available and uses the deck theme without placeholders.

### Optional starting content

- Duplicate current slide, copying its layout key, editable elements, notes, background override, and hidden state.
- Create from the selected layout.
- Blank slide.

The first implementation does not need AI-generated layout choices here; that belongs in the copilot or a later template flow.

## Context panel behavior

The underlying deck panel remains visible but inert while the chooser has modal focus. If New Slide is implemented as a non-modal temporary surface, it uses:

| Key | Label | Contents |
| --- | --- | --- |
| `layouts` | Layouts | Default. Searchable layout gallery. |
| `sections` | Sections | Destination section and insertion point. |

No separate inspector vocabulary is necessary for a modal implementation; selection details can occupy the deck inspector.

## Inspector targets

### Selected layout

- **Identity** — layout name and key; expanded.
- **Preview** — background, locked elements, and placeholders; expanded.
- **Placeholders** — role, frame, style key, prompt; collapsed list.
- **Destination** — position and section; expanded.

### Blank slide

- Theme background preview.
- Destination.

### Duplicate current slide

- Source slide thumbnail.
- Copied layout/background/hidden summary plus element and notes count.
- Destination.

## Confirmation semantics

When a layout is chosen:

- Locked elements remain owned by the layout and are not copied into the slide as editable objects.
- Every layout placeholder becomes an independent `SlideElement` at the placeholder frame.
- The element records the placeholder role in `fromPlaceholder`. Reset to layout is enabled only when that role resolves to exactly one placeholder in the chosen layout; duplicate-role reset is gated on stable placeholder identity.
- Later layout changes do not live-bind the slide element's content or frame.
- The new slide inherits the layout/theme background unless it later receives an override.

After creation, close the chooser, select the new slide in the slide strip, focus the first suitable materialized element, and preserve one undoable user action.

Duplicate mints a new ID for the slide and every identified descendant—elements, blocks, atoms, marks, table rows/cells, captions, and nested blocks. IDs may be reused only when copying the entire deck into a different resource-local ID space, never for two objects inside one deck.

## Keyboard and accessibility

- Arrow keys move through layout cards.
- Enter confirms; Escape cancels without creating anything.
- Cards expose layout name and placeholder-role summary to assistive technology.
- A text list view is available when thumbnails cannot convey their purpose.

## Retained chooser state

New Slide is not a tab. Its insertion index, layout query, and selected layout key live in the owning slide tab's `newSlide` state. They survive an incidental tab switch while the chooser remains open, but Cancel clears them and reload may close the chooser without affecting the deck.

## Model coverage

- [Slide decks, layouts, placeholders, and sections](../data-models/general-resources/slides.md)
