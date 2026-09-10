import { requireScope } from "$runtime/server/scope.server";
import { serverModel } from "$runtime/server/start.server";

import { threadItem } from "$capabilities/research-chat/api/shared/projection";
import { rowsIn, threadsIn } from "$capabilities/research-chat/api/shared/store";
import type {
  ReadThreadsResult,
  ResourceOption
} from "$capabilities/research-chat/types/research-chat";

export const readThreads = async (): Promise<ReadThreadsResult> => {
  const scope = await requireScope();
  const store = serverModel().store;
  const personas = rowsIn(store, "personas")
    .filter((row) => row.projectId === scope.projectId && typeof row.name === "string")
    .toSorted((left, right) => left.name.localeCompare(right.name));
  const named = new Map(personas.map((row) => [row._id as string, row.name]));
  const resources: ResourceOption[] = [
    ...rowsIn(store, "documents")
      .filter((row) => row.projectId === scope.projectId)
      .map((row) => ({ kind: "document" as const, id: row._id, name: row.title })),
    ...rowsIn(store, "slideDecks")
      .filter((row) => row.projectId === scope.projectId)
      .map((row) => ({ kind: "slides" as const, id: row._id, name: row.title })),
    ...rowsIn(store, "spreadsheets")
      .filter((row) => row.projectId === scope.projectId)
      .map((row) => ({ kind: "spreadsheet" as const, id: row._id, name: row.title }))
  ];
  return {
    threads: threadsIn(store, scope.projectId)
      .map((row) => threadItem(store, row, (id) => named.get(id) ?? null))
      .toSorted((left, right) => right.updatedAt - left.updatedAt),
    personas: personas.map((row) => ({
      id: row._id,
      name: row.name,
      description: row.description ?? null
    })),
    resources: resources.toSorted((left, right) => left.name.localeCompare(right.name))
  };
};
