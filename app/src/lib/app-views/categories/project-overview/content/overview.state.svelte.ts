import type { Creating } from "$app-views/categories/project-overview/procedures/make-resource";

/**
 * What the board holds for as long as it is mounted.
 *
 * The filters die with the tab on purpose: coming back to the board and finding
 * it still narrowed to one person from an hour ago is the state that makes the
 * project look empty for no visible reason.
 */
export class OverviewState {
  /** Which of the two the feed is showing. */
  feed = $state<"mentions" | "activity">("mentions");

  search = $state("");
  kind = $state("all");
  actor = $state("all");
  sortBy = $state("updated");
  direction = $state<"asc" | "desc">("asc");

  readonly creation: Creating = $state({
    mounted: true,
    making: undefined,
    failure: undefined
  });

  dispose(): void {
    this.creation.mounted = false;
  }
}
