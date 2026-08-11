# Document context panels

## Expanded the editor-session boundary for context-panel work

```ts
export type EditorActions = {
  renameDocument(name: string): Promise<void>;
  searchText(query: string, options: SearchOptions): SearchResult[];
  focusSearchResult(result: SearchResult): void;
  replaceSearchResults(results: SearchResult[], replacement: string): number;
  // existing inspector and outline actions continue below
};
```

The document runtime now publishes editor-neutral search matches, navigation and
replacement actions, canonical rename, and live page/line/word/character plus
row/block counts. Panels remain independent of ProseMirror while still operating on
the current editor truth.

## Made Info a complete live document summary

```svelte
<section class="grid grid-cols-2 gap-2 border-t border-border pt-3">
  <!-- Created date/time -->
  <!-- Relative last-updated time, actor, and honest Mock attribution badge -->
</section>

<div class="grid grid-cols-2 gap-1.5">
  {@render stat('Pages', `~${$editorSession.pages}`)}
  {@render stat('Lines', $editorSession.lines)}
  {@render stat('Words', $editorSession.words)}
  {@render stat('Characters', $editorSession.chars)}
</div>
```

Info now supports the same double-click, in-place Resource rename as the top bar.
Created date and time stack for scanability; last updated is relative and identifies
the current mock actor. Document counts follow the requested order, page count is
explicitly estimated, and row/block structure plus document identity are separated
below the reading metrics.

## Added real whole-document Search and Replace

```ts
searchText: (query, options) => this.findText(query, options),
focusSearchResult: (result) => {
  this.dispatch(
    this.state.tr
      .setSelection(TextSelection.create(this.state.doc, result.from, result.to))
      .scrollIntoView()
  );
},
replaceSearchResults: (results, replacement) => {
  // Apply matches from the end so earlier editor positions stay valid.
}
```

Search settings sit above a divider and include replace mode, replacement text,
match-case, and whole-word controls. Results below show match count, block/type,
context preview, click-to-navigate behavior, per-match replace, and replace-all.
Replacement is a real editor transaction and follows the normal Omega sync path.

## Filled Layout with the intended page-design vocabulary

```svelte
<!-- Page size, orientation, and width -->
<!-- Four margins -->
<!-- Default body font and size -->
<!-- Collapsible Heading 1–6 font, size, and foreground color -->
```

Layout is deliberately mock-backed and labeled as such, but its local controls make
the full page-level styling shape reviewable now. It remains separate from content and
does not pretend to persist settings Omega cannot yet store.

## Added two-way References and a mock Name Manager

```ts
export const mockDocumentReferences = {
  outgoing: [/* resources this file cites */],
  incoming: [/* resources that cite this file */]
};

export const mockDocumentNames = [
  { name: 'target_system', type: 'Text', value: 'Kepler-186' },
  { name: 'distance_ly', type: 'Number', value: '580' }
];
```

References renders “This file references” first and “Referencing this file” second;
both are collapsible and initially expanded. Name Manager provides filtering,
name/type/value scanning, formula previews, and a Formula Helper modal. Both consume
fixtures from the shared data boundary and surface mock notices for navigation or
evaluation that cannot yet be real.

## Added expandable Comments and operation-level History

```svelte
<Modal bind:open={detailOpen} title="Change detail · Mock">
  <!-- actor, scope, exact before/after detail -->
  <Button variant="secondary" onclick={undoSelected}>Undo this change</Button>
</Modal>
```

Mock comments expose author, age, full text, quoted target context, status, and the
future anchor-navigation action. History exposes actor-scoped changes in a timeline,
then opens an exact before/after modal with the requested targeted undo. Copy explains
that undo appends an inverse operation rather than rewriting history; AI Tasks remains
the requested untouched placeholder.

## Recorded the backend gaps at one actionable boundary

```http
PATCH /documents/:documentID/layout
GET   /documents/:documentID/references
POST  /documents/:documentID/formulas/evaluate
POST  /documents/:documentID/comments
POST  /documents/:documentID/history/:entryID/undo
```

The new backend request covers persistent layout, resource graphs, typed names and
formula evaluation, durable comment anchors, paginated operation history, and
append-only targeted undo. Architecture, discrepancy, orientation, and companion
documentation now distinguish real, derived, estimated, mocked, and placeholder
behavior.

## Reframed Details around the actions users take on inspected content

```ts
export type SelectionInfo =
  | { mode: 'none' }
  | ({ mode: 'run'; blockIds: string[]; blocks: number; chars: number; words: number } & TypographyState)
  | { mode: 'block' | 'new-block'; block: InspectedBlock }
  | { mode: 'blocks'; items: InspectedBlock[] }
  | { mode: 'row'; rowId: string; items: InspectedBlock[] };
```

The editor session now translates ProseMirror state into Run, Block, Multiple
Blocks, Row, and New Block rather than leaking cursor/range/node-selection terms
into the Details panel. A gutter-anchor click inspects a whole multi-column row or
its single block, while Shift-click accumulates explicit blocks. Real block-kind,
mark, and link edits continue through the Omega change-set path.

## Made the planned inspector controls reviewable without overstating persistence

```svelte
{@render heading('Typeface', true)}
{@render heading('Color', true)}
{@render heading('Alignment', true)}
{@render heading('Row dimensions', true)}
```

Details now exposes font family and size, foreground/background color, horizontal
and vertical alignment, row height, normalized child widths, column insertion, and
comment entry at the appropriate selection scopes. Unsupported capabilities are
locally interactive and carry adjacent Mock badges; prompt instructions and evidence
were intentionally removed from this formatting/layout lens. A dedicated data
boundary, discrepancy note, and backend request define how those mocks will be
replaced incrementally.

## Extended end-to-end coverage across the full context rail

```ts
await page.getByLabel('Search document').fill('Alpha');
await page.getByRole('button', { name: 'All', exact: true }).click();
await expect(editor).toContainText('Gamma beta Gamma');
await page.getByRole('button', { name: /View change:/ }).first().click();
await expect(page.getByRole('button', { name: 'Undo this change' })).toBeVisible();
```

The real-resource flow now exercises live Search/Replace, Outline navigation, every
mock-backed panel, the History modal, the AI Tasks placeholder, Info counts, and a
second canonical rename through Info. `pnpm check`, `pnpm build`, and all five
Playwright tests passed before publication.

## Stabilized repeated row-child rendering and its persistence proof

```diff
-{#each selection.items as block, index (block.blockId ?? block.pos)}
+{#each selection.items as block, index (`${block.blockId ?? 'new'}:${block.pos}`)}

+await expect(page.getByText('Unsaved changes', { exact: true })).toBeVisible();
 await expect(page.getByText('Saved', { exact: true })).toBeVisible();
```

Details now keys row children with both stable identity and editor position, avoiding
duplicate-key collisions when a transient block does not yet have an Omega id. The
browser flow also proves that creating the second row child crosses the visible
unsaved state before returning to Saved, so the Row and Multiple Blocks assertions
exercise persisted editor state rather than only local rendering.
