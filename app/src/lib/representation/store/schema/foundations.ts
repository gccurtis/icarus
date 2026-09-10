import type { CurrentRowPolicies } from "$representation/store/schema/types";

export const FOUNDATION_ROW_POLICIES = {
  users: {
    authSubject: "required", displayName: "required", email: "optional", imageUrl: "optional",
    settings: "required", updatedAt: "required"
  },
  projects: {
    name: "required", description: "optional", archivedAt: "optional", revision: "required",
    settings: "required", updatedAt: "required"
  },
  memberships: { userId: "required", projectId: "required", token: "required", role: "required" },
  connectors: {
    projectId: "required", name: "required", configuration: "required", credential: "optional",
    refreshIntervalMs: "optional", createdBy: "required", updatedAt: "required"
  },
  externalFiles: {
    projectId: "required", name: "required", mediaType: "required", subkind: "required",
    storageId: "required", hash: "required", origin: "required", createdBy: "required",
    updatedAt: "required"
  },
  threads: { projectId: "required", kind: "required", branchedFrom: "optional" },
  threadParts: { projectId: "required", threadId: "required", part: "required", messages: "required" },
  comments: {
    projectId: "required", threadId: "required", blocks: "required", mentions: "required",
    author: "required", editedAt: "optional"
  },
  commentThreads: {
    projectId: "required", target: "required", within: "optional", quote: "optional",
    resolution: "optional", createdBy: "required", updatedAt: "required"
  },
  activity: {
    projectId: "required", actor: "required", actorLabel: "required", verb: "required",
    target: "required", context: "optional", detail: "optional"
  }
} satisfies Pick<
  CurrentRowPolicies,
  | "users"
  | "projects"
  | "memberships"
  | "connectors"
  | "externalFiles"
  | "threads"
  | "threadParts"
  | "comments"
  | "commentThreads"
  | "activity"
>;
