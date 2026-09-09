import type { Working } from "$app-views/categories/agents/procedures/run";

/**
 * What the library surface holds for as long as it is mounted.
 *
 * The filters are deliberately not kept anywhere longer-lived: coming back to
 * the library and finding it still narrowed to one persona from an hour ago is
 * the state that makes a table look empty for no visible reason.
 */
export class LibraryState implements Working {
  persona = $state("any");
  query = $state("");
  kind = $state("any");
  taskState = $state("any");
  sort = $state("started");
  direction = $state("asc");

  /** "persona" or "automation" while one is being made. */
  busy = $state<string>();
  failure = $state<string>();
  mounted = true;

  clearFilters(): void {
    this.query = "";
    this.kind = "any";
    this.taskState = "any";
  }
}
