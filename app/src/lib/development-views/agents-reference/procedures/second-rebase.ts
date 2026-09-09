import type { Callout } from "$development-views/agents-reference/types";

export const TOPOLOGY = `graph TD
  classDef ours fill:#1f2937,stroke:#4b5563,color:#f9fafb
  classDef gone fill:#3f1d1d,stroke:#7f1d1d,color:#fca5a5
  classDef base fill:#132e1f,stroke:#166534,color:#86efac

  subgraph before["Where the branch stood"]
    m0["306e308 · main<br/>flatten slide inspector"]
    m0 --> old21["21 commits<br/>semantic overlay, derived output"]
    old21 --> oldhead["1166f8e<br/>map ingestion and agent tools"]
    oldhead --> c1["d1e8bab · agents"]
    c1 --> c2["b52a214 · research chat"]
  end

  subgraph after["Where it had moved to"]
    m0 --> arch["3 commits on main<br/>audit pillars · commands vs helpers<br/>recoverable unit of work"]
    arch --> m1["8ba102e · main"]
    m1 --> new21["the same 21 commits,<br/>replayed with new hashes"]
    new21 --> newhead["794c453<br/>map ingestion and agent tools"]
    newhead --> tpl["13 commits<br/>the template system"]
    tpl --> tip["deab480 · the new base"]
  end

  oldhead -.->|"same patch, new hash"| newhead
  c2 ==>|"git rebase --onto"| tip

  class c1,c2 ours
  class oldhead,old21 gone
  class arch,m1,tpl,tip base`;

export const RESOLUTION = `flowchart LR
  classDef stop fill:#3f1d1d,stroke:#7f1d1d,color:#fca5a5
  classDef quiet fill:#2b2410,stroke:#854d0e,color:#fde68a
  classDef done fill:#132e1f,stroke:#166534,color:#86efac

  replay(["replay 2 commits over 37"]) --> git{"git stops?"}

  git -->|"3 files"| loud["conflict markers<br/>demo index · persist · tables"]
  git -->|"207 files"| clean["merged without stopping"]

  loud --> read["read both sides,<br/>then read what the base built"]
  read --> keep["keep the base's mechanism,<br/>keep our line"]
  keep --> green1["3 resolved by hand"]

  clean --> tc{"typecheck"}
  tc -->|"2 errors"| rename["a type was renamed<br/>and a field became optional"]
  tc -->|"clean"| lint{"structural lint"}
  rename --> narrow["narrow where it maps"]
  narrow --> lint

  lint -->|"129 findings<br/>across 15 checks"| triage["fix what is ours to fix,<br/>baseline the rest with a reason"]
  lint -->|"clean"| tests{"unit suite"}
  triage --> tests

  tests -->|"19 failed"| doubles["the test doubles<br/>have no transaction"]
  tests -->|"1,155 passed"| green2["green"]
  doubles --> green2
  green1 --> green2

  class loud,rename,doubles stop
  class triage quiet
  class green1,green2,clean done`;

export const HISTORY: readonly (readonly string[])[] = [
  [
    "deab480",
    "fix(integration): reconcile templates with derived outputs",
    "The new base. The head of work/derived-output-architecture.",
    "base"
  ],
  [
    "794c453",
    "docs(semantic-overlay): map ingestion and agent tools",
    "The commit this branch used to sit on, replayed with a new hash. It was 1166f8e.",
    "rewritten"
  ],
  [
    "8ba102e",
    "feat(store): add recoverable unit of work",
    "The head of main, and the reason the base was rewritten at all.",
    "main"
  ],
  [
    "306e308",
    "refactor(slide-deck-editor): flatten slide inspector",
    "The old head of main, and the fork point both sides still share.",
    "main"
  ],
  [
    "61cba5d",
    "feat(agents): build the category end to end",
    "Ours, replayed. Was d1e8bab. 142 files.",
    "ours"
  ],
  [
    "2aaad1e",
    "feat(research-chat): build Explore end to end",
    "Ours, replayed. Was b52a214. 91 files.",
    "ours"
  ]
];

