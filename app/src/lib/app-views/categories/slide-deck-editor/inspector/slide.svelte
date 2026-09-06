<script lang="ts">
  import { Panel, PanelButton, PanelColor, PanelCrumbs, PanelEmpty, PanelField, PanelFields, PanelNote, PanelQuote, PanelSection, PanelToggle } from "$authored-components/panel";
  import { notesBlock, slideIndexOf, withElementFrame, withSet } from "$app-views/categories/slide-deck-editor/procedures/deck";
  import { swatchesFor } from "$app-views/categories/slide-deck-editor/procedures/palette";
  import { notesSignal } from "$app-views/categories/slide-deck-editor/procedures/selecting";
  import { workspaceState, type SlideDeckRuntime } from "$model/client/workspace-state";

  const view = workspaceState();
  const deckId = $derived(view.active.resourceId);
  let runtime = $state<SlideDeckRuntime | undefined>(undefined);
  $effect(() => {
    runtime = deckId === undefined ? undefined : view.slideDeckRuntime(deckId);
  });

  const body = $derived(runtime?.body);
  const slideId = $derived(view.selection?.kind === "slide" ? view.selection.id : view.active.focus ?? undefined);
  const slide = $derived(body?.slides.find((held) => held.id === slideId) ?? body?.slides[0]);
  const position = $derived(body === undefined || slide === undefined ? 0 : slideIndexOf(body, slide.id) + 1);
  const layout = $derived(body?.layouts.find((held) => held.key === slide?.layoutKey));
  const swatches = $derived(body === undefined ? [] : swatchesFor(body.theme));
  const notes = $derived(slide === undefined ? undefined : notesBlock(slide)?.display.trim());

  const set = (path: string, value: unknown) => {
    if (body === undefined) return;
    runtime?.apply(withSet(body, path, value).ops);
  };

  const resettable = $derived.by(() => {
    if (slide === undefined || layout === undefined) return [];
    return slide.elements.flatMap((element) => {
      if (!element.fromPlaceholder) return [];
      const matching = layout.placeholders.filter((placeholder) => placeholder.role === element.fromPlaceholder);
      return matching.length === 1 ? [{ id: element.id, frame: matching[0].frame }] : [];
    });
  });

  const reset = () => {
    if (body === undefined) return;
    let held = body;
    const ops = [];
    for (const { id, frame } of resettable) {
      const step = withElementFrame(held, id, frame);
      held = step.body;
      ops.push(...step.ops);
    }
    if (ops.length > 0) runtime?.apply(ops);
  };
</script>

<Panel title="Slide {position}">
  {#snippet crumbs()}
    <PanelCrumbs trail={[{ label: "Deck" }, { label: `Slide ${position}` }]} onnavigate={() => {}} />
  {/snippet}
  {#snippet actions()}
    {#if slide}
      <PanelButton label="Edit notes" onclick={() => { const signal = notesSignal(slide.id); view.inspect(signal.key, signal.selection); }} />
    {/if}
  {/snippet}

  {#if body && slide}
    <PanelSection title="Notes">
      {#if notes}
        <PanelQuote source={`${notes.split("\n").length} paragraph${notes.split("\n").length === 1 ? "" : "s"} · ${notes.length} characters`}>{notes.split("\n")[0]}{notes.includes("\n") ? " …" : ""}</PanelQuote>
      {:else}
        <PanelNote>No speaker notes yet.</PanelNote>
      {/if}
    </PanelSection>

    <PanelSection title="Slide">
      <PanelFields>
        <PanelField label="Hidden"><PanelToggle checked={slide.hidden ?? false} label="Hide this slide" onchange={(next) => set(`${slide.id}/hidden`, next ? true : null)} /></PanelField>
      </PanelFields>
      <div class="grid grid-cols-[auto_1fr] items-center gap-x-2">
        <span class="text-caption text-ink-muted">Background</span>
        <PanelColor picker label="Slide background" value={slide.background?.kind === "color" ? slide.background.color : ""} options={swatches} flush onchange={(value) => set(`${slide.id}/background`, { kind: "color", color: value })} />
      </div>
      {#if slide.background}
        <div class="flex"><PanelButton label="Use the theme background" tone="ghost" onclick={() => set(`${slide.id}/background`, null)} /></div>
      {/if}
    </PanelSection>

    <PanelSection title="Reset to layout" open={false} chevron="end">
      <PanelNote>Puts every box that came from a placeholder back on the placeholder's frame. Text is kept.</PanelNote>
      <div class="flex">
        <PanelButton label="Reset {resettable.length} box{resettable.length === 1 ? '' : 'es'}" tone="danger" disabled={resettable.length === 0} title={resettable.length === 0 ? "Nothing on this slide came from a placeholder" : undefined} onclick={reset} />
      </div>
    </PanelSection>
  {:else}
    <PanelEmpty title="Pick a slide in the Slides panel" />
  {/if}
</Panel>
