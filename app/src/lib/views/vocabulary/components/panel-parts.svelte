<script lang="ts">
  import AtSign from "@lucide/svelte/icons/at-sign";
  import FileText from "@lucide/svelte/icons/file-text";
  import Link2 from "@lucide/svelte/icons/link-2";
  import Settings from "@lucide/svelte/icons/settings";

  import Entry from "$views/vocabulary/components/entry.svelte";
  import SectionTitle from "$views/vocabulary/components/section-title.svelte";
  import {
    Panel,
    PanelActions,
    PanelActor,
    PanelButton,
    PanelChip,
    PanelChoice,
    PanelCode,
    PanelCrumbs,
    PanelFaces,
    PanelField,
    PanelFields,
    PanelLink,
    PanelNote,
    PanelProgress,
    PanelQuote,
    PanelRow,
    PanelSearch,
    PanelSection,
    PanelSkeleton,
    PanelThumb,
    PanelThumbs,
    PanelToggle
  } from "$lib/unique-components/panel";

  /**
   * The panel family, each word shown at the width it will actually be used at.
   *
   * The sample content is illustrative and deliberately obvious — it is here so
   * a shape can be judged, not to suggest anything is wired up. Where a real
   * panel would read a query, this reads a string.
   *
   * Two exceptions, and both are deliberate: a choice you cannot press and a
   * thumbnail you cannot select prove nothing about the shapes they are meant to
   * demonstrate, so those two hold local state.
   */
  let scope = $state("slide");

  /** The search example filters for real — a filter you cannot work says nothing. */
  const RESOURCES = [
    { name: "Q3 Resilience Memo", kind: "Document" },
    { name: "Regulatory Filing Draft", kind: "Document" },
    { name: "Interconnect Failure Review", kind: "Document" },
    { name: "Storm cost model", kind: "Spreadsheet" },
    { name: "Substation Inventory", kind: "Spreadsheet" }
  ];
  let filter = $state("");
  const matches = $derived(
    RESOURCES.filter((resource) =>
      resource.name.toLowerCase().includes(filter.trim().toLowerCase())
    )
  );
  const documents = $derived(matches.filter((resource) => resource.kind === "Document"));
  const spreadsheets = $derived(matches.filter((resource) => resource.kind === "Spreadsheet"));

  const SLIDES = [
    { index: 1, hidden: false },
    { index: 2, hidden: false },
    { index: 3, hidden: true },
    { index: 4, hidden: false }
  ];
  let current = $state(4);

  const CODE = {
    panel: `<Panel title="Health">
  {#snippet actions()}
    <PanelButton label="Open Automations" />
  {/snippet}
  ...
</Panel>`,
    section: `<PanelSection title="Connectors" count={2} flush>
  <PanelRow ... />
</PanelSection>`,
    row: `<PanelRow
  title="SharePoint — Ops Reports"
  sub="Authentication expired 6d ago"
  icon={Link2}
  tone="danger"
  onselect={() => workbench.inspect("project.connector")}
/>

<!-- titleTone when the subject carries the state, not the row -->
<PanelRow title="Storm cost model" sub="Deleted by Ana Reyes"
  icon={FileText} tone="danger" titleTone="danger" />`,
    fields: `<PanelFields>
  <PanelField label="Name" stacked>
    Northwind Grid Resilience
  </PanelField>
  <PanelField label="Members" mono>7</PanelField>
</PanelFields>`,
    chip: `<PanelChip tone="success">Active</PanelChip>
<PanelChip tone="danger">Couldn't start</PanelChip>`,
    quote: `<PanelQuote
  source="Q3 Resilience Memo, ¶4"
  sourceLabel="Source"
  onopen={() => workbench.inspect("project.resource")}
>
  "@ana can you confirm 1,842,000…"
</PanelQuote>`,
    code: `<PanelCode>=IF(E3=0,"",F3*1000000/E3)</PanelCode>`,
    note: `<PanelNote>…</PanelNote>
<PanelNote tone="gap">…</PanelNote>`,
    button: `<PanelActions>
  <PanelButton label="Reconnect" tone="primary" />
  <PanelButton label="Sync now" disabled
    title="Authentication has to be repaired first" />
</PanelActions>`,
    crumbs: `<PanelCrumbs
  trail={[
    { label: "Project", key: "project.self" },
    { label: "Mention" }
  ]}
  onnavigate={(key) => workbench.inspect(key)}
/>`,
    search: `<PanelSearch
  placeholder="Search resources"
  matched={shown.length} total={ALL.length}
  empty="No resource matches that."
  bind:value={query}
  flush
>
  <PanelSection title="Documents" count={3} flush>
    <PanelRow ... />
  </PanelSection>
  <PanelSection title="Slide decks" count={2} flush>…</PanelSection>
</PanelSearch>`,
    progress: `<PanelProgress label="Google Drive — Filings"
  detail="148 of 212 files" value={70} />

<!-- no value: running, extent unknown -->
<PanelProgress label="NERC-2025-winter-review.pdf"
  detail="Extracting" tone="attention" />`,
    skeleton: `{#if resources.loading}
  <PanelSkeleton shape="rows" count={3} />
{:else}
  …
{/if}`,
    faces: `<PanelFaces
  actors={presence.here}
  limit={4}
  onselect={(id) => workbench.inspect(\`actor.\${id}\`)}
  onoverflow={() => selectContext("people")}
/>`,
    link: `<PanelField label="Created by">
  <PanelLink label="Ana Reyes"
    title="Ana Reyes — Owner"
    onselect={() => workbench.inspect("actor.person")} />
</PanelField>`,
    actor: `<PanelActor
  name="Grid Analyst" kind="agent" size="head"
  role="Reads field data and relay logs."
  onselect={() => workbench.inspect("actor.person")}
/>

<PanelField label="Started by">
  <PanelActor name="Nightly filing digest" kind="automation" />
</PanelField>`,
    choice: `<PanelChoice
  label="What these comments are on"
  value={scope}
  options={[
    { value: "deck", label: "Deck" },
    { value: "slide", label: "Slide 4" },
    { value: "element", label: "Element" }
  ]}
  onchange={(next) => (scope = next)}
/>`,
    thumb: `<PanelThumbs across={2}>
  {#each deck.slides as slide (slide.id)}
    <PanelThumb
      caption={String(slide.index)}
      hidden={slide.hidden}
      selected={slide.id === current}
      onselect={() => editor.goTo(slide.id)}
    />
  {/each}
</PanelThumbs>`,
    toggle: `<PanelField label="On">
  <PanelToggle checked label="The rule is on" />
</PanelField>

<PanelRow title="Nightly filing digest">
  <PanelToggle label="Nightly filing digest" checked />
</PanelRow>`
  };
