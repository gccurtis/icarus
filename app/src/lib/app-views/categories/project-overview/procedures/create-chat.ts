import { createThread, readThreads } from "$capabilities/research-chat/index.remote";
import { readProjectResourceIndex } from "$capabilities/project-resources/index.remote";

/**
 * Opens an empty research chat and hands back the row a tab can be opened on.
 *
 * The tab bar names a chat from the scoped represented-resource index, so that
 * projection is refreshed before a tab opens on the new resource id.
 */
export const createChat = async (): Promise<string> => {
  const { threadId } = await createThread({}).updates(
    readThreads,
    readProjectResourceIndex
  );
  return threadId;
};
