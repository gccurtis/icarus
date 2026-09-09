<script lang="ts">
  import { PanelButton, PanelEditableText, PanelNote, PanelSection } from "$authored-components/panel";
  import { traceNode } from "$development-components/trace.svelte";

  /**
   * What a prompt becomes when its resource is made a template.
   *
   * Every prompt is one hole, so nothing here is a switch: the name is offered
   * rather than asked for, and a template made without opening this section
   * still places. What the section buys is a name the person placing it will
   * recognise, and words telling them what the prompt is for.
   *
   * It sits in the prompt's own inspector, in the ordinary editor as much as in
   * a working copy, because the author of the prompt is the only person who
   * knows what it stands for and they are here already.
   */
  let {
    name,
    offered,
    description,
    context,
    settled,
    disabled = false,
    onname,
    ondescription,
    oncontext
  }: {
    /** What it is called, or empty while the offered name still stands. */
    name: string;
    /** The name it carries until somebody types one. */
    offered: string;
    description: string;
    /** What the hole selects by default, in words, or undefined when it has none. */
    context?: string;
    /** Whether that default was settled by the prompt's own scope. */
    settled: boolean;
    disabled?: boolean;
    onname: (next: string) => void;
    ondescription: (next: string) => void;
    oncontext: () => void;
  } = $props();

  const trace = traceNode("PromptTemplate", () => ({ name, offered, settled }));

  const shown = $derived(name.trim() === "" ? offered : name.trim());

  /** Blank is not a name, so the offered one comes back rather than nothing. */
  const rename = (next: string) => {
    const trimmed = next.trim();
    onname(trimmed === "" ? offered : trimmed);
  };
</script>

<PanelSection title="Template" chevron="end">
  <div class="template" {...trace}>
    <div class="field">
      <span class="label">Hole name</span>
      <PanelEditableText
        value={shown}
        label="What this prompt's hole is called"
        placeholder={offered}
        {disabled}
        onchange={rename}
      />
    </div>

    <div class="field">
      <span class="label">Description <em>optional</em></span>
      <PanelEditableText
        value={description}
        label="What this prompt's hole stands for"
        placeholder="What whoever places this is choosing"
        multiline
        {disabled}
        onchange={ondescription}
      />
    </div>

    <div class="field">
      <span class="label">Default context</span>
      {#if context === undefined}
        <PanelNote tone="muted">
          This prompt reads something particular to this project, so it cannot carry a default.
          Whoever places the template has to choose.
        </PanelNote>
      {:else}
        <p class="rule" class:settled>{context}</p>
      {/if}
      <div class="act">
        <PanelButton
          label="Set default context"
          {disabled}
          title="Choose what this hole selects when nobody says otherwise"
          onclick={oncontext}
        />
      </div>
    </div>
  </div>
</PanelSection>

<style>
  .template {
    display: flex;
    flex-direction: column;
    gap: calc(var(--token-spacing-unit) * 2);
  }

  .field {
    display: flex;
    flex-direction: column;
    gap: calc(var(--token-spacing-unit) * 0.75);
  }

  .label {
    color: var(--token-ink-muted);
    font-size: var(--token-text-caption);
    font-weight: 650;
    letter-spacing: 0.06em;
    line-height: var(--token-text-caption-leading);
    text-transform: uppercase;
  }

  .label em {
    font-style: normal;
    font-weight: 400;
    text-transform: none;
  }

  .rule {
    margin: 0;
    color: var(--token-ink-secondary);
    font-size: var(--token-text-body-sm);
    line-height: var(--token-text-body-sm-leading);
  }

  .rule.settled {
    color: var(--token-ink-primary);
  }

  .act {
    display: flex;
  }
</style>
