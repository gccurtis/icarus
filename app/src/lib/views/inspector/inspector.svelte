<script lang="ts">
  import Sparkles from "@lucide/svelte/icons/sparkles";

  import { clientModel } from "$model/client";
  import { ResizeHandle } from "$lib/unique-components/resize-handle";
  import NextText from "$views/inspector/components/next-text.svelte";
  import TextSelection from "$views/inspector/components/text-selection.svelte";
  import { COLLAPSE_BELOW, MAX_WIDTH, MIN_WIDTH } from "$views/inspector/types";

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
   *
   * **Collapsed, it becomes a rail rather than nothing.** A flank that vanishes
   * leaves no way back but finding a 4px edge, so what remains is the same 44px
   * strip the context panel collapses to, holding the one control that reopens
   * it. Both edges of the work surface therefore behave alike: drag inward to
   * shut, click an icon in what is left to reopen. No arrows on either side.
   */
  const { workbench } = clientModel();

  const inspection = $derived(workbench.currentInspection);
  const collapsed = $derived(workbench.panels.inspectorCollapsed);
</script>

<aside class="inspector" aria-label="Inspector">
  {#if collapsed}
    <!--
      The whole rail is the control, not an icon sitting on top of one: a 44px
      strip is small enough that a miss between the icon and its edge would read
      as the panel ignoring a click.
    -->
    <button
      type="button"
      class="rail"
      aria-label="Open the inspector"
      aria-expanded="false"
      title="Open the inspector"
      onclick={() => workbench.resize({ inspectorCollapsed: false })}
    >
      <Sparkles size={18} aria-hidden="true" />
    </button>
  {:else}
    <div class="content">
      {#if !inspection}
        <p class="note">Nothing selected.</p>
      {:else if inspection.kind === "document-text-selection"}
        <TextSelection blockId={inspection.blockId} from={inspection.from} to={inspection.to} />
      {:else if inspection.kind === "document-next-text"}
        <NextText blockId={inspection.blockId} />
      {:else}
        <p class="note">No view for <code>{inspection.kind}</code> yet.</p>
      {/if}
    </div>
  {/if}

  <ResizeHandle
    side="end"
    width={workbench.panels.inspectorWidth}
    {collapsed}
    min={MIN_WIDTH}
    max={MAX_WIDTH}
    collapseBelow={COLLAPSE_BELOW}
    label="the inspector"
    onchange={({ width, collapsed: next }) =>
      workbench.resize({ inspectorWidth: width, inspectorCollapsed: next })}
  />
</aside>

<style>
  .inspector {
    position: relative;
    height: 100%;
    min-height: 0;
    display: flex;
    background-color: var(--token-surface-panel);
    border-left: 1px solid var(--token-border-subtle);
  }

  .content {
    flex: 1;
    min-width: 0;
    overflow-y: auto;
    padding: calc(var(--token-spacing-unit) * 3);
  }

  .rail {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    padding-block: calc(var(--token-spacing-unit) * 2);
    border: none;
    background: none;
    /* The intelligence role, because what this strip reopens onto is agent
     * work. It is the one place the collapsed panel can say what it is for. */
    color: var(--token-color-intelligence-text);
    cursor: pointer;
  }

  .rail:hover {
    background-color: var(--token-surface-panel-hover);
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
