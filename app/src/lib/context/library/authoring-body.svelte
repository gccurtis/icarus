<script lang="ts">
  import Heading from "@lucide/svelte/icons/heading";

  import { Panel, PanelRow, PanelSection } from "$lib/unique-components/panel";
  import { outlineIn } from "$mock-capabilities/library";
  import { viewState } from "$model/client/view-state";

  const view = viewState();

  /**
   * Getting around a template's content.
   *
   * `docs/screen-panel-views/context/library/authoring-body.md` is the
   * specification. This is the ordinary editor's Navigator under a name that fits
   * a template: the same view doing the same job, on a body that happens to have
   * openings in it.
   *
   * **The outline cannot show where the variables are.** Nothing in a body
   * records which variable it stands for, and a template's structure is exactly
   * the part a variable interrupts — so the omission is felt here more than
   * anywhere else in the screen.
   */
  let { templateId = "tp-filing" }: { templateId?: string } = $props();

  const headings = $derived(outlineIn(templateId).current);
</script>

<Panel title="Body">
  <PanelSection title="Outline" count={headings.length} flush>
    {#each headings as heading (heading.id)}
      <PanelRow
        title={heading.text}
        meta="p.{heading.page}"
        icon={Heading}
        indent={heading.level === 2}
        onselect={() =>
          view.inspect("library.body-entity", { kind: "entity", id: heading.id })}
      />
    {/each}
  </PanelSection>
</Panel>
