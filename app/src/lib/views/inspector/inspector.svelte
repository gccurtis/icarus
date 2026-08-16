<script lang="ts">
  import { clientModel } from "$model/client";

  /**
   * The inspector — the lens. It answers "what is this selected thing?"
   *
   * It reads `currentInspection`, the innermost node of the active tab's
   * inspection ancestry. That value is `undefined` whenever nothing is
   * inspected, which the model made a named state rather than an absent one:
   * this panel is a control surface, not a mirror, and the nothing-inspected
   * case is exactly when it can offer insert affordances.
   *
   * **It is `undefined` on every path today**, because `inspect()` has no
   * callers yet — no editor exists to report a caret. That is a fact about how
   * far the application has been built, not a gap in this view.
   *
   * **There is no kind map here, deliberately.** `InspectionNode` names six
   * kinds, and building six components for carets no surface can produce would
   * be six files nothing can reach. The branch below is the whole of the
   * mapping until something calls `inspect()`; the first caller brings the view
   * its node needs, and the map starts then.
   */
  const { workbench } = clientModel();

  const inspection = $derived(workbench.currentInspection);
</script>

<aside class="inspector" aria-label="Inspector">
  {#if inspection}
    <p class="note">No view for <code>{inspection.kind}</code> yet.</p>
  {:else}
    <p class="note">Nothing selected.</p>
  {/if}
</aside>

<style>
  .inspector {
    height: 100%;
    min-height: 0;
    overflow-y: auto;
    padding: calc(var(--token-spacing-unit) * 3);
    background-color: var(--token-surface-panel);
    border-left: 1px solid var(--token-border-subtle);
  }

  .note {
    font-size: var(--token-text-body-sm);
    color: var(--token-ink-muted);
    margin: 0;
  }

  code {
    font-family: var(--token-font-mono);
    font-size: var(--token-text-mono);
  }
</style>
