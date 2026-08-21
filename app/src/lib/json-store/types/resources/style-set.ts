import type { HorizontalAlignment } from "$json-store/types/content/block-format";

/**
 * One named style. `name` is what a person picks from a menu; the key it sits
 * under is what blocks reference, so renaming is one field rather than a rewrite.
 *
 * Sizes and spacing are points; `lineHeight` is a multiplier. No vertical
 * alignment — that is a property of the box, and lives on `BlockFormat`.
 */
export type TextStyle = {
  name: string;
  fontFamily?: string;
  fontSize?: number;
  fontWeight?: number;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  color?: string;
  background?: string;
  lineHeight?: number;
  spaceBefore?: number;
  spaceAfter?: number;
  horizontalAlignment?: HorizontalAlignment;
  indent?: number;
};

/**
 * A resource's named styles. A block carries a key into this rather than a copy,
 * which is what makes editing "Heading 1" restyle every heading at once.
 *
 * It lives inside the resource's body, so restyling is an ordinary change and an
 * undo reaches it. `defaultKey` is required: without one, unstyled text renders
 * differently depending on which renderer is asked.
 */
export type StyleSet = { styles: Record<string, TextStyle>; defaultKey: string };
