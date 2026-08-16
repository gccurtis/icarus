<script lang="ts">
  import { clientModel } from "$model/client";
  import NextText from "$views/inspector/components/next-text.svelte";
  import TextSelection from "$views/inspector/components/text-selection.svelte";

  /**
   * The inspector — the lens. It answers "what is this selected thing?"
   *
   * It reads `currentInspection`, the innermost node of the active tab's
   * inspection ancestry. That value is `undefined` whenever nothing is
   * inspected, which the model made a named state rather than an absent one:
   * this panel is a control surface, not a mirror, and the nothing-inspected
   * case is exactly when it can offer insert affordances.
   *
   * **The key selection is an if-chain rather than a map**, unlike the workspace
   * and the context panel. `InspectionNode` is a discriminated union whose
   * members carry different fields, so a `Record<kind, Component>` would erase
   * the per-kind props and every component would take `any`. Narrowing on `kind`
   * is what keeps `blockId` and the offsets typed at the point they are passed.
   *
   * **The map is partial, deliberately.** Only the two kinds a surface can
   * actually produce are built. `document-table`, `formula`, and `prompt` have
   * no producer, and `empty` needs the insert affordances that belong to an
   * editor; components for any of them would be files nothing can reach. The
   * fallback below names the kind, which is the honest rendering of "something
   * is inspected and this panel has no view for it yet".
   */
  const { workbench } = clientModel();

  const inspection = $derived(workbench.currentInspection);
</script>

<aside class="inspector" aria-label="Inspector">
  {#if !inspection}
    <p class="note">Nothing selected.</p>
  {:else if inspection.kind === "document-text-selection"}
    <TextSelection blockId={inspection.blockId} from={inspection.from} to={inspection.to} />
  {:else if inspection.kind === "document-next-text"}
    <NextText blockId={inspection.blockId} />
  {:else}
    <p class="note">No view for <code>{inspection.kind}</code> yet.</p>
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
