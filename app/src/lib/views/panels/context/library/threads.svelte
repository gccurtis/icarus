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
  } from "$components/authored/panel";
  import { threads } from "$capabilities/library";
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

  /**
   * Choosing a thread opens its tab, and inspects it.
   *
   * Two acts in one call, and deliberately: this panel is the map onto a screen
   * that has no list of its own, so a click that only inspected would leave the
   * map with no way onto the territory. `open` is idempotent, so a thread
   * reached from here, from a finding and from the work table is one tab.
   */
  const inspect = (id: string) => {
    view.open({ screen: "research", resourceId: id });
    view.inspect("research.thread", { kind: "thread", id });
  };
</script>

<Panel title="Threads">
  {#snippet actions()}
    <!--
      There is no capability that starts a thread, so this opens the first one
      the screen is not already holding rather than pretending to create.
    -->
    <PanelButton
      label="New thread"
      icon={Plus}
      tone="primary"
      onclick={() => {
        const open = new Set(
          view.tabs.filter((tab) => tab.screen === "research").map((tab) => tab.resourceId)
        );
        const fresh = all.find((row) => !open.has(row.id));
        if (fresh) inspect(fresh.id);
      }}
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
