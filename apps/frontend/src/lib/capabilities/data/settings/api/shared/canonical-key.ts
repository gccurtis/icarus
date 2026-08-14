import { SettingsError } from "$settings/errors";

/**
 * A dotted lowercase path: `theme`, `editor.font-size`.
 *
 * Narrow on purpose. A key is an identifier a person types into configuration
 * and into code, so admitting arbitrary text would mean two keys that look
 * identical in a list are different rows — and the first bug is someone
 * wondering why their setting did not take.
 */
const KEY = /^[a-z0-9]+(?:[.-][a-z0-9]+)*$/;

/** Long enough for any real path, short enough to bound an untrusted payload. */
const MAX_LENGTH = 128;

/**
 * Admits a key, or refuses it.
 *
 * Shared by all three functions because they must agree on what a key *is*: if
 * `set` accepted a form `get` rejected, a caller could write a setting it could
 * never read back. That shared invariant is what earns a place in `shared/`,
 * rather than the fact that three files wanted the same regex.
 *
 * Trimming is deliberate and casing is not. Surrounding whitespace is a
 * transcription artifact nobody means; a different case is a different key
 * someone chose, and quietly folding it would merge two settings into one.
 */
export const canonicalKey = (value: unknown): string => {
  if (typeof value !== "string") {
    throw new SettingsError("invalid-key", "key must be a string");
  }

  const key = value.trim();

  if (key.length > MAX_LENGTH) {
    throw new SettingsError("invalid-key", `key must be at most ${MAX_LENGTH} characters`);
  }

  if (!KEY.test(key)) {
    throw new SettingsError(
      "invalid-key",
      "key must be lowercase letters, digits, dots, and hyphens — for example 'editor.font-size'"
    );
  }

  return key;
};
