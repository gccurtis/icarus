// Plain text extraction from a list of atoms.

import type { RichTextAtom } from "./types.js";

/**
 * Concatenate all atoms into a plain text string.
 * Text atoms contribute their `text`. Formula and reference atoms
 * contribute their `displayText`. Hard breaks become `\n`.
 */
export function plainText(atoms: RichTextAtom[]): string {
  let result = "";
  for (const atom of atoms) {
    switch (atom.kind) {
      case "text":
        result += atom.text;
        break;
      case "formula":
      case "reference":
        result += atom.displayText;
        break;
      case "hard-break":
        result += "\n";
        break;
    }
  }
  return result;
}