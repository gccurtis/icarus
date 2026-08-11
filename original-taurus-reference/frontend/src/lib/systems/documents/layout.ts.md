# layout.ts

The row-height math shared by the document runtime and its panels. This module used to be the
UI-shaped **page-geometry** vocabulary (print-length strings, Letter/A4/Legal sizes, page-count
packing); workstream B of the document-subsystem reorg removed pagination entirely, and what
survives is the one piece of layout math the product still uses: **line spacing**, modelled as a
row's height increase above a standard row height.

## LayoutPoint — validated whole points

```ts
export type LayoutPoint = number & { readonly [layoutPointBrand]: true };

export function layoutPoint(value: number, label = 'layout value'): LayoutPoint {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new RangeError(`${label} must be a non-negative whole point`);
  }
  return value as LayoutPoint;
}
```

A branded number: anything entering the height math must pass through `layoutPoint`, which
rejects negatives and non-integers at the wire boundary instead of letting a bad server value
propagate as NaN geometry. The brand means a plain `number` does not typecheck where a
`LayoutPoint` is required.

## standardRowHeight / canonicalRowHeight

```ts
export function standardRowHeight(rules: LayoutRules): LayoutPoint {
  const font = layoutPoint(rules.maxFontHeight, 'maximum font height');
  const padding = layoutPoint(rules.minRowPadding, 'minimum row padding');
  ...
}
```

`standardRowHeight` is the height every row gets before any explicit increase —
`maxFontHeight + 2 × minRowPadding` under the document's own `LayoutRules`. This is the baseline
the inspector's Line-spacing control shows as **0**, and what the runtime's presentation pass
adds each row's `heightIncrease` to. `canonicalRowHeight` is the same sum computed from a row's
persisted style, validating the increase against `maxHeightIncrease`.

## What was deliberately removed

`DocumentPageLayout` and its print-string vocabulary, `defaultDocumentPageLayout`,
`dimensionsForPageSize`, `pageLengthPoints`/`pageLengthPixels`, the canonical↔print translators,
and `calculateDocumentPages`. Documents render as one continuous flow; page geometry from Omega
(`PageLayout` in `types.ts`) is still *read* as the paper frame's width and margins, but nothing
edits it and nothing fits rows into pages.
