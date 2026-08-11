/**
 * Row-height math shared by the document runtime and its panels. This is what
 * survives of the old page-geometry module: line spacing is modelled as a row's
 * height increase above a standard row height, and that math is independent of
 * page fitting (which the product does not do — documents render as one
 * continuous flow).
 */
import type { LayoutRules, Row } from './types';

declare const layoutPointBrand: unique symbol;

/** A validated non-negative whole typographic point (1/72 inch). */
export type LayoutPoint = number & { readonly [layoutPointBrand]: true };

/** Validate an untrusted wire/layout value before it enters layout math. */
export function layoutPoint(value: number, label = 'layout value'): LayoutPoint {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new RangeError(`${label} must be a non-negative whole point`);
  }
  return value as LayoutPoint;
}

/** The height reserved for a row before its explicit increase. */
export function standardRowHeight(rules: LayoutRules): LayoutPoint {
  const font = layoutPoint(rules.maxFontHeight, 'maximum font height');
  const padding = layoutPoint(rules.minRowPadding, 'minimum row padding');
  const height = font + 2 * padding;
  if (height <= 0) throw new RangeError('layout rules must leave positive row height');
  return layoutPoint(height, 'standard row height');
}

/** The exact canonical height of one Omega row under the captured layout rules. */
export function canonicalRowHeight(row: Pick<Row, 'style'>, rules: LayoutRules): LayoutPoint {
  const increase = layoutPoint(row.style.heightIncrease, 'row height increase');
  const maximum = layoutPoint(rules.maxHeightIncrease, 'maximum row height increase');
  if (increase > maximum) throw new RangeError('row height increase exceeds document rules');
  return layoutPoint(standardRowHeight(rules) + increase, 'canonical row height');
}
