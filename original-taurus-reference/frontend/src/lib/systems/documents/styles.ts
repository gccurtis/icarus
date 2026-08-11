import { cssDeclaration, safeCssColor, safeCssLength, safeFontFamily } from './sanitize';
import type {
  BlockKind,
  BlockStyleRef,
  CustomTypography,
  SemanticTypography,
  StyleDefinition,
  StyleRegistry
} from './types';

/**
 * Semantic-typography helpers for the style registry (Goals 2.1/2.2).
 *
 * SIGNPOST (catalog L6): the editor has TWO typography systems, both current,
 * with different jobs. This one — semantic tokens (`SemanticTypography`)
 * resolved through Omega's style registry — backs BLOCK-TYPE styling (the
 * inspector's "Text type": Title, Heading, Body, …). Real-font styling —
 * `CustomTypography` in types.ts, written per block or as inline font/fg/bg
 * marks — is what the typography controls set directly and is the shipped
 * direction for user-facing font choices. Neither replaces the other: a block's
 * rendered look is its token's CSS overridden by its custom typography and then
 * by inline marks (the five-level cascade in `effectiveTypography` + overlay).
 *
 * Omega styles are semantic *tokens*, and every reference must resolve to a
 * definition that already exists in the (initially empty) registry. To keep the
 * UI simple we seed **one definition per typography token**, applicable to every
 * Alpha block kind, so the same style can back a per-kind default (2.2) or a
 * per-block assignment (2.1). This module owns those definitions, the resolution
 * of a block's effective typography, and the token → CSS map used for rendering.
 */

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

/** CSS fragment for a block's free-form custom typography (real fonts). Overrides
 *  the semantic font family/size/color per field; empty fields fall through to the
 *  resolved semantic style. */
export function customTypographyCss(custom: CustomTypography | null | undefined): string {
  if (!custom) return '';
  // Validated per field on the way into a `style` attribute: Omega only
  // length-bounds font family/size, so an unvalidated value here would be a live
  // CSS-injection path (catalog S2/S4). An invalid field is dropped, not escaped —
  // the block simply falls through to its resolved semantic style.
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
