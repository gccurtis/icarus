import type { WorkspaceStateModel } from "$model/client/workspace-state";

/**
 * What is half-typed in each chat, kept while its tab is away.
 *
 * The workspace holds it rather than the surface, because leaving a tab
 * unmounts the surface and losing a paragraph somebody was writing is not
 * acceptable. Keyed by chat, so two chats keep two drafts.
 */
const key = (threadId: string): string => `research-chat:${threadId}`;

export const draftFor = (view: WorkspaceStateModel, threadId: string | undefined): string =>
  threadId === undefined ? "" : view.draft(key(threadId));

export const keepDraft = (
  view: WorkspaceStateModel,
  threadId: string | undefined,
  text: string
): void => {
  if (threadId === undefined) return;
  view.keepDraft(key(threadId), text);
};
