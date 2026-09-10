import type { ReadProjectOverviewResult } from "$capabilities/project/index.remote";

export type Person = {
  readonly id: string;
  readonly name: string;
  /** What they may do here, which is the membership's fact rather than the user's. */
  readonly role: string;
  /** Where they are right now. Presence is live rather than stored, so nothing sets it yet. */
  readonly at?: string;
};

const ROLE: Record<string, string> = {
  owner: "Owner",
  editor: "Editor",
  viewer: "Viewer"
};

/**
 * Everyone in the project.
 *
 * A join rather than a table: `memberships` says who is in this project and
 * `users` says what they are called, and neither answers alone. A membership
 * whose user has not loaded is dropped rather than drawn as a blank face.
 */
export const people = (
  projectId: string,
  overview: ReadProjectOverviewResult | undefined
): readonly Person[] => {
  return overview?.projectId === projectId
    ? overview.people.map((person) => ({ ...person, role: ROLE[person.role] ?? person.role }))
    : [];
};
