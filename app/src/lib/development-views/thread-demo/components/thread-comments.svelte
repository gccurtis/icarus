<script lang="ts">
  import {
    Panel,
    PanelActions,
    PanelActor,
    PanelButton,
    PanelInput,
    PanelNote,
    PanelQuote,
    PanelSection
  } from "$authored-components/panel";

  /**
   * A comment thread, in the flank, at the width the flank actually is.
   *
   * **This is a proposal, not a component that exists.** The cards below are
   * built out of tokens and named surfaces rather than out of the panel
   * vocabulary, because the vocabulary has no word for a comment yet. The point
   * of drawing it here is to decide what that word should be before writing it.
   *
   * The order is the argument. **The anchored text is a source block at the
   * top**, in the reading voice and marked as quoted from the document, because
   * a thread whose first card looks like the comments below it makes the reader
   * work out which one is the passage. **A rule separates it from the thread.**
   * **The opening comment is primary** and its replies are indented under it, so
   * a glance answers "what was asked" before "what was said about it".
   *
   * A detached thread — one whose anchor is gone — is a row in this panel with a
   * relink action, never a pin floating on the page beside content it is not
   * attached to.
   */
  let { onopen }: { onopen: (what: string) => void } = $props();

  const REPLIES = [
    {
      author: "Dev Okonkwo",
      at: "2h ago",
      body: "Customer-minutes. The events number is 21% and it is in the appendix table."
    },
    {
      author: "Ana Reyes",
      at: "1h ago",
      body: "Then let's say customer-minutes in the sentence. It reads as events as written."
    }
  ];

  let draft = $state("");
</script>

<Panel title="Comments">
  <PanelSection title="Anchored to" chevron="end">
    <PanelQuote
      source="Q3 Resilience Memo"
      sourceLabel="In"
      when="§1 · paragraph 2"
      onopen={() => onopen("the anchored passage")}
    >
      <span class="font-reading">
        undergrounded segments lost 38% fewer customer-minutes than overhead ones
      </span>
    </PanelQuote>
  </PanelSection>

  <PanelSection title="Thread" count={REPLIES.length + 1} chevron="end">
    <div class="flex flex-col gap-2 px-3">
      <article class="rail p-3">
        <div class="flex items-center gap-2">
          <PanelActor name="Mira Jain" kind="person" size="row" />
          <span class="text-micro text-ink-muted ms-auto">3h ago</span>
        </div>
        <p class="text-body-sm text-ink-primary m-0 mt-2">
          Is the 38% figure customer-minutes or events? The two are different enough that the
          recommendation changes.
        </p>
      </article>

      <div class="flex flex-col gap-2 ps-4">
        {#each REPLIES as reply (reply.author + reply.at)}
          <article class="border-border-subtle rounded-panel bg-surface-elevated border p-3">
            <div class="flex items-center gap-2">
              <PanelActor name={reply.author} kind="person" size="row" />
              <span class="text-micro text-ink-muted ms-auto">{reply.at}</span>
            </div>
            <p class="text-body-sm text-ink-secondary m-0 mt-2">{reply.body}</p>
          </article>
        {/each}
      </div>
    </div>

    <div class="pt-2">
      <PanelInput
        label="Reply to this thread"
        bind:value={draft}
        placeholder="Reply…"
        onenter={() => (draft = "")}
      />
    </div>

    <PanelActions>
      <PanelButton
        label="Reply"
        tone="primary"
        disabled={draft.trim().length === 0}
        title={draft.trim().length === 0 ? "Write a reply first" : undefined}
        onclick={() => (draft = "")}
      />
      <PanelButton label="Resolve" onclick={() => onopen("resolving the thread")} />
    </PanelActions>
  </PanelSection>

  <PanelSection title="Detached" count={1} chevron="end">
    <PanelQuote tone="quoted" when="anchor removed 2d ago">
      <span class="font-reading">the nine-span threshold</span>
    </PanelQuote>
    <PanelActions>
      <PanelButton label="Relink" onclick={() => onopen("relinking a detached thread")} />
      <PanelButton label="Dismiss" tone="ghost" onclick={() => onopen("dismissing a thread")} />
    </PanelActions>
    <PanelNote>
      A thread whose anchor is gone lives here, not on the page. A dashed pin floating beside a
      header it is not attached to is a lie about where the comment belongs.
    </PanelNote>
  </PanelSection>

  <PanelNote tone="gap">
    Demonstrative. No comment component exists yet. The cards above are tokens and named surfaces, drawn here to
    settle the shape — a source block, a rule, one primary comment, indented replies — before it
    becomes a word in the panel vocabulary.
  </PanelNote>
</Panel>
