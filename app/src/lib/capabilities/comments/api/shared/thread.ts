import type { StoreModel } from "$model/server/store/index.server";

export type ThreadRow = {
  readonly _id: string;
  readonly projectId: string;
  readonly resolution?: unknown;
};

export const threadOf = (store: StoreModel, projectId: string, threadId: string): ThreadRow | undefined => {
  const found = store.read("commentThreads");
  if (found?.table !== "commentThreads" || found.kind !== "table") return undefined;
  return found.rows.find((row) => row._id === threadId && row.projectId === projectId);
};
