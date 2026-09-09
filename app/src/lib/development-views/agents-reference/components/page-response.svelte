<script lang="ts">
  import Callouts from "$development-views/agents-reference/components/callouts.svelte";
  import Flow from "$development-views/agents-reference/components/flow.svelte";
  import Noted from "$development-views/agents-reference/components/noted.svelte";
  import Questions from "$development-views/agents-reference/components/questions.svelte";
  import ReferenceSection from "$development-views/agents-reference/components/reference-section.svelte";
  import ReferenceShell from "$development-views/agents-reference/components/reference-shell.svelte";
  import ResponseSample from "$development-views/agents-reference/components/response-sample.svelte";
  import SpecTable from "$development-views/agents-reference/components/spec-table.svelte";
  import Stage from "$development-views/agents-reference/components/stage.svelte";
  import { pageOf } from "$development-views/agents-reference/procedures/navigation";
  import { questionsFor } from "$development-views/agents-reference/procedures/questions";

  let { project }: { project: string } = $props();

  const page = pageOf("response");

  const kinds = [
    ["text", "Yes", "Yes", "The answer's prose, split on blank lines", "One column at the prose measure. Never full bleed."],
    ["table", "Yes", "Yes", "A make_table call", "Its own box, its own horizontal scroll, numbers right and tabular."],
    ["image", "Yes", "Alt text only", "Nothing yet", "A made image needs somewhere to put the bytes first."],
    ["formula", "Yes", "No", "Nothing yet", "A resolved value belongs to a document, not to an answer."],
    ["prompt", "Yes", "No", "Never", "A prompt block is a document's live text. An answer is already the output of one."],
    ["chart", "No", "No", "A make_chart call, when charts exist", "The kind comes from the data's shape, not from the model's opinion."],
    ["slide", "No", "No", "A make_slide call, when the deck capability offers one", "Drawn at its own aspect, never stretched to the column."]
  ];

  const made = [
    { actor: "Model", action: "Calls a tool with the data, never with a drawing.", artifact: "make_table({ columns, rows, caption })" },
    { actor: "Tool", action: "Validates the shape, builds the block, and keeps it for this turn.", artifact: "returns { blockId, summary }" },
    { actor: "Model", action: "Writes the answer and names the block where it belongs.", artifact: "response: \"…as the table below shows.\", blocks: [\"b-3\"]" },
    { actor: "Capability", action: "Assembles prose and named blocks in order and stores them on the turn.", artifact: "blocks: ContentBlock[]" },
    { actor: "Plane", action: "Draws each block by kind, and says so for one it does not know.", artifact: "{#if block.type === …}" }
  ];

  const why = [
    {
      n: 1,
      title: "A tool call is checkable; a blob of JSON in the prose is not",
      body: "If the model emits a table inside its answer, a malformed one is discovered when the plane tries to draw it, which is after the turn is published. A tool validates at the moment of the call, refuses with a reason the model can act on, and the model gets another round to fix it."
    },
    {
      n: 2,
      title: "The tool owns the block's identity",
      body: "It mints the id, so the same table named twice in one answer is one block rather than two copies. That is also what makes Add idempotent: pressing it twice adds one thing."
    },
    {
      n: 3,
      title: "The data is the argument, and the drawing is ours",
      body: "make_chart takes columns and rows and what the chart is meant to show. It does not take a chart type, a colour, or a size. That decision belongs to the chart system, which is why a made chart looks like every other chart in the application."
    },
    {
      n: 4,
      title: "Nothing is written to the project until a person presses Add",
      body: "A block lives on the turn. It becomes a resource only when somebody puts it somewhere, which keeps a chat that produced six drafts from leaving six artefacts behind."
    }
  ];

  const quality = [
    {
      n: 1,
      title: "A table's alignment comes from its columns, not from its author",
      body: "Text left, numbers right and tabular, so a column of figures reads as a column. The header row is a header row, with the scope attribute, so it is still a table to a screen reader."
    },
    {
      n: 2,
      title: "Wide content scrolls inside its own box",
      body: "A twelve-column table gets a horizontal scrollbar of its own. The plane never scrolls sideways, because the prose beside the table would go with it."
    },
    {
      n: 3,
      title: "Every made thing says where it came from",
      body: "One line under the title: the resource, and how much of it. A table with no provenance is a claim with no source, which is the thing this whole feature exists to avoid."
    },
    {
      n: 4,
      title: "The chart kind is chosen from the data",
      body: "One categorical column and one measure is bars. A date column and a measure is a line. Two measures is a scatter. Parts of a whole that actually sum is the only case for a share chart, and it is still usually bars."
    },
    {
      n: 5,
      title: "A block the plane cannot draw says what it is",
      body: "Not a blank space and not an error. The answer stays readable and the gap is legible as a missing renderer, which is the difference between something unbuilt and something broken."
    }
  ];

  const actions = [
    ["Add", "A plus, and the word", "Puts the block somewhere in the project: a slide in a deck, a table in a document, a chart as its own resource.", "An alert. The picker and the writes are not built."],
    ["Open", "A pop-out arrow", "Opens the block in Analysis, where a chart is edited and re-run rather than looked at.", "An alert. Analysis does not take a block yet."]
  ];

  const prose = [
    ["Lead with the answer", "The first sentence answers the question. Nothing warms up."],
    ["One idea a sentence", "Around twenty words. A new sentence beats a semicolon."],
    ["No restating the question", "It is at the top of the plane already, in larger type."],
    ["No account of the search", "What it searched is in the turn, and the lens shows it."],
    ["No offer of further help", "The composer is right there."],
    ["Insufficient is a status", "A turn that found nothing says so once, plainly, and cites nothing."]
  ];
