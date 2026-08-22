<script lang="ts">
  import AtSign from "@lucide/svelte/icons/at-sign";
  import MessageSquare from "@lucide/svelte/icons/message-square";

  import { Panel, PanelChoice, PanelRow, PanelSection } from "$lib/unique-components/panel";
  import {
    commentsOn,
    textBlock,
    textSelection,
    type ResourceComment
  } from "$mock-capabilities/resource";
  import { viewState } from "$model/client/view-state";

  /**
   * Conversation on this document.
   *
   * `docs/screen-panel-views/context/resource/comments-document.md` is the
   * specification. Open threads first, settled ones behind a disclosure.
   *
   * **The page chip is a computed filter, not a stored one.** A comment is
   * anchored to text and has no idea what page it is on; the layout decides that.
   * So the chip reads the page off the block the selection is in, and matches
   * comments whose anchor lands on the same one. It relabels itself when the
   * layout moves, which is the honest drawing of a number that is not an address.
   */
  let { documentId = "r-memo" }: { documentId?: string } = $props();

  const view = viewState();

  const threads = $derived(commentsOn(documentId).current);
  const selection = $derived(textSelection(documentId).current);
  const page = $derived(textBlock(selection.blockId).current.page);

  let scope = $state<"resource" | "page" | "selection">("resource");

  const SCOPES = $derived([
    { value: "resource", label: "Document" },
    { value: "page", label: `Page ${page}` },
    { value: "selection", label: "Selection" }
  ]);

  const inScope = (comment: ResourceComment) => {
    if (scope === "resource") return true;
    if (scope === "page") return comment.anchor.page === page;
    return comment.anchor.text === selection.text;
  };

  const openAll = $derived(threads.filter((comment) => comment.state === "open"));
  const resolvedAll = $derived(threads.filter((comment) => comment.state === "resolved"));

  const open = $derived(openAll.filter(inScope));
  const resolved = $derived(resolvedAll.filter(inScope));

  /**
   * Matched of total while a chip is narrowing, so a scoped list never reads as
   * the whole conversation.
   */
  const count = (shown: number, all: number) => (shown === all ? shown : `${shown} of ${all}`);

  const openThread = (comment: ResourceComment) =>
    view.inspect("collaboration.comment", { kind: "comment", id: comment.id });
</script>

<Panel title="Comments">
  <!--
    The chips sit above both sections rather than inside either: they narrow
    what is being talked about, and open and resolved are the same conversation
    in two states.
  -->
  <PanelChoice
    label="Scope"
    value={scope}
    options={SCOPES}
    onchange={(next) => (scope = next as typeof scope)}
  />

  <PanelSection title="Open" count={count(open.length, openAll.length)} flush>
    {#each open as comment (comment.id)}
      <PanelRow
        title={comment.authorName}
        sub={comment.body}
        meta={comment.age}
        icon={comment.mentionsViewer ? AtSign : MessageSquare}
        tone={comment.mentionsViewer ? "attention" : "default"}
        onselect={() => openThread(comment)}
      />
    {/each}
  </PanelSection>

  <PanelSection
    title="Resolved"
    count={count(resolved.length, resolvedAll.length)}
    open={false}
    flush
  >
    {#each resolved as comment (comment.id)}
      <PanelRow
        title={comment.authorName}
        sub={comment.body}
        meta={comment.age}
        icon={MessageSquare}
        onselect={() => openThread(comment)}
      />
    {/each}
  </PanelSection>
</Panel>
