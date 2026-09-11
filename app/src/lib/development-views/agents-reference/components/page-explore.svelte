<script lang="ts">
  import Callouts from "$development-views/agents-reference/components/callouts.svelte";
  import Flow from "$development-views/agents-reference/components/flow.svelte";
  import LiveStage from "$development-views/agents-reference/components/live-stage.svelte";
  import Noted from "$development-views/agents-reference/components/noted.svelte";
  import Questions from "$development-views/agents-reference/components/questions.svelte";
  import ReferenceSection from "$development-views/agents-reference/components/reference-section.svelte";
  import ReferenceShell from "$development-views/agents-reference/components/reference-shell.svelte";
  import SpecTable from "$development-views/agents-reference/components/spec-table.svelte";
  import { pageOf } from "$development-views/agents-reference/procedures/navigation";
  import { questionsFor } from "$development-views/agents-reference/procedures/questions";

  let { project }: { project: string } = $props();

  const page = pageOf("explore");

  const panes = [
    {
      n: 1,
      title: "Left: Threads, and Turns beside it",
      body: "Threads is every chat in the project, newest first, each with how many turns it holds and how long ago it was last spoken to. Turns is the open chat's questions, newest first, and choosing one moves the centre and the lens to it. Two panels, not one with a nested list."
    },
    {
      n: 2,
      title: "Centre: the question, then the answer",
      body: "A line of context above the question — how long ago, what it could see, which mode — then the question itself, then the answer with the rest of the plane to fill. The composer holds the bottom. Nothing says who asked, because there are only two of you."
    },
    {
      n: 3,
      title: "Right: findings and sources",
      body: "The current turn, always, with both sections open. No mode chip, no duration, and no restatement of the question that is already at the top of the plane in larger type. Tool use is not here: what it searched is recorded on the turn and not what a reader wants."
    }
  ];

  const composer = [
    ["Mode", "Far left of the head", "Explore, Question and Hypothesis. Explore is selected; the other two are in the list and disabled."],
    ["Context", "Beside the mode", "All project, or this resource when the chat was opened on one. It is the scope the turn records."],
    ["Web", "Beside the context", "The one tool a person turns on. Disabled, because searching the web is not built."],
    ["Send", "Far right of the head", "A round button with an arrow, disabled until something is written and spinning while the turn runs."],
    ["The field", "The rest of the surface", "No border of its own, no gap, and no keycaps or subtext under it. The composer is the surface; the head is its lid."]
  ];

  const turn = [
    { actor: "Compose", action: "The question is written; the mode and the context are already chosen.", artifact: "Explore · All project" },
    { actor: "Ask", action: "The prompt is appended to the thread and a turn row opens as running.", artifact: "ask({ threadId, text, scope })" },
    { actor: "Index", action: "Every resource not already current is embedded and the queue is drained.", artifact: "enqueueSemanticSync · processSemanticSyncQueueFor" },
    { actor: "Search", action: "The model searches the project, reads what it needs, and delivers by calling a tool.", artifact: "retrieve · read_text · submit_answer" },
    { actor: "Publish", action: "The response message and the turn are written together; the panes refresh.", artifact: "state: \"answered\"" }
  ];

  const built = [
    ["researchTurns", "A turn is a row: the question, the answer's blocks, the searches, the sources, the findings, the model and what it cost.", "New table"],
    ["research-chat", "Five procedures: read the chats, read one, start one, ask, remove.", "New capability"],
    ["research.thread", "The centre, rewritten from a 1,182-line mock over invented data to the real surface.", "Replaced"],
    ["research.threads · research.turns", "The two context panels.", "New"],
    ["research.turn", "The one lens.", "New"],
    ["intelligence.chat.model", "A cheap reasoning model named per call, so a chat does not pay for the derived-output model.", "New key"],
    ["IntelligenceInput.model", "One optional field on the port: a model for this call only. The credential still never crosses.", "One line"]
  ];

  const learned = [
    {
      n: 1,
      title: "A forced response schema stops a model searching",
      body: "The first build asked for a JSON answer with response_format on every provider turn, the way the derived output capability does. Two of the three models tried answered the schema immediately and never called a tool at all: ten searches became zero. The answer now arrives as a submit_answer tool call, and the same models search six times before delivering."
    },
    {
      n: 2,
      title: "A model that answers may still forget to cite",
      body: "Before that change one model wrote a real answer and returned an empty sources array, which the capability then threw away and replaced with the insufficient text. There is now one repair pass with no tools: the passages and the draft go back with a single instruction to name what it used. It costs one request, and only in that case."
    },
    {
      n: 3,
      title: "Insufficient is the model's word, not a fallback",
      body: "An answer with no citations is published as the answer, with the lens showing that nothing was cited. Publishing the refusal text over a real answer hides a working loop behind a wrong sentence."
    },
    {
      n: 4,
      title: "The first question in a project pays for the overlay",
      body: "Nothing indexes a project until something asks. The first turn embeds every document and presentation and drains the queue; later turns skip whatever is already current. In the seeded project that is eight resources and about twenty seconds."
    }
  ];

  const vocabulary = [
    ["research.thread", "content", "keep", "The chat surface. The key keeps the word thread; the interface says chat."],
    ["research.threads", "context", "keep", "Every chat in the project."],
    ["research.turns", "context", "add", "The open chat's questions."],
    ["research.turn", "inspector", "add", "The one lens: findings and sources."],
    ["research.overview · history · findings · findings-library · inquiry-library · sources · context · trace", "context", "keep", "Left in the vocabulary, off the rail. There are more panels to come and retiring the keys would only mean adding them back."],
    ["research.inquiry", "context", "keep", "Off the rail until Question mode is wired."],
    ["research.research-thread · question · hypothesis · source · tool-call · accepted-finding · proposed-finding", "inspector", "keep", "Also left alone. One lens is what is built, not what is allowed."]
  ];
