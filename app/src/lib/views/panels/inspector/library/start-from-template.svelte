<script lang="ts">
  import WandSparkles from "@lucide/svelte/icons/wand-sparkles";

  import {
    Panel,
    PanelActions,
    PanelButton,
    PanelCrumbs,
    PanelField,
    PanelFields,
    PanelNote,
    PanelRow,
    PanelSection,
    PanelThumb,
    PanelThumbs
  } from "$authored-components/panel";
  import { previewOf, template, variablesIn } from "$capabilities/library";
  import { isInspectionKey, viewState } from "$model/client/view-state";

  /**
   * A template, from the launcher: what it will ask you for, and using it.
   *
   * `docs/screen-panel-views/inspector/library/start-from-template.md` is the
   * specification. Enough to decide whether this is the template you want
   * without going to the Templates tab — **so nothing here is editable**.
   * Editing a template happens where a template is owned, and a launcher that
   * quietly renamed one would change every future use of it from a tab that
   * looks like it is making a document.
   *
   * Use template is disabled: nothing in a body records which variable it stands
   * for, so a supplied value has nowhere to go.
   */
  let { templateId = "tp-filing" }: { templateId?: string } = $props();

  const view = viewState();

  const tpl = $derived(template(templateId).current);
  const asks = $derived(variablesIn(templateId).current);
  const preview = $derived(previewOf(templateId).current);

  /** Whose it is, in the library's own words. */
  const where = $derived(tpl.scope);
</script>

<Panel title={tpl.name}>
  {#snippet crumbs()}
    <PanelCrumbs
      trail={[{ label: "New tab" }, { label: "Templates" }, { label: tpl.name }]}
      onnavigate={(key: string) => {
        if (isInspectionKey(key)) view.inspect(key);
      }}
    />
  {/snippet}

  <PanelSection title="Identity" flush>
    <PanelFields>
      <PanelField label="Name" stacked>{tpl.name}</PanelField>
      <PanelField label="Target">{tpl.makes}</PanelField>
      <PanelField label="Scope">{where}</PanelField>
    </PanelFields>
  </PanelSection>

  <PanelSection title="Preview" flush>
    <PanelThumbs>
      <PanelThumb ratio="4 / 3" caption="Page 1" meta={tpl.updated}>
        {#snippet children()}
          <span class="page border-border-subtle bg-surface-canvas rounded-control border">
            {#each preview as line (line.id)}
              <!--
                Rendered from the real body, not from a stored thumbnail: the
                model has no thumbnail field and the library must not imply one.
              -->
              {@const look = line.variable
                ? "text-intelligence-text"
                : line.style === "heading"
                  ? "text-ink-primary font-semibold"
                  : "text-ink-secondary"}
              <span class="line text-caption {look}">{line.text}</span>
            {/each}
          </span>
        {/snippet}
      </PanelThumb>
    </PanelThumbs>
    <PanelNote tone="gap">
      Marking the variable regions requires knowing where they are, which is the
      same gap that blocks using the template at all.
    </PanelNote>
  </PanelSection>

  <PanelSection title="Variables it asks for" count={asks.length} flush>
    {#each asks as variable (variable.id)}
      <PanelRow
        title={variable.key}
        onselect={() =>
          view.inspect("library.template-variable", {
            kind: "template-variable",
            id: variable.id
          })}
      >
        {#snippet children()}
          <span class="text-body-sm text-ink-primary truncate font-mono">{variable.key}</span>
          <!--
            A generated variable is not a question. It is listed here because it
            is still something the result will carry, and marked optional
            because you are never asked for it.
          -->
          <span class="text-caption text-ink-muted truncate">
            {variable.type} · {variable.required ? "required" : "optional"}
          </span>
        {/snippet}
      </PanelRow>
    {/each}
    {#if asks.length === 0}
      <PanelNote>It asks for nothing. Using it copies the body as it stands.</PanelNote>
    {/if}
  </PanelSection>

  <PanelSection title="Create" flush>
    <PanelActions>
      <PanelButton
        label="Use template"
        icon={WandSparkles}
        disabled
        title="Nothing in a body records which variable it stands for, so a supplied value has nowhere to go."
      />
    </PanelActions>
    <PanelNote tone="gap">
      Every template with variables is unusable until a body entity can carry a
      variable key.
    </PanelNote>
  </PanelSection>
</Panel>

<style>
  /* The body, drawn small. A page rather than a picture of one. */
  .page {
    display: flex;
    aspect-ratio: 4 / 3;
    flex-direction: column;
    gap: var(--token-spacing-unit);
    overflow: hidden;
    padding: calc(var(--token-spacing-unit) * 2);
  }

  .line {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
</style>
