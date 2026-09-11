<script lang="ts">
  import { Panel, PanelButton, PanelCrumbs, PanelEmpty, PanelRow, PanelSection } from "$authored-components/panel";
  import ArrangeSection from "$app-views/categories/presentation-editor/components/arrange-section.svelte";
  import { withDuplicatedElements, withoutElements } from "$app-views/categories/presentation-editor/procedures/presentation-elements";
  import { withGrouped } from "$app-views/categories/presentation-editor/procedures/presentation-layering";
  import { placedOn } from "$app-views/categories/presentation-editor/procedures/presentation-placement";
  import { slideHolding } from "$app-views/categories/presentation-editor/procedures/presentation-slide-holding";
  import { elementIn, labelOf } from "$app-views/categories/presentation-editor/procedures/presentation-reading";
  import { slideIndexOf } from "$app-views/categories/presentation-editor/procedures/presentation-slides";
  import { elementsSignal, selectedIds, slideSignal } from "$app-views/categories/presentation-editor/procedures/selecting";
  import { workspaceState, type PresentationRuntime } from "$model/client/workspace-state";

  const view = workspaceState();
  const presentationId = view.active.resourceId;
  let runtime = $state<PresentationRuntime | undefined>(undefined);

  $effect(() => {
    runtime = presentationId === undefined ? undefined : view.presentationRuntime(presentationId);
  });

  const body = $derived(runtime?.body);
  const ids = $derived(selectedIds(view.selection));
  const slide = $derived(body === undefined || ids[0] === undefined ? undefined : slideHolding(body, ids[0]));
  const position = $derived(body === undefined || slide === undefined ? 0 : slideIndexOf(body, slide.id) + 1);
  const members = $derived(slide === undefined ? [] : [...placedOn(slide)].reverse().filter((placed) => ids.includes(placed.element.id)).map((placed) => placed.element));

  const group = () => {
    if (body === undefined || slide === undefined) return;
    const before = slide;
    const edit = withGrouped(body, ids);
    const made = edit.body.slides.find((held) => held.id === before.id)?.elements.find((element) => element.content.type === "group" && !before.elements.some((was) => was.id === element.id));
    const signal = made ? elementsSignal([made]) : undefined;
    runtime?.apply(edit.ops);
    if (signal) view.inspect(signal.key, signal.selection);
  };

  const duplicate = () => {
    if (body === undefined || slide === undefined) return;
    const before = slide;
    const edit = withDuplicatedElements(body, ids);
    const fresh = edit.body.slides.find((held) => held.id === before.id)?.elements.filter((element) => !before.elements.some((was) => was.id === element.id)) ?? [];
    const signal = elementsSignal(fresh);
    runtime?.apply(edit.ops);
    if (signal) view.inspect(signal.key, signal.selection);
  };

  const remove = () => {
    if (body === undefined) return;
    runtime?.apply(withoutElements(body, ids).ops);
    if (slide) view.inspect("presentation-editor.slide", slideSignal(slide.id).selection);
  };
</script>

<Panel title="{ids.length} objects">
  {#snippet crumbs()}
    <PanelCrumbs
      trail={[{ label: "Presentation" }, { label: `Slide ${position}`, key: "presentation-editor.slide" }, { label: `${ids.length} objects` }]}
      onnavigate={() => { if (slide) view.inspect("presentation-editor.slide", slideSignal(slide.id).selection); }}
    />
  {/snippet}
  {#snippet actions()}
    <PanelButton label="Group" tone="primary" disabled={members.some((member) => body !== undefined && placedOn(slide!).find((placed) => placed.element.id === member.id)?.parents.length)} title="Group the selection" onclick={group} />
    <PanelButton label="Duplicate" onclick={duplicate} />
    <PanelButton label="Delete" tone="danger" onclick={remove} />
  {/snippet}

  {#if body && slide && members.length > 0}
    <PanelSection title="Selected" count={members.length} flush>
      {#each members as member (member.id)}
        <PanelRow title={labelOf(member)} sub={member.content.type} onselect={() => { const signal = elementsSignal([elementIn(body, member.id)!]); if (signal) view.inspect(signal.key, signal.selection); }} />
      {/each}
    </PanelSection>
    <ArrangeSection />
  {:else}
    <PanelEmpty title="Shift-click or drag across the slide to select several objects" />
  {/if}
</Panel>
