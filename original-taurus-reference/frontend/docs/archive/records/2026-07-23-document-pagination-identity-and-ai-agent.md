# 2026-07-23 — Document pagination, identity, and AI Agent integration

## Align the document boundary with Omega's revision, layout, style, and row model

```ts
export type CanonicalPageLayout = {
  width: number;
  height: number;
  marginTop: number;
  marginRight: number;
  marginBottom: number;
  marginLeft: number;
};

export type CanonicalLayoutRules = {
  maxFontHeight: number;
  minRowPadding: number;
};
```

The document data boundary now preserves canonical whole-point page geometry,
layout rules, row height increases, richer block and atom styling, revision-bound
change submission, and compatibility with the current resolved-document endpoint.
Keeping translation in `src/lib/data/*` lets the UI use print-friendly controls
without making CSS pixels or panel vocabulary part of the backend contract.

## Add deterministic pagination and bounded row-window foundations

```ts
export function paginateRows(
  rows: readonly RowMetric[],
  layout: CanonicalPageLayout
): PagePlan[] {
  const usableHeight = usablePageHeight(layout);
  // Complete rows remain indivisible and exact fits stay on the current page.
}
```

A pure paginator, branded point geometry, page index, viewport overscan policy,
normalized row repository, and presentation-only ProseMirror pagination plugin now
separate page composition from transport and DOM windowing. The document stage
renders real page sheets while retaining one continuous editor, and the current
full-document fetch remains the correctness fallback until Omega provides the
additive descriptor, manifest, row-window, and locate routes.

## Make document inspection precise and reusable

```svelte
<NumberField
  value={rowHeightIncrease}
  min={0}
  step={1}
  suffix="pt"
  onchange={setRowHeightIncrease}
/>
```

The document context and inspector surfaces now expose truthful search, outline,
layout, reference, history, information, naming, and selection-detail behavior.
Reusable `Combobox` and `NumberField` controls keep field mechanics consistent,
while row gutter handles target stable rows or blocks and the inspector supports
caret, block, multi-block, and row-aware editing without moving those concerns
into the editor schema.

## Unify people and persona attribution behind an identity profile boundary

```ts
export type IdentityProfile = {
  id: string;
  kind: 'person' | 'persona';
  name: string;
  email?: string;
  avatarUrl?: string;
  role: string;
  description: string;
  createdAt?: string;
  mock: boolean;
};
```

Document presence, creator attribution, history, and agent-facing surfaces now use
one profile shape and one presentation-only hover card. The directory remains
fixture-backed and visibly marked when mocked, but stable adapters and a documented
batch-resolution request allow Omega-backed profiles to replace fixtures without
rewriting each feature component.

## Introduce a persistent Ask, Action, and Plan AI Agent surface

```svelte
<div class="flex h-8 shrink-0 items-center gap-1 border-b border-border bg-panel/70 px-2.5">
  <span data-ai-agent-mark class="text-caption font-semibold tracking-wide text-muted">AI</span>
  <!-- Ask / Action / Plan and submit live in this quiet header. -->
</div>
<div class="flex w-full px-2.5 py-2">
  <!-- The multiline prompt keeps the full composer width. -->
</div>
```

The shell now treats the composer and inspector as one AI Agent surface. Ask,
Action, and Plan describe the next intent; recent chats separately expose Chat,
Running, and Done state; plans can be reviewed and accepted into local task
artifacts; and contextual references remain in a shallow disclosure. The compact
composer uses a recessed tokenized header, neutral AI label, visible mode selector,
full-width four-line prompt, and header-level submit control so intelligence stays
available without competing with the work surface. All execution remains honestly
mock-badged until the documented Omega contracts exist.

## Keep shell panels calm, stable, and accessible

```css
.panel-scroll {
  scrollbar-width: none;
}

.panel-scroll::-webkit-scrollbar {
  display: none;
}
```

The permanent inspector destination is now named AI Agent, active surfaces provide
an implicit-context label, and side panels retain keyboard and wheel scrolling while
suppressing browser scrollbar chrome. These changes follow the authoritative style
laws: center first, intelligence quiet until directed, visible keyboard paths, and
semantic color used only for state or meaning.

## Expand regression coverage for pagination and document workflows

```ts
test('keeps an exact fit and moves only the overflowing row', () => {
  const pages = paginateRows(metrics, layout);
  expect(pages.map((page) => page.rowIds.length)).toEqual([5, 1]);
});
```

The test suite now covers empty documents, exact page fits, overflow, mixed row
heights, row repository eviction and pinning, duplicate identities, viewport
overscan, and broader resource/document interactions. This makes the new geometry
and caching rules auditable independently from the browser editor while preserving
end-to-end confidence in the integrated workflow.

## Reconcile architecture, style, discrepancy, plan, and backend-request documentation

```text
Transport windowing decides which row bodies cross the network.
Pagination decides which rows occupy each visual page.
DOM windowing decides which page and row elements are mounted.
```

Architecture and orientation documents now describe the implemented frontend rather
than an earlier continuous-paper or Quarterback vocabulary. New plans capture the
pagination and identity migration strategy; discrepancy records distinguish honest
frontend translations from missing backend capability; and prioritized backend
requests specify row windows, AI conversations and execution, identity resolution,
and compact member summaries. This preserves a clear audit trail of what is real,
what is derived, what is mocked, and what Omega must supply next.
