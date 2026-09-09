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

  const page = pageOf("rebase");

  const history = [
    ["d1e8bab", "feat(agents): build the category end to end", "Mine. One commit, replayed unchanged.", "work/agents"],
    ["1166f8e", "docs(semantic-overlay): map ingestion and agent tools", "The new base, and the head of the branch I was sent to.", "work/derived-output-architecture"],
    ["205686e", "feat(slide-deck-editor): add prompt blocks", "The commit before it. Twenty-one of these sit between main and the base.", "work/derived-output-architecture"],
    ["306e308", "refactor(slide-deck-editor): flatten slide inspector", "The head of main, and an ancestor of both sides.", "main"]
  ];

  const headline = [
    {
      n: 1,
      title: "Zero conflicts, and that is a fact rather than a claim",
      body: "The replay printed Successfully rebased and updated refs/heads/work/agents and stopped for nothing. No conflict markers were resolved, no hunk was reapplied by hand, and the tree after the rebase differs from the tree before it only by the twenty-one commits it now sits on."
    },
    {
      n: 2,
      title: "The base had moved by one commit while I was reading it",
      body: "The survey said twenty commits between main and the derived output branch. The rebase landed on twenty-one. The extra one is the documentation commit that is now the base, which is also the page that catalogues the sixteen agent tools, so it changed what I read rather than what I had to merge."
    },
    {
      n: 3,
      title: "The two sides overlap in four files and nowhere else",
      body: "My commit touches 142 files. The branch underneath touches 236. The intersection is four, all of them lists: two vocabulary unions, the store's table registry and the demo index. Every one merged because the two edits land in different places in the same sorted list."
    }
  ];

  const overlap = [
    [
      "representation/store/tables.ts",
      "Four material tables, a semantic sync job, a derived output refresh job, a two-lane semantic object and a file subkind.",
      "agentTasks reshaped into a run, an automations table, and tools narrowed from string to the ToolId union.",
      "Both extend TABLE_NAMES and TableFields, but automations sorts before comments and derivedOutputRefreshJobs after dataBackReferences, so the hunks are forty lines apart."
    ],
    [
      "representation/data/types/workspace/views.ts",
      "One inspector key added: slide-deck-editor.prompt-block.",
      "Ten agents keys retired and agents.activity added.",
      "One sorted union, two different letters. The agents block and the slide-deck-editor block never touch."
    ],
    [
      "representation/data/behavior/workspace/views.ts",
      "The same key added to the runtime list beside the type.",
      "The same ten retired and one added.",
      "As above. The pair is edited in step by both sides, which is the point of keeping them adjacent."
    ],
    [
      "development-views/demo/components/demo-index.svelte",
      "Six cards for the semantic overlay and derived output demos.",
      "One card for this reference suite.",
      "Both append to the same array of cards in different places, and neither renames a field on it."
    ]
  ];

  const arrived = [
    ["capabilities/semantic-overlay", "50", "—", "Ingestion, embedding, the two durable lanes, retrieval and the material registry."],
    ["capabilities/derived-output", "31", "—", "The grounded synthesis loop, the resource reading session, the tool catalogue and the refresh queue."],
    ["representation/data", "27", "10", "Semantic material, sync, index lane, derived output and citation types, plus the behaviours over them."],
    ["model/server", "21", "2", "The intelligence port, its OpenRouter provision and the agent loop that runs inside it."],
    ["app-views/categories", "16", "23", "Prompt blocks in the document and slide editors, and the panels that go with them."],
    ["development-views", "12", "3", "Four reference suites: derived output architecture, semantic overlay, ingestion tools and slide prompt blocks."],
    ["routes/demo/semantic-overlay", "9", "—", "The routes those suites hang under."],
    ["configuration", "1", "2", "intelligence.yaml is new; representation.yaml and semantic-overlay.yaml gained keys."],
    ["docs", "3", "—", "The semantic overlay, the material layer and the development reference surfaces."]
  ];

  const floor = [
    {
      n: 1,
      title: "An intelligence port with exactly one method",
      body: "completeWithTools takes a system prompt, a user input, a list of tools, an optional forced first tool and an optional structured output, and answers with a value, a usage record, the tool calls it made and the number of rounds it took. The credential never crosses that boundary. It is constructed once in start.server.ts and hangs off the server model."
    },
    {
      n: 2,
      title: "Sixteen agent tools with an observation contract",
      body: "The catalogue names each tool's family, what it can see, what it returns, whether what it returns is evidence or only orientation, and the gate that decides whether it may be called. Fourteen of them are registered for real against the store by the resource reading session."
    },
    {
      n: 3,
      title: "A synthesis loop that refuses to answer ungrounded",
      body: "Evidence identifiers are issued by the tools, not by the model. The decision is parsed against a schema, every cited identifier must be one that was actually issued, and a decision that cites nothing is published as insufficient rather than as prose. This is the pattern a chat turn should copy rather than reinvent."
    },
    {
      n: 4,
      title: "A queue that survives a restart",
      body: "One durable job row per output plus one in-process flight, so every browser that asks joins the same run, a changed request supersedes the one in flight, and a process that died mid-run reclaims its own row."
    },
    {
      n: 5,
      title: "Six new tables and a two-lane overlay",
      body: "Text and material are separate lanes over the same overlay, materials carry a deterministic profile and a generated description, and both are addressable by handle within one attempt."
    }
  ];

  const checks = [
    ["Typecheck", "0 errors, 0 warnings", "0 errors, 0 warnings", "2,553 files before the replay, 2,952 after, 2,968 with these three pages"],
    ["Structural lint", "56 of 56", "56 of 56", "No rule needed changing"],
    ["Unit tests", "848 passed, 84 files", "968 passed, 2 skipped, 107 files", "The two skips are env-gated live calls"],
    ["The live call", "Not available on main", "1 passed", "Run once here with the gate on: real Jina embeddings, a real OpenRouter tool loop, 7.4 seconds"],
    ["Dependencies", "—", "mermaid added", "@lucide/svelte and @types/node moved a minor"]
  ];

  const issues = [
    {
      n: 1,
      title: "Without a local configuration the server does not start at all",
      body: "The intelligence is constructed eagerly while the server model is built, and its API key is read with requiredString, so an absent key throws before anything is served. Configuration comes only from app/configuration/*.yaml, merged with local.yaml last, and the loader does no environment interpolation, so the key in .env is readable by me and invisible to the constructor. A worktree is a fresh checkout with no ignored files, which is why this branch could not boot until it was fixed. Resolved by symlinking app/configuration/local.yaml at the main checkout's, which carries both the OpenRouter and the Jina credential. Both symlinks are ignored by git, so neither is in the commit."
    },
    {
      n: 2,
      title: "Two tests skip, and one of them is the only proof the wiring works",
      body: "The live derived output test is gated on ICARUS_LIVE_DERIVED_OUTPUT being 1 because it spends money at two providers, so it never runs in the default suite. It was run once from this branch after the symlinks were made and it passed in 7.4 seconds: real Jina embeddings, a real OpenRouter tool loop, a grounded answer. That is the credential path proved end to end from this worktree, and it is worth repeating deliberately rather than automatically."
    },
    {
      n: 3,
      title: "The demo card claimed a page count that was already wrong",
      body: "The card this suite is reached by said nine pages while the suite had eight. It now says eleven, which is what these three pages make it."
    },
    {
      n: 4,
      title: "The store's table registry is the one place a future rebase will fight",
      body: "TABLE_NAMES and TableFields are two sorted lists that every feature branch appends to. This time the letters were far apart. When two branches both add a table in the same neighbourhood the merge will stop there, and the resolution is always to keep both lines in sorted order."
    },
    {
      n: 5,
      title: "mermaid arrived as a runtime dependency of a demo",
      body: "It is pulled in by the derived output architecture reference pages rather than by the app. Nothing in the agents category imports it, and nothing in the app's own trees does either. Worth knowing before it is treated as part of the product's bundle."
    }
  ];

  const unwired = [
    ["The category imports nothing new", "No file under app-views/categories/agents imports the intelligence port, the semantic overlay or the derived output capability.", "The rebase changed the floor, not the building."],
    ["Task tools are grants, not runtime tools", "A persona grants one of six coarse tools. The runtime registers sixteen fine ones. Nothing translates between them yet.", "The intelligence page proposes the mapping."],
    ["Nothing dispatches a task", "Create and Run now still write a row and stop. The runner that would fill plan, outputs and questions is unbuilt.", "A chat turn is the smaller version of the same problem, which is why it is being built first."],
    ["The research chat is still a mock", "research/content/thread.svelte is 1,182 lines of local types over invented data, and the research rail has eight keys with no panels behind them.", "The Explore page is the design that replaces it."]
  ];

  const steps = [
    { actor: "Squash", action: "The category's work is amended into its single commit.", artifact: "d1e8bab feat(agents): build the category end to end" },
    { actor: "Rebase", action: "That commit is replayed onto the derived output branch's head.", artifact: "git rebase work/derived-output-architecture" },
    { actor: "Merge", action: "Four overlapping files merge by hunk; nothing stops.", artifact: "Successfully rebased and updated refs/heads/work/agents" },
    { actor: "Install", action: "The lockfile brings one new dependency and two minors.", artifact: "+ mermaid 11.17.2" },
    { actor: "Verify", action: "Typecheck, structural lint and the unit suite are run against the new base.", artifact: "0 errors · 56 of 56 · 968 passed" },
    { actor: "Prove", action: "The symlinked credentials are exercised once against both providers.", artifact: "ICARUS_LIVE_DERIVED_OUTPUT=1 · 1 passed" }
  ];
