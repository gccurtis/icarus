<script lang="ts">
  import BringToFront from "@lucide/svelte/icons/bring-to-front";
  import Group from "@lucide/svelte/icons/group";
  import SendToBack from "@lucide/svelte/icons/send-to-back";

  import {
    Panel,
    PanelActions,
    PanelButton,
    PanelCrumbs,
    PanelEditableText,
    PanelField,
    PanelFields,
    PanelNote,
    PanelRow,
    PanelSection
  } from "$lib/unique-components/panel";
  import { multiSelection, slide } from "$mock-capabilities/resource";
  import { mockWorkbench } from "$mock-models/workbench.svelte";

  /**
   * Two or more elements, shift-clicked: the selection as a group.
   *
   * `docs/screen-panel-views/inspector/resource/multi-selection.md` is the
   * specification.
   *
   * **A multi-selection is a different thing from an element, not a degraded
   * one.** Align and distribute exist only here, and distribute is inert with two
   * members because there is nothing between two things to distribute.
   *
   * **Mixed is a value.** A property the selection disagrees on shows as Mixed
   * rather than as one member's answer, and typing over it sets all of them —
   * which is the only honest way to edit three values through one field.
   */
  let { slideId = "sl-4" }: { slideId?: string } = $props();

  const on = $derived(slide(slideId).current);
  const selection = $derived(multiSelection(slideId).current);
  const members = $derived(selection.members);

  /** What was last done to the group, said where it was done. */
  let applied = $state<{ section: string; said: string } | undefined>(undefined);
  const apply = (section: string, said: string) => (applied = { section, said });

  /** Values typed over a shared property, keyed by its label. */
  let overrides = $state<Record<string, string>>({});
  const set = (label: string, next: string) => (overrides = { ...overrides, [label]: next });

  const listOf = (words: readonly string[]) =>
    words.length < 2
      ? (words[0] ?? "")
      : `${words.slice(0, -1).join(", ")} and ${words[words.length - 1]}`;

  const capitalise = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

  const differing = $derived(
    selection.format.filter((property) => property.mixed).map((property) => property.label.toLowerCase())
  );
  const agreeing = $derived(selection.format.filter((property) => !property.mixed));
</script>

<Panel title={`${members.length} elements`}>
  {#snippet crumbs()}
    <PanelCrumbs
      trail={[
        { label: `Slide ${on.index}`, key: "resource.slide" },
        { label: `${members.length} elements` }
      ]}
      onnavigate={(key: string) => mockWorkbench.inspect(key, { kind: "slide", id: slideId })}
    />
  {/snippet}

  <PanelSection title="Selection" count={members.length} flush>
    {#each members as member (member.id)}
      <PanelRow
        title={member.name}
        onselect={() => mockWorkbench.inspect("resource.element", { kind: "element", id: member.id })}
      />
    {/each}
    <PanelNote>Everything below applies to all {members.length} of them.</PanelNote>
  </PanelSection>

  <PanelSection title="Align">
    <PanelActions>
      <PanelButton label="Left" onclick={() => apply("align", "Aligned to the left.")} />
      <PanelButton label="Centre" onclick={() => apply("align", "Centred horizontally.")} />
      <PanelButton label="Right" onclick={() => apply("align", "Aligned to the right.")} />
      <PanelButton label="Top" onclick={() => apply("align", "Aligned to the top.")} />
      <PanelButton label="Middle" onclick={() => apply("align", "Centred vertically.")} />
      <PanelButton label="Bottom" onclick={() => apply("align", "Aligned to the bottom.")} />
    </PanelActions>
    {#if applied?.section === "align"}
      <PanelNote>{applied.said}</PanelNote>
    {/if}
  </PanelSection>

  <PanelSection title="Distribute">
    <PanelActions>
      <PanelButton
        label="Horizontally"
        disabled={!selection.canDistribute}
        title="Distribute needs three or more elements."
        onclick={() => apply("distribute", "Spaced evenly across.")}
      />
      <PanelButton
        label="Vertically"
        disabled={!selection.canDistribute}
        title="Distribute needs three or more elements."
        onclick={() => apply("distribute", "Spaced evenly down.")}
      />
    </PanelActions>
    {#if applied?.section === "distribute"}
      <PanelNote>{applied.said}</PanelNote>
    {/if}
  </PanelSection>

  <PanelSection title="Arrange">
    <PanelActions>
      <PanelButton label="Group" icon={Group} />
      <PanelButton
        label="Front"
        icon={BringToFront}
        onclick={() => apply("arrange", "Brought to the front, in selection order.")}
      />
      <PanelButton
        label="Back"
        icon={SendToBack}
        onclick={() => apply("arrange", "Sent to the back, in selection order.")}
      />
    </PanelActions>
    {#if applied?.section === "arrange"}
      <PanelNote>{applied.said}</PanelNote>
    {/if}
    <!-- Group is drawn and does nothing: there is no group object to make. -->
    <PanelNote tone="gap">
      Grouping is offered and there is no group in the model behind it. Either a
      group is a thing that survives a reload or this is a selection convenience,
      and the difference shows up the next time the deck is opened.
    </PanelNote>
  </PanelSection>

  <PanelSection title="Shared geometry">
    <PanelFields>
      {#each selection.geometry as property (property.label)}
        <PanelField label={property.label} mono>
          <PanelEditableText
            label={property.label}
            value={overrides[property.label] ?? (property.mixed ? "" : property.value)}
            mixed={property.mixed && overrides[property.label] === undefined}
            mono
            onchange={(next: string) => set(property.label, next)}
          />
        </PanelField>
      {/each}
    </PanelFields>
  </PanelSection>

  <PanelSection title="Shared format">
    {#if differing.length > 0}
      <PanelNote>{capitalise(listOf(differing))} differ across the selection.</PanelNote>
    {/if}
    {#each agreeing as property (property.label)}
      <PanelNote>{property.label} is {property.value} on all {members.length}.</PanelNote>
    {/each}
    <PanelNote tone="gap">
      There is nowhere here to set them. Shared geometry lets Mixed be typed over;
      this section should do the same and does not.
    </PanelNote>
  </PanelSection>
</Panel>
