<script lang="ts">
  import { username } from "$capabilities/development/index.remote";
  import { kindOf, nameOf } from "$surfaces/status-bar/procedures/resource-name";
  import { workspaceState } from "$model/client/workspace-state";

  /**
   * The bar across the foot of the application. Two parts, at opposite ends.
   *
   * **Its columns are the frame's columns.** Left sits under the context panel,
   * right under the inspector, with the work surface's width between them — so
   * each end is under the thing it is about. This is why the widths are read
   * from the frame's own custom properties instead of being halves.
   *
   * **Left is about the work, right is about you.** A resource's state and a
   * person's attention are different kinds of fact, and putting them at opposite
   * ends is what stops the bar becoming a single run of unrelated chips.
   */
  const view = workspaceState();

  // ------------------------------------------------------------ the work ----

  /**
   * What is on the surface, and nothing about which category is showing it.
   *
   * The category has a tab two rows up; naming it again here would spend the one
   * always-visible line on the least surprising fact in the application. What
   * the tab strip cannot say is which *thing* a permanent tab is on, because it
   * moves between subjects without ever minting a tab — the Agents tab on a
   * persona is exactly the case a tab label cannot describe.
   *
   * `resourceId` first, because a tab that holds an identified thing is named by
   * it; `focus` otherwise, which is where a permanent tab keeps its subject.
   */
  const subjectId = $derived(view.active.resourceId ?? view.active.focus);

  const name = $derived(subjectId === undefined ? undefined : nameOf(subjectId));
  const kind = $derived(subjectId === undefined ? undefined : kindOf(subjectId));

  // ----------------------------------------------------------------- you ----

  /** From `configuration/dev.yaml` until authentication exists. */
  const you = $derived(username().current);
</script>

<footer class="status-bar">
  <!--
    What is on the work surface. Never a control except for the subject, which
    opens what it names — a status bar that acted on things would be a toolbar.
  -->
  <div class="part start">
    {#if name !== undefined}
      <span class="subject" title={name}>{name}</span>
      {#if kind !== undefined}
        <span class="sep" aria-hidden="true">·</span>
        <span class="label">{kind}</span>
      {/if}
    {:else}
      <span class="label">Nothing open</span>
    {/if}
  </div>

  <!-- You. What is addressed to you arrives here when comments are built. -->
  <div class="part end">
    <span class="label">{you ?? "…"}</span>
  </div>
</footer>

<style>
  /**
   * The frame's own columns. `--app-context` and `--app-inspector` are set by the
   * frame from the active tab, so the two ends track the panels as they are
   * dragged and the middle track stays exactly as wide as the work surface.
   */
  .status-bar {
    display: grid;
    height: 100%;
    grid-template-columns: var(--app-context) 1fr var(--app-inspector);
    align-items: center;
    background-color: var(--token-surface-panel);
    border-top: 1px solid var(--token-border-subtle);
  }

  .part {
    display: flex;
    min-width: 0;
    align-items: center;
    gap: calc(var(--token-spacing-unit) * 1.5);
    padding-inline: calc(var(--token-spacing-unit) * 3);
    font-size: var(--token-text-caption);
    color: var(--token-ink-muted);
  }

  /* The third track is the work surface's width, and nothing sits in it, so the
     right-hand part is placed rather than flowed into the middle. */
  .end {
    grid-column: 3;
    justify-content: flex-end;
  }

  .label {
    white-space: nowrap;
  }

  .subject {
    overflow: hidden;
    color: var(--token-ink-secondary);
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .sep {
    color: var(--token-border-strong);
  }
</style>