</script>

<section class="flex flex-col gap-8">
  <SectionTitle title="Panel vocabulary" source="src/lib/unique-components/panel/">
    A flank is 300px and vertical. Every example below is shown at that width,
    because a shape that reads well at 800px and breaks at 300 is exactly what
    this page exists to catch.
  </SectionTitle>

  <Entry
    name="Panel"
    use="The frame every context view and inspector lens is built in. Three bands: an optional trail, a title with its controls, and the body. The body scrolls; nothing else does."
    instead="a pinned band at the bottom. Controls go at the top — a button below content of unbounded length is a button nobody finds — and anything the panel wants to say after its contents is a PanelNote at the end of the body."
    code={CODE.panel}
  >
    <Panel title="Health">
      {#snippet actions()}
        <PanelButton label="Open Automations" />
      {/snippet}
      <PanelSection title="Connectors" count={2} flush>
        <PanelRow title="SharePoint — Ops Reports" sub="Authentication expired" icon={Link2} tone="danger" onselect={() => {}} />
        <PanelRow title="Google Drive — Filings" sub="Synced 2h ago" icon={Link2} tone="success" onselect={() => {}} />
      </PanelSection>
    </Panel>
  </Entry>

  <Entry
    name="PanelSection"
    use="One disclosure: a heading, a count, and what it holds. Which sections start open is the disclosure decision — what you came for is open, what qualifies it is shut."
    instead="grouping two unrelated things. A section is a claim that its contents belong together."
    code={CODE.section}
  >
    <div class="py-2">
      <PanelSection title="Needs you" count={2} flush>
        <PanelRow title="4 mentions" sub="Unread" icon={AtSign} tone="active" onselect={() => {}} />
        <PanelRow title="SharePoint can't sync" sub="Authentication expired" icon={Link2} tone="danger" onselect={() => {}} />
      </PanelSection>
      <PanelSection title="Dates" open={false}>
        <PanelFields><PanelField label="Created" mono>12 Mar 2026</PanelField></PanelFields>
      </PanelSection>
    </div>
  </Entry>

  <Entry
    name="PanelRow"
    use="A line in a list: an icon, what it is, what qualifies it, and when. The most repeated shape in the application — a resource, a mention, a task and a tool permission are all this. tone colours the icon; titleTone colours the name too, for the rarer row whose subject is what carries the state."
    instead="a label and a value. That is PanelField — a row's subtitle qualifies its title, it does not describe it."
    code={CODE.row}
  >
    <div class="py-2">
      <PanelRow title="Q3 Resilience Memo" sub="Document · 4 minutes ago" icon={FileText} onselect={() => {}} />
      <PanelRow title="SharePoint — Ops Reports" sub="Authentication expired 6d ago" icon={Link2} tone="danger" onselect={() => {}} />
      <PanelRow
        title="Storm cost model"
        sub="Deleted by Ana Reyes"
        icon={FileText}
        tone="danger"
        titleTone="danger"
        onselect={() => {}}
      />
      <PanelRow title="Regulatory Filing Draft" sub="Not selectable — no onselect" icon={FileText} />
    </div>
  </Entry>

  <Entry
    name="PanelFields · PanelField"
    use="Facts about one thing, as a description list. The label column is fixed so values line up between panels."
    instead="a long value set beside its label. Pass stacked and it takes the full width."
    code={CODE.fields}
  >
    <div class="py-2">
      <PanelFields>
        <PanelField label="Name" stacked>Northwind Grid Resilience</PanelField>
        <PanelField label="Status"><PanelChip tone="success">Active</PanelChip></PanelField>
        <PanelField label="Members" mono>7</PanelField>
        <PanelField label="Updated" mono>4 minutes ago</PanelField>
      </PanelFields>
    </div>
  </Entry>

  <Entry
    name="PanelChip"
    use="A small tinted label carrying a state or a category, in the roles the colour system names."
    instead="colour on its own. A chip always has a word in it — the tint is a second channel."
    code={CODE.chip}
  >
    <div class="flex flex-wrap gap-1 p-3">
      <PanelChip tone="success">Active</PanelChip>
      <PanelChip tone="danger">Couldn't start</PanelChip>
      <PanelChip tone="attention">Inference</PanelChip>
      <PanelChip tone="active">Running</PanelChip>
      <PanelChip tone="intelligence">In the lattice</PanelChip>
      <PanelChip tone="interactive">Owner</PanelChip>
      <PanelChip tone="accent-1">Question</PanelChip>
      <PanelChip tone="accent-2">Proposed</PanelChip>
      <PanelChip tone="inactive">41 tasks</PanelChip>
      <PanelChip>Neutral</PanelChip>
    </div>
  </Entry>

  <Entry
    name="PanelQuote"
    use="Content quoted verbatim from somewhere else — a comment, an instruction sent to an agent, the passage a finding rests on."
    instead="a quote with nowhere to go back to. Showing a fragment and no reference strips the context that made it mean something. The reference sits inside the box, so the quotation and where it came from are one object; sourceLabel prefixes it where it could be misread as part of the quote."
    code={CODE.quote}
  >
    <div class="flex flex-col gap-3 py-3">
      <PanelQuote source="Q3 Resilience Memo, ¶4" sourceLabel="Source" onopen={() => {}}>
        “@ana can you confirm 1,842,000 against the relay log?”
      </PanelQuote>
      <PanelQuote tone="intelligence" source="Storm review · run 12" onopen={() => {}}>
        Across the three storm events, undergrounded segments lost 38% fewer
        customer-minutes…
      </PanelQuote>
    </div>
  </Entry>

  <Entry
    name="PanelCode"
    use="A formula, an expression, or a call's arguments — mono, whitespace preserved, wrapping rather than scrolling."
    instead="an identifier inside a sentence. That is a mono PanelField."
    code={CODE.code}
  >
    <div class="py-3">
      <PanelCode>{`=IF(E3=0,"",F3*1000000/E3)`}</PanelCode>
    </div>
  </Entry>

  <Entry
    name="PanelNote"
    use="A line of explanation under what it explains. Panels here say why: a rule that is not obvious, a control absent on purpose, a count that means something narrower than it looks."
    instead="an ordinary caption. The gap tone marks something the model cannot store, and must stay distinct from passing advice."
    code={CODE.note}
  >
    <div class="flex flex-col gap-2 py-3">
      <PanelNote>
        Values are stored, not formulas — a formula reads the value when it runs.
      </PanelNote>
      <PanelNote tone="gap">
        A zero-member Context currently broadens retrieval to the whole project.
        Blocked until an explicit-empty sentinel exists.
      </PanelNote>
    </div>
  </Entry>

  <Entry
    name="PanelActions · PanelButton"
    use="Controls, in the action row under the title or beside what they act on. simple-components/button at its 24px size, so the press, the focus ring and the disabled handling are the registry's rather than redrawn."
    instead="a permanently impossible action. A disabled button carries its reason in title; one that can never work should not be drawn."
    code={CODE.button}
  >
    <div class="py-3">
      <PanelActions>
        <PanelButton label="Reconnect" tone="primary" />
        <PanelButton label="Sync now" disabled title="Authentication has to be repaired first" />
        <PanelButton label="Disconnect" tone="danger" />
        <PanelButton label="Settings" icon={Settings} tone="ghost" />
      </PanelActions>
    </div>
  </Entry>

  <Entry
    name="PanelCrumbs"
    use="Where the inspected thing sits, and the way back up. Ancestors are navigable; the last entry is a label, because reselecting what is already selected teaches nothing."
    instead="a context view. A context view is not inside anything."
    code={CODE.crumbs}
  >
    <div class="py-2">
      <PanelCrumbs
        trail={[{ label: "Project", key: "project.self" }, { label: "Q3 Resilience Memo", key: "project.resource" }, { label: "Mention" }]}
        onnavigate={() => {}}
      />
    </div>
  </Entry>

  <Entry
    name="PanelSearch"
    use="A filter and the things it filters, as one component. What is inside it is what is searched — the scope is the markup rather than a convention, which is the whole reason this contains its content instead of being a field the frame pinned above it."
    instead="a field on its own. A search that does not contain what it searches leaves the scope unanswerable from any single place, and a scope a reader has to reconstruct from two files is one nobody can check."
    code={CODE.search}
  >
    <div class="py-2">
      <PanelSearch
        placeholder="Search resources"
        matched={matches.length}
        total={RESOURCES.length}
        empty="No resource matches that."
        bind:value={filter}
        flush
      >
        {#if documents.length > 0}
          <PanelSection title="Documents" count={documents.length} flush>
            {#each documents as resource (resource.name)}
              <PanelRow title={resource.name} sub={resource.kind} icon={FileText} onselect={() => {}} />
            {/each}
          </PanelSection>
        {/if}
        {#if spreadsheets.length > 0}
          <PanelSection title="Spreadsheets" count={spreadsheets.length} flush>
            {#each spreadsheets as resource (resource.name)}
              <PanelRow title={resource.name} sub={resource.kind} icon={FileText} onselect={() => {}} />
            {/each}
          </PanelSection>
        {/if}
      </PanelSearch>
      <PanelSection title="Dates" open={false}>
        <PanelFields><PanelField label="Created" mono>12 Mar 2026</PanelField></PanelFields>
      </PanelSection>
      <PanelNote>
        Type in it. The count and the sections follow, an empty group disappears
        rather than sitting there empty, and a search that matches nothing says
        so in a sentence this component owns. Dates stays — it is outside the
        search, and nothing has to say so because you can see it.
      </PanelNote>
    </div>
  </Entry>

  <Entry
    name="PanelLink"
    use="A name inside a sentence or a field that opens what it names. Every 'who' in the application is one of these. title carries what the label could not — a truncated name, or which kind of actor this is."
    instead="a navigation. It changes what the inspector is looking at; there is no URL for it to have."
    code={CODE.link}
  >
    <div class="py-3">
      <PanelFields>
        <PanelField label="Created by">
          <PanelLink label="Ana Reyes" title="Ana Reyes — Owner" onselect={() => {}} />
        </PanelField>
        <PanelField label="Updated by">
          <PanelLink
            label="Nightly filing digest"
            title="Nightly filing digest — an automation"
            onselect={() => {}}
          />
        </PanelField>
      </PanelFields>
    </div>
  </Entry>

  <Entry
    name="PanelToggle"
    use="An on/off state, for a setting that takes effect immediately. label is required and becomes the accessible name, so a toggle with no visible word beside it is still in the tab order and still announced — the third row below has no label drawn and is fully operable."
    instead="a value submitted with a form. That is a checkbox."
    code={CODE.toggle}
  >
    <div class="py-3">
      <PanelFields>
        <PanelField label="On"><PanelToggle checked label="The rule is on" onchange={() => {}} /></PanelField>
        <PanelField label="Show on first">
          <PanelToggle label="Show the page number on the first page" onchange={() => {}} />
        </PanelField>
      </PanelFields>
      <div class="pt-2">
        <PanelRow title="Nightly filing digest" sub="No visible label — the name is on the control">
          {#snippet children()}
            <span class="flex items-center gap-2">
              <span class="text-body-sm text-ink-primary truncate">Nightly filing digest</span>
              <PanelToggle checked label="Nightly filing digest" onchange={() => {}} />
            </span>
          {/snippet}
        </PanelRow>
      </div>
    </div>
  </Entry>

  <Entry
    name="PanelActor"
    use="A face, the name beside it, and the one line saying what it is. The face is always a target — an actor is inspectable from wherever it appears, which is the promise PanelLink already makes for a name."
    instead="an icon. PanelRow's icon slot renders at 14px, and a picture at 14px is a dot. If it is a picture of somebody, it is this."
    code={CODE.actor}
  >
    <div class="flex flex-col gap-3 py-3">
      <div class="px-3">
        <PanelActor
          name="Grid Analyst"
          kind="agent"
          size="head"
          role="Reads field data and relay logs."
          onselect={() => {}}
        />
      </div>
      <PanelFields>
        <PanelField label="Created by">
          <PanelActor name="Ana Reyes" onselect={() => {}} />
        </PanelField>
        <PanelField label="Started by">
          <PanelActor name="Nightly filing digest" kind="automation" onselect={() => {}} />
        </PanelField>
        <PanelField label="Brought in by">
          <PanelActor name="SharePoint" kind="connector" onselect={() => {}} />
        </PanelField>
      </PanelFields>
    </div>
  </Entry>

  <Entry
    name="PanelChoice"
    use="A small set of alternatives with exactly one on, shown rather than hidden. The scope a list is narrowed to, or the region a panel is switched to. Built on toggle-group in single mode, so arrow keys move between them."
    instead="a set worth hiding. If the options are many, or long, or rarely changed, that is PanelSelect — this one spends the panel's width on being visible."
    code={CODE.choice}
  >
    <div class="flex flex-col gap-2 py-3">
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
      <PanelRow title="Press one — it is a real control" sub={`Scope: ${scope}`} icon={FileText} />
    </div>
  </Entry>

  <Entry
    name="PanelThumbs · PanelThumb"
    use="A preview that is the thing's identity, because the thing has no name. A slide, a layout, a page. What sits under it is an index or a role, and a state the picture cannot show is drawn on the picture."
    instead="anything with a title. Every other word here identifies by a string; this one exists for the things that have none."
    code={CODE.thumb}
  >
    <div class="py-3">
      <PanelThumbs across={2}>
        {#each SLIDES as slide (slide.index)}
          <PanelThumb
            caption={String(slide.index)}
            hidden={slide.hidden}
            lines={2}
            selected={slide.index === current}
            onselect={() => (current = slide.index)}
          />
        {/each}
      </PanelThumbs>
    </div>
  </Entry>

  <Entry
    name="PanelProgress"
    use="How far through something is: a sync, an extraction, a batch of agent tasks. The figure beside it is required, because 'about two-thirds' is not something anyone can plan around and '148 of 212 files' is."
    instead="a bar at zero for work whose extent is unknown. Omit value and it draws the indeterminate form — 'running, extent unknown' — which is honest, where a bar at nothing is indistinguishable from work that never started."
    code={CODE.progress}
  >
    <div class="flex flex-col gap-3 py-3">
      <PanelProgress label="Google Drive — Filings" detail="148 of 212 files" value={70} />
      <PanelProgress label="Grid Analyst" detail="3 of 9 tasks" value={33} tone="intelligence" />
      <PanelProgress label="NERC-2025-winter-review.pdf" detail="Extracting" tone="attention" />
    </div>
  </Entry>

  <Entry
    name="PanelSkeleton"
    use="What a panel shows while it is finding out, shaped like the thing that is coming. Rows for a list, fields for facts about one thing."
    instead="a spinner. A spinner says only 'wait'; this says 'a list, about this long', and when the rows land nothing moves — the layout shift is the real cost of a generic loader."
    code={CODE.skeleton}
  >
    <div class="flex flex-col gap-4 py-3">
      <PanelSkeleton shape="rows" count={3} />
      <PanelSkeleton shape="fields" count={3} />
    </div>
  </Entry>

  <Entry
    name="PanelFaces"
    use="Several actors at once, as faces rather than as a list. Presence is the case — who is here now, in a strip narrow enough to sit in a header."
    instead="a plus-three you cannot press. The overflow is a control, because this shape exists to say who, and a number hides three of the who behind it."
    code={CODE.faces}
  >
    <div class="py-3">
      <PanelFaces
        actors={[
          { id: "ana", name: "Ana Reyes" },
          { id: "tomas", name: "Tomas Kaur" },
          { id: "mira", name: "Mira Jain" },
          { id: "grid", name: "Grid Analyst", kind: "agent" },
          { id: "digest", name: "Nightly filing digest", kind: "automation" },
          { id: "lee", name: "Sam Lee" }
        ]}
        onselect={() => {}}
        onoverflow={() => {}}
      />
    </div>
  </Entry>
</section>
