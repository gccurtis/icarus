<script lang="ts">
  import ArrowDownNarrowWide from "@lucide/svelte/icons/arrow-down-narrow-wide";
  import ArrowUpNarrowWide from "@lucide/svelte/icons/arrow-up-narrow-wide";
  import ChartColumn from "@lucide/svelte/icons/chart-column";
  import FileText from "@lucide/svelte/icons/file-text";
  import Plus from "@lucide/svelte/icons/plus";
  import Presentation from "@lucide/svelte/icons/presentation";

  import Entry from "$views/development/vocabulary/components/entry.svelte";
  import SectionTitle from "$views/development/vocabulary/components/section-title.svelte";
  import { Button } from "$vendored-components/button";
  import { PanelButton, PanelChip, PanelChoice } from "$authored-components/panel";
  import {
    ScreenAction,
    ScreenBanner,
    ScreenBar,
    ScreenCard,
    ScreenCards,
    ScreenCell,
    ScreenEmpty,
    ScreenFilters,
    ScreenGroup,
    ScreenHeadCell,
    ScreenHeader,
    ScreenNote,
    ScreenPlaceholder,
    ScreenRow,
    ScreenShelf,
    ScreenShelfItem,
    ScreenStat,
    ScreenStats,
    ScreenStrip,
    ScreenTable,
    ScreenThumb
  } from "$authored-components/screen";

  /** The workspace family: the shapes the centre of a screen is built from. */
  const SHELF = [
    { title: "Regulatory filing shell", sub: "Document · 4 variables", icon: FileText, lines: 5, variables: 2 },
    { title: "Board update", sub: "Slide deck · 2 variables", icon: Presentation, lines: 4, variables: 1 },
    { title: "Storm cost model", sub: "Spreadsheet · 6 variables", icon: ChartColumn, lines: 6, variables: 3 },
    { title: "Outage brief", sub: "Document · 1 variable", icon: FileText, lines: 4, variables: 1 },
    { title: "Rate case exhibit", sub: "Slide deck · 3 variables", icon: Presentation, lines: 5, variables: 2 },
    { title: "Events by month", sub: "Analysis · 24 rows", icon: ChartColumn, lines: 4, variables: 0 }
  ];

  /** The shelf is the one example here with a selection, because choosing is its subject. */
  let chosen = $state("Board update");

  /**
   * The filter row works, because a filter row is three controls whose whole
   * point is what happens to the list under them.
   */
  const WORK = [
    { name: "Q3 Resilience Memo", kind: "Document", changed: "4 minutes ago", order: 0, icon: FileText },
    { name: "Board Update — October", kind: "Slide deck", changed: "2 hours ago", order: 1, icon: Presentation },
    { name: "Regulatory Filing Draft", kind: "Document", changed: "1 day ago", order: 2, icon: FileText },
    { name: "Storm Hardening Options", kind: "Slide deck", changed: "3 days ago", order: 3, icon: Presentation },
    { name: "Outage Cost Model", kind: "Spreadsheet", changed: "4 days ago", order: 4, icon: ChartColumn }
  ];
  let query = $state("");
  let kind = $state("all");
  let sort = $state("recent");
  let ascending = $state(true);

  const shown = $derived.by(() => {
    const needle = query.trim().toLowerCase();
    const kept = WORK.filter(
      (item) =>
        (kind === "all" || item.kind === kind) && item.name.toLowerCase().includes(needle)
    );
    const way = ascending ? 1 : -1;
    return [...kept].sort((a, b) => {
      if (sort === "name") return way * a.name.localeCompare(b.name);
      if (sort === "kind") return way * (a.kind.localeCompare(b.kind) || a.order - b.order);
      return way * (a.order - b.order);
    });
  });

  const CODE = {
    action: `<ScreenHeader title="Templates" about="…">
  {#snippet actions()}
    <ScreenAction label="New template" icon={Plus}
      onclick={() => (authoring = true)} />
  {/snippet}
</ScreenHeader>`,
    group: `<ScreenGroup label="How it behaves">
  …
</ScreenGroup>

<!-- toned only when the label is the argument -->
<ScreenGroup label="Include" tone="success" count="248 resources">…</ScreenGroup>
<ScreenGroup label="Take out" tone="danger" count="12 resources">…</ScreenGroup>`,
    note: `<ScreenNote meta="Showing 6 of 41 · limit 10">
  Generated from current data — the result itself is not stored.
</ScreenNote>

<ScreenNote tone="gap">
  A Context matching nothing cannot be used to narrow a search —
  an empty scope currently means the whole project.
</ScreenNote>`,
    header: `<ScreenHeader
  title="Automations"
  about="A run is a dispatch. Success means the task
    was created — what it then does is the task's
    own story."
>
  {#snippet actions()}…{/snippet}
</ScreenHeader>`,
    filters: `<ScreenFilters
  placeholder="Search project work"
  matched={shown.length} total={WORK.length}
  bind:value={query}
  bind:sort
  sorts={[
    { value: "recent", label: "Recently changed" },
    { value: "name", label: "Name" },
    { value: "kind", label: "Kind" }
  ]}
>
  <PanelChoice label="Kind" value={kind} options={KINDS}
    onchange={(next) => (kind = next)} />

  {#snippet order()}
    <Button variant="ghost" size="icon-sm"
      title={ascending ? "Newest first" : "Oldest first"}
      onclick={() => (ascending = !ascending)}>
      <ArrowUpNarrowWide />
    </Button>
  {/snippet}
</ScreenFilters>`,
    table: `<ScreenTable scroll columns={["Name", "Kind", "Updated"]}>
  <ScreenRow>
    <ScreenCell name="Q3 Resilience Memo" icon={FileText}
      onselect={() => workbench.inspect("project.resource")} />
    <ScreenCell>Document</ScreenCell>
    <ScreenCell num>4 minutes ago</ScreenCell>
  </ScreenRow>
</ScreenTable>`,
    cards: `<ScreenCards>
  <ScreenCard title="Regulatory filing shell"
    sub="Document · Project · 4 variables"
    onselect={…}>
    {#snippet thumb()}
      <ScreenThumb ratio="4 / 3" lines={5} variables={2} />
    {/snippet}
  </ScreenCard>
</ScreenCards>`,
    shelf: `<ScreenShelf>
  {#each recent as item (item.id)}
    <ScreenShelfItem>
      <ScreenCard title={item.name} sub={item.kind}
        selected={item.id === chosen}
        onselect={() => (chosen = item.id)}>
        {#snippet thumb()}
          <ScreenThumb ratio="4 / 3" lines={4} />
        {/snippet}
      </ScreenCard>
    </ScreenShelfItem>
  {/each}
</ScreenShelf>`,
    head: `<!-- one row of words: give it columns -->
<ScreenTable columns={["Name", "Kind", "Updated"]}>…</ScreenTable>

<!-- anything else: own the header -->
<ScreenTable>
  {#snippet head()}
    <tr>
      <ScreenHeadCell rows={2}>Name</ScreenHeadCell>
      <ScreenHeadCell rows={2}>Kind</ScreenHeadCell>
      <ScreenHeadCell span={2} scope="colgroup" align="center">
        Last change
      </ScreenHeadCell>
    </tr>
    <tr>
      <ScreenHeadCell>When</ScreenHeadCell>
      <ScreenHeadCell>By</ScreenHeadCell>
    </tr>
  {/snippet}
  <ScreenRow>…</ScreenRow>
</ScreenTable>`,
    bar: `<ScreenBar title="Regulatory filing shell"
  onback={() => (authoring = false)}>
  {#snippet meta()}
    <PanelChip tone="intelligence">Template</PanelChip>
  {/snippet}
</ScreenBar>`,
    banner: `<ScreenBanner title="Two variables, no relationship"
  meta="subId → id">
  You dropped substations.name and
  outageEvents.customerMinutes…
</ScreenBanner>`,
    stats: `<ScreenStats>
  <ScreenStat value="41" label="tasks run" />
  <ScreenStat value="1" label="failed" tone="danger" />
</ScreenStats>`,
    placeholder: `<ScreenPlaceholder framework="Univer, calc bypassed">
  Icarus's formula engine is the only calculation
  authority…
</ScreenPlaceholder>`,
    strip: `<ScreenStrip label="Recent work" width="12rem">
  {#each recent as item (item.id)}
    <ScreenCard title={item.name} sub={item.kind} />
  {/each}
</ScreenStrip>`,
    empty: `<ScreenEmpty title="No Personas yet" icon={Plus}>
  A Persona is a standing brief an agent works from.
</ScreenEmpty>

<ScreenEmpty kind="no-matches"
  title="Nothing matches “storm”"
  onclear={() => (query = "")}
>
  Six templates are here, none of them named that.
</ScreenEmpty>`
  };
