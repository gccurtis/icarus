<script lang="ts">
  import Entry from "$views/development/vocabulary/components/entry.svelte";
  import SectionTitle from "$views/development/vocabulary/components/section-title.svelte";
  import {
    PanelColor,
    PanelMeter,
    PanelNote,
    PanelProgress,
    PanelSentence,
    PanelStat,
    PanelStats,
    PanelSwatch,
    PanelSwatches,
    PanelTable
  } from "$components/authored/panel";

  /**
   * The words a panel uses to show rather than to ask: figures, a level, the
   * colours a thing has, a sample of a table, and a rule read as prose.
   *
   * Every number below is invented and obviously so. Where a real panel would
   * report what a lattice has indexed, this reports a literal — the shape is
   * what is on offer, and a figure a reader could believe would be the one claim
   * this page exists not to make.
   *
   * Three examples hold local state, because a swatch you cannot open, a colour
   * you cannot choose and a clause you cannot press prove nothing about the
   * distinctions they are here to draw.
   */

  /** A deck theme's palette. Tokens rather than hexes, so it follows the theme. */
  const PALETTE = [
    { name: "Paper", color: "var(--token-surface-canvas)" },
    { name: "Ink", color: "var(--token-ink-primary)" },
    { name: "Accent 1", color: "var(--token-color-accent-1-fill)" },
    { name: "Accent 2", color: "var(--token-color-accent-2-fill)" }
  ];

  /** The same listing with names too long to wrap, and a value at the end. */
  const SERIES = [
    {
      name: "Peak demand (winter)",
      color: "var(--token-color-accent-1-fill)",
      value: "--token-color-accent-1-fill"
    },
    {
      name: "Peak demand (summer)",
      color: "var(--token-color-accent-2-fill)",
      value: "--token-color-accent-2-fill"
    },
    {
      name: "Customer-minutes lost",
      color: "var(--token-color-intelligence-fill)",
      value: "--token-color-intelligence-fill"
    }
  ];
  let inspected = $state("Peak demand (winter)");

  /** The chooser the listing must never be mistaken for. */
  const THEME_FILLS = [
    { value: "paper", label: "Paper", token: "var(--token-surface-canvas)" },
    { value: "ink", label: "Ink", token: "var(--token-ink-primary)" },
    { value: "accent-1", label: "Accent 1", token: "var(--token-color-accent-1-fill)" },
    { value: "accent-2", label: "Accent 2", token: "var(--token-color-accent-2-fill)" }
  ];
  let fill = $state("accent-2");

  /** Three rows of a variable that holds four thousand of them. */
  const OUTAGE_ROWS = [
    ["SUB-014", "12,480", "1,842,000"],
    ["SUB-027", "3,110", "402,500"],
    ["SUB-031", "8,905", "1,004,220"]
  ];

  /** Which clause of the rule the lens would be on. */
  let clause = $state("the trigger");

  const CODE = {
    stats: `<PanelStats label="Record">
  <PanelStat value="41" label="tasks run" />
  <PanelStat value="2" label="running now" />
  <PanelStat value="1" label="failed" tone="danger" />
</PanelStats>

<!-- two across where a figure or a word is long -->
<PanelStats label="Connector record" columns={2}>
  <PanelStat value="212" label="files synced" />
  <PanelStat value="6" label="files skipped" tone="attention" />
</PanelStats>`,
    stat: `<PanelStat value="128" label="findings accepted" />

<!-- tone restates the label, so the cell that goes red
     is the one whose word is already "failed" -->
<PanelStat value="1" label="failed" tone="danger" />`,
    meter: `<PanelMeter
  label="Indexed"
  detail="88 of 211 resources"
  value={88}
  max={211}
/>

<!-- tone is how the level reads, not whose work it is -->
<PanelMeter label="Replicas healthy" detail="6 of 9"
  value={6} max={9} tone="danger" />`,
    swatches: `<PanelSwatches label="Palette">
  <PanelSwatch name="Paper" color="var(--token-surface-canvas)" />
  <PanelSwatch name="Accent 1"
    color="var(--token-color-accent-1-fill)" />
</PanelSwatches>

<!-- long names, or values shown: one per line -->
<PanelSwatches label="Series colours" layout="column">
  <PanelSwatch ... />
</PanelSwatches>`,
    swatch: `<PanelSwatch
  name="Peak demand (winter)"
  color="var(--token-color-accent-1-fill)"
  value="--token-color-accent-1-fill"
  selected={series === "winter"}
  onselect={() => workbench.inspect("chart.series")}
/>

<!-- a listing that is only a listing: no onselect -->
<PanelSwatch name="Paper" color="var(--token-surface-canvas)" />`,
    table: `<PanelTable
  columns={["Substation", "Customers", "Minutes lost"]}
  rows={sample.rows}
  total={4182}
/>

<!-- total is not optional; unit says what it counts -->
<PanelTable columns={["Field", "Value"]} rows={[]}
  total={0} unit="fields"
  empty="The variable resolved to nothing." />`,
    sentence: `<PanelSentence
  size="head"
  lead="When"
  join="ask"
  onwhen={() => workbench.inspect("automation.trigger")}
  onthen={() => workbench.inspect("automation.action")}
>
  {#snippet when()}the clock reaches 02:00 in New York{/snippet}
  {#snippet then()}Filing Editor to summarise last night's
    reports{/snippet}
</PanelSentence>

<!-- in a library row the row opens the rule, so the
     clauses inside it take no handlers -->
<PanelSentence tone="inactive">
  {#snippet when()}a resource lands in Filings{/snippet}
  {#snippet then()}Grid Analyst to check it against the
    relay log{/snippet}
</PanelSentence>`
  };
