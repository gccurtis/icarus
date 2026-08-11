# src/lib/systems/documents/block-kinds.ts — breakdown

Companion to [block-kinds.ts](block-kinds.ts). The single source of truth for
block-kind metadata and the built-in text sub-kinds — the schema mapping, bridge,
inspector menus, and CSS all derive from here. It defines Omega's 7 kinds plus the
text sub-kinds (Body + Heading 1–6) that back the Text-type control, along with the
kind/sub-kind predicates and heading-level helpers.

## Imports and metadata types

### Icon/type imports and the `BlockKindGroup` + `BlockKindMeta` shapes

```ts
import type { Component } from 'svelte';
import {
  Code, FileText, Heading1, Heading2, Heading3, Heading4, Heading5, Heading6,
  Image as ImageIcon, List, Minus, Sparkles, SquareStack
} from '@lucide/svelte';
import type { BlockKind, TextSubKind } from './types';

/** Which inspector menu a kind belongs to. */
export type BlockKindGroup = 'text' | 'element';

/** Everything the editor/UI needs to know about a block kind, in one place. */
export type BlockKindMeta = {
  kind: BlockKind;
  label: string;
  /** Offered in the Insert-element menu (image is round-trip-only until upload). */
  offered: boolean;
  group: BlockKindGroup;
  /** Holds atoms / inline content. */
  textBearing: boolean;
  /** A leaf node with no content (divider, image). */
  isLeaf: boolean;
  /** Carries typed Data in Omega (prompt, list, image). */
  dataKind: boolean;
  icon: Component;
};

```

The icons come from `@lucide/svelte`; `BlockKind`/`TextSubKind` are the wire enums
from `types.ts`. `BlockKindGroup` says which inspector menu a kind lives in (the
Text control vs. the Insert-element menu). `BlockKindMeta` is the one record holding
everything the editor and UI need per kind: its label and icon, whether it is
`offered` in the insert menu, `textBearing` (holds inline atoms), `isLeaf` (no
content at all), and `dataKind` (carries typed Data in Omega).

## The `meta` factory

### Build a `BlockKindMeta` with sensible defaults for the boolean flags

```ts
const meta = (
  kind: BlockKind, label: string, group: BlockKindGroup, icon: Component,
  opts: Partial<Pick<BlockKindMeta, 'offered' | 'textBearing' | 'isLeaf' | 'dataKind'>> = {}
): BlockKindMeta => ({
  kind, label, group, icon,
  offered: opts.offered ?? true,
  textBearing: opts.textBearing ?? true,
  isLeaf: opts.isLeaf ?? false,
  dataKind: opts.dataKind ?? false
});

```

A small constructor so each registry entry states only what differs from the norm.
The defaults describe the common case — a kind is offered in menus and bears text,
is not a leaf, and carries no typed Data — so a plain prose kind needs no `opts` at
all, and the special kinds override just the flags that apply.

## The block-kind registry

### The 7 Omega kinds and the derived `ALL_BLOCK_KINDS` list

```ts
/** The single source of truth for block-kind metadata (Omega's 7 kinds). `text`
 *  is the base prose kind (its semantic role lives in the sub-kind); the rest are
 *  insertable elements. */
export const blockKinds: Record<BlockKind, BlockKindMeta> = {
  text: meta('text', 'Text', 'text', FileText),
  code: meta('code', 'Code', 'element', Code),
  callout: meta('callout', 'Callout', 'element', SquareStack),
  list: meta('list', 'List', 'element', List, { dataKind: true }),
  divider: meta('divider', 'Divider', 'element', Minus, { textBearing: false, isLeaf: true }),
  // Deferred to the Files/upload pass; round-trip only.
  image: meta('image', 'Image', 'element', ImageIcon, { offered: false, textBearing: false, isLeaf: true, dataKind: true }),
  prompt: meta('prompt', 'Prompt (AI)', 'element', Sparkles, { dataKind: true })
};

export const ALL_BLOCK_KINDS = Object.keys(blockKinds) as BlockKind[];

```