</script>

<section class="flex flex-col gap-8">
  <SectionTitle title="Workspace vocabulary" source="src/lib/components/authored/screen/">
    A workspace is the generous plane, and eight of the eleven screens are one
    sequence: header, filters, then a table or a grid of cards. Naming that
    sequence is what makes a library screen about twenty-five lines.
  </SectionTitle>

  <Entry
    name="ScreenHeader"
    use="A screen's title, what it is for, and the one thing you make here. The subtitle carries the rule that is otherwise invisible."
    instead="decoration. If the subtitle says nothing a reader could not guess, leave it out."
    code={CODE.header}
    width="screen"
  >
    <div class="p-4">
      <ScreenHeader
        title="Automations"
        about="A run is a dispatch. Success means the task was created — what it then does is the task's own story."
      >
        {#snippet actions()}
          <ScreenAction label="New Automation" icon={Plus} onclick={() => {}} />
        {/snippet}
      </ScreenHeader>
    </div>
  </Entry>

  <Entry
    name="ScreenFilters"
    use="The row above a table or a grid: what narrows it, what orders it, which way that order runs, and how much of it you are looking at. They answer one question — which of these am I seeing, and in what order — and splitting them puts half the answer somewhere else. The direction shares the order's frame, because it is half of that one decision."
    instead="a bare number, or an unnamed order. '24' could be the whole project or a tenth of it; and a list in an order nobody chose is a list whose first row looks like a ranking."
    code={CODE.filters}
    width="screen"
  >
    <div class="flex flex-col gap-3 p-4">
      <ScreenFilters
        placeholder="Search project work"
        matched={shown.length}
        total={WORK.length}
        bind:value={query}
        bind:sort
        sorts={[
          { value: "recent", label: "Recently changed" },
          { value: "name", label: "Name" },
          { value: "kind", label: "Kind" }
        ]}
      >
        <PanelChoice
          label="Kind"
          value={kind}
          options={[
            { value: "all", label: "All kinds" },
            { value: "Document", label: "Documents" },
            { value: "Slide deck", label: "Decks" }
          ]}
          onchange={(next) => (kind = next)}
        />

        {#snippet order()}
          <Button
            variant="ghost"
            size="icon-sm"
            title={ascending ? "Newest first" : "Oldest first"}
            aria-label={ascending ? "Newest first" : "Oldest first"}
            onclick={() => (ascending = !ascending)}
          >
            {#if ascending}
              <ArrowUpNarrowWide aria-hidden="true" />
            {:else}
              <ArrowDownNarrowWide aria-hidden="true" />
            {/if}
          </Button>
        {/snippet}
      </ScreenFilters>

      <ScreenTable columns={["Name", "Kind", "Changed"]}>
        {#each shown as item (item.name)}
          <ScreenRow>
            <ScreenCell name={item.name} icon={item.icon} onselect={() => {}} />
            <ScreenCell>{item.kind}</ScreenCell>
            <ScreenCell num>{item.changed}</ScreenCell>
          </ScreenRow>
        {/each}
      </ScreenTable>

      <ScreenNote>
        Every control works. Type, switch the kind, change the order, flip its
        direction — the table and the count follow, so what each one does is
        visible rather than described.
      </ScreenNote>
    </div>
  </Entry>

  <Entry
    name="ScreenTable · ScreenRow · ScreenCell · ScreenHeadCell"
    use="Rows of things. The click target is the name cell rather than the row, so other cells can hold their own links. Pass columns for one row of words; pass a head snippet of ScreenHeadCells when the header is its own shape — a group over two columns, a sort control, a unit under a name."
    instead="a status column. A row is a thing, not a health report — unless the table is about dispatch, where the result is the subject."
    code={CODE.head}
    width="screen"
  >
    <div class="p-4">
      <ScreenTable>
        {#snippet head()}
          <tr>
            <ScreenHeadCell rows={2}>Name</ScreenHeadCell>
            <ScreenHeadCell rows={2}>Kind</ScreenHeadCell>
            <ScreenHeadCell span={2} scope="colgroup" align="center">Last change</ScreenHeadCell>
          </tr>
          <tr>
            <ScreenHeadCell>When</ScreenHeadCell>
            <ScreenHeadCell>By</ScreenHeadCell>
          </tr>
        {/snippet}
        <ScreenRow>
          <ScreenCell name="Q3 Resilience Memo" icon={FileText} onselect={() => {}} />
          <ScreenCell>Document</ScreenCell>
          <ScreenCell num>4 minutes ago</ScreenCell>
          <ScreenCell>
            <button type="button" class="text-interactive-text text-body-sm border-none bg-transparent p-0 hover:underline">
              Ana Reyes
            </button>
          </ScreenCell>
        </ScreenRow>
        <ScreenRow>
          <ScreenCell name="Board Update — October" icon={Presentation} onselect={() => {}} />
          <ScreenCell>Slide deck</ScreenCell>
          <ScreenCell num>2 hours ago</ScreenCell>
          <ScreenCell>
            <button type="button" class="text-interactive-text text-body-sm border-none bg-transparent p-0 hover:underline">
              Tomas Kaur
            </button>
          </ScreenCell>
        </ScreenRow>
      </ScreenTable>
    </div>
  </Entry>

  <Entry
    name="ScreenCards · ScreenCard · ScreenThumb"
    use="Things you recognise by looking rather than by reading. The thumbnail is the point; variable regions are tinted with the intelligence role."
    instead="a list of names. Four screens are card grids and four are tables, and the difference is whether the thing has a shape."
    code={CODE.cards}
    width="screen"
  >
    <div class="p-4">
      <ScreenCards min="11rem">
        <ScreenCard title="Regulatory filing shell" sub="Document · 4 variables" icon={FileText} onselect={() => {}}>
          {#snippet thumb()}<ScreenThumb ratio="4 / 3" lines={5} variables={2} />{/snippet}
        </ScreenCard>
        <ScreenCard title="Board update" sub="Slide deck · 2 variables" icon={Presentation} onselect={() => {}}>
          {#snippet thumb()}<ScreenThumb ratio="4 / 3" lines={4} variables={1} />{/snippet}
        </ScreenCard>
        <ScreenCard title="Events by month" sub="Line · 24 rows" icon={ChartColumn}>
          {#snippet thumb()}<ScreenThumb ratio="4 / 3" lines={4} />{/snippet}
        </ScreenCard>
      </ScreenCards>
    </div>
  </Entry>

  <Entry
    name="ScreenShelf · ScreenShelfItem"
    use="The same cards on a shelf you push sideways — the well, the frame's overhang, the drag physics and the two buttons are unique-components/carousel-shelf, unmodified. For browsing rather than searching, and for a row that is one band of a screen with other bands under it."
    instead="a library. A shelf hides most of itself off the edge, which is right for six recent things and wrong for sixty templates — what is off-screen cannot be scanned."
    code={CODE.shelf}
    width="screen"
  >
    <div class="p-4">
      <ScreenShelf>
        {#each SHELF as item (item.title)}
          <ScreenShelfItem>
            <ScreenCard
              title={item.title}
              sub={item.sub}
              icon={item.icon}
              selected={item.title === chosen}
              onselect={() => (chosen = item.title)}
            >
              {#snippet thumb()}<ScreenThumb ratio="4 / 3" lines={item.lines} variables={item.variables} />{/snippet}
            </ScreenCard>
          </ScreenShelfItem>
        {/each}
      </ScreenShelf>
    </div>
  </Entry>

  <Entry
    name="ScreenBar"
    use="Which one of many you are editing, and how to get back. Six screens have a library and an editor in one tab; this is the whole of what that costs the user."
    instead="a page title. The title is ScreenHeader's — this bar exists because the library was replaced."
    code={CODE.bar}
    width="screen"
  >
    <ScreenBar title="Regulatory filing shell" onback={() => {}}>
      {#snippet meta()}<PanelChip tone="intelligence">Template</PanelChip>{/snippet}
      {#snippet actions()}<PanelChip tone="success">Saved · revision 6</PanelChip>{/snippet}
    </ScreenBar>
  </Entry>

  <Entry
    name="ScreenBanner"
    use="A statement about the whole of what is under it — something that has to be said before the work rather than after."
    instead="a transient message. A banner is for a condition that persists; a toast is for an event that passed."
    code={CODE.banner}
    width="screen"
  >
    <div class="p-4">
      <ScreenBanner title="Two variables, no relationship" meta="subId → id">
        You dropped <b>substations.name</b> and <b>outageEvents.customerMinutes</b>.
        They line up on <b>subId → id</b>, which is what this chart is using.
      </ScreenBanner>
    </div>
  </Entry>

  <Entry
    name="ScreenStats · ScreenStat"
    use="A record of what a thing has done — evidence about whether to trust what is beside it."
    instead="a metric dashboard. And never omit the failures: a record that only counts successes is not a record."
    code={CODE.stats}
    width="screen"
  >
    <div class="p-4">
      <ScreenStats>
        <ScreenStat value="41" label="tasks run" />
        <ScreenStat value="2" label="running now" />
        <ScreenStat value="1" label="failed" tone="danger" />
        <ScreenStat value="128" label="findings accepted" />
      </ScreenStats>
    </div>
  </Entry>

  <Entry
    name="ScreenPlaceholder"
    use="Where a framework surface will go. Names the framework, what Icarus adds, and what it deliberately does not take."
    instead="a drawn imitation. A fake editor is one nobody can tell from the real thing, including whoever is reviewing it."
    code={CODE.placeholder}
    width="screen"
  >
    <div class="h-60">
      <ScreenPlaceholder framework="Univer, with its calculation engine bypassed">
        Icarus's formula engine is the only calculation authority — two engines
        would mean two answers, and only one can be what a document's inline
        formula reads.
      </ScreenPlaceholder>
    </div>
  </Entry>

  <Entry
    name="ScreenAction"
    use="The control in a screen's header: the one thing this screen makes. 32px rather than the panel's 24, so a screen's action never reads as a panel control that wandered onto the plane."
    instead="a second one. The interactive role is reserved for the one thing the screen makes; anything else a header needs is a PanelButton beside it."
    code={CODE.action}
    width="screen"
  >
    <div class="p-4">
      <ScreenHeader
        title="Templates"
        about="A template hands back an independent copy. Editing the template never changes what was made from it."
      >
        {#snippet actions()}
          <PanelButton label="Import" />
          <ScreenAction label="New template" icon={Plus} onclick={() => {}} />
        {/snippet}
      </ScreenHeader>
    </div>
  </Entry>

  <Entry
    name="ScreenGroup"
    use="A named band of the plane: a caption in caps, an optional count, and what it holds. Twelve of these were hand-set across six workspaces, each copying PanelSection's trigger typography onto the plane."
    instead="a disclosure. It never collapses — hiding things is a 300px problem, and a plane that could hide half of itself gives no way to know it had."
    code={CODE.group}
    width="screen"
  >
    <div class="flex flex-col gap-5 p-4">
      <ScreenGroup label="How it behaves">
        <p class="text-body-sm text-ink-secondary m-0">
          Reads field data and relay logs. Answers in short paragraphs with the
          figure first.
        </p>
      </ScreenGroup>
      <ScreenGroup label="Include" tone="success" count="248 resources">
        <ScreenCards min="11rem">
          <ScreenCard title="Everything under Filings" sub="Folder rule" icon={FileText} />
        </ScreenCards>
      </ScreenGroup>
      <ScreenGroup label="Take out" tone="danger" count="12 resources">
        <ScreenCards min="11rem">
          <ScreenCard title="Superseded drafts" sub="Tag rule" icon={FileText} />
        </ScreenCards>
      </ScreenGroup>
    </div>
  </Entry>

  <Entry
    name="ScreenNote"
    use="The quiet line under a workspace's content that qualifies it. PanelNote's counterpart on the plane — seven workspaces name a note region and every one of them wrote its own paragraph, in two different sizes."
    instead="something to act on. That is ScreenBanner, which is loud on purpose and read before the work. This is read after it, is permanent, and cannot be dismissed."
    code={CODE.note}
    width="screen"
  >
    <div class="flex flex-col gap-3 p-4">
      <ScreenNote meta="Showing 6 of 41 · limit 10">
        Generated from current data — the result itself is not stored.
      </ScreenNote>
      <ScreenNote>
        Previews are rendered from the real body. The model has no thumbnail, tag,
        category, favourite or usage count, so the library does not pretend those
        exist.
      </ScreenNote>
      <ScreenNote tone="gap">
        A Context matching nothing cannot be used to narrow a search — an empty
        scope currently means the whole project.
      </ScreenNote>
    </div>
  </Entry>

  <Entry
    name="ScreenStrip"
    use="A row of cards you scroll rather than step through. A native scroll container, so two fingers, shift-wheel, a dragged scrollbar, Home and End and the arrow keys all come free."
    instead="a display. The shelf's well and overhang are what make a row feel like a surface; this is for a row someone is getting through, and it trades the chrome for the gestures."
    code={CODE.strip}
    width="screen"
  >
    <div class="p-4">
      <ScreenStrip label="Recent work" width="12rem">
        {#each SHELF as item (item.title)}
          <ScreenCard title={item.title} sub={item.sub} icon={item.icon}>
            {#snippet thumb()}<ScreenThumb ratio="4 / 3" lines={item.lines} variables={item.variables} />{/snippet}
          </ScreenCard>
        {/each}
      </ScreenStrip>
    </div>
  </Entry>

  <Entry
    name="ScreenEmpty"
    use="A workspace with nothing in it, saying which nothing this is. A screen never used wants an invitation; a filter that matched nothing wants clearing — and the two look identical unless the component tells them apart."
    instead="one 'No results' for both. It reads as failure on a screen nobody has used yet, and as emptiness on a list that is full behind a filter."
    code={CODE.empty}
    width="screen"
  >
    <div class="flex flex-col gap-4 p-4">
      <ScreenEmpty title="No Personas yet" icon={Plus}>
        A Persona is a standing brief an agent works from. The first one is
        usually the one you explain most often.
      </ScreenEmpty>
      <ScreenEmpty kind="no-matches" title="Nothing matches “storm”" onclear={() => {}}>
        Six templates are here, none of them named that.
      </ScreenEmpty>
    </div>
  </Entry>
</section>
