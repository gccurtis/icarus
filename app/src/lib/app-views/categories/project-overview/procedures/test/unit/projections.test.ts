import { describe, expect, it } from "vitest";

import type { ReadCommentsResult } from "$capabilities/comments/index.remote";
import type { ProjectResourceIndex } from "$capabilities/project-resources/index.remote";
import type {
  ReadProjectHistoryResult,
  ReadProjectOverviewResult
} from "$capabilities/project/index.remote";
import { asId } from "$representation/data/behavior/core/id";
import { activity } from "$app-views/categories/project-overview/procedures/activity";
import { actorName } from "$app-views/categories/project-overview/procedures/actor-name";
import { mentions } from "$app-views/categories/project-overview/procedures/mentions";
import { people } from "$app-views/categories/project-overview/procedures/people";
import { project } from "$app-views/categories/project-overview/procedures/project";
import { projectId, viewerId } from "$app-views/categories/project-overview/procedures/scope";

const NOW = Date.UTC(2026, 8, 10, 16);

const overview: Exclude<ReadProjectOverviewResult, null> = {
  projectId: "projects:current",
  viewerId: "users:viewer",
  name: "Grid readiness",
  description: "The current scoped project",
  status: "active",
  viewerRole: "editor",
  createdAt: NOW - 10_000,
  people: [
    { id: "users:viewer", name: "Avery", role: "editor" },
    { id: "users:owner", name: "Morgan", role: "owner" }
  ]
};

describe("Project Overview snapshot projections", () => {
  it("reads identity and people only from the supplied current overview", () => {
    expect(projectId(overview)).toBe("projects:current");
    expect(viewerId(overview)).toBe("users:viewer");
    expect(project("projects:current", overview)).toEqual({
      name: "Grid readiness",
      description: "The current scoped project"
    });
    expect(people("projects:current", overview)).toEqual([
      { id: "users:viewer", name: "Avery", role: "Editor" },
      { id: "users:owner", name: "Morgan", role: "Owner" }
    ]);

    expect(project("projects:other", overview)).toEqual({ name: "…", description: "" });
    expect(people("projects:other", overview)).toEqual([]);
    expect(projectId(undefined)).toBe("");
    expect(viewerId(undefined)).toBe("");
  });

  it("uses the exact historical actor label supplied by the history capability", () => {
    const history: ReadProjectHistoryResult = {
      entries: [
        {
          id: "activity:1",
          at: NOW - 60_000,
          actorLabel: "Historical name",
          actor: null,
          type: "external-file.context-changed",
          what: "Added dataset context",
          action: "added dataset context",
          target: { kind: "document", id: "documents:1", label: "Winter brief" }
        }
      ],
      matched: 1,
      total: 1,
      hasMore: false
    };

    expect(activity(NOW, history)).toEqual([
      {
        id: "activity:1",
        at: "1 minute ago",
        actor: "Historical name",
        action: "added dataset context",
        subject: "Winter brief"
      }
    ]);
    expect(activity(NOW, undefined)).toEqual([]);
  });

  it("joins mentions and actor names from the supplied comment and resource snapshots", () => {
    const comments: ReadCommentsResult = {
      viewerId: "users:viewer",
      people: [{ _id: "users:author", displayName: "Riley" }],
      threads: [
        {
          _id: "commentThreads:1",
          _creationTime: NOW - 120_000,
          target: { kind: "document", id: "documents:1" },
          quote: "winter margin",
          createdBy: { kind: "user", userId: "users:author" },
          updatedAt: NOW - 60_000
        }
      ],
      remarks: [
        {
          _id: "comments:1",
          _creationTime: NOW - 60_000,
          threadId: "commentThreads:1",
          text: "Can you verify this?",
          author: { kind: "user", userId: "users:author" },
          mentionedUserIds: ["users:viewer"]
        }
      ]
    };
    const resources: ProjectResourceIndex = {
      resources: [
        {
          id: "documents:1",
          ref: { kind: "document", id: asId<"documents">("documents:1") },
          kind: "document",
          name: "Winter brief",
          relativePath: null,
          updatedAt: NOW,
          updatedByName: "Riley"
        }
      ],
      unavailable: []
    };

    expect(mentions("users:viewer", NOW, comments, resources)).toEqual([
      {
        id: "commentThreads:1",
        age: "1 minute ago",
        author: { kind: "user", userId: "users:author" },
        resource: "Winter brief",
        location: "winter margin",
        excerpt: "Can you verify this?"
      }
    ]);
    expect(actorName(comments.remarks[0].author, comments.people)).toBe("Riley");
    expect(mentions("users:other", NOW, comments, resources)).toEqual([]);
  });
});
