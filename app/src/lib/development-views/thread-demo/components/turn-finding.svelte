<script lang="ts">
  import Check from "@lucide/svelte/icons/check";
  import X from "@lucide/svelte/icons/x";

  import { PanelActions, PanelButton, PanelChip, PanelLink } from "$authored-components/panel";

  /**
   * A conclusion the thread produced, offered for keeping.
   *
   * The reason a thread is not a transcript. Everything else in a message is
   * read and left behind; this is the one part meant to outlive the
   * conversation, and it is the whole argument for a thread having structure
   * beyond an ordered list of text.
   *
   * **A finding is a conclusion, not a quotation** — the specification's words,
   * and the reason this is not drawn as a `PanelQuote` however well the shape
   * would fit. A quote box says a source states this, and the findings worth
   * having are frequently the ones no single source states. `basis` is where
   * that gets said out loud instead of being implied by a border.
   *
   * **Accept and dismiss belong to the finding, not to the message.** One reply
   * can propose three of these, and they are decided one at a time — a
   * per-message control would make a reader take all of them or none.
   *
   * **A decided finding keeps its place in the thread.** Accepting does not
   * remove the card and neither does dismissing, because the thread is the
   * record of how the conclusion was reached; a thread with its decisions edited
   * out cannot answer "why is this in the project".
   */
  let {
    title,
    body,
    basis,
    standingOn,
    state = "proposed",
    onaccept,
    ondismiss,
    onopen
  }: {
    title: string;
    /** The claim in full. This is what would enter the project, verbatim. */
    body: string;
    /** How it was arrived at — "Inference", "Stated outright in one source". */
    basis: string;
    /** The evidence, named as the reader would recognise it. */
    standingOn: readonly string[];
    state?: "proposed" | "accepted" | "dismissed";
    onaccept: () => void;
    ondismiss: () => void;
    onopen: (source: string) => void;
  } = $props();

  const TONE = { proposed: "attention", accepted: "success", dismissed: "inactive" } as const;
  const WORD = { proposed: "Proposed", accepted: "Accepted", dismissed: "Dismissed" } as const;

  /** What a decided finding says in place of its controls. */
  const SETTLED = {
    proposed: "",
    accepted: "In the project. Retrievable from any thread, not only this one.",
    dismissed: "Not kept. It stays here because the thread is the record of the decision."
  };
</script>

<!--
  Padding is vertical only. The panel words inside carry their own 12px gutter,
  so the lines that are not panel words take the same one by hand rather than
  every panel word ending up double-inset.
-->
<div class="border-border-subtle bg-surface-panel rounded-panel flex flex-col gap-2 border py-2.5">
  <div class="flex flex-wrap items-center gap-2 px-3">
    <PanelChip tone={TONE[state]}>{WORD[state]}</PanelChip>
    <span class="text-body-sm text-ink-primary font-medium">{title}</span>
  </div>

  <p class="text-body-sm text-ink-secondary m-0 max-w-prose px-3">{body}</p>
  <p class="text-caption text-ink-muted m-0 max-w-prose px-3">{basis}</p>

  <div class="text-caption text-ink-muted flex flex-wrap items-baseline gap-x-2 gap-y-1 px-3">
    <span>Standing on:</span>
    {#each standingOn as source (source)}
      <PanelLink label={source} title="Open the source" onselect={() => onopen(source)} />
    {/each}
  </div>

  {#if state === "proposed"}
    <PanelActions>
      <PanelButton
        label="Accept finding"
        icon={Check}
        tone="primary"
        title="Write it into the project"
        onclick={onaccept}
      />
      <PanelButton label="Dismiss" icon={X} title="Keep it here, out of the project" onclick={ondismiss} />
    </PanelActions>
  {:else}
    <p class="text-caption text-ink-muted m-0 max-w-prose px-3">{SETTLED[state]}</p>
  {/if}
</div>
