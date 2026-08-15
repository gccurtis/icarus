/**
 * A setting is its key and its value. The key is the identity — there is no
 * surrogate id, because two rows with the same key in one project would be a
 * defect with no way to say which one is current.
 */
export interface Setting {
  readonly key: string;
  readonly value: unknown;
}

/**
 * The lowercased, trimmed form a key is stored and looked up under.
 *
 * Canonicalizing on the way in is what makes `Editor.Theme` and `editor.theme`
 * the same setting rather than two that shadow each other depending on which
 * was written last.
 */
export const canonicalKey = (key: string): string => key.trim().toLowerCase();
