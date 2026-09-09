<script lang="ts">
  import { PanelButton, PanelEditableText, PanelNote, PanelSection } from "$authored-components/panel";
  import { traceNode } from "$development-components/trace.svelte";

  /**
   * Turning this thing into a hole, and saying what the hole is.
   *
   * A hole is made, never found: until somebody presses the button there is
   * none, and a template made from this body will not ask about it. That is
   * what makes placing a template short — the questions are the ones somebody
   * meant to ask.
   *
   * There is no default control. A hole's default is simply whatever the thing
   * already is: the scope this prompt reads, or the words that were selected.
   * Changing the default means changing the thing, which is done where the
   * thing is.
   */
  let {
    name,
    description = "",
    offered,
    standing,
    disabled = false,
    onmake,
    onname,
    ondescription
  }: {
    /** The hole's name, or undefined while this is not a hole. */
    name?: string;
    description?: string;
    /** The name the button will give it. */
    offered: string;
    /** What it would default to, in words — the scope it reads, or the words it holds. */
    standing: string;
    disabled?: boolean;
    onmake: () => void;
    onname: (next: string) => void;
    ondescription: (next: string) => void;
  } = $props();

  const trace = traceNode("PromptTemplate", () => ({ name, offered }));

  /** Blank is not a name, so the offered one comes back rather than nothing. */
  const rename = (next: string) => {
    const trimmed = next.trim();
    onname(trimmed === "" ? offered : trimmed);
  };
</script>

<PanelSection title="Template" chevron="end">
  <div class="template" {...trace}>
    {#if name === undefined}
      <PanelNote tone="muted">
        Not a hole. Make it one and a template built from this will ask what fills it, starting from
        what it is now — {standing}.
      </PanelNote>
      <div class="act">
        <PanelButton
          label="Templateify"
          tone="primary"
          {disabled}
          title={`Make this a hole called ${offered}`}
          onclick={onmake}
        />
      </div>
    {:else}
      <div class="field">
        <span class="label">Hole name</span>
        <PanelEditableText
          value={name}
          label="What this hole is called"
          placeholder={offered}
          {disabled}
          onchange={rename}
        />
      </div>

      <div class="field">
        <span class="label">Description <em>optional</em></span>
        <PanelEditableText
          value={description}
          label="What this hole stands for"
          placeholder="What whoever places this is choosing"
          multiline
          {disabled}
          onchange={ondescription}
        />
      </div>

      <div class="field">
        <span class="label">Default</span>
        <p class="standing">{standing}</p>
      </div>
    {/if}
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

  .standing {
    margin: 0;
    color: var(--token-ink-primary);
    font-size: var(--token-text-body-sm);
    line-height: var(--token-text-body-sm-leading);
  }

  .act {
    display: flex;
  }
</style>