export const HEADLINE: readonly Callout[] = [
  {
    n: 1,
    title: "The base was rewritten, not extended",
    body: "Three commits landed on main — the audit pillars, a rule separating commands from pure helpers, and a recoverable unit of work — and the derived output branch was rebased onto them. The twenty-one commits this branch was sitting on came back with different hashes. Nothing was lost; everything moved."
  },
  {
    n: 2,
    title: "Two commits were replayed, not twenty-three",
    body: "git rebase work/derived-output-architecture would have replayed everything from the shared fork point and relied on patch-id matching to drop the twenty-one that had been rewritten. git rebase --onto work/derived-output-architecture 1166f8e names the two commits that are actually ours and replays exactly those."
  },
  {
    n: 3,
    title: "Three files stopped the replay, and three more things stopped it later",
    body: "git found three conflicts. Typecheck found a fourth that git had merged cleanly and wrongly. The structural lint found a fifth, worth a hundred and twenty-nine findings. The unit suite found a sixth. A rebase is not finished when git says it is."
  },
  {
    n: 4,
    title: "The recovery story got better by losing an argument",
    body: "This branch had added a .previous copy of every table file. The base had added a write-ahead journal with replay on start. They collided in one file, the journal won on the merits, and the .previous change was dropped rather than layered on top."
  }
];

export const CONFLICTS: readonly {
  readonly n: number;
  readonly file: string;
  readonly commit: string;
  readonly ours: string;
  readonly theirs: string;
  readonly took: string;
  readonly why: string;
}[] = [
  {
    n: 1,
    file: "development-views/demo/components/demo-index.svelte",
    commit: "1 of 2 · agents",
    ours: "A card for the agents reference suite, appended after the Template reference card.",
    theirs: "The Template reference card's own description rewritten, because templates stopped being a proposal and became a built system.",
    took: "Both.",
    why: "The two edits are the same three lines of one array: ours added an entry immediately below the text theirs replaced, so the hunks could not be separated. Keeping the base's description and our card is the whole resolution. The second commit then auto-merged its own update to that same card — nine pages became sixteen — on top of it."
  },
  {
    n: 2,
    file: "model/server/store/methods/shared/persist.server.ts",
    commit: "2 of 2 · research chat",
    ours: "persist renames the current table file to <table>.json.previous before moving the new one into place, so the version it replaced is still on disk.",
    theirs: "persist delegates to writeDurableFile, which writes, fsyncs the file, renames, then fsyncs the containing directory — under a journal that names every table's committed value before any file is touched.",
    took: "Theirs, whole. Ours was dropped.",
    why: "Two reasons, and either alone would settle it. Their write is durable and ours was not: ours used a plain writeFileSync and never synced anything, so a power loss could lose a write the process believed had landed. And .previous is worse than useless under a journal: recovery replays persist for every table in the journal, so a table already written before the interruption has its new value renamed to .previous on the way back through. The file that claims to be the version before this one would hold the torn intermediate."
  },
  {
    n: 3,
    file: "representation/store/tables.ts",
    commit: "2 of 2 · research chat",
    ours: "researchTurns: ResearchTurnFields added to TableFields, one line above resourceSets.",
    theirs: "resourceSets: NamedResourceSetFields renamed to ResourceSetFields, because a row is no longer necessarily named.",
    took: "Both.",
    why: "Adjacent lines in the same sorted map: our insertion and their rename land in the same hunk. The resolution is one line each. This is the file the first rebase predicted would fight, and it is the one that did."
  }
];

