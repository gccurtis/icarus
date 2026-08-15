import { SettingsError } from "$settings/errors";
import type { SettingValue } from "$settings/types/settings";

/**
 * The largest value a setting may hold, serialized.
 *
 * A bound rather than no bound because `set` is browser-reachable and declared
 * `'unchecked'`: without one, a single request decides how much of a project's
 * database a caller gets to occupy.
 */
const MAX_SERIALIZED_BYTES = 64 * 1024;

/** Keys that are a prototype-pollution attempt rather than data. */
const FORBIDDEN = new Set(["__proto__", "constructor", "prototype"]);

/**
 * Admits a value, or refuses it.
 *
 * The serialize-then-parse is doing four jobs at once, which is why it is worth
 * more than the four separate checks it replaces:
 *
 * 1. **Representability.** A function, a `symbol`, or an `undefined` serializes
 *    to nothing and is caught by the `undefined` result; a `Date` or a class
 *    instance collapses to what would actually have been stored, so what the
 *    caller gets back later is what this admitted.
 * 2. **Cycles.** `JSON.stringify` throws on one, before the database sees it.
 * 3. **Size**, measured on the bytes that will really be written rather than on
 *    a guess about the shape.
 * 4. **Aliasing.** The parse severs every reference to the caller's object, so
 *    nothing that is stored can be mutated afterwards from outside.
 *
 * `undefined` is refused rather than treated as a deletion. A `set` that
 * sometimes removes a row would be two operations sharing a name, and the one
 * you get would depend on a value being absent — which is exactly what happens
 * by accident.
 */
export const canonicalValue = (value: unknown): SettingValue => {
  if (value === undefined) {
    throw new SettingsError(
      "invalid-value",
      "value must be present — to remove a setting, delete it"
    );
  }

  let serialized: string | undefined;
  try {
    serialized = JSON.stringify(value);
  } catch {
    // The only thing stringify throws on for plain data is a cycle. A BigInt
    // throws too, and is refused for the same reason: it has no JSON form.
    throw new SettingsError("invalid-value", "value must not contain cycles or BigInt");
  }

  if (serialized === undefined) {
    throw new SettingsError("invalid-value", "value must be representable as JSON");
  }

  if (Buffer.byteLength(serialized, "utf8") > MAX_SERIALIZED_BYTES) {
    throw new SettingsError(
      "invalid-value",
      `value must serialize to at most ${MAX_SERIALIZED_BYTES} bytes`
    );
  }

  const parsed = JSON.parse(serialized) as SettingValue;
  rejectForbiddenKeys(parsed);
  return parsed;
};

/**
 * Refuses `__proto__` and friends anywhere in the value.
 *
 * `JSON.parse` creates these as ordinary own properties rather than invoking a
 * setter, so nothing is polluted *here*. The risk is downstream: this value is
 * stored, read back, and eventually spread or merged by code that has no idea it
 * came from a browser. Refusing at admission means that code never has to know.
 */
const rejectForbiddenKeys = (value: SettingValue): void => {
  if (Array.isArray(value)) {
    for (const item of value) rejectForbiddenKeys(item);
    return;
  }

  if (typeof value !== "object" || value === null) return;

  for (const [field, nested] of Object.entries(value)) {
    if (FORBIDDEN.has(field)) {
      throw new SettingsError("invalid-value", `value must not contain a '${field}' key`);
    }
    rejectForbiddenKeys(nested);
  }
};
