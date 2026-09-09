import { createThread, readThreads } from "$capabilities/research-chat/index.remote";
import type { WorkspaceStateModel } from "$model/client/workspace-state";

/**
 * Opens an empty research chat and hands back the row a tab can be opened on.
 *
 * The tab bar names a chat from the workspace's own copy of the thread list, so
 * that read is refreshed here rather than after the tab is already open under a
 * placeholder title.
 */
export const createChat = async (view: WorkspaceStateModel): Promise<string> => {
  const { threadId } = await createThread({}).updates(readThreads);
  await view.readStore("researchThreads").refresh();
  return threadId;
};
