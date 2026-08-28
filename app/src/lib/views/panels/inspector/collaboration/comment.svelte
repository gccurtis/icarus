<script lang="ts">
  import Check from "@lucide/svelte/icons/check";
  import FileText from "@lucide/svelte/icons/file-text";
  import Presentation from "@lucide/svelte/icons/presentation";
  import Reply from "@lucide/svelte/icons/reply";
  import RotateCcw from "@lucide/svelte/icons/rotate-ccw";
  import Sheet from "@lucide/svelte/icons/sheet";

  import { Separator } from "$lib/components/vendor/separator";
  import {
    Panel,
    PanelActor,
    PanelButton,
    PanelChip,
    PanelCrumbs,
    PanelEditableText,
    PanelField,
    PanelFields,
    PanelNote,
    PanelQuote,
    PanelRow,
    PanelSection
  } from "$components/authored/panel";
  import { actorName, VIEWER } from "$capabilities/cast";
  import { member, resourceNamed, thread } from "$capabilities/collaboration";
  import { isInspectionKey, viewState, type InspectionKey } from "$model/client/view-state";

  /**
   * One comment thread: what was said, what it is attached to, and the replies.
   *
   * `docs/screen-panel-views/inspector/collaboration/comment.md` is the
   * specification. One lens for every anchor kind — a document range, a cell, a
   * slide — because those are the same thread with the same two controls, and
   * only the anchor differs.
   *
   * **The controls are at the top.** A thread has no ceiling, so a Reply button
   * under fifty replies is a button nobody reaches. Reply with nothing typed
   * puts the cursor in the composer at the foot of the thread; with something
   * typed it sends, so there is one send rather than two.
   *
   * **The anchor is always shown.** The trail above names the resource when the
   * comment was reached from it and a person when it was reached from a profile,
   * so a thread that leaned on the breadcrumb could not say what it is about.
   */
  let { commentId }: { commentId?: string } = $props();

  const view = viewState();

  const id = $derived(commentId ?? view.selection?.id ?? "c-1");

  const comment = $derived(thread(id).current);
  const author = $derived(member(comment.author).current);
  const anchor = $derived(comment.anchor);

  /**
   * Resolving is local until the capability lands. `undefined` means untouched,
   * so the door's own state is what shows until someone changes it here.
   */
  let settledLocally = $state<boolean | undefined>(undefined);
  const settled = $derived(settledLocally ?? comment.state === "resolved");

  let draft = $state("");
  let sent = $state<string[]>([]);
  let composer = $state<HTMLDivElement | null>(null);

  const replyCount = $derived(comment.replies.length + sent.length);

  const reply = () => {
    if (draft.trim() === "") {
      // The button is at the top because it must be findable; the writing
      // happens where the thread ends.
      composer?.scrollIntoView({ behavior: "smooth", block: "nearest" });
      composer?.querySelector("button")?.focus();
      return;
    }
    sent = [...sent, draft.trim()];
    draft = "";
  };

  /** The editor a person lands in, said as an icon before they get there. */
  const anchorIcon = $derived.by(() => {
    const kind = resourceNamed(anchor.resource)?.kind;
    if (kind === "spreadsheet") return Sheet;
    if (kind === "slides") return Presentation;
    return FileText;
  });

  const WHOLE_RESOURCE: Record<string, InspectionKey> = {
    document: "resource.document",
    slides: "resource.deck",
    spreadsheet: "resource.spreadsheet"
  };

  /**
   * Open the resource at the anchor rather than at its top: the cell, the slide,
   * or the text itself. A gone anchor still lands on the position it held.
   */
  const openAnchor = () => {
    const resource = resourceNamed(anchor.resource);
    const id = resource?.id ?? anchor.resource;
    if (anchor.location !== undefined && resource?.kind === "spreadsheet") {
      view.inspect("resource.cell", { kind: "cell", id: anchor.location });
    } else if (anchor.location !== undefined && resource?.kind === "slides") {
      view.inspect("resource.slide", { kind: "slide", id: anchor.location });
    } else if (anchor.text !== undefined) {
      view.inspect("resource.text-selection", { kind: "text", id });
    } else {
      const lens = WHOLE_RESOURCE[resource?.kind ?? "document"] ?? "resource.document";
      view.inspect(lens, { kind: "resource", id });
    }
  };

  const openPerson = (id: string) => view.inspect("collaboration.person", { kind: "person", id });
