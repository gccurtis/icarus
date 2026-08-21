<script lang="ts">
  import Compass from "@lucide/svelte/icons/compass";
  import FlaskConical from "@lucide/svelte/icons/flask-conical";
  import MessageCircleQuestionMark from "@lucide/svelte/icons/message-circle-question-mark";
  import Plus from "@lucide/svelte/icons/plus";

  import {
    Panel,
    PanelButton,
    PanelNote,
    PanelRow,
    PanelSearch,
    PanelSection
  } from "$lib/unique-components/panel";
  import { currentTurn, otherThreads, turnsIn } from "$mock-capabilities/research";
  import { mockWorkbench } from "$mock-models/workbench.svelte";

  /**
   * The earlier turns in this thread, and the other threads in the project.
   *
   * `docs/screen-panel-views/context/research/history.md` is the specification.
   * The screen is anchored to one turn rather than scrolled through all of them,
   * so the turns need somewhere addressable to live: this is it, and every row
   * says what its turn produced, because a list of prompts alone would not say
   * which turn mattered.
   *
   * **The anchored turn is held here.** Moving the centre onto an earlier turn is
   * a selection, and the workbench only carries a selection alongside an
   * inspection — a turn has no lens — so this panel keeps which one is showing.
   *
   * The search covers the turns and nothing else, which is why the other threads
   * sit outside it: they are a way across to another enquiry, not part of this
   * one's history.
   */
  let { threadId = "th-feeder" }: { threadId?: string } = $props();

  const turns = $derived(turnsIn(threadId).current);
  const others = $derived(otherThreads(threadId).current);
  const anchored = $derived(currentTurn(threadId).current);

  let showing = $state<string>();
  let search = $state("");

  const centred = $derived(showing ?? anchored.id);

  const shown = $derived(
    turns.filter((turn) => turn.prompt.toLowerCase().includes(search.trim().toLowerCase()))
  );

  /** The mode as an icon: it repeats on every row and the title is the part worth reading. */
  const MODE = {
    Discover: Compass,
    Question: MessageCircleQuestionMark,
    Hypothesis: FlaskConical
  };

  const turnCount = (count: number) => (count === 1 ? "1 turn" : `${count} turns`);
</script>

<Panel title="History">
  {#snippet actions()}
    <PanelButton
      label="New thread"
      icon={Plus}
      tone="primary"
      onclick={() => mockWorkbench.inspect("research.thread", { kind: "thread", id: "new" })}
    />
  {/snippet}

  <PanelSearch
    placeholder="Search turns"
    matched={shown.length}
    total={turns.length}
    bind:value={search}
    flush
  >
    <PanelSection title="This thread" count={shown.length} flush>
      {#each shown as turn (turn.id)}
        <PanelRow
          title={turn.prompt}
          sub="{turn.at} · {turn.produced}"
          meta={turn.ago}
          selected={turn.id === centred}
          onselect={() => (showing = turn.id)}
        />
      {/each}
    </PanelSection>
  </PanelSearch>

  <PanelSection title="Other threads" count={others.length} flush>
    {#each others as row (row.id)}
      <PanelRow
        title={row.title}
        sub="{row.mode} · {turnCount(row.turns)}"
        meta={row.lastAsked}
        icon={MODE[row.mode]}
        onselect={() => mockWorkbench.inspect("research.thread", { kind: "thread", id: row.id })}
      />
    {/each}
  </PanelSection>

  <PanelNote tone="gap">
    Selecting an earlier turn and asking something new has no defined relationship
    to the turns after it. Nothing records a branch.
  </PanelNote>
</Panel>
