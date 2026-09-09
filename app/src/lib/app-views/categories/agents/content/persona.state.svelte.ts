import type { Working } from "$app-views/categories/agents/procedures/run";

/** What the persona surface holds for as long as it is mounted. */
export class PersonaState implements Working {
  /** The persona whose lens has already been opened, so it opens once. */
  claimed = $state<string>();
  /** Which of the two lists under the definition is showing. */
  band = $state("Tasks");

  query = $state("");
  kind = $state("any");
  taskState = $state("any");
  sort = $state("started");
  direction = $state("asc");

  ruleQuery = $state("");
  ruleTrigger = $state("any");
  ruleOn = $state("any");

  busy = $state<string>();
  failure = $state<string>();
  mounted = true;

  clearFilters(): void {
    this.query = "";
    this.kind = "any";
    this.taskState = "any";
  }
}
