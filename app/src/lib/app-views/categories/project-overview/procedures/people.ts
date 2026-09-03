import { rowsIn } from "$app-views/categories/project-overview/procedures/rows";

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
export const people = (projectId: string): readonly Person[] => {
  const users = rowsIn("users");

  return rowsIn("memberships")
    .filter((membership) => membership.projectId === projectId)
    .flatMap((membership) => {
      const user = users.find((candidate) => candidate._id === membership.userId);
      return user === undefined
        ? []
        : [{ id: user._id, name: user.displayName, role: ROLE[membership.role] ?? membership.role }];
    });
};
