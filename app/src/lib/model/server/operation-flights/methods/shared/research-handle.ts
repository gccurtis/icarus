import type { HeldResearchFlight } from "$model/server/operation-flights/definition";
import type { ResearchFlight } from "$model/server/operation-flights/types";

export const researchHandle = (held: HeldResearchFlight): ResearchFlight => ({
  signal: held.controller.signal,
  stopping: () => held.stopping,
  reason: () => held.reason
});
