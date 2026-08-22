<script lang="ts">
  import Copy from "@lucide/svelte/icons/copy";
  import Eye from "@lucide/svelte/icons/eye";
  import EyeOff from "@lucide/svelte/icons/eye-off";
  import Plus from "@lucide/svelte/icons/plus";
  import Trash2 from "@lucide/svelte/icons/trash-2";

  import {
    Panel,
    PanelButton,
    PanelNote,
    PanelSection,
    PanelThumb,
    PanelThumbs
  } from "$lib/unique-components/panel";
  import { layoutsIn, sectionsIn, slidesIn } from "$mock-capabilities/resource";
  import { viewState } from "$model/client/view-state";

  /**
   * The deck as an ordered list, one panel section per section of the deck.
   *
   * `docs/screen-panel-views/context/resource/slides.md` is the specification.
   * This is the deck's first rail entry and its default: the list of slides is
   * the orientation, so nothing sits above it.
   *
   * A slide has no persisted name, so each one is a picture captioned with its
   * index. The bars a picture draws are its layout's placeholder count — the only
   * thing about a slide's shape this can say honestly without a renderer.
   */
  let { deckId = "r-board", slideId = "sl-4" }: { deckId?: string; slideId?: string } = $props();

  const view = viewState();

  const slides = $derived(slidesIn(deckId).current);
  const sections = $derived(sectionsIn(deckId).current);
  const layouts = $derived(layoutsIn(deckId).current);

  /** The slide the editor is on: view state's, or the one the screen opened with. */
  const currentId = $derived(
    view.selection?.kind === "slide" ? view.selection.id : slideId
  );

  /**
   * Hiding and deleting are held here rather than written. No door writes a deck
   * yet, and a control that changes nothing at all reads as broken; these two at
   * least change the picture they act on.
   */
  let concealed = $state<Record<string, boolean>>({});
  let discarded = $state<readonly string[]>([]);

  const live = $derived(slides.filter((slide) => !discarded.includes(slide.id)));
  const current = $derived(live.find((slide) => slide.id === currentId));
  const isHidden = (id: string, stored: boolean) => concealed[id] ?? stored;

  const placeholders = (layoutId: string) =>
    layouts.find((candidate) => candidate.id === layoutId)?.placeholders ?? 0;

  const toggleHidden = () => {
    if (current === undefined) return;
    concealed = { ...concealed, [current.id]: !isHidden(current.id, current.hidden) };
  };

  const discard = () => {
    if (current === undefined) return;
    discarded = [...discarded, current.id];
    view.clear();
  };

  /** Both mint identifiers, which is the part no door answers. See the note below. */
  const MINTS = "No door mints a slide id yet.";
</script>

<Panel title="Slides">
  <!--
    The four slide actions act on the selected slide and sit at the top of the
    panel that shows it, which is also the only place `Panel` puts controls.
  -->
  {#snippet actions()}
    <PanelButton label="New" icon={Plus} tone="primary" disabled title={MINTS} />
    <PanelButton label="Duplicate" icon={Copy} disabled title={MINTS} />
    <PanelButton
      label="Delete"
      icon={Trash2}
      tone="danger"
      disabled={current === undefined}
      onclick={discard}
    />
    <PanelButton
      label={current && isHidden(current.id, current.hidden) ? "Show" : "Hide"}
      icon={current && isHidden(current.id, current.hidden) ? Eye : EyeOff}
      disabled={current === undefined}
      onclick={toggleHidden}
    />
  {/snippet}

  {#each sections as section (section.id)}
    {@const held = live.filter((slide) => slide.sectionId === section.id)}
    <!-- `flush` because `PanelThumbs` carries the panel's padding itself. -->
    <PanelSection title={section.name} count={held.length} flush>
      <PanelThumbs across={2}>
        {#each held as slide (slide.id)}
          <PanelThumb
            caption={String(slide.index)}
            lines={placeholders(slide.layoutId)}
            selected={slide.id === currentId}
            hidden={isHidden(slide.id, slide.hidden)}
            onselect={() => view.inspect("resource.slide", { kind: "slide", id: slide.id })}
          />
        {/each}
      </PanelThumbs>
    </PanelSection>
  {/each}

  <PanelNote tone="gap">
    New and Duplicate are inert. Duplicating a slide has to mint fresh ids for it
    and for every identified descendant, or two slides share element ids, and
    nothing decides that yet.
  </PanelNote>

  <PanelNote>
    A section is anchored to its first slide, so reordering re-interprets where the
    boundaries fall rather than carrying them along.
  </PanelNote>
</Panel>
