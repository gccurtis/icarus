# Slide Prompt Blocks

This is the implementation and design record for the first editable Derived
Output surface in the slide-deck editor. Its served companion is
`/demo/semantic-overlay/slide-prompt-blocks`.

The load-bearing rule is:

> The slide stays a slide; ordinary text gains one Derived Output relationship.

A Prompt Block is not a special presentation object. The deck continues to own
the element's frame, paint, stacking order, editable text, styles, and mark
ranges. A separate server-owned Derived Output owns its prompt, scope, canonical
response, evidence, freshness, and refresh operation. The only durable bridge is
`PromptBlock.derivedOutputId`.

## Why the interaction starts on a text box

The user selects an existing standalone text box and sees `Prompt` beside
`Comment` in the text-box inspector. Choosing it converts the text box in place
and opens the Prompt Block inspector.

This is intentionally different from inserting a new decorative object from a
global toolbar:

- the user can decide exactly which existing text should become derived;
- the outer slide element and every presentation field remain stable;
- the existing text can seed optional previous-response continuity;
- the command is discoverable at the place where the relationship is created;
- Prompt management remains an index, not a second creation path.

The first slice converts only standalone `content.type === "text"` elements.
Shape text, table cells, speaker notes, groups, and arbitrary multi-selection are
explicit later adapters. The core Derived Output does not need to change when
those adapters arrive.

## Persisted shape before and after conversion

The conversion is deliberately narrow. `withPromptElement(body, elementId)`
replaces only `SlideElement.content`:

```ts
// Before
{
  id: "element-42",
  frame,
  paint,
  overflow,
  content: {
    type: "text",
    block: {
      id: "block-42",
      type: "text",
      atoms,
      display,
      marks,
      style,
      format
    }
  }
}

// After
{
  id: "element-42",       // unchanged
  frame,                   // unchanged
  paint,                   // unchanged
  overflow,                // unchanged
  content: {
    type: "prompt",
    block: {
      id: "block-42",     // unchanged
      type: "prompt",
      atoms,               // unchanged
      display,             // unchanged
      marks,               // unchanged
      style,               // unchanged
      format,              // unchanged
      state: "idle"
    }
  }
}
```

Text-only semantic fields that do not belong to `PromptBlock` (`variant`,
`level`, `listStyle`, `checked`, `language`, and `resolvedAt`) are removed. The
conversion is one represented deck `set` operation, so the normal runtime,
collaboration, undo, persistence, and revision machinery see the change.

## Exact creation and refresh procedure

### Convert and configure

1. `PromptAction` obtains the active `SlideDeckRuntime` and selected element.
2. `withPromptElement(body, elementId)` returns the converted body and its deck
   operation.
3. `runtime.apply(ops)` updates the local collaborative projection.
4. `view.inspect("slide-deck-editor.prompt-block", selection)` opens the
   dedicated inspector.
5. `runtime.flush()` persists the conversion. A rejected flush is represented by
   runtime sync state rather than becoming an unhandled browser error.
6. The user enters a prompt. Scope is currently the one explicit option,
   `Whole project`.

### Create, link, and generate

1. `createDerivedOutput({ prompt, origin: { kind: "slides", id: deckId } })`
   creates the durable definition.
2. If the text box already contains text,
   `updateDerivedOutput({ lastResponse })` records it as ungrounded previous
   response continuity. It is not registered as evidence.
3. `linkPromptBlockOps(block, derivedOutputId)` writes only the ID into the
   Prompt Block.
4. `syncPromptBlockOps(block, seededOutput)` mirrors value state and any seeded
   response through deck operations.
5. The deck runtime flushes that link before generation begins.
6. `refreshDerivedOutput({ derivedOutputId })` signals the server-owned refresh
   system.
7. The server drains pending Semantic Overlay work, retrieves or directly reads
   authoritative evidence, synthesizes a structured response, resolves only
   application-issued evidence IDs, rechecks authority, and atomically publishes
   the response and citations.
8. `syncPromptBlockOps(currentBlock, refreshed.output)` copies only the response
   text and small value-state mirror back into the slide.
