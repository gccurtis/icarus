<script lang="ts">
  import type { Component } from "svelte";
  import ChartArea from "@lucide/svelte/icons/chart-area";
  import ChartColumn from "@lucide/svelte/icons/chart-column";
  import ChartLine from "@lucide/svelte/icons/chart-line";
  import ChartPie from "@lucide/svelte/icons/chart-pie";
  import MessageSquarePlus from "@lucide/svelte/icons/message-square-plus";

  import Entry from "$views/development/vocabulary/components/entry.svelte";
  import SectionTitle from "$views/development/vocabulary/components/section-title.svelte";
  import {
    PanelCards,
    PanelColor,
    PanelDate,
    PanelField,
    PanelFields,
    PanelInput,
    PanelKeys,
    PanelMarks,
    PanelNote,
    PanelNumber,
    PanelRange,
    PanelRow,
    PanelThumb
  } from "$authored-components/panel";

  /**
   * The controls, and every one of them is the same argument made about a
   * different value: a text field would have taken it and lost something.
   *
   * The examples are live, because a control nobody can press proves nothing
   * about the control. They move local state and reach nothing else — the value
   * a real panel would hand back is exactly the part this page does not have.
   */
  let find = $state("customer-minutes");
  let replacement = $state("");
  let committed = $state("");

  let due = $state("2026-04-15");

  let margin = $state(36);
  let rows = $state(3);

  let opacity = $state(62);
  let zoom = $state(125);

  const MARKS = [
    { value: "bold", label: "Bold" },
    { value: "italic", label: "Italic" },
    { value: "underline", label: "Underline" },
    { value: "strike", label: "Strikethrough" },
    { value: "code", label: "Code" }
  ];
  let marks = $state<string[]>(["bold"]);
  /** A mark the reader presses is no longer partly on: that is how mixed ends. */
  let mixed = $state<string[]>(["italic"]);
  const setMarks = (next: string[]) => {
    mixed = mixed.filter((mark) => !next.includes(mark));
    marks = next;
  };

  /** The colours a project names. A fill comes from this set or from nowhere. */
  const FILLS = [
    { value: "None", label: "None", token: "transparent" },
    { value: "Primary", label: "Primary", token: "var(--token-color-primary-fill)" },
    { value: "Secondary", label: "Secondary", token: "var(--token-color-secondary-fill)" },
    { value: "Accent 1", label: "Accent 1", token: "var(--token-color-accent-1-fill)" },
    { value: "Accent 2", label: "Accent 2", token: "var(--token-color-accent-2-fill)" }
  ] as const;
  let fill = $state("Accent 1");
  let stroke = $state("None");
  let strokeMixed = $state(true);

  type Kind = {
    id: string;
    name: string;
    shape: Component<{ size?: number | string; "aria-hidden"?: boolean | "true" | "false" }>;
  };
  const KINDS: readonly Kind[] = [
    { id: "bar", name: "Bar", shape: ChartColumn },
    { id: "line", name: "Line", shape: ChartLine },
    { id: "pie", name: "Pie", shape: ChartPie },
    { id: "area", name: "Area", shape: ChartArea }
  ];
  let kind = $state("line");

  const CODE = {
    input: `<PanelInput
  label="Replace with"
  placeholder="Replace with"
  bind:value={replacement}
  onenter={replaceSelected}
  flush
/>

<!-- a visible name, where the placeholder is not enough alone -->
<PanelField label="Replace with" stacked>
  <PanelInput label="Replace with" bind:value={replacement} mono flush />
</PanelField>`,
    date: `<PanelField label="Deadline" stacked>
  <PanelDate
    label="Filing deadline"
    value={variable.due}
    min="2026-01-01"
    flush
    onchange={(next) => variable.setDue(next)}
  />
</PanelField>

<!-- no onchange: read-only, and disabled rather than absent -->
<PanelDate label="Created" value="2026-03-04" flush />`,
    number: `<PanelField label="Margin" stacked>
  <PanelNumber
    label="Margin"
    value={page.margin}
    unit="pt"
    min={0}
    max={144}
    step={0.5}
    flush
    onchange={(next) => page.setMargin(next)}
  />
</PanelField>`,
    range: `<PanelRange
  label="Opacity"
  value={layer.opacity}
  min={0}
  max={100}
  unit="%"
  onchange={(next) => layer.setOpacity(next)}
/>`,
    marks: `<PanelMarks
  label="Marks"
  value={marks}
  options={[
    { value: "bold", label: "Bold" },
    { value: "italic", label: "Italic" },
    { value: "code", label: "Code" }
  ]}
  mixed={["italic"]}
  onchange={(next) => selection.setMarks(next)}
/>`,
    color: `const FILLS = [
  { value: "None", label: "None", token: "transparent" },
  { value: "Accent 1", label: "Accent 1",
    token: "var(--token-color-accent-1-fill)" }
];

<PanelField label="Fill" stacked>
  <PanelColor
    label="Fill"
    value={fill}
    options={FILLS}
    mixed={property.mixed}
    flush
    onchange={(next) => range.setFill(next)}
  />
</PanelField>`,
    keys: `<PanelKeys action="Find in document" mods={["mod"]} key="f" />
<PanelKeys action="Replace and find next"
  mods={["mod", "alt"]} key="Enter" />

<!-- no action: the chord sits in something that names it -->
<PanelRow title="Comment" sub="On the selection"
  icon={MessageSquarePlus} onselect={() => comment()}>
  {#snippet control()}
    <PanelKeys mods={["mod", "shift"]} key="m" />
  {/snippet}
</PanelRow>`,
    cards: `<PanelCards label="Chart kind" columns={2}>
  {#each KINDS as kind (kind.id)}
    {@const Shape = kind.shape}
    <PanelThumb
      caption={kind.name}
      selected={kind.id === chosen}
      onselect={() => chart.draw(kind.id)}
    >
      <span style="aspect-ratio: 4 / 3" aria-hidden="true">
        <Shape size={18} />
      </span>
    </PanelThumb>
  {/each}
</PanelCards>`
  };