</script>

<section class="flex flex-col gap-8">
  <SectionTitle title="Figures, colours and claims" source="src/lib/components/authored/panel/">
    Seven words that show rather than ask. Each one is a claim about the thing
    beside it, and each sits one gesture away from a word that would make a
    different claim — a level is not progress, a listing is not a picker, and a
    sample that does not say what it is a sample of has said it is everything.
  </SectionTitle>

  <Entry
    name="PanelStats"
    use="The record band in a flank: the figures a panel reports about its subject, on an even grid so the second figure of one panel sits under the second figure of the panel above it. Two or three across, never four — a 276px body divided four ways leaves 60px, which will not hold “128” over “findings”."
    instead="a sentence in a PanelField. A field is a labelled value and reads one per line; a record reads across, and “41 tasks · 2 running · 128 findings” written as prose becomes two more lines of small grey text nobody scans. Nor ScreenStats — that band is a bordered frame with the rules drawn in the gaps, sized so a cell is a card on the open plane, and at 300px it is a box inside the panel's own box."
    code={CODE.stats}
  >
    <div class="flex flex-col gap-4 py-3">
      <PanelStats label="Record">
        <PanelStat value="41" label="tasks run" />
        <PanelStat value="2" label="running now" />
        <PanelStat value="1" label="failed" tone="danger" />
      </PanelStats>
      <PanelStats label="Connector record" columns={2}>
        <PanelStat value="212" label="files synced" />
        <PanelStat value="6" label="files skipped" tone="attention" />
      </PanelStats>
    </div>
  </Entry>

  <Entry
    name="PanelStat"
    use="One figure and the word for what it counts, the figure above its label always. ScreenStat sets the two side by side and only stacks them where the cell is too narrow; at 300px three across a cell is 84px, so the side-by-side form is never reachable and this does not try for it — a band that reflowed between the two as its numbers grew a digit would move every time it updated. Tabular figures, because these are read down a column of panels and across a band that re-renders as counts move."
    instead="tone carrying information. It restates what the label already says — the cell that goes red is the one whose word is “failed” — so nothing is lost by a reader who cannot see the colour, and a toned figure takes a mark beside it as well, because ink is the only surface a cell this size has."
    code={CODE.stat}
  >
    <div class="py-3">
      <PanelStats label="The four tones" columns={2}>
        <PanelStat value="128" label="findings accepted" />
        <PanelStat value="9" label="sections filled" tone="success" />
        <PanelStat value="6" label="files skipped" tone="attention" />
        <PanelStat value="1" label="failed" tone="danger" />
      </PanelStats>
    </div>
  </Entry>

  <Entry
    name="PanelMeter"
    use="A proportion that is a fact rather than a promise: 88 of 211 resources indexed, 6 of 9 sections filled, a confidence, a share of a budget. It carries the meter role — a level, now — where a bar carries the progressbar role and a promise. The track is drawn as a visible extent rather than left as a groove, because in “88 of 211” the 211 is a real quantity the reader is comparing against."
    instead="PanelProgress. A bar promises the total will be reached — that is what the shape means, and the progressbar role says it out loud to everything that reads the page. A lattice that has indexed 88 of its 211 resources is not heading for 211; it may sit exactly there for the life of the project, because the other 123 are images with no text in them, and a reader shown progress waits for a number that will never move. There is no indeterminate form either: a level nobody has measured is not a fact, so value and detail are both required, and a caller who has neither has progress rather than a meter."
    code={CODE.meter}
  >
    <div class="flex flex-col gap-3 py-3">
      <PanelMeter label="Indexed" detail="88 of 211 resources" value={88} max={211} />
      <PanelProgress label="Indexed" detail="88 of 211 resources" value={42} />
      <PanelNote>
        The same two numbers twice. The meter says the lattice has indexed 88 of
        211. The bar under it says it is on its way to 211, and it is not.
      </PanelNote>
      <PanelMeter label="Sections filled" detail="6 of 9" value={6} max={9} tone="success" />
      <PanelMeter label="Replicas healthy" detail="6 of 9" value={6} max={9} tone="danger" />
      <PanelNote>
        And the same reading twice. Six of nine sections filled is a draft going
        well; six of nine replicas healthy is an incident. Only the caller can
        say which, which is why the tone is the level rather than the job.
      </PanelNote>
      <PanelMeter label="Retrieval confidence" detail="72% confidence" value={72} tone="attention" />
    </div>
  </Entry>

  <Entry
    name="PanelSwatches"
    use="The colours a thing has, listed: a deck theme's four named colours, a chart's series assignment, the key to a status map. layout follows the names — wrap where they are “Paper” and “Accent 1”, column where they are “Peak demand (winter)” or where each carries its value."
    instead="a hand-rolled row of divs. Three panels want this shape — the theme inspector, the theme context and the chart inspector — and without a word for it each writes its own local style block at its own size, which is the tell that a word is missing."
    code={CODE.swatches}
  >
    <div class="flex flex-col gap-4 py-3">
      <PanelSwatches label="Palette">
        {#each PALETTE as swatch (swatch.name)}
          <PanelSwatch name={swatch.name} color={swatch.color} />
        {/each}
      </PanelSwatches>
      <PanelSwatches label="Series colours" layout="column">
        {#each SERIES as swatch (swatch.name)}
          <PanelSwatch name={swatch.name} color={swatch.color} value={swatch.value} />
        {/each}
      </PanelSwatches>
      <PanelNote>
        The same component twice. Four short names wrap into a palette; three
        long ones would give a ragged block where nothing lines up, so they run
        down the column with their values at the end.
      </PanelNote>
    </div>
  </Entry>

  <Entry
    name="PanelSwatch"
    use="One colour, named, in a listing of colours. The colour is content — it comes from whatever the caller is describing, and this vocabulary has no opinion about what it means. The name is the swatch: the square is aria-hidden beside it, the text is required, and there is no prop that turns the words off."
    instead="a PanelChip. A chip is a word with a tone from the role vocabulary — success, attention, intelligence — a closed set where every entry means something, and a theme colour called “Paper” belongs to no such set. It is square where PanelColor's targets are round, and deliberately: this is a sample of material and that is a radio button, so a listing and a chooser never read alike. A selectable swatch opens the lens for its colour; it never sets one."
    code={CODE.swatch}
  >
    <div class="flex flex-col gap-4 py-3">
      <PanelSwatches label="Series colours" layout="column">
        {#each SERIES as swatch (swatch.name)}
          <PanelSwatch
            name={swatch.name}
            color={swatch.color}
            value={swatch.value}
            selected={swatch.name === inspected}
            onselect={() => (inspected = swatch.name)}
          />
        {/each}
      </PanelSwatches>
      <PanelSwatches label="Palette">
        {#each PALETTE as swatch (swatch.name)}
          <PanelSwatch name={swatch.name} color={swatch.color} />
        {/each}
      </PanelSwatches>
      <PanelColor
        label="Fill"
        value={fill}
        options={THEME_FILLS}
        onchange={(next) => (fill = next)}
      />
      <PanelNote>
        Both are real, and they are not the same offer. The squares are a
        listing: pressing one says which colour the panel is now about, and the
        palette under them does not press at all. The circles are PanelColor,
        and pressing one sets the fill.
      </PanelNote>
    </div>
  </Entry>

  <Entry
    name="PanelTable"
    use="A bounded prefix of a tabular value, in a 300px column. A variable holding 4,182 rows still has to show what it holds or a reader cannot tell whether it is the one they meant, and three rows with a count answers that where a scrollable grid in a flank does not. Every column is mono and truncates; what does not fit is on the cell's title."
    instead="a bare row count. total is required and renders as “3 of 4,182 rows”, because a sample that reports its own length claims to be the whole — the same fault matched-of-total guards against in PanelSearch and PanelSection. The prefix is read server-side: this takes rows that are already bounded and has no way to ask for more."
    code={CODE.table}
  >
    <div class="flex flex-col gap-4 py-3">
      <PanelTable
        columns={["Substation", "Customers", "Minutes lost"]}
        rows={OUTAGE_ROWS}
        total={4182}
      />
      <PanelTable
        columns={["Field", "Value"]}
        rows={[]}
        total={0}
        unit="fields"
        empty="The variable resolved to nothing."
      />
    </div>
  </Entry>

  <Entry
    name="PanelSentence"
    use="One rule read as prose, with its clauses still selectable. An Automation is one trigger and one action, and it reads as a sentence rather than as a pair in two columns. A component because three surfaces draw the same rule — the library lists it, the inspector explains it, the editor heads its screen with it — and three hand-written renderings is three ways to read one rule; size is which of the three, not a second component."
    instead="a caller who owns the grammar. “When”, the comma and “ask” are this component's, set in muted ink and part of no clause, which is what lets a clause be pressed without the words around it looking pressable. And a clause is a button only where there is somewhere to go: in a library the whole row opens the rule, so the halves inside it take no handlers and stay inert."
    code={CODE.sentence}
  >
    <div class="flex flex-col gap-3 p-3">
      <PanelSentence
        size="head"
        lead="When"
        join="ask"
        onwhen={() => (clause = "the trigger")}
        onthen={() => (clause = "the action")}
      >
        {#snippet when()}the clock reaches 02:00 in New York{/snippet}
        {#snippet then()}Filing Editor to summarise last night's reports{/snippet}
      </PanelSentence>
      <PanelNote>
        Press either half — both are real controls, and the lens would follow the
        clause. Currently: {clause}. The grammar between them does not press.
      </PanelNote>
      <PanelSentence lead="Every time">
        {#snippet when()}a resource lands in Filings{/snippet}
        {#snippet then()}Grid Analyst to check it against the relay log{/snippet}
      </PanelSentence>
      <PanelSentence tone="inactive" lead="When" join="ask">
        {#snippet when()}a filing is approved{/snippet}
        {#snippet then()}Board Reporter to refresh the October deck{/snippet}
      </PanelSentence>
      <PanelNote>
        The second is a library row: the row opens the rule, so its clauses are
        inert. The third is switched off, and the prose reads spent.
      </PanelNote>
    </div>
  </Entry>
</section>
