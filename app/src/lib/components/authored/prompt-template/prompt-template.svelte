<script lang="ts">
  import { PanelButton, PanelQuote, PanelSection } from "$authored-components/panel";
  import { traceNode } from "$development-components/trace.svelte";

  /**
   * Compact slot authoring for a prompt inside an actual template stage.
   * Metadata and default editing belong to the stage's Slots context section.
   */
  let {
    name,
    offered,
    standing,
    disabled = false,
    onmake
  }: {
    /** The slot's name, or undefined while this is not a slot. */
    name?: string;
    /** The name the button will give it. */
    offered: string;
    /** What it would default to, in words — the scope it reads, or the words it holds. */
    standing: string;
    disabled?: boolean;
    onmake: () => void;
  } = $props();

  const trace = traceNode("PromptTemplate", () => ({ name, offered }));

</script>

<PanelSection title="Template" open={name !== undefined} chevron="end">
  <div class="template" {...trace}>
    {#if name === undefined}
      <div class="act">
        <PanelButton
          label="Make slot"
          tone="primary"
          {disabled}
          title={`Make this a slot called ${offered}`}
          onclick={onmake}
        />
      </div>
    {:else}
      <span class="label">{name}</span>
      <PanelQuote>{standing}</PanelQuote>
    {/if}
  </div>
</PanelSection>

<style>
  .template {
    display: flex;
    flex-direction: column;
    gap: calc(var(--token-spacing-unit) * 2);
  }

  .label {
    color: var(--token-ink-muted);
    font-size: var(--token-text-caption);
    font-weight: 650;
    letter-spacing: 0.06em;
    line-height: var(--token-text-caption-leading);
    text-transform: uppercase;
  }

  .act {
    display: flex;
  }
</style>
