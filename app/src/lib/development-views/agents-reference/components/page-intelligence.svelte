<script lang="ts">
  import Callouts from "$development-views/agents-reference/components/callouts.svelte";
  import Flow from "$development-views/agents-reference/components/flow.svelte";
  import Noted from "$development-views/agents-reference/components/noted.svelte";
  import Questions from "$development-views/agents-reference/components/questions.svelte";
  import ReferenceSection from "$development-views/agents-reference/components/reference-section.svelte";
  import ReferenceShell from "$development-views/agents-reference/components/reference-shell.svelte";
  import SpecTable from "$development-views/agents-reference/components/spec-table.svelte";
  import { pageOf } from "$development-views/agents-reference/procedures/navigation";
  import { questionsFor } from "$development-views/agents-reference/procedures/questions";

  let { project }: { project: string } = $props();

  const page = pageOf("intelligence");

  const port = [
    ["system", "in", "string", "The standing instruction. For a chat this is built from the persona's definition sections."],
    ["user", "in", "string, or text with images", "One request. The image arm is how a rendered slide or chart reaches the model without a separate vision call."],
    ["tools", "in", "IntelligenceTool[]", "A name, a description, a JSON schema and an execute that returns whatever it likes. The loop calls it; the caller never does."],
    ["firstTool", "in", "string, optional", "Forces one named tool on the first provider turn only. Later turns are free."],
    ["output", "in", "structured output, optional", "A provider-enforced JSON schema plus the parse that turns its answer into a trusted value. It competes with tool calling; a finalTool is the better way to end a run."],
    ["finalTool", "in", "string, optional", "The tool that ends the run. An agent that delivers by calling a tool has nothing left to say afterwards."],
    ["maxToolRounds", "in", "number, optional", "A round bound for this call only, or -1 for none. Absent means the configured one."],
    ["signal", "in", "AbortSignal, optional", "Abandons the run, including the provider request in flight."],
    ["value", "out", "Value", "The parsed answer, typed by whatever parse returned."],
    ["usage", "out", "requests, tokens, cost", "Prompt, completion, total, reasoning and cost, summed over every round."],
    ["toolCalls", "out", "id, name, input, ok", "Every call the model made and whether it succeeded. This is what the inspector's tool use is."],
    ["rounds", "out", "number", "How many provider turns it took, bounded by intelligence.agent.maxToolRounds."]
  ];

  const loop = [
    { actor: "Build", action: "Tools are constructed for this one attempt, closed over the scope and the store.", artifact: "environment(input)" },
    { actor: "Force", action: "The first call is fixed: the selection if there is one, otherwise search.", artifact: "firstTool: \"read_selection\" | \"retrieve\"" },
    { actor: "Round", action: "The model calls tools until it answers. maxToolRounds is -1, so nothing counts the rounds.", artifact: "runAgent(state, input)" },
    { actor: "Parse", action: "The answer is validated against a schema and every cited evidence id must be one the tools issued.", artifact: "validSelections(evidence, issued)" },
    { actor: "Publish", action: "Coalesced citations and text, or the insufficient text and no citations at all.", artifact: "status: \"answered\" | \"insufficient\"" }
  ];

  const grants = [
    ["retrieve", "scope", "retrieve · retrieve_materials", "Both discovery lanes: exact authored text, and interpreted facets for tables, charts, images and code.", "Exists"],
    ["resource.read", "project", "find_resources · list_document_blocks · list_deck_slides · inspect_slide · view_slide · inspect_dataset · inspect_code · read_text · read_table · read_csv · read_chart · read_code · read_image · read_selection", "The navigate, inspect and read families. Fourteen tools, all registered against the store already.", "Exists"],
    ["resource.write", "project", "—", "Nothing in the catalogue writes. A chat that edits a document is a later capability, and it is the one grant that needs a confirmation before it fires.", "To build"],
    ["finding.create", "project", "—", "One tool that writes a finding with the evidence identifiers it rests on, so a person accepts a claim that is already sourced.", "To build"],
    ["analysis.evaluate", "project", "—", "Runs a saved analysis and reads the result. Needs the analysis capability to expose a read-only evaluate.", "To build"],
    ["web.search", "unbounded", "—", "The only grant whose results are not bounded by the project, which is why it is listed separately in the composer's Tools section and starts off.", "To build"]
  ];

  const turnRow = [
    ["projectId · threadId", "The chat this turn belongs to.", "Every read is scoped by the first and keyed by the second."],
    ["promptMessageId · messageId", "The two messages this turn sits between.", "A turn is the machinery beside a response, not a replacement for it."],
    ["mode", "explore · question · hypothesis", "Only explore is wired. The others are stored so a thread does not have to be migrated when they are."],
    ["personaId", "Whose definition became the system prompt, optional.", "A chat with no persona uses the project's default instruction."],
    ["scope · tools", "What it could see and what it was allowed to call.", "Recorded per turn, because the answer is only reproducible with them."],
    ["state", "queued · running · answered · insufficient · failed · superseded", "What the centre shows while it works and what the inspector explains afterwards."],
    ["queries", "Every distinct search the model ran.", "The cheapest explanation of why an answer is thin."],
    ["evidence", "SemanticCitation[]", "Exactly the shape the derived output already publishes, so the same citation rendering works."],
    ["toolCalls", "id, name, input, ok", "The inspector's Tool use section, in order."],
    ["usage", "requests, tokens, cost", "Shown once at the foot of the lens."],
    ["error", "A redacted message, optional.", "Bearer tokens and API keys are stripped before anything is stored."],
    ["requestKey · requestedVersion · attempts · queuedAt · startedAt", "The durable half of the queue.", "Copied from the derived output refresh job, which already survives a restart."]
  ];

  const procedures = [
    ["readChats", "query", "The project's chats, newest first, each with its title and last line.", "—"],
    ["readChat", "query", "One chat: its messages in order and the turn row beside each response.", "—"],
    ["createChat", "command", "A research thread, its thread row and its first part, optionally opened on a prompt.", "—"],
    ["sendChatTurn", "command", "Appends the prompt, queues the turn, runs it, and answers with the published turn.", "not-found · invalid-state"],
    ["cancelChatTurn", "command", "Supersedes the turn in flight and leaves the prompt in the thread.", "not-found"],
    ["renameChat", "command", "A compare-and-swap on the title.", "not-found · stale"],
    ["removeChat", "command", "The chat, its thread, its parts and its turns.", "not-found"]
  ];

  const turn = [
    { actor: "Composer", action: "Send posts the text with the mode and the chat it belongs to.", artifact: "sendChatTurn(chatId, text, mode)" },
    { actor: "Door", action: "Scope first, then validation, then the prompt is appended to the thread.", artifact: "requireScope() · appendMessage(\"prompt\")" },
    { actor: "Queue", action: "One durable row per chat and one in-process flight, so a second browser joins rather than starts.", artifact: "enqueueChatTurnFor · processChatTurnFor" },
    { actor: "Overlay", action: "The semantic sync queue is drained in bounded batches before retrieval runs.", artifact: "processSemanticSyncQueueFor(model, projectId, 50)" },
    { actor: "Loop", action: "The persona's prompt, the project scope and the granted tools go to the port; it answers once.", artifact: "intelligence.completeWithTools(...)" },
    { actor: "Publish", action: "The response message and its turn row are written together and the read refreshes.", artifact: "appendMessage(\"response\") · readChat().refresh()" }
  ];

  const prompt = [
    {
      n: 1,
      title: "Who it is comes from the persona, not from the code",
      body: "A persona already stores its definition as sections. Those sections are the system prompt, in order, which means the definition editor built on the persona page is the prompt editor and there is no second place to change how a chat behaves."
    },
    {
      n: 2,
      title: "What it may see is stated, not implied",
      body: "The prompt names the scope in words and the tools enforce it in code. Today the scope is the whole project, so the sentence is short, but the sentence exists so that narrowing it later changes one string rather than a habit."
    },
    {
      n: 3,
      title: "How to cite is a rule about identifiers",
      body: "Evidence identifiers are issued by the tools during the attempt. The model may cite only identifiers it was given, and the parse rejects the answer if it invents one. This is what makes a citation a fact about the run rather than a claim in prose."
    },
    {
      n: 4,
      title: "When to refuse is a status, not a sentence",
      body: "A turn that cannot ground itself answers insufficient, and the surface says so in its own words. The model is never asked to write an apology, because an apology is indistinguishable from an answer to everything downstream."
    }
  ];

  const streaming = [
    {
      n: 1,
      title: "The message already has a streaming state",
      body: "Message.state is streaming, complete or error, and it has been since before any of this. Nothing writes streaming today, because the port answers once."
    },
    {
      n: 2,
      title: "The turn row gives a live surface without a stream",
      body: "Queued, running and the tool calls so far are enough for the centre to show that something is happening and for the inspector to show what it is doing. That is most of what a stream buys, without changing an interface."
    },
    {
      n: 3,
      title: "When it is worth it, it is one method",
      body: "A streaming variant belongs on the same port beside completeWithTools, returning an async iterable of deltas and settling on the same result. The capability would write partial text into the response message. No surface changes, because a surface already renders a message whose text grows."
    }
  ];

  const configuration = [
    ["intelligence.api", "openrouter", "The only accepted value; anything else throws at startup."],
    ["providers.openrouter.apiKey", "local.yaml", "Git-ignored, merged last, and required. Absent means the server does not start."],
    ["providers.openrouter.endpoint", "https://openrouter.ai/api/v1/chat/completions", "Validated as an HTTP URL."],
    ["providers.openrouter.model", "~openai/gpt-latest", "One model for every caller today. A chat that wanted a cheaper model would add a key, not a provider."],
    ["providers.openrouter.timeoutMs", "180000", "Three minutes for a whole attempt, tool rounds included."],
    ["providers.openrouter.maxOutputTokens", "4096", "Per provider turn."],
    ["providers.openrouter.reasoningEffort", "medium", "low, medium or high."],
    ["agent.maxToolRounds", "8", "The default for every caller, sized for one grounded synthesis of one prompt. A caller that needs a different bound passes maxToolRounds on the call rather than changing this."],
    ["agent.maxSourceRetries", "2", "How many times a run is repeated when the sources moved under it."],
    ["agent.defaultTopK", "8", "Hits per retrieval when the model does not ask for a number."]
  ];

  const rules = [
    { n: 1, title: "One port, one instance", body: "createIntelligence runs once in buildServerModel and hangs off the server model. A capability reaches it as model.intelligence and never constructs one." },
    { n: 2, title: "The credential never crosses the port", body: "Tools receive a store and a scope. Nothing below the port sees a key, and every error message is stripped of Bearer tokens before it is stored or logged." },
    { n: 3, title: "A tool is built per attempt", body: "Tools close over the scope, the project and the evidence issuer for one run. There is no long-lived registry, which is what makes a grant enforceable rather than advisory." },
    { n: 4, title: "The loop is the port's business", body: "A capability never writes a round-trip loop. It describes tools and asks once; runAgent does the rounds and reports how many it took." },
    { n: 5, title: "Refusals are answers here too", body: "not-found, invalid-state and stale come back as accepted false with the row's revision, exactly as the agents capability already does." }
  ];
