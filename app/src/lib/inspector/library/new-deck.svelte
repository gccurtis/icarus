<script lang="ts">
  import Plus from "@lucide/svelte/icons/plus";

  import {
    Panel,
    PanelActions,
    PanelButton,
    PanelChoice,
    PanelCrumbs,
    PanelEditableText,
    PanelField,
    PanelFields,
    PanelNote,
    PanelSection,
    PanelThumb,
    PanelThumbs
  } from "$lib/unique-components/panel";
  import { deckDraft } from "$mock-capabilities/library";
  import { mockWorkbench } from "$mock-models/workbench.svelte";

  /**
   * What a slide deck will be, before it exists.
   *
   * `docs/screen-panel-views/inspector/library/new-deck.md` is the
   * specification. Draft state the launcher tab holds, none of it written until
   * **Create**, which is inert here: minting the deck and rebinding the tab is a
   * model step no door has.
   *
   * **The first slide is drawn at the chosen ratio.** Aspect is the one choice
   * that re-frames every element on every slide, so the preview answers it in
   * the picture rather than repeating the words above it.
   */
  const draft = $derived(deckDraft().current);

  /** Undefined until touched, so an untouched field still reads from the door. */
  let title = $state<string>();
  let aspect = $state<string>();

  const chosen = $derived(aspect ?? draft.aspect);
  const ratio = $derived(chosen === "4:3" ? "4 / 3" : "16 / 9");
</script>

<Panel title="Slide deck">
  {#snippet crumbs()}
    <PanelCrumbs
      trail={[{ label: "New tab" }, { label: "Create" }, { label: "Slide deck" }]}
      onnavigate={(key: string) => mockWorkbench.inspect(key)}
    />
  {/snippet}

  <PanelSection title="Identity" flush>
    <PanelFields>
      <PanelField label="Title" stacked>
        <PanelEditableText
          label="Title"
          value={title ?? draft.title}
          placeholder="Untitled deck"
          onchange={(next: string) => (title = next)}
        />
      </PanelField>
    </PanelFields>
  </PanelSection>

  <PanelSection title="Format" flush>
    <!-- TODO(vocabulary): needs PanelChoice to draw its label — a section with several axes in it has nothing naming each one. -->
    <div class="axis">
      <span class="text-caption text-ink-muted">Aspect ratio</span>
      <PanelChoice
        label="Aspect ratio"
        value={chosen}
        options={draft.aspects.map((name: string) => ({ value: name, label: name }))}
        onchange={(next: string) => (aspect = next)}
      />
    </div>
    <PanelNote>
      Asked explicitly. There is no modeled project or user default to fall back
      to, and changing it later re-frames every element on every slide.
    </PanelNote>
  </PanelSection>

  <PanelSection title="First slide" flush>
    <!-- A thumbnail rather than a layout name: the choice is visible, not named. -->
    <PanelThumbs>
      <PanelThumb {ratio} caption={draft.firstSlide.caption} lines={2} />
    </PanelThumbs>
    <PanelNote tone="gap">
      Whether the first slide's layout is choosable here or fixed is unsettled.
      Offering it makes this a small deck editor; not offering it means the first
      thing you do is change it.
    </PanelNote>
  </PanelSection>

  <PanelSection title="Create" flush>
    <PanelActions>
      <PanelButton label="Create deck" icon={Plus} tone="primary" />
    </PanelActions>
    <PanelNote>This tab becomes the deck. It does not open a second one.</PanelNote>
  </PanelSection>
</Panel>

<style>
  /*
    A named choice. The label takes the panel's gutter and the chips bring their
    own, so the two line up without either being re-padded.
  */
  .axis {
    display: flex;
    flex-direction: column;
    gap: var(--token-spacing-unit);
  }

  .axis > span {
    padding-inline: calc(var(--token-spacing-unit) * 3);
  }
</style>
