import type { Creating } from "$app-views/categories/project-overview/procedures/make-resource";

/**
 * What the board holds for as long as it is mounted.
 *
 * Resource filters have a separate lifetime owned by the mounted resource table.
 */
export class OverviewState {
  /** Which of the two the feed is showing. */
  feed = $state<"mentions" | "activity">("mentions");

  readonly creation: Creating = $state({
    mounted: true,
    making: undefined,
    failure: undefined
  });

  dispose(): void {
    this.creation.mounted = false;
  }
}
