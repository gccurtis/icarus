<script lang="ts">
  import Check from "@lucide/svelte/icons/check";
  import Locate from "@lucide/svelte/icons/locate";
  import RotateCcw from "@lucide/svelte/icons/rotate-ccw";

  import {
    Panel,
    PanelButton,
    PanelChip,
    PanelCrumbs,
    PanelLink,
    PanelQuote
  } from "$authored-components/panel";
  import { Textarea } from "$vendored-components/textarea";

  const noop = () => undefined;

  let { stress = false }: { stress?: boolean } = $props();

  const LONG_SELECTED =
    "The corridor itself is scheduled for reconductoring, but not until the following summer. The current plan assumes the same restoration window for every downstream substation even though the field notes identify separate switching constraints, crew arrival times, and cold-load pickup risks that could materially change the customer-minutes-lost estimate.";
  const LONG_OPENING =
    "Can we make the dependency between these two exposures explicit, including which operating assumption owns the restoration window, what evidence would invalidate it, and whether the decision changes if Substation 14 remains isolated through the evening peak? I want someone opening this thread months from now to understand both the question and the threshold for resolving it.";
  const LONG_REPLY =
    "Yes. I will connect the assumptions before the cost section, identify the source for each restoration window, and add a short decision note covering the evening-peak scenario. I will also flag the one unresolved dispatch-time discrepancy so the summary does not imply more certainty than the underlying evidence supports.";

  let resolved = $state(false);
  let reply = $state("");
  let replies = $state<{ id: string; author: string; when: string; text: string }[]>([]);
  let repliesMode = $state<boolean | undefined>(undefined);

  $effect(() => {
    if (repliesMode === stress) return;
    repliesMode = stress;
    replies = [
      {
        id: "comments:6",
        author: "Mira Okonkwo",
        when: "7m",
        text: stress ? LONG_REPLY : "Yes. I will connect them before the cost section."
      }
    ];
  });

  const send = () => {
    const text = reply.trim();
    if (text.length === 0) return;
    replies.push({ id: `mock:${replies.length}`, author: "Ana Duarte", when: "now", text });
    reply = "";
  };
</script>

<Panel
  title={stress ? "Comment on the northern transmission corridor restoration assumptions" : "Comment"}
  titleLines={2}
>
  {#snippet crumbs()}
    <PanelCrumbs
      trail={[{ label: "Project overview", key: "project-overview.overview" }, { label: "Comment" }]}
      onnavigate={noop}
    />
  {/snippet}

  {#snippet actions()}
    <PanelButton label="Show in document" icon={Locate} tone="ghost" onclick={noop} />
  {/snippet}

  <div class="flex flex-col gap-3 pt-1">
    <div class="flex flex-col gap-1.5 px-3">
      <div class="text-body-sm min-w-0 font-semibold">
        <PanelLink
          label={stress
            ? "Winter readiness brief for the northern transmission corridor and every downstream substation"
            : "Winter readiness brief"}
          title="Open Winter readiness brief details"
          lines={2}
          onselect={noop}
        />
      </div>
      <div class="flex flex-wrap items-center gap-1.5">
        <PanelChip tone="interactive">Document</PanelChip>
        <PanelChip tone={resolved ? "success" : "attention"}>
          {resolved ? "Resolved" : "Open"}
        </PanelChip>
      </div>
    </div>

    <section aria-labelledby="mock-comment-anchor" class="bg-surface-panel-hover border-border-subtle flex flex-col gap-1.5 border-y py-2">
      <h3 id="mock-comment-anchor" class="text-caption text-ink-muted m-0 px-3 font-semibold tracking-wide uppercase">
        Selected text
      </h3>
      <PanelQuote
        sourceLabel="Selected by"
        source="Ana Duarte"
        when="13m"
        collapsible={stress}
        onopen={noop}
      >
        {stress
          ? LONG_SELECTED
          : "The corridor itself is scheduled for reconductoring but not until the following summer."}
      </PanelQuote>
    </section>

    <section aria-labelledby="mock-comment-conversation" class="flex flex-col gap-2.5">
      <h3 id="mock-comment-conversation" class="text-caption text-ink-muted m-0 px-3 font-semibold tracking-wide uppercase">
        Conversation
      </h3>
      <div class="border-active-border bg-active-surface mx-3 flex flex-col gap-1 rounded-md border py-2">
        <span class="text-caption text-active-text px-3 font-semibold">Original comment</span>
        <PanelQuote source="Ana Duarte" when="13m" collapsible={stress} onopen={noop}>
          {stress
            ? LONG_OPENING
            : "Can we make the dependency between these two exposures explicit?"}
        </PanelQuote>
      </div>

      <div class="border-border-subtle mx-3 border-t" aria-hidden="true"></div>
      <div class="flex flex-col gap-2.5 px-3">
        <Textarea
          bind:value={reply}
          placeholder="Write a reply…"
          aria-label="Write a reply"
          class="text-body-sm field-sizing-content max-h-40 min-h-16 resize-none overflow-y-auto"
        />
        <div class="flex flex-wrap items-center justify-between gap-2">
          <PanelButton
            label={resolved ? "Reopen" : "Resolve"}
            icon={resolved ? RotateCcw : Check}
            onclick={() => (resolved = !resolved)}
          />
          <PanelButton
            label="Reply"
            tone="primary"
            disabled={reply.trim().length === 0}
            onclick={send}
          />
        </div>
      </div>

      {#if replies.length > 0}
        <div class="border-border-subtle mx-3 flex items-center border-t pt-2">
          <h4 class="text-caption text-ink-muted m-0 font-semibold tracking-wide uppercase">
            Replies ({replies.length})
          </h4>
        </div>
        {#each replies as remark (remark.id)}
          <PanelQuote
            source={remark.author}
            when={remark.when}
            collapsible={remark.text.length > 280}
            onopen={noop}
          >
            {remark.text}
          </PanelQuote>
        {/each}
      {/if}
    </section>
  </div>
</Panel>
