import type { Working } from "$app-views/categories/agents/procedures/run";

/** What the automation surface holds for as long as it is mounted. */
export class AutomationState implements Working {
  /** The rule whose lens has already been opened, so it opens once. */
  claimed = $state<string>();
  busy = $state<string>();
  failure = $state<string>();
  mounted = true;
}
