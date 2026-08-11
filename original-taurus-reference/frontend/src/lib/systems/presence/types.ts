/**
 * Who is on a PROJECT right now.
 *
 * Distinct from `systems/documents/collaboration`, which answers "who has THIS
 * DOCUMENT open" — Omega's presence capability is keyed by document
 * (`core/capability/presence/presence.go`: `byDoc map[string]map[string]Entry`)
 * and its session records carry a `currentDocumentId`. There is no project-level
 * presence to read, so this system is **mocked** and the real thing is requested
 * in `docs/backend-requests/project-level-presence.md`.
 */

export type PresentUser = {
  userId: string;
  name: string;
  /**
   * Whether this entry is invented.
   *
   * The current user is REAL — they are looking at the project, which is the
   * whole point of the request ("you should see yourself"). Everyone else is
   * mocked until Omega can answer, and the UI badges the group accordingly.
   */
  mock: boolean;
};

export type ProjectPresence = {
  /** The project these entries belong to; '' when nothing is loaded. */
  projectId: string;
  present: PresentUser[];
  /** True while any entry is invented — drives the surface's Mock badge. */
  mocked: boolean;
};