9. The deck runtime flushes the publication operations.

### Refresh an existing Prompt Block

`PromptSettings.generate` first compares the inspector draft and current slide
text with the stored Derived Output. If either is different,
`updateDerivedOutput` advances the definition and/or previous response. It then
signals `refreshDerivedOutput`, publishes the returned text through deck ops,
flushes, and broadcasts a small same-browser notification so other mounted
inspectors immediately re-read.

The Refresh control remains a signal, never the refresh authority. The server
owns queued/running/failed state in `derivedOutputRefreshJobs`. Concurrent users
and repeated clicks for the same Derived Output ID join the same versioned job.
Only a changed prompt, scope, selection, or prior response advances the requested
version. The inspector polls `readDerivedOutput` so work started in a different
browser is visible and disables a redundant local click while the shared job is
queued or running. The last good response remains readable after a failed later
attempt.

There is one deliberate atomicity follow-up: creating the Derived Output and
first linking it to the slide currently cross two persistence calls. A future
transactional orchestration command should make first-link creation
compare-and-set and clean up an orphaned output if the slide revision loses a
race. Refresh after the link is already server-coalesced.

Canonical generation has a single server writer, but the final presentation
mirror is still submitted by each mounted editor through the ordinary deck
operation stream. Those callers all receive the same canonical response, yet
simultaneous viewers can currently submit duplicate equivalent atom/mark edits.
A server-owned, idempotent presentation publisher (or one elected client
publisher) is the remaining collaboration seam; it must preserve the same deck
operations and revision checks rather than write around them.

## Response publication and marks

The Derived Output passes plain text in and plain text out. It never owns slide
marks or presentation.

`syncPromptBlockOps` converts the response into native slide operations:

1. remove existing marks;
2. remove existing atoms;
3. insert the response atom;
4. reinsert surviving marks;
5. set the small `state`, `error`, and `refreshedAt` mirrors.

Using native `remove` and `insert` operations matters. Slide list fields carry
identified values, so the deck operation applier rejects a generic `set` of
`atoms` or `marks`. Native operations also retain the collaboration, revision,
and undo semantics used by normal slide text editing.

Marks keep their absolute character ranges. When a response becomes shorter,
each endpoint is clipped to the new length and an empty range is removed. This
is the same policy as the document Prompt Block. Subsequent user typing uses the
normal `replaced` text operation; it is not a special Prompt edit. The visible
edited text becomes previous-response continuity on the next refresh.

## Rendering and editor chrome

`sceneOf` already projects Prompt Blocks through the same text scene as ordinary
text. The slide export/presentation surface therefore sees no special card,
background, outline, label, or badge.

The editor adds one small intelligence-colored star at the edge of the element.
It is rendered by `SlideSurface` from a separate `SurfacePrompt[]` input:

- it is editor chrome rather than authored slide content;
- it is omitted when the surface is non-interactive;
- it opens the Prompt Block inspector;
- it stacks below an existing comment badge instead of covering it;
- pointer handling excludes it from marquee and element-drag initiation.

The Prompt Block inspector retains all normal text and element controls after
its prompt settings: Text style, Geometry, Paint, Order, Spacing, Effects, and
Comment. Entering text mode still routes to Next Letter or Text Selection, and
the star provides the stable route back to Prompt settings.

The `slide-deck-editor.prompts` context panel lists existing Prompt Blocks by
slide number and current text. It navigates to the correct slide and opens the
inspector; it never creates a new Prompt Block.

## Semantic and evidence boundary

Generated Prompt Block responses are excluded from slide exact-text projection
and material-context narrative. This prevents a derived response from being
retrieved as evidence for itself or another output. Authored text on the rest of
the slide, in notes, and in supported structured content follows the normal
projection pipeline.

Evidence stays on the Derived Output. The inspector renders:

- a concise evidence-kind label;
- only the exact retrieved/read span or bounded typed value;
- the authoritative resource title as the source link.

