<script lang="ts">
  import {
    Panel,
    PanelCrumbs,
    PanelEditableText,
    PanelNote,
    PanelSection
  } from "$components/authored/panel";
  import { notesFor } from "$capabilities/resource";
  import { isInspectionKey, viewState } from "$model/client/view-state";

  /**
   * One slide's speaker notes, on their own.
   *
   * `docs/screen-panel-views/inspector/resource/speaker-notes.md` is the
   * specification.
   *
   * **This lens is the editor.** The slide lens shows the same paragraph and
   * routes here to change it, because two writable copies of one text is how one
   * of them quietly wins.
   */
  let { slideId = "sl-4" }: { slideId?: string } = $props();

  const view = viewState();

  const notes = $derived(notesFor(slideId).current);

  let draft = $state<string | undefined>(undefined);
  const content = $derived(draft ?? notes.content);
</script>

<Panel title="Speaker notes">
  {#snippet crumbs()}
    <PanelCrumbs
      trail={[{ label: `Slide ${notes.index}`, key: "resource.slide" }, { label: "Speaker notes" }]}
      onnavigate={(key: string) => {
        if (isInspectionKey(key)) view.inspect(key, { kind: "slide", id: slideId });
      }}
    />
  {/snippet}

  <PanelSection title="Notes">
    <PanelEditableText
      label="Speaker notes"
      value={content}
      placeholder="No notes"
      multiline
      onchange={(next: string) => (draft = next)}
    />
  </PanelSection>

  <PanelSection title="Note">
    <PanelNote>
      Notes use the same block editor as everything else and never appear on the
      slide canvas. The editor is what makes them feel like slide content; they are
      not.
    </PanelNote>
  </PanelSection>
</Panel>