</script>

<Panel title="Comment">
  {#snippet crumbs()}
    <PanelCrumbs
      trail={[{ label: anchor.resource, key: "resource.document" }, { label: "Comment" }]}
      onnavigate={(key) => {
        if (isInspectionKey(key)) view.inspect(key);
      }}
    />
  {/snippet}

  {#snippet actions()}
    <PanelButton label="Reply" icon={Reply} tone="primary" onclick={reply} />
    <!--
      One control for both directions, labelled from the state rather than a
      fixed word sitting beside a chip that contradicts it. Settling leaves the
      thread in place: a panel that vanished on the press would look like a
      deletion.
    -->
    <PanelButton
      label={settled ? "Reopen" : "Resolve"}
      icon={settled ? RotateCcw : Check}
      onclick={() => (settledLocally = !settled)}
    />
  {/snippet}

  <Separator />

  <PanelFields>
    <PanelField label="State">
      <!--
        Said in words as well as colour, so the state survives the panel being
        read without it. The mention is absent rather than negated.
      -->
      <span class="flex flex-wrap items-center gap-1">
        <PanelChip tone={settled ? "inactive" : "active"}>
          {settled ? "Resolved" : "Open"}
        </PanelChip>
        {#if comment.mentionsViewer}
          <PanelChip tone="attention">Mentions you</PanelChip>
        {/if}
      </span>
    </PanelField>
    <PanelField label="Started by">
      <PanelActor name={author.name} kind="person" onselect={() => openPerson(author.id)} />
    </PanelField>
    <PanelField label="When">{comment.started}</PanelField>
  </PanelFields>

  <!--
    Never truncated, and no `onopen`: this is the thing the lens is about, and
    *Anchored to* below is the way to the original.
  -->
  <PanelQuote source={author.name}>{comment.body}</PanelQuote>

  <PanelSection title="Anchored to">
    <PanelRow
      title={anchor.resource}
      sub={anchor.location}
      icon={anchorIcon}
      onselect={openAnchor}
    />

    <!-- A cell address and a slide number are the location, not a quotation. -->
    {#if anchor.text !== undefined}
      <PanelQuote
        source={anchor.resource}
        sourceLabel={anchor.resolution === "changed" ? "As written" : undefined}
        onopen={openAnchor}
      >
        {anchor.text}
      </PanelQuote>
    {/if}

    <!--
      Whatever currently sits at the offset is never shown as the anchor: it
      would attribute the remark to a sentence nobody was talking about.
    -->
    {#if anchor.resolution === "changed"}
      <PanelNote>The text this was written on has changed since the comment was made.</PanelNote>
      {#if anchor.nowReads !== undefined}
        <PanelQuote source={anchor.resource} sourceLabel="Now reads" onopen={openAnchor}>
          {anchor.nowReads}
        </PanelQuote>
      {/if}
    {:else if anchor.resolution === "gone"}
      <PanelNote>
        The text this was written on is gone. The position it held is still in {anchor.resource}{anchor.location
          ? `, ${anchor.location}`
          : ""}, and the row above opens it.
      </PanelNote>
    {/if}
  </PanelSection>

  <!--
    Oldest first: a thread is read as a conversation rather than scanned as a
    feed, so the newest reply is next to where the next one gets written. No
    collapsing — a thread long enough to want that should have become a task.
  -->
  <PanelSection title="Replies" count={replyCount} flush>
    {#each comment.replies as item (item.id)}
      <PanelRow
        title={actorName(item.author)}
        sub={item.body}
        meta={item.age}
        onselect={() => openPerson(item.author)}
      />
    {/each}
    {#each sent as body, index (index)}
      <PanelRow
        title={VIEWER.name}
        sub={body}
        meta="now"
        onselect={() => openPerson(VIEWER.id)}
      />
    {/each}

    <div bind:this={composer}>
      <PanelFields>
        <PanelField label="Reply" stacked>
          <PanelEditableText
            label="Reply"
            value={draft}
            multiline
            placeholder="Write a reply"
            onchange={(next: string) => (draft = next)}
          />
        </PanelField>
      </PanelFields>
    </div>
  </PanelSection>
</Panel>