export const SILENT: readonly {
  readonly n: number;
  readonly found: string;
  readonly what: string;
  readonly cost: string;
  readonly fix: string;
}[] = [
  {
    n: 1,
    found: "Typecheck · 2 errors",
    what: "A resource set row's name became optional and boundTo was added, so a row can be bound to one template hole or one resource instead of being a project's named set. git merged the declaration cleanly — it took the base's — and left our reference to the old name dangling one line below.",
    cost: "agents/api/shared/projection.ts, where the persona scope picker lists the project's named sets.",
    fix: "The filter that proved name was a string could not carry that proof into the map beside it. One flatMap narrows where it maps. The behaviour this now states out loud: a bound row is not offered as a persona's scope, because it belongs to one hole, not to the project."
  },
  {
    n: 2,
    found: "Structural lint · 129 findings across 15 checks",
    what: "The lint grew from fifty-six checks to ninety: eight new pillars, and a baseline file that grandfathers what was already in the tree when each checker became blocking. Our two hundred and ten files were written against the fifty-six and met the ninety for the first time in the replay.",
    cost: "Both new capabilities, both new view categories, every reference route, and three baseline entries pointing at a file this branch deleted.",
    fix: "Twenty-four findings were fixed and ninety were baselined with a rationale naming this rebase rather than the file's borrowed default. Twelve stale entries and three invalid ones were removed, because the work resolved the debt they were holding open."
  },
  {
    n: 3,
    found: "Unit suite · 19 failed",
    what: "Both capabilities have a hand-written fake store in their unit tests. Neither had a transaction method, so every command that had just been wrapped in one threw model.store.transaction is not a function.",
    cost: "6 tests in agents, 13 in research chat.",
    fix: "Both fakes gained a transaction that snapshots the tables, runs the work against the same object, and restores on a throw — the rollback the real store gets from staging into isolated state."
  }
];

/** The twenty-four findings answered by changing the code, and the fifteen entries removed. */
export const FIXED: readonly (readonly string[])[] = [
  [
    "multi-write-capability-uses-a-unit-of-work",
    "9",
    "Every command in both capabilities stages its writes in one store.transaction. ask does it four times rather than once, because a turn is not one synchronous moment: reclaiming a stranded turn, opening this one, publishing the answer, and recording a failure are four intents with a model call between them."
  ],
  [
    "multi-table-intent-is-atomic",
    "9",
    "The nine intents named in the Store's shared failpoint contract, beside the twenty-one already there."
  ],
  [
    "subject-write-proves-ownership",
    "2",
    "A cross-project ownership contract per capability, naming all eighteen commands and asserting that each resolves its subject through the request scope and takes no project from its own input."
  ],
  [
    "mutable-state-has-an-instance",
    "2",
    "Two constant lookup tables were built with new Map at module load. They are plain records now, which is what they always were."
  ],
  [
    "architecture-docs-match-the-graph",
    "1",
    "capabilities.md names agents and research-chat in the subject inventory."
  ],
  [
    "production-svelte-imports-no-capability",
    "1",
    "Project Overview called createThread from inside the component. It calls a named procedure now, which calls the capability."
  ],
  [
    "removed · stale entries",
    "12",
    "Debt grandfathered in files this branch replaced: the fixture agents procedures, the mock research thread, and the tab state they declared. The lint asks for a resolved exception to be taken out, so a baseline never outlives the code it was written for."
  ],
  [
    "removed · invalid entries",
    "3",
    "Three entries pointed at app-views/categories/agents/procedures/agents.ts, the fixture module this branch deleted. architecture-exceptions-expire refuses to be baselined, so these had to go rather than be held."
  ]
];

export const BASELINED: readonly (readonly string[])[] = [
  [
    "async-command-state-lives-with-command",
    "34",
    "Base carries 29",
    "Inline async handlers in the agents and research components. A mechanical move into procedures/, and the same debt every view in the tree already has."
  ],
  [
    "component-effects-have-a-home",
    "21",
    "Base carries 65",
    "onMount, onDestroy and $effect written where they are used rather than in procedures/effects/."
  ],
  [
    "development-fixtures-stay-in-development",
    "18",
    "Base carries 0",
    "The live reference routes import their pages from development-views. Routes under /demo/ are exempt from this rule; these are not, and cannot move there — a remote function resolves its scope from the project in the page's path, and every page here reads the project's real store."
  ],
  [
    "remounted-views-hold-no-declared-tab-state",
    "5",
    "Base carries 11",
    "The checker wants an @state-lifetime annotation on every local binding. No content view in the tree carries one; all eleven that exist are baselined too."
  ],
  [
    "source-complexity-is-reviewed",
    "5",
    "Base carries 23",
    "The chat's tool set, its answer, its ask, the library procedures and the agents projection are each over the line the checker draws."
  ],
  [
    "component-state-declares-a-lifetime",
    "4",
    "Base carries 8",
    "The same annotation, asked for by a second checker at file scope."
  ],
  [
    "procedure-directory-has-one-entry-chain",
    "2",
    "Base carries 22",
    "library.svelte.ts exposes twenty-one entry chains and chat.svelte.ts six. One directory per subject rather than one per chain."
  ],
  [
    "mutable-state-has-an-instance",
    "1",
    "Base carries 3",
    "The draft holder. A half-typed message survives a tab switch precisely because that Map is module state and not the surface's."
  ],
  [
    "production-io-has-a-model-owner",
    "1",
    "Base carries 1",
    "The review gutter's endpoint appends a note to a file with node:fs. It is an instrument for reading these pages, not a part of the product."
  ]
];

