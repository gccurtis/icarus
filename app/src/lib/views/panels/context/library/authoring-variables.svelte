<script lang="ts">
  import Plus from "@lucide/svelte/icons/plus";
  import Variable from "@lucide/svelte/icons/variable";

  import {
    Panel,
    PanelButton,
    PanelRow,
    PanelSection
  } from "$authored-components/panel";
  import { variablesIn, type TemplateVariable } from "$capabilities/library";
  import { viewState } from "$model/client/view-state";

  const view = viewState();

  /**
   * What this template will ask the person using it.
   *
   * `docs/screen-panel-views/context/library/authoring-variables.md` is the
   * specification. The one panel particular to a template — everything else in
   * this subscreen is the ordinary editor.
   *
   * Split by requiredness, because that is what decides whether someone can get
   * past the instantiation form. A generated variable sits under Optional
   * although it is not a question at all: skipping it means the block is absent
   * rather than that a value is empty, and the row says so.
   *
   * **A row opens the variable and nothing else.** Highlighting where it sits in
   * the body, and jumping to it, would need a body entity carrying a variable
   * key, and none does — so this is a list beside a document it cannot point
   * into.
   */
  let { templateId = "tp-filing" }: { templateId?: string } = $props();

  const all = $derived(variablesIn(templateId).current);

  const required = $derived(all.filter((variable) => variable.required));
  const optional = $derived(all.filter((variable) => !variable.required));

  /** The label a person reads, plus whatever else changes what they must supply. */
  const says = (variable: TemplateVariable) => {
    if (variable.becomes !== undefined) {
      return `${variable.label} · becomes ${variable.becomes.toLowerCase()}`;
    }
    return variable.defaultValue === undefined
      ? variable.label
      : `${variable.label} · default ${variable.defaultValue}`;
  };

  const inspect = (id: string) =>
    view.inspect("library.template-variable", { kind: "template-variable", id });
</script>

<Panel title="Variables in this template">
  {#snippet actions()}
    <PanelButton label="Add variable" icon={Plus} tone="primary" onclick={() => inspect("new")} />
  {/snippet}

  <PanelSection title="Required" count={required.length} flush>
    {#each required as variable (variable.id)}
      <PanelRow
        title={variable.key}
        sub={says(variable)}
        meta={variable.type}
        icon={Variable}
        onselect={() => inspect(variable.id)}
      />
    {/each}
  </PanelSection>

  <PanelSection title="Optional" count={optional.length} flush>
    {#each optional as variable (variable.id)}
      <PanelRow
        title={variable.key}
        sub={says(variable)}
        meta={variable.type}
        icon={Variable}
        onselect={() => inspect(variable.id)}
      />
    {/each}
  </PanelSection>
</Panel>