</script>

<ReferenceShell {page} {project}>
  <ReferenceSection
    id="frame"
    kicker="The category, live"
    title="Three panes over the real project"
    lede="This is the built surface, not a mock. Type a question into the composer and it will search this project, read what it finds and answer, and the turn will be written to the store. A turn costs a fraction of a cent and takes as long as it takes. There is no round limit; Stop is how a run ends early."
  >
    <Noted scope="figure" label="Research chat">
      <LiveStage
        label="research.thread · Explore"
        category="research"
        context="research.threads"
        geometry="rail 44px · threads 248px · centre ≥ 704px · turn 320px"
      />
    </Noted>
    <Callouts items={panes} scope="pane" />
  </ReferenceSection>

  <ReferenceSection
    id="composer"
    kicker="The composer"
    title="A head, then the box"
    lede="The head carries everything that qualifies the message. Everything below it is for typing, edge to edge, with no second border inside the first."
  >
    <SpecTable
      label="Composer parts"
      columns={["Part", "Where", "What it is"]}
      rows={composer}
      noted="part"
    />
  </ReferenceSection>

  <ReferenceSection
    id="panels"
    kicker="The flanks"
    title="Threads, Turns, and the turn"
    lede="Both context panels and the lens, live over the same project. Time is always how long ago, never a clock: a question asked three days ago is three days ago wherever it is shown."
  >
    <div class="flanks">
      <Noted scope="figure" label="Threads">
        <LiveStage
          label="research.threads"
          category="research"
          panes="context"
          context="research.threads"
          geometry="248px"
          height="26rem"
        />
      </Noted>
      <Noted scope="figure" label="Turns">
        <LiveStage
          label="research.turns"
          category="research"
          panes="context"
          context="research.turns"
          geometry="248px"
          height="26rem"
        />
      </Noted>
      <Noted scope="figure" label="The turn">
        <LiveStage
          label="research.turn"
          category="research"
          panes="inspector"
          geometry="320px"
          height="26rem"
        />
      </Noted>
    </div>
  </ReferenceSection>

  <ReferenceSection
    id="turn"
    kicker="One turn, end to end"
    title="From the composer to the lens"
    lede="Five steps. The third is the one nobody expects: a project is not indexed until something asks a question of it."
  >
    <Noted scope="figure" label="Turn flow">
      <Flow label="A chat turn" steps={turn} tone="intelligence" />
    </Noted>
  </ReferenceSection>

  <ReferenceSection
    id="built"
    kicker="What was built"
    title="One table, one capability, four surfaces"
    lede="Everything else was already there. The intelligence port needed one optional field and the configuration one section."
  >
    <SpecTable
      label="What was built"
      columns={["Thing", "What it is", "Change"]}
      rows={built}
      mono={[0]}
      noted="built"
    />
  </ReferenceSection>

  <ReferenceSection
    id="learned"
    kicker="What the live runs taught"
    title="Four things that only showed up against a real provider"
    lede="Every one of these was found by asking the seeded project a real question and reading the turn's own record of what happened."
  >
    <Callouts items={learned} scope="learned" />
  </ReferenceSection>

  <ReferenceSection
    id="vocabulary"
    kicker="Vocabulary"
    title="Three keys added, none retired"
    lede="The research rail is down to the two panels that exist. The other keys stay in the vocabulary rather than being retired, because there are more panels to come and a key removed today is a key re-added next week."
  >
    <SpecTable
      label="Keys"
      columns={["Key", "Pane", "Change", "Why"]}
      rows={vocabulary}
      mono={[0]}
      pills={[2]}
      noted="key"
    />
  </ReferenceSection>

  <ReferenceSection
    id="questions"
    kicker="Forks on this page"
    title="Decisions Explore raised"
    lede="Answer by number."
  >
    <Questions questions={questionsFor("explore")} />
  </ReferenceSection>
</ReferenceShell>

<style>
  .flanks {
    display: flex;
    flex-wrap: wrap;
    gap: 2rem;
  }

  .flanks > :global(*) {
    flex: 1 1 26rem;
  }
</style>
