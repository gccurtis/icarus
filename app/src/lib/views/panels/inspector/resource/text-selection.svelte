<script lang="ts">
  import Link2 from "@lucide/svelte/icons/link-2";
  import MessageSquarePlus from "@lucide/svelte/icons/message-square-plus";

  import {
    Panel,
    PanelActions,
    PanelButton,
    PanelCrumbs,
    PanelField,
    PanelFields,
    PanelLink,
    PanelMarks,
    PanelNote,
    PanelQuote,
    PanelSection
  } from "$components/authored/panel";
  import { documentRecord, marksFor, textSelection } from "$capabilities/resource";
  import { isInspectionKey, viewState } from "$model/client/view-state";

  /**
   * A range of text inside one block — the most common selection in the editor,
   * and the one whose formatting is read here rather than off a toolbar floating
   * over the words it is about to change.
   *
   * `docs/screen-panel-views/inspector/resource/text-selection.md` is the
   * specification. Offsets and atom counts are internals and are not shown: what
   * you selected is the useful confirmation, not where it starts.
   *
   * **Family, size and spacing are not here.** They belong to the named style,
   * and the section says so rather than offering a local override that would
   * quietly disagree with the style it sits in.
   */
  let { documentId = "r-memo" }: { documentId?: string } = $props();

  const view = viewState();

  const doc = $derived(documentRecord(documentId).current);
  const selection = $derived(textSelection(documentId).current);
  const marks = $derived(marksFor("document").current);

  /** Which marks are on. `undefined` until something is pressed, so the stored set stands. */
  let pressed = $state<string[] | undefined>(undefined);
  const on = $derived(pressed ?? marks.filter((mark) => mark.active).map((mark) => mark.id));

  const navigate = (key: string) => {
    if (!isInspectionKey(key)) return;
    view.inspect(
      key,
      key === "resource.document"
        ? { kind: "resource", id: documentId }
        : { kind: "block", id: selection.blockId }
    );
  };
</script>

<Panel title="Text selection">
  {#snippet crumbs()}
    <PanelCrumbs
      trail={[
        { label: doc.title, key: "resource.document" },
        { label: "Text block", key: "resource.text-block-document" },
        { label: "Selection" }
      ]}
      onnavigate={navigate}
    />
  {/snippet}

  <PanelQuote>{selection.text}</PanelQuote>

  <PanelSection title="Marks" flush>
    <PanelMarks
      label="Marks"
      value={on}
      options={marks.map((mark) => ({ value: mark.id, label: mark.label }))}
      onchange={(next: string[]) => (pressed = next)}
    />

    <!-- The two things a selection can become, rather than a formatting state it can hold. -->
    <PanelActions>
      <PanelButton
        label="Add link"
        icon={Link2}
        onclick={() => view.inspect("resource.link")}
      />
      <PanelButton
        label="Comment"
        icon={MessageSquarePlus}
        title="Start a thread anchored to this range"
        onclick={() =>
          view.inspect("collaboration.comment", {
            kind: "selection",
            id: selection.blockId
          })}
      />
    </PanelActions>
  </PanelSection>

  <PanelSection title="Text style" flush>
    <PanelFields>
      <PanelField label="Named style">
        <PanelLink
          label={selection.styleName}
          title="Open the named style"
          onselect={() =>
            view.inspect("resource.named-style-document", {
              kind: "style",
              id: selection.styleId
            })}
        />
      </PanelField>
      <PanelField label="Applies to" mono>{selection.characters} characters</PanelField>
    </PanelFields>

    <PanelNote>
      Family, size and spacing are set on the style, not on this range: changing
      one from here edits the style and every block using it.
    </PanelNote>
  </PanelSection>
</Panel>
