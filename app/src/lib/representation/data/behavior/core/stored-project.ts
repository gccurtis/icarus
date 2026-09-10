import type { MembershipRole } from "$representation/data/types/core/access";
import type { TableRow } from "$representation/store/tables";

import {
  hasExactFields,
  isStoredNatural,
  isStoredRowId,
  isStoredText,
  isStoredTime,
  storedFields
} from "$representation/data/behavior/core/stored";

export const storedMembershipRole = (value: unknown): MembershipRole | undefined =>
  value === "owner" || value === "editor" || value === "viewer" ? value : undefined;

export const isStoredProject = (value: unknown): value is TableRow<"projects"> => {
  const row = storedFields(value);
  return row !== undefined &&
    hasExactFields(
      row,
      ["_id", "_creationTime", "name", "revision", "settings", "updatedAt"],
      ["description", "archivedAt"]
    ) &&
    isStoredRowId(row._id, "projects") &&
    isStoredTime(row._creationTime) &&
    isStoredText(row.name, 10_000) &&
    row.name.length > 0 &&
    isStoredNatural(row.revision) &&
    isStoredText(row.settings) &&
    (row.description === undefined || isStoredText(row.description, 20_000)) &&
    (row.archivedAt === undefined || isStoredTime(row.archivedAt)) &&
    isStoredTime(row.updatedAt);
};

export const isStoredMembership = (value: unknown): value is TableRow<"memberships"> => {
  const row = storedFields(value);
  return row !== undefined &&
    hasExactFields(row, ["_id", "_creationTime", "userId", "projectId", "token", "role"]) &&
    isStoredRowId(row._id, "memberships") &&
    isStoredTime(row._creationTime) &&
    isStoredRowId(row.userId, "users") &&
    isStoredRowId(row.projectId, "projects") &&
    isStoredText(row.token, 10_000) &&
    storedMembershipRole(row.role) !== undefined;
};

export const isStoredUser = (value: unknown): value is TableRow<"users"> => {
  const row = storedFields(value);
  return row !== undefined &&
    hasExactFields(
      row,
      ["_id", "_creationTime", "authSubject", "displayName", "settings", "updatedAt"],
      ["email", "imageUrl"]
    ) &&
    isStoredRowId(row._id, "users") &&
    isStoredTime(row._creationTime) &&
    isStoredText(row.authSubject, 10_000) &&
    isStoredText(row.displayName, 10_000) &&
    row.displayName.length > 0 &&
    isStoredText(row.settings) &&
    (row.email === undefined || isStoredText(row.email, 320)) &&
    (row.imageUrl === undefined || isStoredText(row.imageUrl, 2_000)) &&
    isStoredTime(row.updatedAt);
};
