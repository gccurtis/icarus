<script lang="ts">
  import Copy from "@lucide/svelte/icons/copy";
  import SquarePen from "@lucide/svelte/icons/square-pen";
  import WandSparkles from "@lucide/svelte/icons/wand-sparkles";

  import {
    Panel,
    PanelActions,
    PanelActor,
    PanelButton,
    PanelChoice,
    PanelCrumbs,
    PanelEditableText,
    PanelField,
    PanelFields,
    PanelNote,
    PanelRow,
    PanelSection,
    PanelThumb,
    PanelThumbs
  } from "$authored-components/panel";
  import { PEOPLE, type Person } from "$capabilities/cast";
  import { previewOf, template, variablesIn } from "$capabilities/library";
  import { isInspectionKey, viewState } from "$model/client/view-state";

  /**
   * A template in the library: what it makes, what it looks like, what it asks
   * for.
   *
   * `docs/screen-panel-views/inspector/library/template.md` is the
   * specification. The model has no thumbnail, tag, category, favourite or usage
   * count, and this lens does not pretend otherwise — **the preview is the only
   * visual identity a template has**, and it is drawn from the real body rather
   * than from a stored picture.
   *
   * **Use is disabled and stays disabled.** Nothing in a body records which
   * variable it stands for, so a supplied value would have nowhere to go. Edit
   * and Duplicate are inert for a duller reason: entering the authoring
   * subscreen and copying a record are steps no door here has.
   */
  let { templateId = "tp-filing" }: { templateId?: string } = $props();

  const view = viewState();

  const tpl = $derived(template(templateId).current);
  const asks = $derived(variablesIn(templateId).current);
  const preview = $derived(previewOf(templateId).current);

  /** Undefined until touched, so an untouched value still reads from the door. */
  let name = $state<string>();
  let scope = $state<string>();

  /** Who owns it. The library groups by the same three words. */
  const SCOPES = [
    { value: "Project", label: "Project" },
    { value: "Shared", label: "Shared" },
    { value: "Personal", label: "Personal" }
  ] as const;

  const creator = $derived(PEOPLE.find((person: Person) => person.name === tpl.createdBy));
</script>

<Panel title={tpl.name}>
  {#snippet crumbs()}
    <PanelCrumbs
      trail={[{ label: "Templates" }, { label: tpl.name }]}
      onnavigate={(key: string) => {
        if (isInspectionKey(key)) view.inspect(key);
      }}
    />
  {/snippet}

  <PanelSection title="This template" flush>
    <PanelFields>
      <PanelField label="Name" stacked>
        <PanelEditableText
          label="Name"
          value={name ?? tpl.name}
          onchange={(next: string) => (name = next)}
        />
      </PanelField>
      <!-- What it makes is fixed at creation, so it is a fact rather than a control. -->
      <PanelField label="Makes a">{tpl.makes} — fixed at creation</PanelField>
      <PanelField label="Available in" stacked>
        <PanelChoice
          label="Available in"
          value={scope ?? tpl.scope}
          options={SCOPES}
          flush
          onchange={(next: string) => (scope = next)}
        />
      </PanelField>
    </PanelFields>
  </PanelSection>

  <PanelSection title="Preview" flush>
    <PanelThumbs>
      <PanelThumb ratio="4 / 3" caption="Page 1" meta={tpl.updated}>
        {#snippet children()}
          <span class="page border-border-subtle bg-surface-canvas rounded-control border">
            {#each preview as line (line.id)}
              <!--
                A variable region is coloured rather than boxed: at this size a
                border around three words is a smudge.
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
      Distinguishing the variable regions requires knowing where they are, which
      is the gap that gates the whole screen.
    </PanelNote>
  </PanelSection>

  <PanelSection title="It will ask for" count={asks.length} flush>
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
          <span class="text-caption text-ink-muted truncate">
            {variable.type} · {variable.required ? "required" : "optional"}
          </span>
        {/snippet}
      </PanelRow>
    {/each}
    {#if asks.length === 0}
      <PanelNote>It asks for nothing. What it makes is the body as it stands.</PanelNote>
    {/if}
  </PanelSection>

  <PanelSection title="Actions" flush>
    <PanelActions>
      <PanelButton
        label="Edit"
        icon={SquarePen}
        tone="primary"
        title="Opens it in the authoring centre."
        onclick={() => view.open({ screen: "templates", subscreen: "editor", focus: tpl.id })}
      />
      <PanelButton
        label="Use"
        icon={WandSparkles}
        disabled
        title="Nothing in a body records which variable it stands for, so a supplied value has nowhere to go."
      />
      <!-- Disabled, and the reason is the same one Use carries: nothing writes a
           template back, so a copy would exist only until the next read. -->
      <PanelButton
        label="Duplicate"
        icon={Copy}
        disabled
        title="No capability writes a template, so a copy would not survive the next read."
      />
    </PanelActions>
  </PanelSection>

  <PanelSection title="Attribution" open={false} flush>
    <PanelFields>
      <PanelField label="Created by">
        {#if creator}
          <PanelActor
            name={creator.name}
            kind="person"
            onselect={() =>
              view.inspect("collaboration.person", { kind: "person", id: creator.id })}
          />
        {:else}
          {tpl.createdBy}
        {/if}
      </PanelField>
      <PanelField label="Revision" mono>{tpl.revision}</PanelField>
    </PanelFields>
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
