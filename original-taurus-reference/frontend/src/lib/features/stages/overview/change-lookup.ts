import { fetchDocumentHistory, type HistoryEntry } from '$systems/documents/api';
import { loadChangeText } from '$systems/documents/change-detail';
import type { ActivityEvent } from '$data/projects';

/**
 * Resolving an activity event to the document change behind it.
 *
 * This is possible because a document `edited` event **is** exactly one change
 * set: Omega writes both in a single atomic `AppendChangeSet` call from one
 * `createdAt`, and `activity_events` carries `UNIQUE (source_kind, source_id)`.
 * It is not a roll-up of several edits.
 */

export type EventChange =
  | { state: 'loading' }
  /**
   * The change and its before/after. `priorUnknown` marks a text edit whose
   * previous value could not be recovered by the history walk, so the UI can say
   * that rather than imply there was nothing there.
   */
  | { state: 'ready'; entry: HistoryEntry; before: string; after: string; priorUnknown: boolean }
  /** Found, but Omega no longer retains the ops. */
  | { state: 'pruned'; entry: HistoryEntry }
  /** No change set corresponds — a rename, a create, or pruned past the window. */
  | { state: 'none' }
  | { state: 'error' };

/**
 * How far back to look. The event came from a feed the user is looking at, so it
 * is recent by construction and one page of this size covers it without paging.
 */
export const HISTORY_DEPTH = 50;

/**
 * Match an event to its change set **by exact timestamp**.
 *
 * This is an interim. Omega stores the change-set id on the event (`source_id`)
 * and reads it back, but `eventJSON` does not serialise it, so the shared
 * `createdAt` is the only link the client can see. Exact rather than fuzzy — but
 * it leans on an invariant nothing enforces: two change sets landing in the same
 * millisecond would tie, and `Date.parse` truncates the nanoseconds that would
 * otherwise separate them. Switch to the id when the backend exposes it
 * (`docs/backend-requests/resource-access-enforcement.md`).
 */
export function findChangeEntry(
  entries: HistoryEntry[],
  event: ActivityEvent
): HistoryEntry | null {
  return entries.find((entry) => entry.occurredAt === event.occurredAt) ?? null;
}

/**
 * Turn a located entry into a renderable change.
 *
 * `entries` is the whole history page so the change sets OLDER than this one can
 * be handed to the before-text reconstruction — a change set alone carries only
 * the new text, and the prior value has to be recovered from its predecessors.
 */
export async function loadChangeDetail(
  documentId: string,
  entry: HistoryEntry,
  entries: HistoryEntry[]
): Promise<EventChange> {
  if (!entry.detailAvailable) return { state: 'pruned', entry };
  // History is newest-first, so everything after this entry's index is older.
  const index = entries.findIndex((e) => e.id === entry.id);
  const older = index >= 0 ? entries.slice(index + 1).map((e) => e.id) : [];
  try {
    const text = await loadChangeText(documentId, entry.id, older);
    return {
      state: 'ready',
      entry,
      before: text.before,
      after: text.after,
      priorUnknown: text.priorUnknown
    };
  } catch {
    return { state: 'error' };
  }
}

/**
 * The one-shot lookup: history, then match, then detail. Used where a change is
 * shown immediately. Callers that expand several events fetch history once
 * themselves and pair `findChangeEntry` with `loadChangeDetail` instead, so a
 * list of expansions costs one history read rather than one per row.
 */
export async function loadEventChange(
  documentId: string,
  event: ActivityEvent
): Promise<EventChange> {
  try {
    const page = await fetchDocumentHistory(documentId, HISTORY_DEPTH);
    const entry = findChangeEntry(page.entries, event);
    if (!entry) return { state: 'none' };
    return await loadChangeDetail(documentId, entry, page.entries);
  } catch {
    return { state: 'error' };
  }
}
