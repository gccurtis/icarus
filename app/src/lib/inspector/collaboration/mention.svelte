<script lang="ts">
  import MailOpen from "@lucide/svelte/icons/mail-open";
  import Reply from "@lucide/svelte/icons/reply";
  import SquareArrowOutUpRight from "@lucide/svelte/icons/square-arrow-out-up-right";

  import { Separator } from "$lib/simple-components/separator";
  import {
    Panel,
    PanelActor,
    PanelButton,
    PanelCrumbs,
    PanelField,
    PanelFields,
    PanelLink,
    PanelNote,
    PanelQuote,
    PanelSection
  } from "$lib/unique-components/panel";
  import { member, resourceNamed, thread } from "$mock-capabilities/collaboration";
  import { isInspectionKey, viewState, type InspectionKey } from "$model/client/view-state";

  /**
   * One comment addressed to you: who wrote it, where it sits, what it says, and
   * the text it is attached to.
   *
   * `docs/screen-panel-views/inspector/collaboration/mention.md` is the
   * specification. Enough to answer without opening the document, and one click
   * to open the document when that is not enough.
   *
   * **The controls are in the action row rather than at the foot the layout
   * table puts them at.** `Panel` has no footer band, on the rule that what a
   * panel offers must be visible before what it lists — and *Open in context* is
   * the reason this lens exists, so it is the first thing under the title.
   *
   * **Replying opens the thread.** There is no composer here: the reply belongs
   * beside the rest of the conversation, and a second place to write one would
   * be a second draft nobody can find again.
   */
  let { mentionId }: { mentionId?: string } = $props();

  const view = viewState();

  const id = $derived(mentionId ?? view.selection?.id ?? "c-1");

  const mention = $derived(thread(id).current);
  const author = $derived(member(mention.author).current);
  const anchor = $derived(mention.anchor);

  /** Clearing it is local, because the read marker it would write does not exist. */
  let cleared = $state(false);

  const WHOLE_RESOURCE: Record<string, InspectionKey> = {
    document: "resource.document",
    slides: "resource.deck",
    spreadsheet: "resource.spreadsheet"
  };

  /** Open the resource at the anchor: the cell, the slide, or the text itself. */
  const openInContext = () => {
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
</script>

<Panel title="Mention">
  {#snippet crumbs()}
    <PanelCrumbs
      trail={[{ label: anchor.resource, key: "resource.document" }, { label: "Mention" }]}
      onnavigate={(key) => {
        if (isInspectionKey(key)) view.inspect(key);
      }}
    />
  {/snippet}

  {#snippet actions()}
    <PanelButton
      label="Open in context"
      icon={SquareArrowOutUpRight}
      tone="primary"
      onclick={openInContext}
    />
    <PanelButton
      label="Reply"
      icon={Reply}
      onclick={() =>
        view.inspect("collaboration.comment", { kind: "comment", id: mention.id })}
    />
    <PanelButton
      label={cleared ? "Read" : "Mark read"}
      icon={MailOpen}
      disabled={cleared}
      title={cleared ? "Cleared from your mentions" : "Clear this from your mentions"}
      onclick={() => (cleared = true)}
    />
  {/snippet}

  <Separator />

  <PanelFields>
    <PanelField label="From">
      <PanelActor
        name={author.name}
        kind="person"
        onselect={() =>
          view.inspect("collaboration.person", { kind: "person", id: author.id })}
      />
    </PanelField>
    <PanelField label="Where">
      <PanelLink
        label={anchor.resource}
        title="Open {anchor.resource} at the anchor"
        onselect={openInContext}
      />
      {#if anchor.location !== undefined}
        <span class="text-ink-muted"> · {anchor.location}</span>
      {/if}
    </PanelField>
    <PanelField label="When">{mention.started}</PanelField>
  </PanelFields>

  <!-- The comment in full: a clipped question is a question you cannot answer. -->
  <PanelQuote source={author.name}>{mention.body}</PanelQuote>

  <PanelSection title="Anchored to">
    {#if anchor.text === undefined}
      <PanelNote>
        This is anchored to {anchor.location ?? anchor.resource} rather than to a passage, so there
        is no text to quote.
      </PanelNote>
    {:else}
      <PanelQuote
        source={anchor.resource}
        sourceLabel={anchor.resolution === "changed" ? "As written" : undefined}
        onopen={openInContext}
      >
        {anchor.text}
      </PanelQuote>
    {/if}

    <!--
      The specification left open whether to quote the original or what is there
      now. Both, labelled, whenever they differ — showing the current text alone
      attributes the question to a sentence nobody asked it about.
    -->
    {#if anchor.resolution === "changed"}
      <PanelNote>The text this was written on has changed since the mention was made.</PanelNote>
      {#if anchor.nowReads !== undefined}
        <PanelQuote source={anchor.resource} sourceLabel="Now reads" onopen={openInContext}>
          {anchor.nowReads}
        </PanelQuote>
      {/if}
    {:else if anchor.resolution === "gone"}
      <PanelNote>
        The text this was written on is gone. Open in context lands on the position it held.
      </PanelNote>
    {/if}
  </PanelSection>

  <PanelNote tone="gap">
    A location inside a resource — "page 2", "C2", "Slide 4" — is named by the editor that owns it
    and cannot be derived from the anchor, so it is absent here on anything that has not supplied
    one. Mark read writes a per-user read marker the model does not have; clearing lasts as long as
    this panel does.
  </PanelNote>
</Panel>