</script>

<ReferenceShell {page} {project}>
  <ReferenceSection
    id="port"
    kicker="The port"
    title="One method, and everything else is an argument to it"
    lede="This arrived with the rebase and it is already what a chat needs. completeWithTools is not a completion call with tools bolted on: the agent loop runs inside it, so a caller describes a job and receives a finished answer."
  >
    <SpecTable
      label="The intelligence port"
      columns={["Field", "Way", "Type", "What it does"]}
      rows={port}
      mono={[0]}
      noted="port"
    />
  </ReferenceSection>

  <ReferenceSection
    id="loop"
    kicker="What already runs"
    title="The grounded synthesis, in five moves"
    lede="The derived output capability uses the port to answer a prompt from project material. A chat turn is the same five moves with a conversation in front of it, which is the argument for copying this rather than writing a second loop."
  >
    <Noted scope="figure" label="Synthesis loop">
      <Flow label="Grounded synthesis" steps={loop} tone="intelligence" />
    </Noted>
    <Callouts items={rules} scope="rule" />
  </ReferenceSection>

  <ReferenceSection
    id="catalogues"
    kicker="Two catalogues"
    title="Six grants, sixteen tools"
    lede="The agents category grants a persona one of six coarse tools. The runtime registers sixteen fine ones. Nothing translates between them yet, and this is the translation: a grant is a family of tools, and a persona holding no grant for a family means the family is never registered for that turn."
  >
    <SpecTable
      label="Grants to runtime tools"
      columns={["Grant", "Reach", "Becomes", "Why", "State"]}
      rows={grants}
      mono={[0, 2]}
      noted="grant"
    />
  </ReferenceSection>

  <ReferenceSection
    id="rows"
    kicker="What a turn is"
    title="A message, and a row beside it"
    lede="A Message carries blocks, an author, attachments and labels. It has nowhere to put the queries, the evidence, the tool calls or the usage, and it should not: those are facts about a run, not about what was said. So a turn is a row keyed to the response message it explains."
  >
    <SpecTable
      label="researchTurns"
      columns={["Field", "Holds", "Why it is stored"]}
      rows={turnRow}
      mono={[0]}
      noted="field"
    />
  </ReferenceSection>

  <ReferenceSection
    id="procedures"
    kicker="The doors"
    title="Seven procedures behind one index"
    lede="A research-chat capability beside the agents one, because a chat is a research thread and a task is not. Every command refreshes the chat it changed from inside the same request, as the agents capability already does."
  >
    <SpecTable
      label="Procedures"
      columns={["Procedure", "Kind", "Answers", "Refuses"]}
      rows={procedures}
      mono={[0]}
      noted="procedure"
    />
  </ReferenceSection>

  <ReferenceSection
    id="turn"
    kicker="One turn, end to end"
    title="From the composer to the inspector"
    lede="Six steps, four of which already exist in another capability. The two new ones are the queue key and the pair of writes that publish a response and its turn together."
  >
    <Noted scope="figure" label="Turn flow">
      <Flow label="A chat turn" steps={turn} />
    </Noted>
  </ReferenceSection>

  <ReferenceSection
    id="prompt"
    kicker="The system prompt"
    title="Four things the model is told before anything else"
    lede="Written down here rather than in a string constant, because every one of them is a decision that shows up in the surfaces."
  >
    <Callouts items={prompt} scope="prompt" />
  </ReferenceSection>

  <ReferenceSection
    id="streaming"
    kicker="Streaming"
    title="The row already says streaming; the port does not"
    lede="Worth settling now, because the answer decides whether the centre is built around a growing message or a settled one."
  >
    <Callouts items={streaming} scope="streaming" />
  </ReferenceSection>

  <ReferenceSection
    id="configuration"
    kicker="Configuration"
    title="Ten keys, one of them secret"
    lede="All of it arrived with the rebase. The chat adds no provider and no key of its own."
  >
    <SpecTable
      label="Configuration"
      columns={["Key", "Value", "Note"]}
      rows={configuration}
      mono={[0, 1]}
      noted="key"
    />
  </ReferenceSection>

  <ReferenceSection
    id="questions"
    kicker="Forks on this page"
    title="Decisions the intelligence layer raised"
    lede="Answer by number."
  >
    <Questions questions={questionsFor("intelligence")} />
  </ReferenceSection>
</ReferenceShell>
