import { requireScope } from "$runtime/server/scope.server";
import { serverModel } from "$runtime/server/start.server";
import { asId } from "$representation/data/behavior/core/id";

import { paragraphOf } from "$capabilities/comments/api/shared/paragraph";
import {
  currentStageResource,
  resourceRowIsCurrent
} from "$capabilities/comments/api/shared/current-rows";
import { validateStartThread } from "$capabilities/comments/api/start-thread/validate-start-thread";
import type { StartThreadResult } from "$capabilities/comments/types/start-thread";

export const startThread = async (input: unknown): Promise<StartThreadResult> => {
  const scope = await requireScope();
  const asked = validateStartThread(input);

  const store = serverModel().store;
  const projectId = asId<"projects">(scope.projectId);
  const author = { kind: "user" as const, userId: asId<"users">(scope.userId) };
  const at = Date.now();

  return store.transaction((unit) => {
    const table = asked.target.kind === "document"
      ? "documents"
      : asked.target.kind === "slides"
        ? "slideDecks"
        : "spreadsheets";
    const resources = unit.read(table);
    const claimedResources = resources?.kind === "table" && resources.table === table
      ? resources.rows.filter((row) => row._id === asked.target.id)
      : [];
    if (
      resources?.kind !== "table" ||
      resources.table !== table ||
      claimedResources.length !== 1 ||
      !resourceRowIsCurrent(claimedResources[0], table, projectId, asked.target.id)
    ) {
      throw new Error(`comments/start-thread: no ${asked.target.kind} ${asked.target.id}`);
    }
    const stages = unit.read("templateStages");
    if (
      stages?.table === "templateStages" &&
      stages.kind === "table" &&
      stages.rows.some((row) => currentStageResource(row, projectId) === asked.target.id)
    ) {
      throw new Error("comments/start-thread: a template's working copy takes no comments");
    }
    const threadId = unit.create("commentThreads", {
      projectId,
      target: asked.target,
      ...(asked.within === undefined ? {} : { within: asked.within }),
      ...(asked.quote === undefined ? {} : { quote: asked.quote }),
      createdBy: author,
      updatedAt: at
    });
    const commentId = unit.create("comments", {
      projectId,
      threadId,
      blocks: [paragraphOf(asked.text)],
      mentions: [],
      author
    });
    return { threadId, commentId };
  });
};
