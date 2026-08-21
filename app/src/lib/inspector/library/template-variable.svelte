<script lang="ts">
  import {
    Panel,
    PanelChoice,
    PanelCrumbs,
    PanelEditableText,
    PanelField,
    PanelFields,
    PanelNote,
    PanelSection,
    PanelToggle
  } from "$lib/unique-components/panel";
  import { template, templateVariable } from "$mock-capabilities/library";
  import { mockWorkbench } from "$mock-models/workbench.svelte";

  /**
   * One thing a template will ask for.
   *
   * `docs/screen-panel-views/inspector/library/template-variable.md` is the
   * specification. **The key and the label are both shown and neither stands in
   * for the other**: the key is what the body would reference, the label is what
   * a person reads when they are asked to fill it in, and a lens that showed one
   * would leave the other unaccounted for.
   *
   * The four types are the vocabulary rather than sample content — `Image` has
   * no authoring kind behind it yet, which is why the set is written here and
   * not read from the insert menu.
   */
  let { variableId = "tv-docket" }: { variableId?: string } = $props();

  const variable = $derived(templateVariable(variableId).current);
  const owner = $derived(template(variable.templateId).current);

  /** Undefined until touched, so an untouched value still reads from the door. */
  let label = $state<string>();
  let type = $state<string>();
  let required = $state<boolean>();
  let fallback = $state<string>();

  const TYPES = [
    { value: "Text", label: "Text" },
    { value: "Image", label: "Image" },
    { value: "Table", label: "Table" },
    { value: "Generated", label: "Generated" }
  ] as const;
</script>

<Panel title={variable.label}>
  {#snippet crumbs()}
    <PanelCrumbs
      trail={[
        { label: "Templates" },
        { label: owner.name, key: "library.template" },
        { label: variable.label }
      ]}
      onnavigate={(key: string) => mockWorkbench.inspect(key)}
    />
  {/snippet}

  <PanelSection title="Variable" flush>
    <PanelFields>
      <!-- The key is not editable here: the body references it by name. -->
      <PanelField label="Key" mono>{variable.key}</PanelField>
      <PanelField label="Label">
        <PanelEditableText
          label="Label"
          value={label ?? variable.label}
          onchange={(next: string) => (label = next)}
        />
      </PanelField>
      {#if variable.becomes}
        <!-- A generated variable is never asked for, so what it turns into is the fact. -->
        <PanelField label="Becomes" stacked>{variable.becomes}</PanelField>
      {/if}
      <PanelField label="Required">
        <PanelToggle
          label="Required"
          checked={required ?? variable.required}
          onchange={(next: boolean) => (required = next)}
        />
      </PanelField>
    </PanelFields>

    <!-- TODO(vocabulary): needs PanelChoice to draw its label — a choice standing beside a set of fields has nothing naming it. -->
    <div class="axis">
      <span class="text-caption text-ink-muted">Asks for</span>
      <PanelChoice
        label="Asks for"
        value={type ?? variable.type}
        options={TYPES}
        onchange={(next: string) => (type = next)}
      />
    </div>
  </PanelSection>

  <!-- What is used when nobody supplies one. Context, so it arrives shut. -->
  <PanelSection title="Default" open={false} flush>
    <PanelFields>
      <PanelField label="Value" stacked>
        <PanelEditableText
          label="Default value"
          value={fallback ?? variable.defaultValue ?? ""}
          placeholder="—"
          onchange={(next: string) => (fallback = next)}
        />
      </PanelField>
    </PanelFields>
    <PanelNote tone="gap">
      A default is always a string, which is unclear for an image variable and
      meaningless for a table one.
    </PanelNote>
  </PanelSection>

  <PanelSection title="Where it appears" flush>
    <PanelNote tone="gap">
      It cannot be highlighted in the body or jumped to. Placement must not be
      inferred from labels, text, array position or prompt content — every one of
      those is a guess that will be wrong. One explicit mechanism has to exist
      first.
    </PanelNote>
  </PanelSection>
</Panel>

<style>
  /*
    A named choice. The label takes the panel's gutter and the chips bring their
    own, so the two line up without either being re-padded.
  */
  .axis {
    display: flex;
    flex-direction: column;
    gap: var(--token-spacing-unit);
  }

  .axis > span {
    padding-inline: calc(var(--token-spacing-unit) * 3);
  }
</style>
