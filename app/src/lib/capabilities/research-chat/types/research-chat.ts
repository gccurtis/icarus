import type { ContentBlock } from "$representation/data/types/content/content-block";
import type { ResourceRef } from "$representation/data/types/core/resource";
import type { ResearchModeKind } from "$representation/data/types/investigation/research-thread";
import type {
  ResearchFinding,
  ResearchScope,
  ResearchSource,
  ResearchToolId,
  ResearchTurnUsage
} from "$representation/data/types/investigation/research-turn";

export type ThreadItem = {
  readonly id: string;
  readonly title: string;
  readonly mode: ResearchModeKind;
  readonly personaId: string | null;
  readonly personaName: string | null;
  readonly turnCount: number;
  readonly lastLine: string | null;
  readonly updatedAt: number;
};

type TurnItemCommon = {
  readonly id: string;
  readonly threadId: string;
  readonly prompt: string;
  readonly mode: ResearchModeKind;
  readonly scope: ResearchScope;
  readonly tools: readonly ResearchToolId[];
  readonly askedAt: number;
  readonly stopRequested: boolean;
};

export type RunningTurnItem = TurnItemCommon & {
  readonly state: "running";
  readonly usage?: never;
  readonly model?: never;
  readonly error?: never;
  readonly answeredAt?: never;
  readonly blocks: readonly [];
  readonly queries: readonly [];
  readonly sources: readonly [];
  readonly findings: readonly [];
};

export type CompletedTurnItem = TurnItemCommon & {
  readonly state: "answered" | "insufficient";
  readonly blocks: readonly ContentBlock[];
  readonly queries: readonly string[];
  readonly sources: readonly ResearchSource[];
  readonly findings: readonly ResearchFinding[];
  readonly usage: ResearchTurnUsage;
  readonly model: string;
  readonly error?: never;
  readonly answeredAt: number;
};

export type UnsuccessfulTurnItem = TurnItemCommon & {
  readonly state: "failed" | "cancelled";
  readonly usage?: never;
  readonly model?: never;
  readonly error: string;
  readonly answeredAt?: never;
  readonly blocks: readonly [];
  readonly queries: readonly [];
  readonly sources: readonly [];
  readonly findings: readonly [];
};

export type TurnItem = RunningTurnItem | CompletedTurnItem | UnsuccessfulTurnItem;

/** One thing a turn can be narrowed to, named as the composer shows it. */
export type ResourceOption = ResourceRef & {
  readonly name: string;
  /** Exact uploaded path for External files; represented resources have no path. */
  readonly relativePath: string | null;
};

export type ReadThreadsResult = {
  readonly threads: readonly ThreadItem[];
  readonly personas: readonly PersonaOption[];
  readonly resources: readonly ResourceOption[];
};

export type ReadThreadInput = { readonly threadId: string };

export type ReadThreadResult = {
  readonly thread: ThreadItem;
  readonly turns: readonly TurnItem[];
} | null;

export type CreateThreadInput = { readonly title?: string };

export type CreateThreadResult = { readonly threadId: string };

export type AskInput = {
  readonly threadId: string;
  readonly text: string;
  readonly scope?: ResearchScope;
  readonly tools?: readonly ResearchToolId[];
};

export type AskResult =
  | { readonly accepted: true; readonly threadId: string; readonly turnId: string }
  | {
      readonly accepted: false;
      readonly threadId: string;
      readonly reason: "not-found" | "invalid-state";
      readonly detail: string;
    };

/**
 * A chat, not a turn.
 *
 * A person presses Stop on the conversation in front of them, and the turn it
 * is running may not have reached the browser yet: the request that made it is
 * the request still in flight. The server is the only side that always knows.
 */
export type StopTurnInput = { readonly threadId: string };

export type StopTurnResult =
  | {
      readonly accepted: true;
      readonly threadId: string;
      readonly turnId: string;
      readonly outcome: "answering" | "cancelled";
    }
  | { readonly accepted: false; readonly threadId: string; readonly detail: string };

export type SetThreadPersonaInput = {
  readonly threadId: string;
  readonly personaId: string | null;
};

export type PersonaOption = {
  readonly id: string;
  readonly name: string;
  readonly description: string | null;
};

export type RemoveThreadInput = { readonly threadId: string };

export type RemoveThreadResult =
  | { readonly accepted: true; readonly threadId: string }
  | { readonly accepted: false; readonly threadId: string; readonly detail: string };
