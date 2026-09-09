import {
  readThread,
  readThreads,
  type PersonaOption,
  type ThreadItem,
  type TurnItem
} from "$capabilities/research-chat/index.remote";
import type { WorkspaceStateModel } from "$model/client/workspace-state";

export type { PersonaOption, ThreadItem, TurnItem };

/**
 * What a chat command needs of the surface that asked for it.
 *
 * Structural on purpose: the centre's own state owner satisfies it, and so does
 * a panel holding two bindings, without either knowing about the other.
 */
export type Working = {
  /** False once the surface is gone, so a late answer writes nothing. */
  mounted: boolean;
  pending: boolean;
  failure: string | undefined;
};

export const threadList = () => readThreads();

export const threadDetail = (threadId: string | undefined) =>
  threadId === undefined ? undefined : readThread({ threadId });

/** The chat the centre is on: the tab's own, or the most recent one. */
export const chosenThread = (
  view: WorkspaceStateModel,
  threads: readonly ThreadItem[]
): string | undefined => {
  const asked = view.active.focus ?? view.active.resourceId;
  if (asked !== undefined && threads.some((thread) => thread.id === asked)) return asked;
  return threads[0]?.id;
};

export const openThread = (view: WorkspaceStateModel, threadId: string): void => {
  view.showContent("research.thread", threadId);
};

export const currentTurn = (turns: readonly TurnItem[]): TurnItem | undefined =>
  turns[turns.length - 1];

export const turnById = (
  turns: readonly TurnItem[],
  turnId: string | undefined
): TurnItem | undefined =>
  turnId === undefined ? undefined : turns.find((turn) => turn.id === turnId);

/** One key per durable chat command, so every surface joins the same run. */
export const flightKey = (view: WorkspaceStateModel, ...parts: readonly string[]) =>
  ["research-chat", view.project, ...parts] as const;
