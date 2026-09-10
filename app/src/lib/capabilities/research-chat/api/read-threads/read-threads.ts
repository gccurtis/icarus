import { requireScope } from "$runtime/server/scope.server";
import { serverModel } from "$runtime/server/start.server";
import { asId } from "$representation/data/behavior/core/id";

import { threadItem } from "$capabilities/research-chat/api/shared/projection";
import { researchConversationIn } from "$capabilities/research-chat/api/shared/conversation";
import { researchResources } from "$capabilities/research-chat/api/shared/resource-catalogue";
import { rowsIn, threadsIn } from "$capabilities/research-chat/api/shared/store";
import type {
  ReadThreadsResult,
  ResourceOption
} from "$capabilities/research-chat/types/research-chat";

export const readThreads = async (): Promise<ReadThreadsResult> => {
  const scope = await requireScope();
  const model = serverModel();
  const store = model.store;
  const projectId = asId<"projects">(scope.projectId);
  const personas = rowsIn(store, "personas")
    .filter((row) => row.projectId === scope.projectId && typeof row.name === "string")
    .toSorted((left, right) => left.name.localeCompare(right.name));
  const named = new Map(personas.map((row) => [row._id as string, row.name]));
  const resources = researchResources(model, projectId)
    .map(({ ref, name, relativePath }): ResourceOption => ({ ...ref, name, relativePath }));
  return {
    threads: threadsIn(store, scope.projectId)
      .map((row) => {
        researchConversationIn(store, projectId, row);
        return threadItem(store, row, (id) => named.get(id) ?? null);
      })
      .toSorted((left, right) => right.updatedAt - left.updatedAt),
    personas: personas.map((row) => ({
      id: row._id,
      name: row.name,
      description: row.description ?? null
    })),
    resources: resources.toSorted(
      (left, right) =>
        left.name.localeCompare(right.name) ||
        (left.relativePath ?? "").localeCompare(right.relativePath ?? "") ||
        left.kind.localeCompare(right.kind) ||
        left.id.localeCompare(right.id)
    )
  };
};
