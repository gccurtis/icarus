import type {
  OperationFlightsModel,
  ResearchFlight,
  ResearchFlightReason,
  ResearchStopOutcome
} from "$model/server/operation-flights/types";
import { armResearchDeadline } from "$model/server/operation-flights/methods/arm-research-deadline";
import { beginResearch } from "$model/server/operation-flights/methods/begin-research";
import { close } from "$model/server/operation-flights/methods/close";
import { derivedRequestKey } from "$model/server/operation-flights/methods/derived-request-key";
import { endResearch } from "$model/server/operation-flights/methods/end-research";
import { isResearchActive } from "$model/server/operation-flights/methods/is-research-active";
import { requestResearchStop } from "$model/server/operation-flights/methods/request-research-stop";
import { research } from "$model/server/operation-flights/methods/research";
import { shareDerived } from "$model/server/operation-flights/methods/share-derived";
import { updateDerivedRequestKey } from "$model/server/operation-flights/methods/update-derived-request-key";

export type DerivedFlight = {
  readonly controller: AbortController;
  readonly promise: Promise<unknown>;
  requestKey: string;
};

export type HeldResearchFlight = {
  readonly controller: AbortController;
  readonly settled: Promise<void>;
  readonly settle: () => void;
  stopping: boolean;
  reason?: ResearchFlightReason;
  deadline?: ReturnType<typeof setTimeout>;
};

export type OperationFlightsState = {
  readonly derived: Map<string, DerivedFlight>;
  readonly research: Map<string, HeldResearchFlight>;
  closed: boolean;
  closePromise?: Promise<void>;
};

/** Owns all non-durable operation state for exactly one server process. */
export class OperationFlights implements OperationFlightsModel {
  readonly #state: OperationFlightsState = {
    derived: new Map(),
    research: new Map(),
    closed: false
  };

  derivedRequestKey(key: string): string | undefined {
    return derivedRequestKey(this.#state, key);
  }

  updateDerivedRequestKey(key: string, requestKey: string): void {
    return updateDerivedRequestKey(this.#state, key, requestKey);
  }

  shareDerived<T>(
    key: string,
    requestKey: string,
    run: (signal: AbortSignal) => Promise<T>
  ): { readonly started: boolean; readonly promise: Promise<T> } {
    return shareDerived(this.#state, key, requestKey, run);
  }

  beginResearch(turnId: string): ResearchFlight {
    return beginResearch(this.#state, turnId);
  }

  research(turnId: string): ResearchFlight | undefined {
    return research(this.#state, turnId);
  }

  isResearchActive(turnId: string): boolean {
    return isResearchActive(this.#state, turnId);
  }

  armResearchDeadline(turnId: string, ms: number): () => void {
    return armResearchDeadline(this.#state, turnId, ms);
  }

  requestResearchStop(turnId: string): ResearchStopOutcome {
    return requestResearchStop(this.#state, turnId);
  }

  endResearch(turnId: string): void {
    return endResearch(this.#state, turnId);
  }

  close(): Promise<void> {
    return close(this.#state);
  }
}
