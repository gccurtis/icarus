<script lang="ts">
  import ChartColumn from "@lucide/svelte/icons/chart-column";
  import Clock from "@lucide/svelte/icons/clock";
  import FileText from "@lucide/svelte/icons/file-text";
  import Link2 from "@lucide/svelte/icons/link-2";
  import RefreshCw from "@lucide/svelte/icons/refresh-cw";
  import Table from "@lucide/svelte/icons/table";

  import Entry from "$development-views/vocabulary/components/entry.svelte";
  import SectionTitle from "$development-views/vocabulary/components/section-title.svelte";
  import {
    PanelBanner,
    PanelBranch,
    PanelButton,
    PanelChoice,
    PanelDiff,
    PanelEmpty,
    PanelField,
    PanelFields,
    PanelRow,
    PanelSteps,
    PanelTimeline,
    PanelToggle,
    PanelTree
  } from "$authored-components/panel";

  /**
   * The words for an order, a nesting, a change, and a panel with nothing in it
   * — plus the three props that change what an existing word is.
   *
   * The sample content is illustrative and deliberately obvious. A feed of six
   * plausible events is the one thing on this page that could be mistaken for a
   * working activity log, so the events say what they are rather than what a
   * project's would.
   *
   * Where an example holds state it is because the shape cannot be judged
   * without it: a branch that will not open, a switch that will not move and a
   * choice that cannot be chosen demonstrate nothing.
   */

  /**
   * Times are strings the caller has already phrased — the component takes no
   * view on the reader's locale, and neither does this page.
   */
  const FEED = [
    {
      id: "sync",
      what: "Google Drive — Filings finished syncing",
      detail: "212 files",
      time: "09:14",
      icon: RefreshCw,
      tone: "success"
    },
    {
      id: "edit",
      what: "Ana Reyes changed the storm cost model",
      detail: "Rows 12–48",
      time: "10:02",
      actor: "Ana Reyes"
    },
    {
      id: "mention",
      what: "Tomas Kaur mentioned you in the Q3 Resilience Memo",
      detail: "“can you confirm 1,842,000 against the relay log?”",
      time: "11:37",
      actor: "Tomas Kaur",
      tone: "active"
    },
    {
      id: "expiry",
      what: "SharePoint — Ops Reports stopped syncing",
      detail: "Authentication expired",
      time: "Just now",
      icon: Link2,
      tone: "danger"
    }
  ] as const;

  /** Two of them are underway at once, which is why no step carries a number. */
  const PLAN = [
    {
      id: "gather",
      label: "Gather the relay logs",
      detail: "Three substations",
      meta: "4s",
      state: "done"
    },
    {
      id: "read",
      label: "Read the storm cost model",
      detail: "Rows 12–48",
      meta: "2s",
      state: "done"
    },
    {
      id: "compare",
      label: "Compare against the filing draft",
      detail: "The draft has no 2026 column",
      state: "failed"
    },
    {
      id: "chart",
      label: "Draw the outage chart",
      detail: "Two of three storm events",
      state: "running"
    },
    {
      id: "summarise",
      label: "Write the summary",
      detail: "Waits for the chart",
      state: "waiting"
    },
    {
      id: "post",
      label: "Post the summary to the board deck",
      detail: "No deck was chosen",
      state: "skipped"
    }
  ] as const;

  /** The branch example selects and opens for real — both are what it is about. */
  let node = $state("substations");
  let terms = $state(false);
  let regions = $state(false);
  const allOpen = $derived(terms && regions);

  let digest = $state(true);
  let relay = $state(false);

  let ratio = $state("16-9");
  let numbers = $state("from-2");
  let scope = $state("slide");

  const CODE = {
    timeline: `<PanelSection title="Activity" count={4} flush>
  <PanelTimeline
    label="Project activity"
    entries={feed.entries}
    empty="Nothing has happened here yet."
  />
</PanelSection>

<!-- entries[n] -->
{ id: "edit", actor: "Ana Reyes", time: "10:02",
  what: "Ana Reyes changed the storm cost model",
  detail: "Rows 12–48",
  onselect: () => workbench.inspect("project.resource") }`,
    steps: `<PanelSteps label="Storm review — plan" steps={task.steps} />

<!-- steps[n] -->
{ id: "compare", state: "failed",
  label: "Compare against the filing draft",
  detail: "The draft has no 2026 column",
  meta: "1m 12s" }`,
    tree: `<PanelTree label="Q3 Resilience Memo outline">
  <PanelBranch label="Storm events" icon={FileText} meta="3">
    <PanelBranch label="January" meta="2">
      <PanelBranch label="Northwind West" />
    </PanelBranch>
  </PanelBranch>

  <!-- nothing under it: no twisty, and the label still lines up -->
  <PanelBranch label="Appendix" icon={FileText} />
</PanelTree>`,
    branch: `<PanelBranch
  label="Substations"
  meta="3"
  icon={Table}
  bind:open={terms}
  selected={node === "substations"}
  onselect={() => workbench.inspect("context.term")}
>
  <PanelBranch label="Northwind West" onselect={…} />
</PanelBranch>

<!-- given onselect, the twisty and the label are two controls;
     without it the whole head toggles -->`,
    diff: `<PanelDiff
  before={anchor.asWritten}
  after={anchor.nowReads}
/>

<!-- short values can take the split -->
<PanelDiff
  before="1,842,000" after="1,904,500"
  beforeLabel="In the template" afterLabel="The resource has"
  layout="side" mono
/>`,
    empty: `<PanelEmpty
  title="No comments on this slide yet."
  action="Write the first"
  onaction={() => (composing = true)}
/>

<PanelEmpty
  kind="no-matches"
  title="No resource here matches “storm”."
  action="Clear the filter"
  onaction={() => (query = "")}
/>`,
    banner: `<PanelBanner title="SharePoint can't sync" tone="danger">
  Authentication expired 6 days ago. Nothing from this
  connector has changed since.
  {#snippet actions()}
    <PanelButton label="Reconnect" tone="primary"
      onclick={() => workbench.inspect("project.connector")} />
  {/snippet}
</PanelBanner>`,
    control: `<PanelRow
  title="Nightly filing digest"
  sub="Runs every day"
  icon={Clock}
  meta="06:00"
  onselect={() => workbench.inspect("automation.rule")}
>
  {#snippet control()}
    <PanelToggle
      checked={rule.on}
      label="Nightly filing digest"
      onchange={(next) => (rule.on = next)}
    />
  {/snippet}
</PanelRow>`,
    depth: `<PanelRow title="Q3 Resilience Memo" icon={FileText} onselect={…} />
<PanelRow title="Summary" depth={1} onselect={…} />
<PanelRow title="What it costs" depth={2} onselect={…} />
<PanelRow title="Per-substation table" depth={3} onselect={…} />

<!-- indent says depth={1} in one word -->
<PanelRow title="Storm events" indent onselect={…} />`,
    flush: `<!-- alone in the body: label is the accessible name, undrawn -->
<PanelChoice label="What these comments are on" value={scope}
  options={SCOPES} onchange={(next) => (scope = next)} />

<!-- with a visible label: nest it, and drop the second gutter -->
<PanelFields>
  <PanelField label="Ratio">
    <PanelChoice label="Slide ratio" value={ratio} flush
      options={[
        { value: "16-9", label: "16:9" },
        { value: "4-3", label: "4:3" }
      ]}
      onchange={(next) => (ratio = next)} />
  </PanelField>
</PanelFields>`
  };
