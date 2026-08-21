<script lang="ts">
  import Link2 from "@lucide/svelte/icons/link-2";

  import Entry from "$views/vocabulary/components/entry.svelte";
  import SectionTitle from "$views/vocabulary/components/section-title.svelte";
  import {
    PanelActor,
    PanelButton,
    PanelChip,
    PanelSentence
  } from "$lib/unique-components/panel";
  import {
    ScreenCanvas,
    ScreenCard,
    ScreenCards,
    ScreenComposer,
    ScreenDecision,
    ScreenGrid,
    ScreenGridCell,
    ScreenGroup,
    ScreenItem,
    ScreenList,
    ScreenNote,
    ScreenPage,
    ScreenSlide,
    ScreenSplit
  } from "$lib/unique-components/screen";

  /**
   * The plane's other shapes: the ones a table and a grid of cards cannot hold.
   *
   * A feed entry, something offered for a decision, the ground a document sits
   * on, and a sheet whose columns are addresses. The sample content is
   * illustrative and deliberately obvious — a shape is here to be judged, not to
   * suggest anything is wired up.
   *
   * The last two entries are cross-family on purpose. A workspace that needs an
   * actor or a rule at screen scale asks the panel word for a size, because a
   * second renderer of one object is the drift those components exist to
   * prevent.
   */

  /** The feed's selection, because choosing an entry is what a feed is for. */
  let opened = $state("mira");

  /** The decisions are real: pressing Accept changes the verdict on the card. */
  const FINDINGS = [
    {
      id: "underground",
      title: "Undergrounded segments lost 38% fewer customer-minutes",
      meta: "Storm review · run 12",
      body: "Across the three storm events in the window, undergrounded segments lost 38% fewer customer-minutes than overhead segments on the same feeders."
    },
    {
      id: "harbour",
      title: "Harbour substation is the only one with no relay log",
      meta: "Storm review · run 12",
      body: "Four of the five substations report relay events for the window. Harbour reports none, which is either a clean run or a missing feed."
    }
  ] as const;

  let decided = $state<Record<string, "accepted" | "dismissed" | "pending">>({
    underground: "pending",
    harbour: "pending"
  });
  let looking = $state("underground");
  const WORD = { accepted: "Accepted", dismissed: "Dismissed", pending: "Proposed" } as const;

  /** Two stages on a canvas, so the gutters between them can be seen. */
  const COVER = [
    { id: "title", frame: { x: 0.1, y: 0.34, w: 0.8, h: 0.16 }, label: "Deck title", outline: "dashed" },
    { id: "sub", frame: { x: 0.1, y: 0.52, w: 0.55, h: 0.1 }, label: "Subtitle", outline: "dashed" },
    { id: "mark", frame: { x: 0.78, y: 0.82, w: 0.14, h: 0.08 }, label: "Mark — from the layout", outline: "solid" }
  ] as const;

  const SECTION = [
    { id: "heading", frame: { x: 0.08, y: 0.14, w: 0.84, h: 0.18 }, label: "Section heading", outline: "dashed" },
    { id: "body", frame: { x: 0.08, y: 0.36, w: 0.48, h: 0.42 }, label: "Body placeholder", outline: "dashed" },
    { id: "chart", frame: { x: 0.6, y: 0.36, w: 0.32, h: 0.42 }, label: "Chart", outline: "solid" },
    { id: "rule", frame: { x: 0.08, y: 0.86, w: 0.84, h: 0.05 }, label: "Footer — from the layout", outline: "solid" }
  ] as const;

  /** The slide example has a selection, because selecting an object is its subject. */
  let onObject = $state("heading");

  /** Which band of the page was last opened. One control, projected onto every page. */
  let band = $state("");

  /** The sheet the grid example reads. Sparse on purpose: an empty address is still an address. */
  const SHEET: Record<string, string | undefined> = {
    A1: "Substation",
    B1: "Customers",
    C1: "Minutes lost",
    D1: "Per customer",
    A2: "Northgate",
    B2: "12,400",
    C2: "1,842,000",
    D2: "148.5",
    A3: "Harbour",
    B3: "8,120",
    C3: "1,204,000",
    D3: "148.3",
    A4: "Elmwood",
    B4: "5,940",
    C4: "612,000",
    D4: "103.0",
    A5: "Riverside",
    B5: "3,210",
    C5: "486,000",
    D5: "151.4"
  };
  let cursor = $state("B3");

  /** What a value cannot say about itself: the three states, each with its own words. */
  type Marked = {
    readonly value?: string;
    readonly state?: "spilled" | "error" | "read-only";
    readonly note?: string;
  };

  const IMPORTED = "Header row — written by the import, and a write here would be refused";
  const MARKS: Record<string, Marked | undefined> = {
    A1: { value: "Substation", state: "read-only", note: IMPORTED },
    B1: { value: "Customers", state: "read-only", note: IMPORTED },
    C1: { value: "Per customer", state: "read-only", note: IMPORTED },
    D1: { value: "Rank", state: "read-only", note: IMPORTED },
    A2: { value: "Northgate" },
    B2: { value: "12,400" },
    C2: { value: "148.5" },
    D2: { value: "1" },
    A3: { value: "Harbour" },
    B3: { value: "8,120" },
    C3: { value: "148.3" },
    D3: { value: "2", state: "spilled", note: "Spilled from D2" },
    A4: { value: "Elmwood" },
    B4: { value: "5,940" },
    C4: { value: "103.0" },
    D4: { value: "3", state: "spilled", note: "Spilled from D2" },
    A5: { value: "Riverside" },
    B5: { value: "0" },
    C5: { value: "#DIV/0!", state: "error", note: "#DIV/0! — customers is zero in row 5" }
  };

  /** The composer keeps what is in it, so the example shows what was sent beside it. */
  let draft = $state("");
  let sent = $state("");

  const CODE = {
    list: `<ScreenList label="Mentions">
  {#each mentions as mention (mention.id)}
    <ScreenItem
      excerpt={mention.excerpt}
      meta={mention.age}
      selected={mention.id === opened}
      onselect={() => workbench.inspect(\`mention.\${mention.id}\`)}
    >
      {#snippet lead()}
        <PanelActor name={mention.by} size="face" />
      {/snippet}
      <b>{mention.by}</b> mentioned you on <b>{mention.where}</b>
    </ScreenItem>
  {/each}
</ScreenList>

<!-- scroll only for a feed that is a band of a fixed-height grid -->
<ScreenList label="Activity" scroll>…</ScreenList>`,
    item: `<!-- the whole entry is the target -->
<ScreenItem
  excerpt="The north bay reading looks off — 1,842,000
    against a relay log that says 1,204,000."
  meta="3h"
  selected={mention.id === opened}
  onselect={() => (opened = mention.id)}
>
  {#snippet lead()}
    <PanelActor name="Mira Jain" size="face" />
  {/snippet}
  <b>Mira Jain</b> mentioned you on <b>Roof survey</b>
</ScreenItem>

<!-- controls make it a region: the title line becomes the target -->
<ScreenItem title="Grid Analyst finished 9 tasks" meta="1d"
  onselect={() => workbench.inspect("run.12")}>
  {#snippet actions()}
    <PanelButton label="Open run" />
    <PanelButton label="Dismiss" tone="ghost" />
  {/snippet}
</ScreenItem>`,
    decision: `<ScreenDecision
  title="Undergrounded segments lost 38% fewer customer-minutes"
  meta="Storm review · run 12"
  verdict={{ label: WORD[finding.state], tone: finding.state }}
  selected={finding.id === looking}
  onselect={() => workbench.inspect(\`finding.\${finding.id}\`)}
>
  Across the three storm events in the window…

  {#snippet actions()}
    <PanelButton label="Accept" tone="primary"
      onclick={() => decide(finding.id, "accepted")} />
    <PanelButton label="Edit" />
    <PanelButton label="Dismiss" tone="danger"
      onclick={() => decide(finding.id, "dismissed")} />
  {/snippet}
</ScreenDecision>`,
    canvas: `<!-- the surface owns the zoom; the canvas only reads it -->
<div class="flex min-h-0 flex-1 flex-col" style="--canvas-zoom: {zoom}">
  <ScreenCanvas label="Board update" onwheel={pinched}>
    {#each deck.slides as slide (slide.id)}
      <ScreenSlide
        ratio={deck.ratio}
        objects={slide.objects}
        caption={\`Slide \${slide.index} of \${deck.count}\`}
      />
    {/each}
  </ScreenCanvas>
</div>`,
    page: `<ScreenCanvas label="Regulatory filing draft">
  <ScreenPage
    paper="letter"
    orientation="portrait"
    margins={{ top: 1, bottom: 1, inside: 1.25, outside: 1 }}
    caption="Page 3 · continues 2"
    onheader={() => editor.openHeader()}
    onfooter={() => editor.openFooter()}
  >
    {#snippet header()}
      <span>Northwind Grid Resilience</span>
      <span>Draft</span>
    {/snippet}
    {#snippet footer()}
      <span>Sample document</span>
      <span>3</span>
    {/snippet}

    <p>…</p>
  </ScreenPage>
</ScreenCanvas>`,
    slide: `<ScreenSlide
  ratio="16:9"
  objects={[
    { id: "heading", frame: { x: 0.08, y: 0.14, w: 0.84, h: 0.18 },
      label: "Section heading", outline: "dashed" },
    { id: "rule", frame: { x: 0.08, y: 0.86, w: 0.84, h: 0.05 },
      label: "Footer — from the layout", outline: "solid" }
  ]}
  selected={editor.objectId}
  onselect={(id) => editor.select(id)}
  caption="Slide 2 of 12 · Section head"
/>

<!-- with an object snippet, once there is something to draw -->
<ScreenSlide … >
  {#snippet object(item)}
    <SlideObject object={item} />
  {/snippet}
</ScreenSlide>`,
    grid: `<ScreenGrid
  label="Storm cost model"
  columns={6}
  rows={12}
  bind:address={cursor}
  range="B2:C5"
  onselect={(next) => workbench.inspect(\`cell.\${next}\`)}
>
  {#snippet cell(spot)}
    <ScreenGridCell
      address={spot.address}
      align={spot.column === "A" ? "start" : "end"}
    >
      {sheet.at(spot.address)}
    </ScreenGridCell>
  {/snippet}
</ScreenGrid>`,
    gridCell: `<ScreenGridCell address="C5" align="end" state="error"
  note="#DIV/0! — customers is zero in row 5">
  #DIV/0!
</ScreenGridCell>

<ScreenGridCell address="D3" align="end" state="spilled"
  note="Spilled from D2">2</ScreenGridCell>

<ScreenGridCell address="A1" state="read-only"
  note="Header row — written by the import">
  Substation
</ScreenGridCell>

<!-- nothing stored here, and still an address -->
<ScreenGridCell address="B6" />`,
    split: `<ScreenSplit operator={{ symbol: "−", word: "minus" }}>
  {#snippet left()}
    <ScreenGroup label="Include" tone="success" count="248 resources">
      <ScreenCards min="11rem">…</ScreenCards>
    </ScreenGroup>
  {/snippet}
  {#snippet right()}
    <ScreenGroup label="Take out" tone="danger" count="12 resources">
      <ScreenCards min="11rem">…</ScreenCards>
    </ScreenGroup>
  {/snippet}
</ScreenSplit>`,
    composer: `<ScreenComposer
  label="Ask the Research agent"
  placeholder="Ask about the project's filings…"
  bind:value={draft}
  rows={2}
  sendLabel="Ask"
  submit="modifier-enter"
  onsend={(message) => turns.ask(message)}
>
  {#snippet about()}
    <PanelChip tone="intelligence">Research</PanelChip>
    <span>Answering turn 4</span>
  {/snippet}
  {#snippet scope()}
    <PanelChip tone="interactive">Context: Filings</PanelChip>
    <PanelChip tone="inactive">Web off</PanelChip>
  {/snippet}
</ScreenComposer>`,
    face: `<ScreenCards min="11rem">
  {#each personas as persona (persona.id)}
    <ScreenCard title={persona.name} sub="Agent · 41 tasks run">
      {#snippet thumb()}
        <PanelActor
          name={persona.name}
          kind="agent"
          size="face"
          onselect={() => workbench.inspect(\`actor.\${persona.id}\`)}
        />
      {/snippet}
    </ScreenCard>
  {/each}
</ScreenCards>`,
    sentence: `<!-- the library row and the inspector lens -->
<PanelSentence size="row" tone="inactive">
  {#snippet when()}the clock reaches 02:00 in New York{/snippet}
  {#snippet then()}Filing Editor to summarise last night's reports{/snippet}
</PanelSentence>

<!-- the screen that edits it, heading itself with the same rule -->
<PanelSentence
  size="head"
  lead="Every time"
  join="ask"
  onwhen={() => selectLens("automation.trigger")}
  onthen={() => selectLens("automation.action")}
>
  {#snippet when()}the clock reaches 02:00 in New York{/snippet}
  {#snippet then()}Filing Editor to summarise last night's reports{/snippet}
</PanelSentence>`
  };
