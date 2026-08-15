import type { AtomId, ListId, RichContentId } from "$rich-content/types/ids";

/**
 * Allocates every identifier Rich Content owns.
 *
 * The four kinds and their prefixes are this capability's semantics; the values
 * behind them are UUIDs. **The prefixes earn their place at a debugger and in a
 * log**: an id sitting in a stored `jsonb` row or in a `stale-version` message
 * says what kind of thing it names without anyone having to look it up.
 *
 * Imported rather than injected. The backend passed a factory into a runtime
 * object so a test could substitute a counter; there is no object to inject into
 * now, and a test that needs stable identity mocks this module instead. Most do
 * not — an assertion on `content-1` was usually testing the fixture rather than
 * the capability.
 */
const value = (): string => crypto.randomUUID();

export const contentId = (): RichContentId => `content_${value()}`;
export const atomId = (): AtomId => `atom_${value()}`;
export const markId = (): string => `mark_${value()}`;
export const listId = (): ListId => `list_${value()}`;
