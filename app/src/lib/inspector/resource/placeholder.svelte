<script lang="ts">
  import {
    Panel,
    PanelCrumbs,
    PanelField,
    PanelFields,
    PanelNote,
    PanelSection
  } from "$lib/unique-components/panel";
  import { layout, placeholderAt } from "$mock-capabilities/resource";
  import { mockWorkbench } from "$mock-models/workbench.svelte";

  /**
   * A placeholder in a layout: a frame and a style key that a slide fills in.
   *
   * `docs/screen-panel-views/inspector/resource/placeholder.md` is the
   * specification.
   *
   * **It is addressed by position, not by name.** A placeholder has no stable key,
   * so the lens takes an index into the layout's list and two placeholders in the
   * same role can only be told apart by which one comes first. That is what makes
   * the whole lens read-only, and Status says so rather than offering fields that
   * would have nowhere to save to.
   */
  let {
    layoutId = "ly-two-panes",
    index = 1
  }: { layoutId?: string; index?: number } = $props();

  const owner = $derived(layout(layoutId).current);
  const placeholder = $derived(placeholderAt(layoutId, index).current);

  const frame = $derived(
    placeholder === undefined
      ? ""
      : [placeholder.frame.x, placeholder.frame.y, placeholder.frame.w, placeholder.frame.h]
          .map((value) => value.toFixed(2))
          .join(" / ")
  );
</script>

<Panel title={`Placeholder ${index + 1}`}>
  {#snippet crumbs()}
    <PanelCrumbs
      trail={[{ label: owner.name, key: "resource.layout" }, { label: `Placeholder ${index + 1}` }]}
      onnavigate={(key: string) => mockWorkbench.inspect(key, { kind: "layout", id: layoutId })}
    />
  {/snippet}

  {#if placeholder === undefined}
    <PanelSection title="Placeholder">
      <PanelNote>
        {owner.name} has nothing in that position. A placeholder is addressed by its
        place in the list, so a list that has shortened leaves the last address
        pointing at nothing.
      </PanelNote>
    </PanelSection>
  {:else}
    <PanelSection title="Placeholder">
      <PanelFields>
        <PanelField label="Role">{placeholder.role}</PanelField>
        <PanelField label="Frame" mono>{frame}</PanelField>
        <PanelField label="Style key" mono>{placeholder.styleKey}</PanelField>
      </PanelFields>
      {#if placeholder.sameRoleAsAbove}
        <PanelNote>
          The placeholder above holds the same role. Neither has a name of its own,
          so this one is described by its neighbour and its position.
        </PanelNote>
      {/if}
    </PanelSection>

    <PanelSection title="Status">
      <PanelNote>Read-only. The slide supplies the content, in its own copy, which it then owns.</PanelNote>
      <PanelNote tone="gap">
        Placeholders have no stable key, so this is a summary of the layout rather
        than an independently selectable object. Two placeholders in the same role
        cannot be told apart, which is what blocks selection, duplicate-role reset,
        and any per-placeholder property at all.
      </PanelNote>
    </PanelSection>
  {/if}
</Panel>
