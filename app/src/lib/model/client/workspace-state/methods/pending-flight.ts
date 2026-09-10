import type { WorkspaceStateData } from "$model/client/workspace-state/definition.svelte";
import type { SingleFlightKeyPart } from "$model/client/workspace-state/types";

/** Observe a matching durable client command without acquiring or replacing it. */
export const pendingFlight = <Result>(
  state: WorkspaceStateData,
  key: readonly SingleFlightKeyPart[]
): Promise<Result> | undefined =>
  state.pendingFlights.get(JSON.stringify(key)) as Promise<Result> | undefined;