</script>

<ReferenceShell {page} {project}>
  <ReferenceSection
    id="headline"
    kicker="What happened"
    title="One commit, replayed onto twenty-one"
    lede="The instruction was to rebase onto the branch that carries the read tools and the semantic overlay, then write down every conflict and issue. There were no conflicts. This page spends its length on the second half of that sentence."
  >
    <SpecTable
      label="The history after the rebase"
      columns={["Commit", "Subject", "What it is", "Branch"]}
      rows={history}
      mono={[0]}
      noted="commit"
    />
    <Callouts items={headline} scope="headline" />
  </ReferenceSection>

  <ReferenceSection
    id="steps"
    kicker="The replay"
    title="Six steps, none of which stopped"
    lede="Recorded because a rebase that produces nothing to resolve leaves no evidence of itself, and next time somebody will want to know what was actually run."
  >
    <Noted scope="figure" label="Rebase flow">
      <Flow label="The rebase" steps={steps} tone="intelligence" />
    </Noted>
  </ReferenceSection>

  <ReferenceSection
    id="overlap"
    kicker="Where the two sides met"
    title="Four files, and why none of them fought"
    lede="These are the only files touched by both my commit and the twenty-one underneath it. All four are lists. In each one the two edits land in different neighbourhoods of the same sorted sequence, which is the whole reason the replay was quiet."
  >
    <SpecTable
      label="Overlapping files"
      columns={["File", "The branch underneath", "The agents commit", "Why it merged"]}
      rows={overlap}
      mono={[0]}
      noted="overlap"
    />
  </ReferenceSection>

  <ReferenceSection
    id="arrived"
    kicker="What arrived"
    title="Two hundred and thirty-six files, mostly two capabilities"
    lede="What the category now sits on. None of it is imported by the agents trees yet, which is why the rebase changed no behaviour on any of the pages in this suite."
  >
    <SpecTable
      label="What the branch brought"
      columns={["Tree", "Added", "Modified", "What it is"]}
      rows={arrived}
      mono={[0]}
      noted="tree"
    />
  </ReferenceSection>

  <ReferenceSection
    id="floor"
    kicker="The new floor"
    title="Five things the category can now reach"
    lede="The reason for rebasing onto this branch rather than main. Each of these is used by the plan on the next two pages."
  >
    <Callouts items={floor} scope="floor" />
  </ReferenceSection>

  <ReferenceSection
    id="checks"
    kicker="Checks"
    title="Typecheck, lint and the suite, before and after"
    lede="Before is the same commit sitting on main. After is that commit sitting on the derived output branch, with the lockfile installed."
  >
    <SpecTable
      label="Checks"
      columns={["Check", "Before", "After", "Note"]}
      rows={checks}
      noted="check"
    />
  </ReferenceSection>

  <ReferenceSection
    id="issues"
    kicker="Issues"
    title="Five things that needed resolving, and what I did"
    lede="None of these is a merge conflict. They are the things that were wrong or newly load-bearing once the two branches were one, found by reading rather than by the rebase stopping."
  >
    <Callouts items={issues} scope="issue" />
  </ReferenceSection>

  <ReferenceSection
    id="unwired"
    kicker="Still true after the move"
    title="Four seams the rebase did not close"
    lede="Worth stating plainly so the next page is read as a plan rather than as a description of something that exists."
  >
    <SpecTable
      label="Seams"
      columns={["Seam", "Where it stands", "Where it is answered"]}
      rows={unwired}
      noted="seam"
    />
  </ReferenceSection>

  <ReferenceSection
    id="questions"
    kicker="Forks on this page"
    title="Decisions the migration raised"
    lede="Answer by number."
  >
    <Questions questions={questionsFor("rebase")} />
  </ReferenceSection>
</ReferenceShell>