</script>

<section class="flex flex-col gap-8">
  <SectionTitle title="Values a field could not hold" source="src/lib/components/authored/panel/">
    PanelEditableText edits a value already on the screen beside it, and
    PanelSearch contains the very things it filters. None of these is either. A
    replace string goes somewhere the panel does not display, a date typed as
    text is a date in somebody's local format, a number has a floor and a unit, a
    range is proportional rather than exact, marks are independent where a choice
    picks one, a colour comes from a theme rather than a picker, a chord is
    structure rather than a string, and a set chosen by its picture is not a set
    chosen by its name.
  </SectionTitle>

  <PanelNote>
    Every control here is real, because one you cannot press says nothing about
    the control. They move local state and reach nothing else — a change dies
    with the tab.
  </PanelNote>

  <Entry
    name="PanelInput"
    use="A field holding a string the panel will use somewhere else: a replacement, a name for something that does not exist yet, a filter whose results are in another region. label is required and becomes the accessible name, because a box with no name is a box nobody can answer."
    instead="text that is already on the screen. PanelEditableText edits a value drawn beside it, and PanelSearch contains what it filters so its scope is the markup — both of which are exactly wrong for a string the panel will use against content it does not display."
    code={CODE.input}
  >
    <div class="flex flex-col gap-2 py-3">
      <PanelFields>
        <PanelField label="Find" stacked>
          <PanelInput label="Find" placeholder="Find in document" bind:value={find} mono flush />
        </PanelField>
        <PanelField label="Replace with" stacked>
          <PanelInput
            label="Replace with"
            placeholder="Replace with"
            bind:value={replacement}
            mono
            flush
            onenter={(text) => (committed = text)}
          />
        </PanelField>
      </PanelFields>
      <div class="px-3">
        <PanelNote>
          {committed === ""
            ? "Press Enter in the second field. There is no document here — the string is the whole of what this word holds."
            : `Enter committed “${committed}”. A panel would now use it against text it does not show.`}
        </PanelNote>
      </div>
    </div>
  </Entry>

  <Entry
    name="PanelDate"
    use="A date, chosen: a variable's default, a deadline, the day a scope starts. The value is ISO-8601 and only ISO-8601, and the ambiguity lives entirely in the display, where the platform labels the segments and orders them the way the reader's system does."
    instead="a date typed as free text. PanelEditableText takes “next tuesday”, “3/4/26” and “2026-13-40” with equal enthusiasm, so every caller writes the same parser and gets the ordering wrong in the same way — and the difference between 03/04 and 04/03 is a filing deadline."
    code={CODE.date}
  >
    <div class="flex flex-col gap-2 py-3">
      <PanelFields>
        <PanelField label="Deadline" stacked>
          <PanelDate
            label="Filing deadline"
            value={due}
            min="2026-01-01"
            flush
            onchange={(next) => (due = next)}
          />
        </PanelField>
        <PanelField label="Created" stacked>
          <PanelDate label="Created" value="2026-03-04" flush />
        </PanelField>
      </PanelFields>
      <div class="px-3">
        <PanelNote>
          The first reads back as {due === "" ? "an empty string" : due}, whatever
          order the field draws. The second has no onchange, so it is disabled
          rather than absent — a date that opens, changes and is silently
          discarded is worse than one that plainly cannot be touched.
        </PanelNote>
      </div>
    </div>
  </Entry>

  <Entry
    name="PanelNumber"
    use="A number with its unit and a way to step it — a margin, a weight, a limit, a row count, a font size. Those four facts belong to the number, so they belong to the component that holds it, and the unit sits beside the figure rather than inside the value: “12 pt”, never “12pt” stored as one."
    instead="PanelEditableText with mono on. Text has no floor, no ceiling, no step and no unit, so every caller that wanted a number re-implemented all four — one clamped on the wrong side, one let “12pt” through as a value, and one stored the string."
    code={CODE.number}
  >
    <div class="flex flex-col gap-2 py-3">
      <PanelFields>
        <PanelField label="Margin" stacked>
          <PanelNumber
            label="Margin"
            value={margin}
            unit="pt"
            min={0}
            max={144}
            step={0.5}
            flush
            onchange={(next) => (margin = next)}
          />
        </PanelField>
        <PanelField label="Rows shown" stacked>
          <PanelNumber
            label="Rows shown"
            value={rows}
            unit="rows"
            min={1}
            max={12}
            flush
            onchange={(next) => (rows = next)}
          />
        </PanelField>
      </PanelFields>
      <div class="px-3">
        <PanelNote>
          Type 137 into the first rather than pressing anything 137 times: the
          steppers are for the nudge. Take the second to 1 and its minus goes dead
          with a title saying which bound it reached.
        </PanelNote>
      </div>
    </div>
  </Entry>

  <Entry
    name="PanelRange"
    use="A continuous value with its extent visible: opacity, a weight, a confidence threshold, a zoom that is a control rather than a gesture. The figure is always beside the track, because “about two-thirds” cannot be written in a bug, typed into a second panel, or compared with what it was yesterday."
    instead="an exact figure, which is PanelNumber — and never a value only being reported, which is PanelProgress. A number is exact and a range is proportional: what a track says that a field cannot is where the value sits between its ends, which is the only reading available when the value has no meaningful unit."
    code={CODE.range}
  >
    <div class="flex flex-col gap-3 py-3">
      <PanelRange
        label="Opacity"
        value={opacity}
        min={0}
        max={100}
        unit="%"
        onchange={(next) => (opacity = next)}
      />
      <PanelRange
        label="Zoom"
        value={zoom}
        min={25}
        max={400}
        step={25}
        unit="%"
        onchange={(next) => (zoom = next)}
      />
      <div class="px-3">
        <PanelNote>
          The fill is the same colour PanelProgress uses, deliberately: a filled
          length reads as one thing across the vocabulary. Everything else about
          them differs, because this one is a control and takes focus.
        </PanelNote>
      </div>
    </div>
  </Entry>

  <Entry
    name="PanelMarks"
    use="Several independent on-or-off options as one row: bold and italic on a selection, locked and hidden on a layer, header row and banded rows on a table. Mixed is a third state and is drawn as one — struck with a dashed edge, because a mark shown on would claim every character carries it."
    instead="a set with exactly one on. PanelChoice would make bold and italic alternatives, which is a lie about the text it describes; and PanelToggle is one switch with a name beside it, which is right for one option and absurd for six stacked down a 300px column."
    code={CODE.marks}
  >
    <div class="flex flex-col gap-2 py-3">
      <PanelMarks
        label="Marks on the selection"
        value={marks}
        options={MARKS}
        {mixed}
        onchange={setMarks}
      />
      <div class="px-3">
        <PanelNote>
          Italic is dashed: some of the selection carries it and some does not.
          Press it and the mixed state resolves the only way it can — every
          character gets the mark.
        </PanelNote>
      </div>
    </div>
  </Entry>

  <Entry
    name="PanelColor"
    use="A colour chosen from the ones this project actually has — a fill, a stroke or a text colour, out of a theme or a style set. Each swatch carries its name on hover and as its accessible name, and the chosen one takes a ring rather than only a border, so a control that is otherwise nothing but colour survives being read without colour."
    instead="a colour picker. A free one lets an author put a colour in a deck its theme has never heard of, and then the theme is not a theme. A listing of colours that sets nothing is PanelSwatches, drawn square — these are radio targets and are shaped like targets."
    code={CODE.color}
  >
    <div class="flex flex-col gap-2 py-3">
      <PanelFields>
        <PanelField label="Fill" stacked>
          <PanelColor
            label="Fill"
            value={fill}
            options={FILLS}
            flush
            onchange={(next) => (fill = next)}
          />
        </PanelField>
        <PanelField label="Stroke" stacked>
          <PanelColor
            label="Stroke"
            value={stroke}
            options={FILLS}
            mixed={strokeMixed}
            flush
            onchange={(next) => {
              stroke = next;
              strokeMixed = false;
            }}
          />
        </PanelField>
      </PanelFields>
      <div class="px-3">
        <PanelNote>
          Stroke starts mixed — several things are selected and their colours do
          not agree — so nothing is drawn as chosen. Showing one would claim the
          others match it. Pressing a swatch answers for all of them.
        </PanelNote>
      </div>
    </div>
  </Entry>

  <Entry
    name="PanelKeys"
    use="A keyboard shortcut, drawn beside the thing it does. The design law is no secret essentials — a shortcut accelerates a path that is already visible — so the chord is printed next to the control it duplicates, and the fast way is something you are told rather than something you find out."
    instead="a chord written as a string. “Cmd+K” has already made the platform decision, and made it wrong on Linux for every reader who is not on a Mac; mod is the platform's own accelerator and is resolved here, once. Not PanelChip or PanelCode either — both would draw the characters and neither would know what they mean."
    code={CODE.keys}
  >
    <div class="flex flex-col gap-1 py-3">
      <PanelKeys action="Find in document" mods={["mod"]} key="f" />
      <PanelKeys action="Replace and find next" mods={["mod", "alt"]} key="Enter" />
      <PanelRow title="Comment" sub="On the selection" icon={MessageSquarePlus} onselect={() => {}}>
        {#snippet control()}
          <PanelKeys mods={["mod", "shift"]} key="m" />
        {/snippet}
      </PanelRow>
      <div class="px-3 pt-1">
        <PanelNote>
          These are drawn for the machine you are reading on: ⌃⌥⇧⌘ order on Apple
          hardware, Ctrl Alt Shift everywhere else. The keycaps are hidden from
          assistive technology and the spoken form sits beside them, because ⌘⇧M
          read aloud is nothing useful.
        </PanelNote>
      </div>
    </div>
  </Entry>

  <Entry
    name="PanelCards"
    use="A small set chosen by its picture rather than its name: a chart kind, a slide layout, a page orientation. It holds PanelThumbs, and the chosen one is the caller's to mark — PanelThumb already carries selected, and a second selected state here would be two claims about one card."
    instead="the same decision in words, which is PanelChoice: right for a scope or a mode, wrong for a chart kind, where Bar, Line, Pie and Area are shapes and the person picking one is matching a shape to their data. Two or three across and never more — a 276px body divided four ways leaves 60px a side, and what needs more columns belongs in a modal, where the plane is wide."
    code={CODE.cards}
  >
    <div class="py-3">
      <PanelCards label="Chart kind" columns={2}>
        {#each KINDS as option (option.id)}
          {@const Shape = option.shape}
          <PanelThumb
            caption={option.name}
            selected={option.id === kind}
            onselect={() => (kind = option.id)}
          >
            <span
              class="border-border-subtle bg-surface-canvas rounded-control text-ink-secondary flex w-full items-center justify-center border"
              style="aspect-ratio: 4 / 3"
              aria-hidden="true"
            >
              <Shape size={18} />
            </span>
          </PanelThumb>
        {/each}
      </PanelCards>
    </div>
  </Entry>
</section>
