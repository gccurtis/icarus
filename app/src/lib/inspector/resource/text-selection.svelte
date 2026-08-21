<script lang="ts">
  import Link2 from "@lucide/svelte/icons/link-2";
  import MessageSquarePlus from "@lucide/svelte/icons/message-square-plus";

  import { ToggleGroup, ToggleGroupItem } from "$lib/simple-components/toggle-group";
  import {
    Panel,
    PanelActions,
    PanelButton,
    PanelCrumbs,
    PanelField,
    PanelFields,
    PanelLink,
    PanelNote,
    PanelQuote,
    PanelSection
  } from "$lib/unique-components/panel";
  import { documentRecord, marksFor, textSelection } from "$mock-capabilities/resource";
  import { mockWorkbench } from "$mock-models/workbench.svelte";

  /**
   * A range of text inside one block — the most common selection in the editor,
   * and the one that used to be a toolbar.
   *
   * `docs/screen-panel-views/inspector/resource/text-selection.md` is the
   * specification. Offsets and atom counts were internals and are not shown:
   * what you selected is the useful confirmation, not where it starts.
   *
   * **Family, size and spacing are not here.** They belong to the named style,
   * and the section says so rather than offering a local override that would
   * quietly disagree with the style it sits in.
   */
  let { documentId = "r-memo" }: { documentId?: string } = $props();

  const doc = $derived(documentRecord(documentId).current);
  const selection = $derived(textSelection(documentId).current);
  const marks = $derived(marksFor("document").current);

  /** Which marks are on. `undefined` until something is pressed, so the stored set stands. */
  let pressed = $state<string[] | undefined>(undefined);
  const on = $derived(pressed ?? marks.filter((mark) => mark.active).map((mark) => mark.id));

  const navigate = (key: string) =>
    mockWorkbench.inspect(
      key,
      key === "resource.document"
        ? { kind: "resource", id: documentId }
        : { kind: "block", id: selection.blockId }
    );
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
    <!--
      TODO(vocabulary): needs PanelMarks — several independent on-or-off marks as
      one row of chips. `PanelChoice` is the closest word and is single-select,
      which would make bold and italic mutually exclusive.
    -->
    <ToggleGroup
      type="multiple"
      value={on}
      aria-label="Marks"
      onValueChange={(next: string[]) => (pressed = next)}
      class="flex flex-wrap justify-start gap-1 px-3"
    >
      {#each marks as mark (mark.id)}
        <ToggleGroupItem
          value={mark.id}
          class="text-caption border-border-subtle bg-surface-panel text-ink-secondary rounded-control data-[state=on]:border-active-border data-[state=on]:bg-active-surface data-[state=on]:text-active-text h-auto min-w-0 border px-1.5 py-0.5 font-normal"
        >
          {mark.label}
        </ToggleGroupItem>
      {/each}
    </ToggleGroup>

    <!-- The two things a selection can become, rather than a formatting state it can hold. -->
    <PanelActions>
      <PanelButton
        label="Add link"
        icon={Link2}
        onclick={() => mockWorkbench.inspect("resource.link")}
      />
      <PanelButton
        label="Comment"
        icon={MessageSquarePlus}
        title="Start a thread anchored to this range"
        onclick={() =>
          mockWorkbench.inspect("collaboration.comment", {
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
            mockWorkbench.inspect("resource.named-style-document", {
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
