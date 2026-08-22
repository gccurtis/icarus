<script lang="ts">
  import Compass from "@lucide/svelte/icons/compass";
  import FlaskConical from "@lucide/svelte/icons/flask-conical";
  import MessageCircleQuestionMark from "@lucide/svelte/icons/message-circle-question-mark";
  import Plus from "@lucide/svelte/icons/plus";

  import {
    Panel,
    PanelButton,
    PanelRow,
    PanelSearch,
    PanelSection
  } from "$lib/unique-components/panel";
  import { threads } from "$mock-capabilities/library";
  import { viewState } from "$model/client/view-state";

  const view = viewState();

  /**
   * Every line of enquiry in the project.
   *
   * `docs/screen-panel-views/context/library/threads.md` is the specification.
   * The mode is carried by the icon rather than by a word, because it repeats on
   * every row and the title is the part worth reading.
   *
   * *Answered* is a projection of the anchoring question's status, not a state
   * anyone sets — so the two sections are a split of one list rather than two
   * lists, and a thread moves between them without being edited.
   */
  const all = $derived(threads().current);

  let search = $state("");

  const MODE = {
    Discover: Compass,
    Question: MessageCircleQuestionMark,
    Hypothesis: FlaskConical
  };

  const shown = $derived(
    all.filter((row) => row.title.toLowerCase().includes(search.trim().toLowerCase()))
  );

  const open = $derived(shown.filter((row) => row.state === "open"));
  const answered = $derived(shown.filter((row) => row.state === "answered"));

  const turns = (count: number) => (count === 1 ? "1 turn" : `${count} turns`);

  const inspect = (id: string) =>
    view.inspect("research.thread", { kind: "thread", id });
</script>

<Panel title="Threads">
  {#snippet actions()}
    <PanelButton
      label="New thread"
      icon={Plus}
      tone="primary"
      onclick={() => view.inspect("research.thread", { kind: "thread", id: "new" })}
    />
  {/snippet}

  <PanelSearch
    placeholder="Search threads"
    matched={shown.length}
    total={all.length}
    bind:value={search}
    flush
  >
    <PanelSection title="Open" count={open.length} flush>
      {#each open as row (row.id)}
        <PanelRow
          title={row.title}
          sub={turns(row.turns)}
          meta={row.activity}
          icon={MODE[row.mode]}
          onselect={() => inspect(row.id)}
        />
      {/each}
    </PanelSection>

    <PanelSection title="Answered" count={answered.length} flush>
      {#each answered as row (row.id)}
        <PanelRow
          title={row.title}
          sub="{turns(row.turns)} · {row.findings} findings"
          meta={row.activity}
          icon={MODE[row.mode]}
          onselect={() => inspect(row.id)}
        />
      {/each}
    </PanelSection>
  </PanelSearch>
</Panel>
