<script lang="ts">
  import FileText from "@lucide/svelte/icons/file-text";
  import Globe from "@lucide/svelte/icons/globe";
  import Paperclip from "@lucide/svelte/icons/paperclip";

  import {
    Panel,
    PanelChoice,
    PanelNote,
    PanelRow,
    PanelSearch,
    PanelSection
  } from "$components/authored/panel";
  import {
    currentTurn,
    sourcesForTurn,
    sourcesInThread,
    type Source
  } from "$capabilities/research";
  import { viewState } from "$model/client/view-state";

  /**
   * What has been read: by this turn, and across the thread.
   *
   * `docs/screen-panel-views/context/research/sources.md` is the specification. A
   * derived ledger, and nothing in it has state — Reviewed and Accepted belong to
   * a finding. A source is only ever something that was read.
   *
   * **The filter is stated over the thread.** The turn's sources are a subset of
   * the thread's, so one matched-of-total covers both lists honestly, and a
   * filter that empties the thread has emptied the turn with it.
   */
  let { threadId = "th-feeder" }: { threadId?: string } = $props();

  const view = viewState();

  const turn = $derived(currentTurn(threadId).current);
  const forTurn = $derived(sourcesForTurn(turn.id).current);
  const inThread = $derived(sourcesInThread(threadId).current);

  let kind = $state<"all" | Source["kind"]>("all");
  let search = $state("");

  const KINDS = [
    { value: "all", label: "All" },
    { value: "Resource", label: "Resources" },
    { value: "External file", label: "Files" },
    { value: "Web", label: "Web" }
  ] as const;

  const matches = (source: Source) =>
    (kind === "all" || source.kind === kind) &&
    source.title.toLowerCase().includes(search.trim().toLowerCase());

  const shownTurn = $derived(forTurn.filter(matches));
  const shownThread = $derived(inThread.filter(matches));

  const ICON = { Resource: FileText, "External file": Paperclip, Web: Globe };

  /**
   * The locator that matters, which differs by kind: a page or a row range points
   * into something stable, and a web address only means anything with the time it
   * was taken beside it.
   */
  const where = (source: Source) =>
    source.kind === "Web"
      ? `Web · captured ${source.capturedAt ?? "never"}`
      : `${source.locator} · ${source.kind}`;

  const open = (id: string) => view.inspect("research.source", { kind: "source", id });
</script>

<Panel title="Sources">
  <!--
    The field contains what it filters, so the scope of both the search and the
    chips is answered by the markup rather than by a convention held in this file.
  -->
  <PanelSearch
    placeholder="Search sources"
    matched={shownThread.length}
    total={inThread.length}
    bind:value={search}
    flush
  >
    <PanelChoice
      label="Kind"
      value={kind}
      options={KINDS}
      onchange={(next) => (kind = next as typeof kind)}
    />

    <PanelSection title="This turn" count={shownTurn.length} flush>
      {#each shownTurn as source (source.id)}
        <PanelRow
          title={source.title}
          sub={where(source)}
          icon={ICON[source.kind]}
          tone={source.kind === "Web" ? "intelligence" : "default"}
          onselect={() => open(source.id)}
        />
      {/each}
    </PanelSection>

    <!-- The use count is what identifies the source the thread keeps returning to. -->
    <PanelSection title="Whole thread" count={shownThread.length} flush>
      {#each shownThread as source (source.id)}
        <PanelRow
          title={source.title}
          sub={source.usedBy.join(" · ")}
          meta={String(source.uses)}
          icon={ICON[source.kind]}
          onselect={() => open(source.id)}
        />
      {/each}
    </PanelSection>
  </PanelSearch>

  <PanelNote tone="gap">
    "Captured 10:21" claims stored content. Nothing stores it: a web source holds
    an address and a time, and the page under both can change without either
    changing.
  </PanelNote>

  <PanelNote>
    No row here has a state. Reviewed and Accepted are decisions about a finding,
    and this list is a record of what was read.
  </PanelNote>
</Panel>