</script>

<section class="flex flex-col gap-8">
  <SectionTitle title="The plane: entries, canvases, grids" source="src/lib/unique-components/screen/">
    What the plane holds that a table and a grid of cards cannot: a feed read as
    language, something offered for a decision, the ground a document sits on,
    and a sheet whose columns are addresses rather than names. The last two
    entries are panel words, because a workspace that needs an actor or a rule at
    screen scale asks for a size rather than growing a copy.
  </SectionTitle>

  <Entry
    name="ScreenList"
    use="A stack of entries on the plane, read top to bottom: a mentions feed, an activity feed, a thread of research turns, the tools a persona is allowed. The seams between entries belong to the list, so nothing inside it has to know whether it is last."
    instead="a table or a grid of cards. A table is columnar and its whole value is that the second row's third cell sits under the first row's third — reach for it the moment two entries have the same fields in the same order. A card is a tile in a grid, sized by its picture. A feed entry is a paragraph and aligns with nothing above it, which is why five workspaces hand-rolled this on raw buttons with three different hover fills between them."
    code={CODE.list}
    width="screen"
  >
    <div class="p-4">
      <ScreenList label="Mentions">
        <ScreenItem
          excerpt="The north bay reading looks off — 1,842,000 against a relay log that says 1,204,000."
          meta="3h"
          selected={opened === "mira"}
          onselect={() => (opened = "mira")}
        >
          {#snippet lead()}<PanelActor name="Mira Jain" size="face" />{/snippet}
          <b>Mira Jain</b> mentioned you on <b>Roof survey</b>
        </ScreenItem>
        <ScreenItem
          excerpt="Sample reply. Agreed on the ¶4 figure — I will restate it against the relay log before this goes out."
          meta="5h"
          selected={opened === "tomas"}
          onselect={() => (opened = "tomas")}
        >
          {#snippet lead()}<PanelActor name="Tomas Kaur" size="face" />{/snippet}
          <b>Tomas Kaur</b> replied on <b>Q3 Resilience Memo</b>
        </ScreenItem>
        <ScreenItem
          excerpt="Nine tasks finished, one refused: Harbour substation reports no relay events for the window."
          meta="1d"
          selected={opened === "grid"}
          onselect={() => (opened = "grid")}
        >
          {#snippet lead()}<PanelActor name="Grid Analyst" kind="agent" size="face" />{/snippet}
          <b>Grid Analyst</b> finished a run on <b>Storm review</b>
        </ScreenItem>
        <ScreenItem
          excerpt="Authentication expired. Nothing under Ops Reports has been read since."
          meta="6d"
          selected={opened === "sharepoint"}
          onselect={() => (opened = "sharepoint")}
        >
          {#snippet lead()}<Link2 size={14} class="text-danger-text" aria-hidden="true" />{/snippet}
          <b>SharePoint — Ops Reports</b> stopped syncing
        </ScreenItem>
      </ScreenList>
    </div>
  </Entry>

  <Entry
    name="ScreenItem"
    use="One entry: who, what they did, where, and enough of what they said to decide. The title line is a snippet as well as a prop, because a feed sentence names two things inside it and the emphasis is what makes it scannable; the lead is a snippet too, so a face and a glyph are both allowed."
    instead="PanelRow. That row lives in a 300px column, so both of its lines truncate and its subtitle is a qualifier — a state, a count, a location — rather than a quotation. On the plane there is room for two lines of what somebody actually wrote, and a mention you cannot read is a mention you have to open to triage."
    code={CODE.item}
    width="screen"
  >
    <div class="flex flex-col gap-3 p-4">
      <ScreenList label="The three forms">
        <ScreenItem title="Sample entry — a title and nothing else" meta="2m" onselect={() => {}} />
        <ScreenItem
          excerpt="Sample excerpt. Two lines, then clamped: long enough to decide on, short enough that ten entries still fit on a screen without one of them running away with the page."
          meta="3h"
          onselect={() => {}}
        >
          {#snippet lead()}<PanelActor name="Mira Jain" size="face" />{/snippet}
          <b>Mira Jain</b> mentioned you on <b>Roof survey</b>
        </ScreenItem>
        <ScreenItem
          title="Grid Analyst asked for the relay log for Harbour"
          excerpt="Sample request. The run stopped on the missing feed rather than guessing at it."
          meta="1d"
          onselect={() => {}}
        >
          {#snippet lead()}<PanelActor name="Grid Analyst" kind="agent" size="face" />{/snippet}
          {#snippet actions()}
            <PanelButton label="Grant for this run" tone="primary" />
            <PanelButton label="Refuse" tone="ghost" />
          {/snippet}
        </ScreenItem>
      </ScreenList>
      <ScreenNote>
        The last entry carries controls, so it is a region and its title line is
        the target rather than the whole entry — a button cannot hold another
        button, and the first two show what that costs.
      </ScreenNote>
    </div>
  </Entry>

  <Entry
    name="ScreenDecision"
    use="Something offered for a decision, with the decision on it: a title that selects, the proposal in the body, the verdict as a word, and the controls in a row of their own along the bottom."
    instead="ScreenCard. A card becomes a button the moment it is selectable, and a button cannot hold three more buttons — so Accept, Edit and Dismiss on a proposed finding had nowhere to go. Selecting a proposal and deciding it are two acts, and both have to stay reachable."
    code={CODE.decision}
    width="screen"
  >
    <div class="flex flex-col gap-3 p-4">
      {#each FINDINGS as finding (finding.id)}
        <ScreenDecision
          title={finding.title}
          meta={finding.meta}
          verdict={{ label: WORD[decided[finding.id]], tone: decided[finding.id] }}
          selected={finding.id === looking}
          onselect={() => (looking = finding.id)}
        >
          {finding.body}
          {#snippet actions()}
            <PanelButton
              label="Accept"
              tone="primary"
              onclick={() => (decided = { ...decided, [finding.id]: "accepted" })}
            />
            <PanelButton label="Edit" />
            <PanelButton
              label="Dismiss"
              tone="danger"
              onclick={() => (decided = { ...decided, [finding.id]: "dismissed" })}
            />
          {/snippet}
        </ScreenDecision>
      {/each}
      <ScreenNote>
        Decide one. It stays where it was, saying what happened to it, and the
        controls change rather than disappearing — a card that vanished on Accept
        would leave you unable to check what you just did, and a dismissed
        finding can be accepted after all.
      </ScreenNote>
    </div>
  </Entry>

  <Entry
    name="ScreenCanvas"
    use="The ground a document, a deck or a template sits on — a darker fill, the only scroll in the region, a centred column, and gutters on all four sides and between one sheet and the next."
    instead="ScreenSurface, which is a workspace's own padding, measure and scroll for ordinary content and whose job is to get out of the way. A canvas is the opposite: it exists to be seen, so the thing on it reads as an object with edges. And it does not own zoom — it reads a --canvas-zoom it never sets, because whether a surface zooms at all is that surface's decision, and a zoom prop here would have made it for all three."
    code={CODE.canvas}
    width="screen"
  >
    <div class="flex h-120 flex-col">
      <ScreenCanvas label="Board update">
        <ScreenSlide ratio="16:9" objects={COVER} caption="Slide 1 of 12 · Cover" />
        <ScreenSlide ratio="16:9" objects={SECTION} caption="Slide 2 of 12 · Section head" />
      </ScreenCanvas>
    </div>
  </Entry>

  <Entry
    name="ScreenPage"
    use="One sheet of paper on a canvas at a real size, with all four margins drawn as a dashed guide and the header and footer bands filling the top and bottom margins. It takes a paper name rather than a width — 816px is US Letter at 96dpi, and no caller should have to know that."
    instead="ScreenThumb, which is an abstract placeholder at an aspect ratio standing in for a shape nothing has rendered. This is the document. And do not type into the bands: what is drawn there is a projection of the one canonical header, so pressing one opens the header rather than the header on page three."
    code={CODE.page}
    width="screen"
  >
    <div class="flex flex-col gap-3">
      <ScreenCanvas label="Regulatory filing draft">
        <ScreenPage
          paper="letter"
          caption="Page 3 · continues 2"
          onheader={() => (band = "header")}
          onfooter={() => (band = "footer")}
        >
          {#snippet header()}
            <span>Northwind Grid Resilience</span>
            <span>Draft</span>
          {/snippet}
          {#snippet footer()}
            <span>Sample document</span>
            <span class="tabular-nums">3</span>
          {/snippet}

          <h4 class="text-h3 text-ink-primary m-0 font-semibold">3. Restoration performance</h4>
          <p class="text-body-sm text-ink-primary m-0">
            Sample text. A page here is a real sheet at a real size, so the
            measure of this column is the measure a reader would get on paper
            rather than a proportion of whatever window the editor happens to be
            open in.
          </p>
          <p class="text-body-sm text-ink-primary m-0">
            The dashed guide is the margin, drawn on all four sides. There is no
            ruler anywhere near it: the question a ruler answers — how much room
            is left — is answered here by looking at the gutter, next to the
            writing rather than at the top of the screen.
          </p>
          <p class="text-body-sm text-ink-primary m-0">
            The sheet is always its full height. A page that shrank to whatever
            happened to be on it would be a scrolling flow in a paper costume.
          </p>
        </ScreenPage>
      </ScreenCanvas>
      <div class="px-4 pb-4">
        <ScreenNote meta={band === "" ? "Nothing opened yet" : `Opened: the ${band}`}>
          Press the header band or the footer band. Both are the same editor on
          every page, so a press opens the document's header rather than this
          page's — which is why they are a callback and not editable text in
          place.
        </ScreenNote>
      </div>
    </div>
  </Entry>

  <Entry
    name="ScreenSlide"
    use="One stage at the deck's aspect ratio, with its objects placed on it as fractions of the stage. A solid outline is content the layout owns and a slide cannot touch; a dashed one is a placeholder the slide fills with its own copy — two behaviours told apart by a shape, because a reader has to know which they are about to try to edit before they try."
    instead="ScreenPage. A page is a flow running down a sheet between four margins and what lands where is computed; a slide is a fixed stage where every object is somewhere because somebody put it there, and moving one moves nothing else. Speaker notes are not on it either — they left for the inspector, because a tray under a 16:9 stage costs exactly the height zooming needs."
    code={CODE.slide}
    width="screen"
  >
    <div class="flex flex-col gap-3 p-4">
      <ScreenSlide
        ratio="16:9"
        objects={SECTION}
        selected={onObject}
        onselect={(id) => (onObject = id)}
        caption="Slide 2 of 12 · Section head"
      />
      <ScreenNote meta={`On: ${onObject}`}>
        Press an object, or tab into the stage and press another. No object
        snippet is passed here, so each one draws its own label — which is an
        honest stage rather than a drawing of a deck nobody has made.
      </ScreenNote>
    </div>
  </Entry>

  <Entry
    name="ScreenGrid"
    use="A sheet: lettered columns, numbered rows, and a cell you can name. One cursor, held as a roving tabindex, so four hundred coordinates put one stop in the tab order — arrows move it, Home and End reach the ends of the row, Ctrl with either the ends of the sheet, and every move is a selection because a spreadsheet has no state where the cursor sits on a cell that is not selected."
    instead="ScreenTable. A table's columns are named and the names carry the meaning — Name, Kind, Updated — and its rows are records. Here the columns are addresses: a value's identity is A1, it is still A1 when the cell is empty, and neither a row nor a column is a thing the model identifies. That is why the headings open nothing, why columns is a count rather than a list of names, and why there are no sheet tabs — a tab is a spreadsheet."
    code={CODE.grid}
    width="screen"
  >
    <div class="flex flex-col gap-3 p-4">
      <ScreenGrid label="Storm cost model" columns={6} rows={12} bind:address={cursor} range="B2:C5">
        {#snippet cell(spot)}
          <ScreenGridCell address={spot.address} align={spot.column === "A" ? "start" : "end"}>
            {SHEET[spot.address] ?? ""}
          </ScreenGridCell>
        {/snippet}
      </ScreenGrid>
      <ScreenNote meta={`Cursor: ${cursor}`}>
        Click a cell and use the arrow keys. The row and column headings mark
        themselves as you move, which is the job a name box would otherwise be
        doing — without taking a row off the only thing this screen is. Every
        coordinate is drawn, populated or not.
      </ScreenNote>
    </div>
  </Entry>

  <Entry
    name="ScreenGridCell"
    use="One coordinate: what it shows, and what it cannot show. A spilled cell, a cell in error and a read-only cell each carry a glyph and a word — the glyph to be seen at a glance, the word in the accessible name and the tooltip — so the tint is the third channel rather than the only one."
    instead="ScreenCell. That cell belongs to a row that is a record, and its name prop is both the row's identity and its click target. This has no name of that kind, and it is not a button: four hundred buttons in the tab order is a wall, not a sheet. Selection is not a prop either — whether the cursor is here, and whether this falls inside the marked range, are read from the grid by address, because passing them in would let two coordinates both claim to be the one you are on."
    code={CODE.gridCell}
    width="screen"
  >
    <div class="flex flex-col gap-3 p-4">
      <ScreenGrid label="Per-customer minutes" columns={4} rows={6}>
        {#snippet cell(spot)}
          {@const marked = MARKS[spot.address]}
          <ScreenGridCell
            address={spot.address}
            align={spot.column === "A" ? "start" : "end"}
            state={marked?.state}
            note={marked?.note}
          >
            {marked?.value ?? ""}
          </ScreenGridCell>
        {/snippet}
      </ScreenGrid>
      <ScreenNote>
        Hover D3 and C5. The header row is read-only, column D is one formula in
        D2 spilling down into the two cells under it, and C5 divides by a
        customer count of zero — none of which the value itself could have said.
      </ScreenNote>
    </div>
  </Entry>

  <Entry
    name="ScreenSplit"
    use="Two halves and the operation between them, in a middle column exactly as wide as the sign. The operator is a symbol and a word in one prop, so neither can arrive without the other, and only the word is read out — hearing “minus minus” helps nobody."
    instead="two ScreenGroups side by side. That reads as two lists, and Include and Take out are not “things in” and “other things in” — they are a subtraction, and the sign between them is the only thing on the screen that says so. The nested expression tree was removed on the strength of that argument. Narrow the plane and the operator becomes the middle row rather than moving away: a sign no longer between the two things it relates has stopped saying anything. It is not a control — what relates the halves is decided where the set is defined."
    code={CODE.split}
    width="screen"
  >
    <div class="p-4">
      <ScreenSplit operator={{ symbol: "−", word: "minus" }}>
        {#snippet left()}
          <ScreenGroup label="Include" tone="success" count="248 resources">
            <ScreenCards min="11rem">
              <ScreenCard title="Everything under Filings" sub="Folder rule" />
              <ScreenCard title="Anything tagged Storm" sub="Tag rule" />
            </ScreenCards>
          </ScreenGroup>
        {/snippet}
        {#snippet right()}
          <ScreenGroup label="Take out" tone="danger" count="12 resources">
            <ScreenCards min="11rem">
              <ScreenCard title="Superseded drafts" sub="Tag rule" />
            </ScreenCards>
          </ScreenGroup>
        {/snippet}
      </ScreenSplit>
    </div>
  </Entry>

  <Entry
    name="ScreenComposer"
    use="Where a person writes the thing that gets sent, at the foot of a screen that owns one. The scope is required and sits beside the send control, because a request states what it will be able to see where the request is written; the keystroke is drawn on keycaps, because the one that is not bound has to stay a newline and nobody can guess which."
    instead="PanelEditableText, which hands back a value already on the screen beside it, commits on blur and puts the old text back on Escape — none of which means anything for something that does not exist yet. Not the Copilot's bar either: that one belongs to no tab, lives in the status bar, and is disabled on Research precisely because that screen already has one of these."
    code={CODE.composer}
    width="screen"
  >
    <div class="flex flex-col gap-3 p-4">
      <ScreenComposer
        label="Ask the Research agent"
        placeholder="Ask about the project's filings…"
        bind:value={draft}
        sendLabel="Ask"
        onsend={(message) => (sent = message)}
      >
        {#snippet about()}
          <PanelChip tone="intelligence">Research</PanelChip>
          <span class="text-caption text-ink-muted">Answering turn 4</span>
        {/snippet}
        {#snippet scope()}
          <PanelChip tone="interactive">Context: Filings</PanelChip>
          <PanelChip tone="inactive">Web off</PanelChip>
        {/snippet}
      </ScreenComposer>
      <ScreenNote meta={sent === "" ? "Nothing sent yet" : `Sent: “${sent}”`}>
        Write something and press Ctrl-Enter, or the button. The field keeps what
        is in it — the composer never clears itself, because a send can fail and
        the caller clears the value once it has actually happened.
      </ScreenNote>
    </div>
  </Entry>

  <Entry
    name="PanelActor face"
    use="The picture on its own, for a workspace card whose own title already carries the name. What face drops is the visible name, never the accessible one — the circle keeps a tooltip and the name stays in the card's reading order."
    instead="a screen-scale actor of its own. A second renderer of one object is exactly the drift this component exists to prevent — a persona screen hand-rolled a 56px initials circle because there was no word for one — so a workspace asks the panel word for a size. Setting the name twice on one card is what face is here to stop."
    code={CODE.face}
  >
    <div class="p-3">
      <ScreenCards min="11rem">
        <ScreenCard title="Grid Analyst" sub="Agent · 41 tasks run">
          {#snippet thumb()}
            <PanelActor name="Grid Analyst" kind="agent" size="face" onselect={() => {}} />
          {/snippet}
        </ScreenCard>
        <ScreenCard title="Filing Editor" sub="Agent · 12 tasks run">
          {#snippet thumb()}
            <PanelActor name="Filing Editor" kind="agent" size="face" onselect={() => {}} />
          {/snippet}
        </ScreenCard>
      </ScreenCards>
    </div>
  </Entry>

  <Entry
    name="PanelSentence size"
    use="One prop for where the rule is being read: row inside a panel, head where the sentence is the heading of the screen that edits it. The clauses stay selectable at either size, and the connective words stay the component's."
    instead="a ScreenSentence beside it. The whole reason this is a component is that the library, the lens and the editor heading must not read one rule three ways — a screen-scale copy would be the third way. A workspace that needs the rule bigger asks for a size, not a second word."
    code={CODE.sentence}
  >
    <div class="flex flex-col gap-4 p-3">
      <PanelSentence size="head" lead="Every time" join="ask" onwhen={() => {}} onthen={() => {}}>
        {#snippet when()}the clock reaches 02:00 in New York{/snippet}
        {#snippet then()}Filing Editor to summarise last night's reports{/snippet}
      </PanelSentence>
      <PanelSentence size="row">
        {#snippet when()}a resource is added under Filings{/snippet}
        {#snippet then()}Grid Analyst to extract its relay figures{/snippet}
      </PanelSentence>
      <PanelSentence size="row" tone="inactive">
        {#snippet when()}a filing is marked superseded{/snippet}
        {#snippet then()}Filing Editor to retire its summary{/snippet}
      </PanelSentence>
    </div>
  </Entry>
</section>
