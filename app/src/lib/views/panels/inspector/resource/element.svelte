<script lang="ts">
  import ArrowDown from "@lucide/svelte/icons/arrow-down";
  import ArrowUp from "@lucide/svelte/icons/arrow-up";
  import BringToFront from "@lucide/svelte/icons/bring-to-front";
  import SendToBack from "@lucide/svelte/icons/send-to-back";
  import Type from "@lucide/svelte/icons/type";

  import {
    Panel,
    PanelActions,
    PanelButton,
    PanelChoice,
    PanelCrumbs,
    PanelField,
    PanelFields,
    PanelNote,
    PanelSection
  } from "$components/authored/panel";
  import { element, layersOn, slide } from "$capabilities/resource";
  import { isInspectionKey, viewState } from "$model/client/view-state";

  /**
   * One element on a slide: the spatial box, where it sits, how it stacks, and how
   * the box itself is drawn.
   *
   * `docs/screen-panel-views/inspector/resource/element.md` is the specification.
   *
   * **The box is here and the content is not.** What is inside an element is a
   * block with its own lens, and the two are kept apart so that frame, rotation
   * and overflow never leak into content. Content therefore shows what it holds
   * and hands editing over rather than offering a second text field.
   *
   * **The frame is fractions of the slide.** That is the model — it is what lets a
   * deck survive a change of aspect ratio — and it is useless for typing a value
   * into, so the numbers are read here and dragged on the canvas.
   */
  let {
    elementId = "el-title-4",
    slideId = "sl-4"
  }: { elementId?: string; slideId?: string } = $props();

  const view = viewState();

  const el = $derived(element(elementId).current);
  const on = $derived(slide(slideId).current);

  const OVERFLOW = [
    { value: "Clip", label: "Clip" },
    { value: "Shrink", label: "Shrink" },
    { value: "Grow", label: "Grow" }
  ] as const;

  let overflowOverride = $state<string | undefined>(undefined);
  const overflow = $derived(overflowOverride ?? el.overflow);

  /** Stacking, read off the slide's own layer list. Front first. */
  const DEPTHS = ["Front", "Middle", "Back"] as const;
  type Depth = (typeof DEPTHS)[number];

  let depthOverride = $state<Depth | undefined>(undefined);
  const layer = $derived(layersOn(slideId).current.find((one) => one.id === elementId));
  const depth = $derived(depthOverride ?? layer?.depth ?? "Middle");

  const step = (by: number) => {
    const at = DEPTHS.indexOf(depth);
    depthOverride = DEPTHS[Math.min(DEPTHS.length - 1, Math.max(0, at + by))];
  };

  const fraction = (value: number) => value.toFixed(3);
</script>

<Panel title={el.name}>
  {#snippet crumbs()}
    <PanelCrumbs
      trail={[{ label: `Slide ${on.index}`, key: "resource.slide" }, { label: el.name }]}
      onnavigate={(key: string) => {
        if (isInspectionKey(key)) view.inspect(key, { kind: "slide", id: slideId });
      }}
    />
  {/snippet}

  <PanelSection title="Content">
    <PanelNote>{el.content}</PanelNote>
    <PanelActions>
      <PanelButton
        label="Edit text"
        icon={Type}
        tone="primary"
        onclick={() =>
          view.inspect("resource.text-block-deck", { kind: "block", id: elementId })}
      />
    </PanelActions>
  </PanelSection>

  <PanelSection title="Position and size">
    <PanelFields>
      <PanelField label="X" mono>{fraction(el.frame.x)}</PanelField>
      <PanelField label="Y" mono>{fraction(el.frame.y)}</PanelField>
      <PanelField label="Width" mono>{fraction(el.frame.w)}</PanelField>
      <PanelField label="Height" mono>{fraction(el.frame.h)}</PanelField>
      <PanelField label="Rotation" mono>{el.rotation}°</PanelField>
    </PanelFields>
    <PanelNote>
      Fractions of the slide, so the deck survives a change of aspect ratio. Under
      the pointer they are pixels.
    </PanelNote>
  </PanelSection>

  <!--
    The stacking position is read off the slide's layer list, so the two buttons
    that would do nothing at the front or the back are disabled rather than left
    to be pressed twice.
  -->
  <PanelSection title="Arrange">
    <PanelActions>
      <PanelButton
        label="Front"
        icon={BringToFront}
        disabled={depth === "Front"}
        onclick={() => (depthOverride = "Front")}
      />
      <PanelButton
        label="Forward"
        icon={ArrowUp}
        disabled={depth === "Front"}
        onclick={() => step(-1)}
      />
      <PanelButton
        label="Back"
        icon={SendToBack}
        disabled={depth === "Back"}
        onclick={() => (depthOverride = "Back")}
      />
      <PanelButton
        label="Behind"
        icon={ArrowDown}
        disabled={depth === "Back"}
        onclick={() => step(1)}
      />
    </PanelActions>
    <PanelNote>Shift-click a second element and align and distribute appear here.</PanelNote>
  </PanelSection>

  <PanelSection title="Overflow">
    <PanelChoice
      label="Overflow"
      value={overflow}
      options={OVERFLOW}
      onchange={(next: string) => (overflowOverride = next)}
    />
  </PanelSection>

  <!-- How the box is drawn rather than what is in it, so it arrives shut. -->
  <PanelSection title="Box format" open={false}>
    <PanelFields>
      <PanelField label="Fill">{el.fill}</PanelField>
      <PanelField label="Border">{el.border}</PanelField>
      <PanelField label="Padding" mono>{el.padding}</PanelField>
    </PanelFields>
  </PanelSection>

  <PanelSection title="Placeholder origin" open={false}>
    {#if el.fromPlaceholder === undefined}
      <PanelNote>
        Drawn on the slide rather than filled from a layout placeholder, so there is
        nothing to reset it to.
      </PanelNote>
    {:else}
      <PanelFields>
        <PanelField label="From placeholder" mono>{el.fromPlaceholder}</PanelField>
        <PanelField label="Reset eligible">{el.resetEligible}</PanelField>
      </PanelFields>
      <PanelNote tone="gap">
        A placeholder has no stable key, so "one match" is inferred from its role.
        Where a layout has two placeholders in the same role, reset stays shut.
      </PanelNote>
    {/if}
  </PanelSection>
</Panel>
