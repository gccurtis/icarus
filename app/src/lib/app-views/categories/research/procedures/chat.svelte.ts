import {
  ask as askRemote,
  createThread as createThreadRemote,
  readThread,
  readThreads,
  removeThread as removeThreadRemote,
  setThreadPersona as setThreadPersonaRemote,
  stopTurn as stopTurnRemote,
  type PersonaOption,
  type ThreadItem,
  type TurnItem
} from "$capabilities/research-chat/index.remote";
import type { WorkspaceStateModel } from "$model/client/workspace-state";
import type { ResearchModeKind } from "$representation/data/types/investigation/research-thread";
import type { ResearchScope } from "$representation/data/types/investigation/research-turn";

export type { PersonaOption, ThreadItem, TurnItem };

export const MODES: readonly ResearchModeKind[] = ["explore", "question", "hypothesis"];

export const MODE_LABEL: Record<ResearchModeKind, string> = {
  explore: "Explore",
  question: "Question",
  hypothesis: "Hypothesis"
};

export const SCOPE_LABEL: Record<ResearchScope["kind"], string> = {
  project: "All project",
  resource: "This resource"
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

export const inspectTurn = (view: WorkspaceStateModel, turnId: string): void => {
  view.inspect("research.turn", { kind: "turn", id: turnId });
};

export const currentTurn = (turns: readonly TurnItem[]): TurnItem | undefined =>
  turns[turns.length - 1];

export const turnById = (
  turns: readonly TurnItem[],
  turnId: string | undefined
): TurnItem | undefined =>
  turnId === undefined ? undefined : turns.find((turn) => turn.id === turnId);

/**
 * What is half-typed in each chat, kept while the tab is away.
 *
 * Module state rather than the surface's, because switching tabs unmounts the
 * surface and losing a paragraph somebody was writing is not acceptable.
 */
const drafts = new Map<string, string>();

export const draftFor = (threadId: string | undefined): string =>
  threadId === undefined ? "" : (drafts.get(threadId) ?? "");

export const keepDraft = (threadId: string | undefined, text: string): void => {
  if (threadId === undefined) return;
  if (text === "") drafts.delete(threadId);
  else drafts.set(threadId, text);
};

export const messageOf = (error: unknown): string =>
  error instanceof Error ? error.message : "Something went wrong";

const flight = (view: WorkspaceStateModel, ...parts: readonly string[]) =>
  ["research-chat", view.project, ...parts] as const;

/**
 * The tab bar reads chat titles from the generic store query, which may be warm
 * but unmounted. Refresh it here so a new tab is named rather than disconnected.
 */
export const createThread = (view: WorkspaceStateModel) =>
  view.singleFlight(flight(view, "create"), async () => {
    const made = await createThreadRemote({}).updates(readThreads);
    await view.readStore("researchThreads").refresh();
    return made;
  });

export const askQuestion = (
  view: WorkspaceStateModel,
  threadId: string,
  text: string,
  scope: ResearchScope
) =>
  view.singleFlight(flight(view, "ask", threadId), async () => {
    const result = await askRemote({ threadId, text, scope }).updates(readThreads);
    // The first question names the chat, and the tab shows that name.
    await view.readStore("researchThreads").refresh();
    return result;
  });

export const stopTurn = (view: WorkspaceStateModel, threadId: string) =>
  stopTurnRemote({ threadId }).updates(readThreads);

export const setPersona = (
  view: WorkspaceStateModel,
  threadId: string,
  personaId: string | null
) =>
  view.singleFlight(flight(view, "persona", threadId), () =>
    setThreadPersonaRemote({ threadId, personaId }).updates(readThreads)
  );

export const removeThread = (view: WorkspaceStateModel, threadId: string) =>
  view.singleFlight(flight(view, "remove", threadId), () =>
    removeThreadRemote({ threadId }).updates(readThreads)
  );