</script>

<section class="flex flex-col gap-8">
  <SectionTitle title="Order, nesting, change and state" source="src/lib/components/authored/panel/">
    Five shapes the panel vocabulary had no word for — an order, a plan, a
    nesting, a change, and a panel with nothing in it — and three props that
    change what an existing word is. Each one is here because the word nearest it
    was being made to do the job and was reading wrong while it did.
  </SectionTitle>

  <Entry
    name="PanelTimeline"
    use="Events on a rail, in the order they happened: an activity feed, a thread's history, a connector's sync record. Always retrospective — these occurred, in this order, and nothing about them is going to change. The time is a string the caller has already phrased, because a component that formatted it would be a second opinion about the reader's locale."
    instead="a list of PanelRows. A row list has no ordering cue, so a feed read from the bottom up reads exactly like one read from the top down and the order has to be taken on trust from the times at the right-hand end. The rail is the ordering, which is why this is an ol as well: the sequence is the content rather than a way of arranging it."
    code={CODE.timeline}
  >
    <div class="py-3">
      <PanelTimeline label="Project activity" entries={FEED} />
    </div>
  </Entry>

  <Entry
    name="PanelSteps"
    use="A plan, and what has become of each step in it: an agent task's plan, an import's stages, a rule's dispatch. Prospective — this is what is meant to happen, and the five states say how far that intention has got. Each state is a fixed word, a fixed shape and a role together, decided here once rather than per surface."
    instead="a timeline. A timeline is what happened; a plan is what is meant to happen, and drawn alike they read alike — a reader cannot tell a step that failed from an event that occurred. So this one has no rail, and every line carries a state instead."
    code={CODE.steps}
  >
    <div class="py-3">
      <PanelSteps label="Storm review — plan" steps={PLAN} />
    </div>
  </Entry>

  <Entry
    name="PanelTree"
    use="Nested lines that disclose: a lattice, a document outline, a Context's terms — anything whose shape is the data's rather than the view's. The group; PanelBranch is a node in it, and the panel's gutter belongs here so a branch nested four deep does not add it again at every level."
    instead="PanelRow with depth. Indentation says where a line sits and nothing else, so a forty-node lattice drawn as indented rows is forty rows however narrow the thing being looked for. Disclosure is the difference: a shut branch is one line whatever is under it, and depth costs nothing until it is opened."
    code={CODE.tree}
  >
    <div class="py-3">
      <PanelTree label="Q3 Resilience Memo outline">
        <PanelBranch label="Summary" icon={FileText} meta="2" open>
          <PanelBranch label="What we are asking for" />
          <PanelBranch label="What it costs" />
        </PanelBranch>
        <PanelBranch label="Storm events" icon={FileText} meta="3">
          <PanelBranch label="January" meta="2">
            <PanelBranch label="Northwind West" />
            <PanelBranch label="Northwind East" />
          </PanelBranch>
          <PanelBranch label="March" />
          <PanelBranch label="October" />
        </PanelBranch>
        <PanelBranch label="Appendix" icon={FileText} />
      </PanelTree>
    </div>
  </Entry>

  <Entry
    name="PanelBranch"
    use="One node of a tree: a line, and whatever is under it. Indentation comes from the nesting rather than from a number the caller counts and carries down, and given onselect the twisty and the label become two controls — opening a branch and opening its subject are two acts."
    instead="a branch with nothing under it. An empty disclosure is a control that lies: it offers to open something and opens nothing, and a reader who presses two of them stops trusting the rest. children is what decides whether a twisty is drawn at all, and a snippet rendering an empty list is the same lie with more steps."
    code={CODE.branch}
  >
    <div class="flex flex-col gap-2 py-3">
      <div class="px-3">
        <PanelButton
          label={allOpen ? "Collapse all" : "Expand all"}
          onclick={() => {
            const next = !allOpen;
            terms = next;
            regions = next;
          }}
        />
      </div>
      <PanelTree label="Context terms">
        <PanelBranch
          label="Substations"
          meta="3"
          icon={Table}
          bind:open={terms}
          selected={node === "substations"}
          onselect={() => (node = "substations")}
        >
          <PanelBranch
            label="Northwind West"
            selected={node === "west"}
            onselect={() => (node = "west")}
          />
          <PanelBranch
            label="Northwind East"
            selected={node === "east"}
            onselect={() => (node = "east")}
          />
        </PanelBranch>
        <PanelBranch
          label="Regions"
          meta="2"
          icon={Table}
          bind:open={regions}
          selected={node === "regions"}
          onselect={() => (node = "regions")}
        >
          <PanelBranch label="Coastal" selected={node === "coastal"} onselect={() => (node = "coastal")} />
          <PanelBranch label="Inland" selected={node === "inland"} onselect={() => (node = "inland")} />
        </PanelBranch>
        <PanelBranch label="Outage events" meta="0" icon={Table} selected={node === "events"} onselect={() => (node = "events")} />
      </PanelTree>
    </div>
  </Entry>

  <Entry
    name="PanelDiff"
    use="Two versions of one piece of text with what changed marked: a comment anchor whose text has moved under it, a stale value, a resource that has drifted from its template. The sides are named for what they are rather than for when they were — 'As written' and 'Now reads' — because a reader can map those onto their own situation."
    instead="two PanelFields. Two labelled values set near each other invite the reader to compare them character by character, and that comparison is the work this exists to do for them. The marks are del and ins, struck through and underlined, so the change survives a reader who cannot separate the two colours."
    code={CODE.diff}
  >
    <div class="flex flex-col gap-3 py-3">
      <PanelDiff
        before="Undergrounded segments lost 38% fewer customer-minutes across the three storm events."
        after="Undergrounded segments lost 41% fewer customer-minutes across the two winter storm events."
      />
      <PanelDiff
        before="1,842,000"
        after="1,904,500"
        beforeLabel="In the template"
        afterLabel="The resource has"
        layout="side"
        mono
      />
    </div>
  </Entry>

  <Entry
    name="PanelEmpty"
    use="A panel with nothing in it, saying what belongs there and offering the way on. The two kinds also look different: nothing-yet outlines the shape of the missing thing in the place it will appear, and no-matches draws no frame at all, because that list is not missing — it is hidden."
    instead="PanelNote. A note is prose at the foot of a body; this is the body, standing where the rows would have been, and it has a control in it. A footnote with a button in it is the thing that put controls under lists of unbounded length in the first place."
    code={CODE.empty}
  >
    <div class="flex flex-col gap-3 py-3">
      <PanelEmpty title="No comments on this slide yet." action="Write the first" onaction={() => {}} />
      <PanelEmpty
        kind="no-matches"
        title="No resource here matches “storm”."
        action="Clear the filter"
        onaction={() => {}}
      />
    </div>
  </Entry>

  <Entry
    name="PanelBanner"
    use="A statement that something is wrong, made inside a flank, with a way to act on it. It always carries an action or a reason and the type says so — the props are a union, so a banner that only worries will not compile. The one place a panel may reach for the danger role, which is what makes it worth anything."
    instead={`PanelNote tone="gap". A gap note says the model cannot store this — a permanent limitation of the surface, true before the reader arrived and true after they leave. A banner says something is wrong right now, in this project, about this thing. Drawing the two the same way teaches a reader to read past both.`}
    code={CODE.banner}
  >
    <div class="flex flex-col gap-3 py-3">
      <PanelBanner title="SharePoint can't sync" tone="danger">
        Authentication expired 6 days ago. Nothing from this connector has
        changed since.
        {#snippet actions()}
          <PanelButton label="Reconnect" tone="primary" onclick={() => {}} />
        {/snippet}
      </PanelBanner>
      <PanelBanner title="This deck is 4:3">
        Every other deck in the project is 16:9. Slides copied in will be
        letterboxed.
      </PanelBanner>
      <PanelBanner title="Two figures disagree" tone="intelligence">
        The memo says 1,842,000 and the relay log says 1,904,500.
        {#snippet actions()}
          <PanelButton label="Show both" onclick={() => {}} />
          <PanelButton label="Dismiss" tone="ghost" onclick={() => {}} />
        {/snippet}
      </PanelBanner>
    </div>
  </Entry>

  <Entry
    name="PanelRow control"
    use="A control at the row's end: a switch, a remove, an overflow menu. Its presence changes what the row is — a row with an onselect and nothing else is a button, and a button cannot hold another button, so a row with a control becomes a container and the title inside it becomes the button instead."
    instead="a value at the right-hand end. That is meta, which is a time or a count and never a control. A row may carry both, and the control is always last."
    code={CODE.control}
  >
    <div class="py-3">
      <PanelRow
        title="Nightly filing digest"
        sub="Runs every day"
        icon={Clock}
        meta="06:00"
        onselect={() => {}}
      >
        {#snippet control()}
          <PanelToggle
            checked={digest}
            label="Nightly filing digest"
            onchange={(next) => (digest = next)}
          />
        {/snippet}
      </PanelRow>
      <PanelRow title="Relay log watch" sub="Paused" icon={Clock} onselect={() => {}}>
        {#snippet control()}
          <PanelToggle checked={relay} label="Relay log watch" onchange={(next) => (relay = next)} />
        {/snippet}
      </PanelRow>
      <PanelRow title="Storm cost model" sub="Spreadsheet · in this Context" icon={ChartColumn}>
        {#snippet control()}
          <PanelButton label="Take out" tone="ghost" onclick={() => {}} />
        {/snippet}
      </PanelRow>
    </div>
  </Entry>

  <Entry
    name="PanelRow depth"
    use="How many levels in the row sits, for a list nested more than once — a document outline by heading level, a question and its children. indent is depth 1 by another name, and where both are given the deeper of the two wins."
    instead="a nesting the data decides. Depth is capped at three, because a fourth step leaves the title nowhere to be — a shape that is as deep as the data says, and that has to collapse, is PanelTree."
    code={CODE.depth}
  >
    <div class="py-3">
      <PanelRow title="Q3 Resilience Memo" icon={FileText} onselect={() => {}} />
      <PanelRow title="Summary" depth={1} onselect={() => {}} />
      <PanelRow title="What we are asking for" depth={2} onselect={() => {}} />
      <PanelRow title="What it costs" depth={2} onselect={() => {}} />
      <PanelRow title="Per-substation table" depth={3} onselect={() => {}} />
      <PanelRow title="Storm events" indent sub="indent — depth 1 by another name" onselect={() => {}} />
    </div>
  </Entry>

  <Entry
    name="PanelChoice flush"
    use="How a choice gets a visible label. Its own label is the accessible name and is never drawn, so a choice that has to be named beside other fields goes inside a PanelField — the vocabulary's word for a label beside a value — and sets flush, which drops the panel gutter so the two do not stack."
    instead="a choice standing alone in the body. There it keeps the panel's gutter and lines up with the rows above it; flush is only for a choice already inside a padded region."
    code={CODE.flush}
  >
    <div class="flex flex-col gap-3 py-3">
      <PanelChoice
        label="What these comments are on"
        value={scope}
        options={[
          { value: "deck", label: "Deck" },
          { value: "slide", label: "Slide 4" },
          { value: "element", label: "Element" }
        ]}
        onchange={(next) => (scope = next)}
      />
      <PanelFields>
        <PanelField label="Ratio">
          <PanelChoice
            label="Slide ratio"
            value={ratio}
            flush
            options={[
              { value: "16-9", label: "16:9" },
              { value: "4-3", label: "4:3" }
            ]}
            onchange={(next) => (ratio = next)}
          />
        </PanelField>
        <PanelField label="Page numbers">
          <PanelChoice
            label="Page numbers"
            value={numbers}
            flush
            options={[
              { value: "all", label: "All" },
              { value: "from-2", label: "From 2" },
              { value: "none", label: "None" }
            ]}
            onchange={(next) => (numbers = next)}
          />
        </PanelField>
      </PanelFields>
    </div>
  </Entry>
</section>
