<script lang="ts">
  import Lock from "@lucide/svelte/icons/lock";
  import SquareDashed from "@lucide/svelte/icons/square-dashed";

  import {
    Panel,
    PanelNote,
    PanelRow,
    PanelSection
  } from "$lib/unique-components/panel";
  import { lockedContentIn, placeholdersIn } from "$mock-capabilities/resource";
  import { mockWorkbench } from "$mock-models/workbench.svelte";

  /**
   * What a layout owns, split by what a slide may touch.
   *
   * `docs/screen-panel-views/context/resource/layout-objects.md` is the
   * specification. The split is the whole point of a layout, so the panel is
   * built on it rather than listing everything together and marking each row.
   *
   * **Placeholder rows are not targets.** A placeholder has no stable key, so
   * there is nothing to select it by that survives a reorder; the row that
   * repeats a role says so instead of pretending to a name it does not have.
   */
  let { layoutId = "ly-two-panes" }: { layoutId?: string } = $props();

  const locked = $derived(lockedContentIn(layoutId).current);
  const placeholders = $derived(placeholdersIn(layoutId).current);
</script>

<Panel title="Objects">
  <PanelSection title="Locked content" count={locked.length} flush>
    {#each locked as object (object.id)}
      <PanelRow
        title={object.name}
        sub={object.content}
        icon={Lock}
        onselect={() =>
          mockWorkbench.inspect("resource.locked-element", {
            kind: "locked-element",
            id: object.id
          })}
      />
    {/each}
  </PanelSection>

  <PanelSection title="Placeholders" count={placeholders.length} flush>
    {#each placeholders as placeholder (placeholder.index)}
      <PanelRow
        title={placeholder.role}
        sub={placeholder.sameRoleAsAbove ? "Same role as the one above" : undefined}
        meta={placeholder.styleKey}
        icon={SquareDashed}
        tone={placeholder.sameRoleAsAbove ? "attention" : "default"}
      />
    {/each}
  </PanelSection>

  <PanelNote>
    A slide gets its own copy of each placeholder and then owns that copy. The
    layout supplies the frame and the style key, never the content.
  </PanelNote>

  <PanelNote tone="gap">
    Placeholders have no stable key, so selecting one is gated: two with the same
    role cannot be told apart, and an address that is only a position does not
    survive a reorder.
  </PanelNote>
</Panel>
