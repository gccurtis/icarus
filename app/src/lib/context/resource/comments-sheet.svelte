<script lang="ts">
  import MessageSquare from "@lucide/svelte/icons/message-square";

  import {
    Panel,
    PanelChoice,
    PanelNote,
    PanelRow,
    PanelSection
  } from "$lib/unique-components/panel";
  import { commentsOn, type ResourceComment } from "$mock-capabilities/resource";
  import { viewState } from "$model/client/view-state";

  /**
   * Conversation on this spreadsheet.
   *
   * `docs/screen-panel-views/context/resource/comments-sheet.md` is the
   * specification. Every row leads with the address the thread is anchored to,
   * because a remark about C2 is otherwise found only by hunting the grid for a
   * marker.
   *
   * **Only open threads are listed.** The specification has one section and it is
   * Open: a settled thread is history, and this view is what still needs
   * answering. Narrowing to the current cell says matched of total rather than a
   * bare number, so a scoped list never reads as everything said here.
   */
  let { spreadsheetId = "r-cost" }: { spreadsheetId?: string } = $props();

  const view = viewState();

  const threads = $derived(commentsOn(spreadsheetId).current);

  /**
   * The cell the grid is on. `C2` when nothing is selected — the address the
   * specification's example is about, so the narrow scope has something to show.
   */
  const address = $derived(view.selection?.kind === "cell" ? view.selection.id : "C2");

  let scope = $state<"everywhere" | "cell">("everywhere");

  const SCOPES = [
    { value: "everywhere", label: "Everywhere" },
    { value: "cell", label: "This cell" }
  ] as const;

  const open = $derived(threads.filter((thread) => thread.state === "open"));

  const shown = $derived(
    open.filter((thread) => scope === "everywhere" || thread.anchor.address === address)
  );

  const count = $derived(
    shown.length === open.length ? open.length : `${shown.length} of ${open.length}`
  );

  /** Who said it, and where. A thread on the whole grid has no address to name. */
  const said = (thread: ResourceComment) =>
    thread.anchor.label === undefined
      ? `${thread.authorName} on this spreadsheet`
      : `${thread.authorName} on ${thread.anchor.label}`;
</script>

<Panel title="Comments">
  <PanelChoice
    label="Scope"
    value={scope}
    options={SCOPES}
    onchange={(next) => (scope = next as typeof scope)}
  />

  <PanelSection title="Open" {count} flush>
    {#each shown as thread (thread.id)}
      <!--
        A mention is toned rather than sorted to the top: the grid's own order is
        what makes a list of addresses readable, and re-ordering it would cost
        that to say something the tone already says.
      -->
      <PanelRow
        title={said(thread)}
        sub={thread.body}
        meta={thread.age}
        icon={MessageSquare}
        tone={thread.mentionsViewer ? "attention" : "default"}
        onselect={() => view.inspect("collaboration.comment", { kind: "comment", id: thread.id })}
      />
    {/each}
  </PanelSection>

  <PanelNote tone="gap">
    A thread anchors to the spreadsheet, to a cell, or to a range of text inside
    one. A column, a row, a range of cells or a chart cannot be commented on,
    which rules out the most natural thing to say something about — a column of
    numbers.
  </PanelNote>
</Panel>
