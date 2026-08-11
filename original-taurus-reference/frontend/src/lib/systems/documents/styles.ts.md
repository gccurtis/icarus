# src/lib/systems/documents/styles.ts — breakdown

Companion to [styles.ts](styles.ts). Semantic-typography helpers for the style
registry: the seed definitions (one per typography token, applicable to every Alpha
block kind), the four-level resolution of a block's effective typography, the
free-form custom-typography (real font) helpers, and the token → CSS map used to
render decorations.

**Signpost (catalog L6, 2026-07-27):** the editor has two typography systems, both
current, with different jobs — this module's semantic tokens back **block-type**
styling (the inspector's "Text type"), while `CustomTypography` (types.ts) plus the
inline font/fg/bg marks back **real-font** styling, the shipped direction for
user-facing font choices. A block renders as its token's CSS, overridden by custom
typography, overridden by inline marks. The module doc comment carries the same note
so neither file can be read as superseding the other.

## Imports

### The block/style/typography types this module operates over

```ts
import type {
  BlockKind,
  BlockStyleRef,
  CustomTypography,
  SemanticTypography,
  StyleDefinition,
  StyleRegistry
} from './types';

```

Everything here is pure derivation over the document style types, so the only import
is the type set from the sibling `types.ts`: the block/style-reference types, the
`CustomTypography` free-form override shape, the `SemanticTypography` token union, and
the `StyleDefinition`/`StyleRegistry` shapes the seeding and resolution functions read.

## Module overview

### The module doc-comment explaining the seed-one-definition-per-token strategy

```ts
/**
 * Semantic-typography helpers for the style registry (Goals 2.1/2.2).
 *
 * Omega styles are semantic *tokens*, and every reference must resolve to a
 * definition that already exists in the (initially empty) registry. To keep the
 * UI simple we seed **one definition per typography token**, applicable to every
 * Alpha block kind, so the same style can back a per-kind default (2.2) or a
 * per-block assignment (2.1). This module owns those definitions, the resolution
 * of a block's effective typography, and the token → CSS map used for rendering.
 */

```

Omega's style model requires every reference to resolve to a definition that already
exists in the registry, which starts empty. Rather than invent bespoke definitions,
Alpha seeds exactly one definition per typography token, each applicable to every
block kind, so a single seeded style can serve as either a per-kind default (Goal 2.2)
or a per-block assignment (Goal 2.1). The comment records that strategy so the
functions below read as one coherent scheme.

## Block kinds and typography tokens

### The Alpha block-kind set and the eight display-ordered typography tokens

```ts
/** The text-bearing block kinds the Alpha editor produces (the `appliesTo` set for
 *  seeded styles). Heading levels are now text sub-kinds, not distinct kinds. */
export const ALPHA_BLOCK_KINDS: BlockKind[] = ['text', 'code', 'callout', 'prompt'];

/** The eight typography tokens, with UI labels, in display order. */
export const TYPOGRAPHY_TOKENS: { value: SemanticTypography; label: string }[] = [
  { value: 'display', label: 'Display' },
  { value: 'title', label: 'Title' },
  { value: 'heading', label: 'Heading' },
  { value: 'body', label: 'Body' },
  { value: 'body_small', label: 'Body small' },
  { value: 'label', label: 'Label' },
  { value: 'quote', label: 'Quote' },
  { value: 'code', label: 'Code' }
];

```

`ALPHA_BLOCK_KINDS` is the text-bearing kind set the editor produces — heading levels
are text sub-kinds now, not separate kinds — and it doubles as the `appliesTo` array
for every seeded style. `TYPOGRAPHY_TOKENS` pairs each `SemanticTypography` value with
a human label in the order the pickers display them; the labels also feed the seeded
definitions' `name` field below.

## Seeding style definitions

### Deterministic style ids and the per-token seed definition

```ts
/** Deterministic style id for a typography token (idempotent seeding). */
export function typographyStyleId(token: SemanticTypography): string {
  return `typography-${token}`;
}

/** A seeded style definition for a typography token, applicable to every Alpha kind. */
export function typographyStyleDefinition(token: SemanticTypography): StyleDefinition {
  const label = TYPOGRAPHY_TOKENS.find((entry) => entry.value === token)?.label ?? token;
  return {
    id: typographyStyleId(token),
    name: label,
    appliesTo: [...ALPHA_BLOCK_KINDS],
    typography: token,
    spacing: 'normal',
    padding: 'none',
    border: 'none',
    background: 'none',
    tone: 'neutral',
    allowOverrides: ['typography', 'tone']
  };
}

```

`typographyStyleId` derives a stable `typography-<token>` id so re-seeding is
idempotent — the same token always yields the same definition id. `typographyStyleDefinition`
builds the full `StyleDefinition` for a token: it looks up the display label (falling
back to the raw token), applies to every Alpha kind, sets the token as its typography,
neutralizes the other style axes (spacing/padding/border/background/tone), and permits
per-reference overrides of `typography` and `tone`.

## Kind default typography

### The convention per kind and the registry-default lookup

```ts
/** The conventional typography for a block kind when the registry sets no default.
 *  Heading sizing now comes from the heading node's own CSS (h1–h6), so a `text`
 *  block defaults to body here regardless of its sub-kind. */
export function defaultTypographyForKind(kind: BlockKind): SemanticTypography {
  switch (kind) {
    case 'code':
      return 'code';
    case 'prompt':
      return 'label';
    default:
      return 'body';
  }
}

/** The typography of the registry default style for a kind (or the convention). */
export function kindDefaultTypography(kind: BlockKind, registry: StyleRegistry): SemanticTypography {
  const defs = registry.definitions ?? [];
  const def = (registry.defaults ?? []).find((entry) => entry.blockKind === kind);
  const style = defs.find((entry) => entry.id === def?.styleId);
  return style?.typography ?? defaultTypographyForKind(kind);
}

```

`defaultTypographyForKind` is the hard-coded convention used when the registry sets no
default: code blocks get `code`, prompts get `label`, and everything else (including
`text`, whose heading sizing now comes from the heading node's own h1–h6 CSS) gets
`body`. `kindDefaultTypography` layers the registry on top — it finds the registry's
default style for the kind and returns that style's typography, falling back to the
convention when no default (or its definition) is present.

## Resolving effective typography

### The four-level cascade for a single block

```ts
/**
 * Resolve a block's effective typography: an explicit override wins, then its
 * assigned style, then the kind's registry default, then the convention.
 */
export function effectiveTypography(
  kind: BlockKind,
  styleRef: BlockStyleRef | null | undefined,
  registry: StyleRegistry
): SemanticTypography {
  const defs = registry.definitions ?? [];
  if (styleRef?.overrides?.typography) return styleRef.overrides.typography;
  const assigned = defs.find((entry) => entry.id === styleRef?.styleId);
  if (assigned) return assigned.typography;
  return kindDefaultTypography(kind, registry);
}

```

`effectiveTypography` resolves one block's typography through the full cascade in
priority order: a per-reference explicit override wins first, then the typography of
the block's assigned style definition, and finally `kindDefaultTypography` (which is
itself the registry default or the convention). This is the single function the
renderer calls to know which token a block should paint with.

## Custom (free-form) typography

### CSS fragment for real-font overrides and the empty-check

```ts
/** CSS fragment for a block's free-form custom typography (real fonts). Overrides
 *  the semantic font family/size/color per field; empty fields fall through to the
 *  resolved semantic style. */
export function customTypographyCss(custom: CustomTypography | null | undefined): string {
  if (!custom) return '';
  // Validated per field on the way into a `style` attribute (catalog S2/S4).
  return [
    cssDeclaration('font-family', custom.fontFamily, safeFontFamily),
    cssDeclaration('font-size', custom.fontSize, safeCssLength),
    cssDeclaration('color', custom.fg, safeCssColor),
    cssDeclaration('background-color', custom.bg, safeCssColor)
  ]
    .filter((part): part is string => part !== null)
    .join('; ');
}

/** True when a custom-typography value has no set field (used to clear). */
export function customTypographyEmpty(custom: CustomTypography | null | undefined): boolean {
  return (
    !custom ||
    (!custom.fontFamily?.trim() && !custom.fontSize?.trim() && !custom.fg?.trim() && !custom.bg?.trim())
  );
}

```

`customTypographyCss` turns a block's free-form real-font override into a CSS fragment,
emitting a declaration only for each field that is set (family, size, `fg` → `color`,
`bg` → `background-color`) so unset fields fall through to the resolved semantic style.
`customTypographyEmpty` is the inverse test — true when nothing is set — used to decide
when a custom-typography value can be cleared entirely.

Each field is validated by [`sanitize.ts`](sanitize.ts) before it becomes a declaration. This is
not redundant with the server: Omega only *length*-bounds font family and size, so a value like
`Arial;background:url(…)` passes its check and would otherwise be concatenated straight into a
`style` attribute (catalog **S2**). An invalid field is dropped rather than escaped, so the block
falls through to its resolved semantic style — the same outcome as leaving the field unset.

## Token → CSS map

### The per-token CSS the editor decoration applies

```ts
/** Map a typography token to a CSS style fragment for the editor decoration. */
export function typographyCss(token: SemanticTypography): string {
  switch (token) {
    case 'display':
      return 'font-size: 2rem; font-weight: 700; line-height: 1.2';
    case 'title':
      return 'font-size: 1.5rem; font-weight: 700; line-height: 1.25';
    case 'heading':
      return 'font-size: 1.25rem; font-weight: 600; line-height: 1.3';
    case 'body':
      return 'font-size: 1rem; font-weight: 400; line-height: 1.5';
    case 'body_small':
      return 'font-size: 0.875rem; font-weight: 400; line-height: 1.5';
    case 'label':
      return 'font-size: 0.75rem; font-weight: 600; letter-spacing: 0.02em; text-transform: uppercase';
    case 'quote':
      return 'font-size: 1rem; font-weight: 400; font-style: italic; line-height: 1.5';
    case 'code':
      return 'font-family: var(--font-mono, ui-monospace, monospace); font-size: 0.9rem; font-weight: 400';
  }
}
```

`typographyCss` is the concrete rendering map: each token returns the CSS fragment the
pagination plugin injects as an inline block decoration — the size/weight/line-height
scale for the display through body_small text tokens, the uppercase letter-spaced
treatment for `label`, italics for `quote`, and the monospace family (via the
`--font-mono` variable) for `code`.