export const CHECKS: readonly (readonly string[])[] = [
  ["Typecheck", "2 errors · 3,263 files", "0 errors · 0 warnings", "One rename, two call sites"],
  ["Structural lint", "15 of 90 with findings · 129 findings", "90 of 90 clean · 379 baselined", "24 fixed · 90 baselined · 15 entries removed"],
  ["Unit tests", "19 failed · 1,132 passed", "1,155 passed · 2 skipped · 133 files", "4 new tests, both of them contracts"],
  ["Baseline entries", "300", "379", "288 kept · 91 added · 12 dropped; the extra one is this page's own route"],
  ["Conflicted files", "3", "0", "demo index · persist · tables"]
];

export const STEPS: readonly { actor: string; action: string; artifact?: string }[] = [
  {
    actor: "Survey",
    action: "Compare both sides before touching either. The base had moved by thirty-seven commits and rewritten twenty-one of them.",
    artifact: "git merge-base · 306e308"
  },
  {
    actor: "Protect",
    action: "Stop the dev server so nothing writes stale state back, and name the pre-rebase tip so it can be returned to.",
    artifact: "backup/agents-pre-rebase-2"
  },
  {
    actor: "Replay",
    action: "Replay exactly the two commits that are ours onto the new head.",
    artifact: "git rebase --onto work/derived-output-architecture 1166f8e"
  },
  {
    actor: "Resolve",
    action: "Three conflicts, each read against what the base actually built rather than against its diff.",
    artifact: "1 kept both · 1 kept theirs · 1 kept both"
  },
  {
    actor: "Reconcile",
    action: "Typecheck, then the lint's eight new pillars, then the suite. Fix what is ours; baseline the rest with a reason that says what it is.",
    artifact: "0 errors · 90 of 90 · 1,155 passed"
  },
  {
    actor: "Correct",
    action: "Rewrite the two reference pages that documented the recovery mechanism this rebase gave up.",
    artifact: "page-research-chat · research-chat-diagrams"
  }
];

export const CARRIED: readonly (readonly string[])[] = [
  [
    "A write-ahead journal, and recovery on start",
    "The Store stages a multi-table intent in isolation, writes a journal naming every table's committed value, replaces each file durably, then removes the journal. A process that stops in the middle finds the journal on the next start and finishes the same decision before it serves a read.",
    "Replaces the .previous copy this branch had added, and is the mechanism both new capabilities now write through."
  ],
  [
    "Eight architecture pillars, thirty-four new checks",
    "state ownership, procedural transparency, scoped authority, atomic invariants, gated crossings, authoritative data, cohesive units, owned lifecycle — each with a contract id and a baseline that records, per finding, why an exception is still open.",
    "The reason a hundred and twenty-nine findings appeared in code that had not changed."
  ],
  [
    "The template system, end to end",
    "Thirteen commits and three hundred and twenty-one files: project-bound templates, shared working copies, holes, and one scope builder behind four doors.",
    "Nothing in either new capability touches it. It is why a resource set row is no longer necessarily named."
  ],
  [
    "A rule separating commands from pure helpers",
    "A helper that only computes may not write; a command that writes says so in its name and its home.",
    "Cost nothing here — both capabilities were already shaped that way — but it is why rowsIn and openThread now take a unit of work rather than the whole Store."
  ]
];