The resource name and timestamp are never mixed into exact span text. Text
evidence is consolidated by the Semantic Overlay before the agent sees it, and
timestamps elsewhere in the Prompt UI use minute precision. Internal evidence
IDs, offsets, revisions, generations, and placement data remain stored but are
not routine inspector chrome.

Opening an evidence source uses its `ResourceRef`: documents open the document
editor, slides open the slide-deck editor, and spreadsheets open the spreadsheet
editor. The evidence ID continues to refer to the authoritative source record,
not to the editable copy in the Prompt Block.

## Files and ownership

| Concern | File |
| --- | --- |
| Prompt content contract | `src/lib/representation/data/types/content/content-block.ts` |
| Prompt element union | `src/lib/representation/data/types/slide-decks/body.ts` |
| Conversion, linking, publication, and listing | `src/lib/app-views/categories/slide-deck-editor/procedures/prompt-blocks.ts` |
| Prompt entry action | `src/lib/app-views/categories/slide-deck-editor/components/prompt-action.svelte` |
| Unlinked setup and normal element controls | `src/lib/app-views/categories/slide-deck-editor/inspector/prompt-block.svelte` |
| Linked refresh, shared state, and evidence | `src/lib/app-views/categories/slide-deck-editor/components/prompt-settings.svelte` |
| Text editing and formatting support | `src/lib/app-views/categories/slide-deck-editor/procedures/typing.ts`, `src/lib/app-views/categories/slide-deck-editor/procedures/deck.ts`, and `src/lib/app-views/categories/slide-deck-editor/procedures/styles.ts` |
| Operation application | `src/lib/representation/data/behavior/slide-decks/apply-ops.ts` |
| Editor-only marker | `src/lib/components/authored/slide-surface/slide-surface.svelte` |
| Inspector routing | `src/lib/app-views/categories/slide-deck-editor/procedures/selecting.ts` and `src/lib/representation/data/types/workspace/views.ts` |
| Prompt navigation | `src/lib/app-views/categories/slide-deck-editor/context/prompts.svelte` |
| Semantic exclusion | `src/lib/representation/data/behavior/semantic/projection/resources/slide-deck.ts` |
| Shared evidence presentation | `src/lib/app-views/shared/prompt-block/evidence.ts` |
| Same-browser output notification | `src/lib/app-views/shared/prompt-block/output-events.ts` |
| Served visual reference | `src/lib/development-views/slide-prompt-blocks/slide-prompt-blocks.svelte` |

## Verification contract

Procedure tests prove that conversion preserves the element shell, block IDs,
text, marks, style, and format; response publication succeeds through the real
deck operation applier; and normal text operations continue to edit a Prompt
Block. Semantic projection tests prove generated slide responses are absent from
the source text.

The Chromium interaction test proves the user-visible slice:

1. insert a text box;
2. see Prompt beside Comment;
3. convert it and open the Prompt Block inspector;
4. retain its visible text;
5. enter ordinary text mode and edit it;
6. use the star to return to Prompt settings;
7. find the edited block in the Prompts index.

The served reference has its own browser contract: its lifecycle tabs update the
specimen, its Mermaid diagram renders without an error, Helios and Selene both
change the token-derived surface, and a narrow viewport introduces no horizontal
page overflow.

## Intentional next slices

- transactional or compare-and-set first-link orchestration;
- server-owned, idempotent single-writer publication from the canonical response
  into the slide presentation mirror;
- automatic refresh-on-open and bounded interval refresh policy;
- saved Resource Set selection;
- conversion adapters for shape text, table cells, speaker notes, and groups;
- duplicate/copy semantics for whether a Prompt Block clones or shares a Derived
  Output definition;
- export-time choice between the editable slide snapshot and a freshly resolved
  canonical value;
- an explicit unlink or convert-back interaction;
- batch status transport to replace inspector polling when the collaboration
  channel exposes server job events.

These are named seams, not hidden behavior. The first slice remains useful
without them: an ordinary slide text box can be converted, configured, grounded,
refreshed, edited, formatted, navigated, and persisted end to end.
