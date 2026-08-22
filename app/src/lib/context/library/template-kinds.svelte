<script lang="ts">
  import Plus from "@lucide/svelte/icons/plus";

  import {
    Panel,
    PanelActions,
    PanelButton,
    PanelNote,
    PanelSection
  } from "$lib/unique-components/panel";
  import { templateKinds } from "$mock-capabilities/library";
  import { viewState } from "$model/client/view-state";

  const view = viewState();

  /**
   * The four things a template can make, each with a way to start one.
   *
   * `docs/screen-panel-views/context/library/template-kinds.md` is the
   * specification. Organised by target because target is the one decision that
   * cannot be changed afterwards — changing it would mean converting the body,
   * which is not modelled. That is why each target is a section with its own
   * **New** rather than a choice inside a single create form.
   *
   * The kinds and their wording come from the door rather than from this file, so
   * the spreadsheet blurb reads "one grid" here and "sheets" in the
   * specification. The door is the one that has been corrected.
   *
   * **No lens names creating a template**, so New opens the template lens and
   * the selection carries the target, since the target is the whole of what
   * pressing New decides.
   */
  const kinds = $derived(templateKinds().current);
</script>

<Panel title="Kinds">
  {#each kinds as kind (kind.id)}
    <PanelSection title={kind.makes} flush>
      <PanelNote>{kind.blurb}</PanelNote>
      <PanelActions>
        <PanelButton
          label="New"
          icon={Plus}
          onclick={() =>
            view.inspect("library.template", {
              kind: "template-target",
              id: kind.id
            })}
        />
      </PanelActions>
    </PanelSection>
  {/each}
</Panel>
