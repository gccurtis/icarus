import type { Chord, ChordParts } from "$model/client/commands/types";

/**
 * Spells one gesture.
 *
 * The order is fixed — `$mod`, `alt`, `shift`, then the key — so a gesture has
 * exactly one spelling. Sorting at the call site instead would put the rule in
 * every caller, and the binding map would eventually hold two keys meaning the
 * same chord with only one of them reachable.
 *
 * Case is normalised here rather than by the caller, because `shift` already
 * carries that fact: a browser reports `K` for shift+k and `k` without it, so a
 * caller passing the key through untouched would produce two spellings for one
 * gesture and the shifted one would never match.
 *
 * No `KeyboardEvent`. The surface that reads the keyboard fills in `ChordParts`,
 * which is what keeps this object testable without a DOM.
 */
export const chordOf = ({ mod, alt, shift, key }: ChordParts): Chord => {
  const parts: string[] = [];

  if (mod) parts.push("$mod");
  if (alt) parts.push("alt");
  if (shift) parts.push("shift");
  parts.push(key.toLowerCase());

  return parts.join("+");
};