`blockKinds` is the registry every other layer reads. `text` is the base prose kind
(group `text`); the other six are insertable `element` kinds. `list`, `image`, and
`prompt` are `dataKind` (typed Data in Omega); `divider` and `image` are leaves; and
`image` is not `offered` yet — it round-trips but isn't insertable until the upload
pass lands. `ALL_BLOCK_KINDS` is the ordered key list, reused by the option builders
below.

## Text sub-kinds

### The `TextSubKindMeta` type and the Body + Heading 1–6 table

```ts
/** A built-in text sub-kind's metadata (label + heading level + icon). */
export type TextSubKindMeta = { subKind: TextSubKind; label: string; level: number; icon: Component };

/** The built-in text sub-kinds, in display order (Body + Heading 1–6). */
export const textSubKinds: TextSubKindMeta[] = [
  { subKind: 'body', label: 'Body', level: 0, icon: FileText },
  { subKind: 'heading_1', label: 'Heading 1', level: 1, icon: Heading1 },
  { subKind: 'heading_2', label: 'Heading 2', level: 2, icon: Heading2 },
  { subKind: 'heading_3', label: 'Heading 3', level: 3, icon: Heading3 },
  { subKind: 'heading_4', label: 'Heading 4', level: 4, icon: Heading4 },
  { subKind: 'heading_5', label: 'Heading 5', level: 5, icon: Heading5 },
  { subKind: 'heading_6', label: 'Heading 6', level: 6, icon: Heading6 }
];

```

The `text` kind's semantic role lives in its sub-kind. `textSubKinds` enumerates the
built-in ones in display order — plain `body` (level 0) plus Heading 1–6 — each with
a label, numeric heading level, and icon. This table backs the Text-type dropdown
and the heading-level helpers at the bottom of the file.

## Inspector option lists

### Text-type dropdown options and the Insert-element menu options

```ts
/** Text-type dropdown options (Body + headings), in order. */
export const textTypeOptions = textSubKinds.map((s) => ({ value: s.subKind, label: s.label }));

/** Insert-element menu options (code, callout, list, divider, prompt). */
export const insertElementOptions = ALL_BLOCK_KINDS.filter(
  (k) => blockKinds[k].offered && blockKinds[k].group === 'element'
).map((k) => ({ value: k, label: blockKinds[k].label, icon: blockKinds[k].icon }));

```

Two option lists derived from the tables above. `textTypeOptions` projects the
sub-kind table to `{ value, label }` for the Text-type control. `insertElementOptions`
filters the registry to the `offered` `element` kinds — so `image` (not offered) is
excluded — yielding the Insert-element menu entries with their icons.

## Heading-level lookup and predicate helpers

### The heading-level map plus the kind/sub-kind query helpers

```ts
const headingLevels: Record<string, number> = {
  heading_1: 1, heading_2: 2, heading_3: 3, heading_4: 4, heading_5: 5, heading_6: 6
};

export const isDataKind = (k: BlockKind) => blockKinds[k].dataKind;
export const isLeafKind = (k: BlockKind) => blockKinds[k].isLeaf;
export const isTextKind = (k: BlockKind) => k === 'text';
export const blockKindLabel = (k: BlockKind) => blockKinds[k]?.label ?? k;
/** A built-in sub-kind's heading level (1–6), or 0 for body / a custom sub-kind. */
export const headingLevel = (subKind: string | undefined) => (subKind && headingLevels[subKind]) || 0;
export const isHeadingSubKind = (subKind: string | undefined) => !!subKind && subKind in headingLevels;
/** The heading sub-kind for a level 1–6, else `body`. */
export const subKindForLevel = (level: number): TextSubKind =>
  (level >= 1 && level <= 6 ? `heading_${level}` : 'body') as TextSubKind;
export const textSubKindLabel = (subKind: string) =>
  textSubKinds.find((s) => s.subKind === subKind)?.label ?? subKind;
```

`headingLevels` is the private sub-kind→level lookup. The exported helpers are the
predicates the rest of the editor calls: `isDataKind`/`isLeafKind`/`isTextKind` read
the registry flags, and `blockKindLabel` resolves a display label (falling back to the
raw key). `headingLevel` and `isHeadingSubKind` consult `headingLevels`;
`subKindForLevel` inverts it (level 1–6 → `heading_N`, else `body`); and
`textSubKindLabel` resolves a sub-kind to its table label.
