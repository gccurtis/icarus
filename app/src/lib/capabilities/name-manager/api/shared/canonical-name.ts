import { NameManagerError } from "$name-manager/errors";

/**
 * The two forms of a name: the one that is stored and shown, and the one that is
 * looked up.
 *
 * Every caller that writes a name and every caller that resolves one goes
 * through here, which is the invariant this holds — two spellings of the rule
 * would make `Target Margin` findable from one call site and not from another.
 *
 * The key lowercases and drops whitespace entirely, which is what makes
 * `TargetMargin`, `targetmargin`, and `Target Margin` one variable. The name is
 * only trimmed, because the spacing an author typed is theirs to keep.
 */
export const canonicalName = (name: string): { name: string; nameKey: string } => {
  const trimmed = name.trim();
  if (trimmed.length === 0) {
    throw new NameManagerError("empty-name", "A variable name cannot be empty");
  }
  return { name: trimmed, nameKey: trimmed.toLowerCase().replace(/\s+/g, "") };
};
