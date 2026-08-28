<script lang="ts">
  import AtSign from "@lucide/svelte/icons/at-sign";

  import { Panel, PanelNote, PanelRow, PanelSection } from "$authored-components/panel";
  import { actorName } from "$capabilities/cast";
  import { mentionsForViewer, type PersonComment } from "$capabilities/collaboration";
  import { viewState } from "$model/client/view-state";

  /**
   * Mentions — what a person addressed to you, and nothing else.
   *
   * `docs/screen-panel-views/context/project/mentions.md` is the specification.
   * A mention is the one thing worth interrupting for, which is why it leads the
   * screen and why machine noise is not mixed into it: a resource changing did
   * not address you, and belongs in Activity.
   *
   * **The read marker is local to this panel.** No per-user marker is stored yet,
   * so opening a mention moves it to Read here and the two sections start over
   * next time. It is the marker's behaviour without the marker's memory.
   */
  const view = viewState();

  const mentions = $derived(mentionsForViewer().current);

  let seen = $state<string[]>([]);

  const unread = $derived(mentions.filter((mention) => !seen.includes(mention.id)));
  const read = $derived(mentions.filter((mention) => seen.includes(mention.id)));

  /** The resource, and where inside it. A whole-resource comment has no location. */
  const where = (mention: PersonComment) =>
    mention.location === undefined
      ? mention.resource
      : `${mention.resource}, ${mention.location}`;

  const open = (mention: PersonComment) => {
    if (!seen.includes(mention.id)) seen.push(mention.id);
    view.inspect("collaboration.mention", { kind: "comment", id: mention.id });
  };
</script>

<Panel title="Mentions">
  <PanelSection title="Unread" count={unread.length} flush>
    {#each unread as mention (mention.id)}
      <!--
        The excerpt is the row's second line rather than a hover: what a mention
        asks for is the whole reason to open it or leave it, and a decision that
        needs a hover is a decision nobody makes.
      -->
      <PanelRow
        title="{actorName(mention.author)} on {where(mention)}"
        sub={mention.excerpt}
        meta={mention.age}
        icon={AtSign}
        tone="attention"
        onselect={() => open(mention)}
      />
    {/each}

    {#if unread.length === 0}
      <PanelNote>Nothing is waiting on you.</PanelNote>
    {/if}
  </PanelSection>

  <PanelSection title="Read" count={read.length} open={false} flush>
    {#each read as mention (mention.id)}
      <PanelRow
        title="{actorName(mention.author)} on {where(mention)}"
        sub={mention.excerpt}
        meta={mention.age}
        icon={AtSign}
        onselect={() => open(mention)}
      />
    {/each}

    {#if read.length === 0}
      <PanelNote>Nothing read yet.</PanelNote>
    {/if}
  </PanelSection>
</Panel>