</script>

<ReferenceShell {page} {project}>
  <ReferenceSection
    id="blocks"
    kicker="What an answer is"
    title="A list of blocks, of which prose is one kind"
    lede="The turn stores blocks rather than a string. Today the model writes paragraphs and the capability splits them, so every block is text and nothing looks different. The shape is what matters: adding a table changed the renderer, not the model of an answer."
  >
    <SpecTable
      label="Block kinds"
      columns={["Kind", "In ContentBlock", "Drawn today", "Made by", "How it is drawn"]}
      rows={kinds}
      mono={[0]}
      noted="kind"
    />
  </ReferenceSection>

  <ReferenceSection
    id="sample"
    kicker="What it should look like"
    title="A table worth reading, and the chart the same data asks for"
    lede="Mocked. Neither the table tool nor the chart system exists, and this is the standard they are being built to: aligned columns, a caption that says where the numbers came from, and the two actions in the same place every time."
  >
    <Noted scope="figure" label="A response">
      <Stage label="research.thread · the answer" geometry="one column, blocks under it" width="plane">
        <ResponseSample />
      </Stage>
    </Noted>
  </ReferenceSection>

  <ReferenceSection
    id="made"
    kicker="How a block is made"
    title="Five steps, and the model never draws anything"
    lede="This is the whole argument of the page. Everything above prose comes from a tool call, so it is validated before it is published and it is ours rather than the model's."
  >
    <Noted scope="figure" label="Making a block">
      <Flow label="A made block" steps={made} tone="intelligence" />
    </Noted>
    <Callouts items={why} scope="why" />
  </ReferenceSection>

  <ReferenceSection
    id="quality"
    kicker="Quality"
    title="Five rules a made thing keeps"
    lede="Beautiful is not a coat of paint on this. It is alignment, provenance, and never lying about what could not be drawn."
  >
    <Callouts items={quality} scope="rule" />
  </ReferenceSection>

  <ReferenceSection
    id="actions"
    kicker="Actions"
    title="Two, in the same place on every block"
    lede="Both are wired to an alert today, which is deliberate: the affordance is the design decision, and the writes behind it are a later capability."
  >
    <SpecTable
      label="Block actions"
      columns={["Action", "Looks like", "Does", "Today"]}
      rows={actions}
      noted="action"
    />
  </ReferenceSection>

  <ReferenceSection
    id="prose"
    kicker="The prose"
    title="Six rules the system prompt carries"
    lede="The text blocks are most of every answer, and they are the part a model will happily pad. These are in the prompt, not in a review checklist."
  >
    <SpecTable label="Prose rules" columns={["Rule", "Why"]} rows={prose} noted="prose" />
  </ReferenceSection>

  <ReferenceSection
    id="questions"
    kicker="Forks on this page"
    title="Decisions the response raised"
    lede="Answer by number."
  >
    <Questions questions={questionsFor("response")} />
  </ReferenceSection>
</ReferenceShell>
