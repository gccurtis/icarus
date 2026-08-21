/**
 * A line of enquiry: one thread, anchored to one turn.
 *
 * `docs/screen-panel-views/context/research/` and `inspector/research/` are what
 * these serve. The screen sits on a single turn rather than a scrollback, so the
 * doors are split by *which* turn they answer for — the current one, an earlier
 * one, or the thread as a whole — and a panel that wants the thread's total asks
 * for the thread, never for the sum of the turns it can see.
 *
 * The rule the whole subject keeps: a finding is a conclusion, not a quotation.
 * It has sources under it and it can be wrong about them, which is why a
 * proposal is editable and an acceptance is not.
 */
import { actorName, type AgentId } from "$mock-capabilities/cast";
import { read, type Read } from "$mock-capabilities/read";

/** The three jobs a thread can have, chosen when it starts. */
export type ThreadMode = "Discover" | "Question" | "Hypothesis";

export type ResearchThread = {
  readonly id: string;
  readonly title: string;
  readonly mode: ThreadMode;
  /** The same fact as a sentence, for the places that name the job rather than the mode. */
  readonly job: "Look around" | "Answer one question" | "Test an idea";
  /** Absent on a Discover thread: there is nothing for it to anchor to. */
  readonly anchor?: { readonly ref: string; readonly text: string };
  readonly turns: number;
  readonly accepted: number;
  readonly proposed: number;
  /** Distinct sources across the thread's turns, not a sum of the per-turn counts. */
  readonly sources: number;
  readonly lastAsked: string;
  /** A persona reference. Every turn runs as this agent — there is no per-turn switch. */
  readonly agent: AgentId;
  /** The persona's allowance, read in the thread lens beside the scope. */
  readonly toolsAllowed: number;
  readonly createdBy: string;
  readonly revision: number;
  readonly updated: string;
};

export type Turn = {
  readonly id: string;
  readonly prompt: string;
  readonly answer: string;
  /** Clock time: the trace heads its sections with it and the ask card labels itself with it. */
  readonly at: string;
  readonly ago: string;
  /**
   * What it produced, already phrased. A list of prompts alone would not say
   * which turn mattered.
   */
  readonly produced: string;
  readonly proposed: number;
  readonly accepted: number;
};

export type Source = {
  readonly id: string;
  readonly title: string;
  readonly kind: "Resource" | "External file" | "Web";
  /** Whatever a locator means for that kind — a page, a row range, a URL fragment. */
  readonly locator: string;
  readonly excerpt: string;
  /** Web only. A URL is not a source once the page changes. */
  readonly capturedAt?: string;
  /** Tool output, so a web result has none. They are not generic source fields. */
  readonly scores?: { readonly relevance: number; readonly density: number };
  /** How many turns in this thread have used it. */
  readonly uses: number;
  /** What it ended up supporting, read backwards from the answers and findings citing it. */
  readonly usedBy: readonly string[];
};

export type ToolCall = {
  readonly id: string;
  readonly turnId: string;
  readonly name: string;
  /**
   * A call that found nothing is an outcome, not an error — and the most
   * informative row on the screen when a turn produced a weak answer.
   */
  readonly outcome: "Success" | "Nothing found" | "Failed";
  readonly duration: string;
  readonly result: string;
  /** The arguments as stored, unrendered. */
  readonly input: string;
  /**
   * The scope as it actually resolved for this call. Historical scope lives here
   * rather than on the thread, which can be edited after the fact.
   */
  readonly resolvedScope: string;
};

/** Grouped by turn, newest first, because "why did it say that" is asked of one turn. */
export type TurnTrace = {
  readonly turnId: string;
  readonly heading: string;
  readonly calls: readonly ToolCall[];
};

/**
 * One end of a `ResearchLink`, named as the panel at the other end reads it.
 * The same row serves a finding's *Bears on* and a hypothesis's *Evidence*,
 * because a link is symmetric and only the direction you read it from changes.
 */
export type Bearing = {
  readonly id: string;
  readonly kind: "question" | "hypothesis" | "finding";
  readonly ref: string;
  readonly title: string;
  /** On the link, not on the finding: one finding bears differently on different ideas. */
  readonly bearing: "Supports" | "Contradicts" | "Neutral";
};

export type FindingSource = {
  readonly sourceId: string;
  readonly title: string;
  readonly locator: string;
  /**
   * An excerpt is copied on accept and survives the source changing. A locator
   * only points, and can rot.
   */
  readonly capture: "excerpt" | "locator";
  readonly excerpt?: string;
};

export type Finding = {
  readonly id: string;
  readonly state: "proposed" | "accepted";
  readonly title: string;
  readonly body: string;
  readonly threadId: string;
  readonly turnId: string;
  /** Whether a source carries it outright, or the agent concluded it from several. */
  readonly derivation: "From this turn" | "Inference";
  readonly acceptedBy?: string;
  readonly acceptedAt?: string;
  /** Accepted is retrievable project-wide; proposed is not. That is the whole difference. */
  readonly inLattice: boolean;
  readonly standingOn: readonly FindingSource[];
  readonly bearsOn: readonly Bearing[];
};

export type Question = {
  readonly id: string;
  /** The short reference panels lead with: `Q-14`. */
  readonly ref: string;
  readonly text: string;
  /** Set by a person. A question with three accepted findings can still be open. */
  readonly status: "Open" | "Investigating" | "Answered";
  readonly parentId?: string;
  /** Carried on the row so the lens can name the parent without a second query. */
  readonly parentText?: string;
  readonly depth: 0 | 1;
  /** True on the one the current thread is anchored to, marked in place in the tree. */
  readonly anchored: boolean;
};

export type Hypothesis = {
  readonly id: string;
  readonly ref: string;
  readonly statement: string;
  /** A human judgment, never a tally of the supporting and contradicting findings. */
  readonly assessment: "Testing" | "Supported" | "Refuted";
  /** 0–1, with no author and no time on it. A bare 0.70 is barely interpretable. */
  readonly confidence: number;
};

/** What the thread can search, and what that came to when it was last resolved. */
export type ThreadScope = {
  readonly name: string;
  readonly resources: number;
  readonly web: boolean;
  readonly resolvedAt: string;
  readonly indexed: number;
  /** The gap between contained and indexed. It is the useful number here. */
  readonly withoutMaterial: number;
  /** True when the set is absent or resolves to nothing — the silent widest-scope case. */
  readonly unbounded: boolean;
};

const THREADS: readonly ResearchThread[] = [
  {
    id: "th-feeder",
    title: "Why did Feeder 12 fail twice?",
    mode: "Question",
    job: "Answer one question",
    anchor: { ref: "Q-14", text: "Why did Feeder 12 fail twice?" },
    turns: 3,
    accepted: 3,
    proposed: 2,
    sources: 6,
    lastAsked: "just now",
    agent: "grid-analyst",
    toolsAllowed: 4,
    createdBy: actorName("ana"),
    revision: 7,
    updated: "yesterday"
  },
  {
    id: "th-underground",
    title: "Undergrounding beats vegetation management",
    mode: "Hypothesis",
    job: "Test an idea",
    anchor: { ref: "H-7", text: "Undergrounding outperforms vegetation management per pound spent" },
    turns: 22,
    accepted: 9,
    proposed: 1,
    sources: 31,
    lastAsked: "2 days ago",
    agent: "grid-analyst",
    toolsAllowed: 4,
    createdBy: actorName("mira"),
    revision: 44,
    updated: "2 days ago"
  },
  {
    id: "th-precedents",
    title: "Winter storm precedents",
    mode: "Discover",
    job: "Look around",
    turns: 9,
    accepted: 4,
    proposed: 0,
    sources: 18,
    lastAsked: "1 week ago",
    agent: "source-checker",
    toolsAllowed: 3,
    createdBy: actorName("tomas"),
    revision: 12,
    updated: "1 week ago"
  },
  {
    id: "th-eastbrook",
    title: "Is Eastbrook exposed the same way?",
    mode: "Question",
    job: "Answer one question",
    anchor: { ref: "Q-16", text: "Is Eastbrook exposed the same way?" },
    turns: 4,
    accepted: 2,
    proposed: 0,
    sources: 11,
    lastAsked: "3 weeks ago",
    agent: "grid-analyst",
    toolsAllowed: 4,
    createdBy: actorName("ana"),
    revision: 6,
    updated: "3 weeks ago"
  }
];

/** Newest first. The screen is anchored to `TURNS[0]`; the rest are history. */
const TURNS: readonly Turn[] = [
  {
    id: "tn-3",
    prompt: "Was the coordination study ever redone after the 2024 reconductoring?",
    answer:
      "Neither the filings index nor the Commission's public docket lists a coordination study for the Feeder 12 tie dated after the 2024 reconductoring. The 2019 study is the most recent on file, and it assumes 6.2 kA of available fault current at the tie against the 7.3 kA measured in the January event — roughly 18% higher. On that record the settings in service on 14 January and 3 March 2026 were derived from a fault duty that no longer holds.",
    at: "10:21",
    ago: "now",
    produced: "2 findings proposed",
    proposed: 2,
    accepted: 0
  },
  {
    id: "tn-2",
    prompt: "Why did Feeder 12 fail twice?",
    answer:
      "Both failures cleared upstream of the intended device. The recloser operated at 0.42 s against a 0.61 s fuse clearing time on 14 January, and again at 0.44 s on 3 March, so the fuse never saw either fault. The two events share the sequence, not the weather.",
    at: "10:14",
    ago: "7m",
    produced: "1 finding accepted",
    proposed: 0,
    accepted: 1
  },
  {
    id: "tn-1",
    prompt: "What does the event log show for January?",
    answer:
      "The storm window holds 4,182 logged operations, of which 311 name Feeder 12. Nothing in them separates a relay cause from a vegetation cause: the log records operations, not causes.",
    at: "10:02",
    ago: "19m",
    produced: "no findings",
    proposed: 0,
    accepted: 0
  }
];

const SOURCES: readonly Source[] = [
  {
    id: "s-relay",
    title: "feeder-12-relay.pdf",
    kind: "External file",
    locator: "p.7",
    excerpt:
      "…the recloser operated at 0.42 s, ahead of the 0.61 s fuse clearing time, so the fault was cleared upstream of the intended device…",
    scores: { relevance: 0.86, density: 0.41 },
    uses: 2,
    usedBy: ["This answer", "1 accepted finding"]
  },
  {
    id: "s-docket",
    title: "nerc.gov/docket/2024-882",
    kind: "Web",
    locator: "Filing index, 2024",
    excerpt:
      "…no protection coordination study was submitted for the Northwind tie in the 2024 filing year…",
    capturedAt: "10:21",
    uses: 1,
    usedBy: ["This answer"]
  },
  {
    id: "s-study",
    title: "2019 coordination study.pdf",
    kind: "External file",
    locator: "§4.2, p.19",
    excerpt:
      "…settings are derived for 6.2 kA of available fault current at the Feeder 12 tie, the value measured at commissioning…",
    scores: { relevance: 0.79, density: 0.33 },
    uses: 1,
    usedBy: ["This answer", "1 proposed finding"]
  },
  {
    id: "s-stormlog",
    title: "storm-log-2026-01.csv",
    kind: "Resource",
    locator: "rows 1,204–1,318",
    excerpt: "…14 Jan 2026 03:12:07 · FDR-12 · recloser operation · 0.42 s · lockout after 2…",
    scores: { relevance: 0.74, density: 0.62 },
    uses: 2,
    usedBy: ["2 accepted findings"]
  },
  {
    id: "s-nerc",
    title: "NERC-2025-winter-review.pdf",
    kind: "External file",
    locator: "p.44",
    excerpt:
      "…repeat operations on the same feeder within one season were the strongest single predictor of a mis-coordinated pair…",
    scores: { relevance: 0.68, density: 0.29 },
    uses: 1,
    usedBy: ["1 accepted finding"]
  },
  {
    id: "s-inventory",
    title: "Substation Inventory",
    kind: "Resource",
    locator: "Eastbrook · row 27",
    excerpt: "…Eastbrook · 1998 · reconductored 2024 · protection last reviewed 2019…",
    scores: { relevance: 0.61, density: 0.18 },
    uses: 1,
    usedBy: ["1 earlier answer"]
  }
];

/** Which sources each turn read. A source is listed once per thread, however many turns used it. */
const SOURCES_BY_TURN: Record<string, readonly string[]> = {
  "tn-3": ["s-relay", "s-docket", "s-study"],
  "tn-2": ["s-relay", "s-stormlog", "s-nerc"],
  "tn-1": ["s-stormlog", "s-inventory"]
};

const CALLS: readonly ToolCall[] = [
  {
    id: "tc-31",
    turnId: "tn-3",
    name: "lattice.retrieve",
    outcome: "Success",
    duration: "1.2 s",
    result: "4 regions across 3 sources.",
    input:
      '{ "query": "coordination study after reconductoring", "scope": "rs_field_reports_2024_25" }',
    resolvedScope: "rs_field_reports_2024_25 · 96 resources · 88 indexed · resolved 10:21:04"
  },
  {
    id: "tc-32",
    turnId: "tn-3",
    name: "web.search",
    outcome: "Success",
    duration: "2.8 s",
    result: "2 results, 1 captured.",
    input: '{ "query": "Northwind protection coordination study 2024 docket", "results": 5 }',
    resolvedScope: "Web · unscoped · captured 10:21:44"
  },
  {
    id: "tc-21",
    turnId: "tn-2",
    name: "lattice.retrieve",
    outcome: "Success",
    duration: "1.4 s",
    result: "6 regions across 2 sources.",
    input: '{ "query": "Feeder 12 recloser operation January March", "scope": "rs_field_reports_2024_25" }',
    resolvedScope: "rs_field_reports_2024_25 · 96 resources · 88 indexed · resolved 10:14:11"
  },
  {
    id: "tc-22",
    turnId: "tn-2",
    name: "resource.read",
    outcome: "Success",
    duration: "0.3 s",
    result: "storm-log-2026-01.csv · rows 1,204–1,318.",
    input: '{ "resource": "storm-log-2026-01.csv", "rows": "1204:1318" }',
    resolvedScope: "Direct read · no scope resolved"
  },
  {
    id: "tc-11",
    turnId: "tn-1",
    name: "lattice.retrieve",
    outcome: "Nothing found",
    duration: "0.9 s",
    result: "No sufficiently relevant material.",
    input: '{ "query": "January event log cause", "scope": "rs_field_reports_2024_25" }',
    resolvedScope: "rs_field_reports_2024_25 · 96 resources · 88 indexed · resolved 10:02:38"
  },
  {
    id: "tc-12",
    turnId: "tn-1",
    name: "resource.read",
    outcome: "Success",
    duration: "0.4 s",
    result: "storm-log-2026-01.csv · 4,182 rows, 311 naming FDR-12.",
    input: '{ "resource": "storm-log-2026-01.csv", "filter": "feeder = FDR-12" }',
    resolvedScope: "Direct read · no scope resolved"
  }
];

const FINDINGS: readonly Finding[] = [
  {
    id: "f-nostudy",
    state: "proposed",
    title: "No coordination study exists after the 2024 reconductoring",
    body: "Neither the filings index nor the Commission's public docket lists a coordination study dated after the 2024 reconductoring, which raised available fault current on the tie by roughly 18%.",
    threadId: "th-feeder",
    turnId: "tn-3",
    derivation: "From this turn",
    inLattice: false,
    standingOn: [
      { sourceId: "s-relay", title: "feeder-12-relay.pdf", locator: "p.7", capture: "locator" },
      {
        sourceId: "s-docket",
        title: "nerc.gov/docket/2024-882",
        locator: "Filing index, 2024",
        capture: "locator"
      }
    ],
    bearsOn: [
      {
        id: "bl-1",
        kind: "question",
        ref: "Q-14",
        title: "Why did Feeder 12 fail twice?",
        bearing: "Neutral"
      },
      {
        id: "bl-2",
        kind: "hypothesis",
        ref: "H-3",
        title: "Coordination never redone",
        bearing: "Supports"
      }
    ]
  },
  {
    id: "f-settings",
    state: "proposed",
    title: "2019 settings are invalid at current fault levels",
    body: "The settings in service on Feeder 12 were derived in 2019 against 6.2 kA of available fault current. The January event measured 7.3 kA at the same tie, so the coordination margin those settings assume no longer exists.",
    threadId: "th-feeder",
    turnId: "tn-3",
    derivation: "Inference",
    inLattice: false,
    standingOn: [
      {
        sourceId: "s-study",
        title: "2019 coordination study.pdf",
        locator: "§4.2, p.19",
        capture: "locator"
      },
      {
        sourceId: "s-stormlog",
        title: "storm-log-2026-01.csv",
        locator: "rows 1,204–1,318",
        capture: "locator"
      }
    ],
    bearsOn: [
      {
        id: "bl-3",
        kind: "hypothesis",
        ref: "H-3",
        title: "Coordination never redone",
        bearing: "Supports"
      }
    ]
  },
  {
    id: "f-relay",
    state: "accepted",
    title: "Feeder 12 relay mis-coordinated",
    body: "Both January and March failures cleared upstream of the intended device, at 0.42 s against a 0.61 s fuse.",
    threadId: "th-feeder",
    turnId: "tn-2",
    derivation: "From this turn",
    acceptedBy: actorName("ana"),
    acceptedAt: "7 minutes ago",
    inLattice: true,
    standingOn: [
      {
        sourceId: "s-relay",
        title: "feeder-12-relay.pdf",
        locator: "p.7",
        capture: "excerpt",
        excerpt:
          "…the recloser operated at 0.42 s, ahead of the 0.61 s fuse clearing time, so the fault was cleared upstream of the intended device…"
      },
      {
        sourceId: "s-stormlog",
        title: "storm-log-2026-01.csv",
        locator: "rows 1,204–1,318",
        capture: "locator"
      }
    ],
    bearsOn: [
      {
        id: "bl-4",
        kind: "hypothesis",
        ref: "H-3",
        title: "Coordination never redone",
        bearing: "Supports"
      },
      {
        id: "bl-5",
        kind: "question",
        ref: "Q-14",
        title: "Why did Feeder 12 fail twice?",
        bearing: "Neutral"
      }
    ]
  },
  {
    id: "f-sequence",
    state: "accepted",
    title: "January and March share a sequence",
    body: "The 14 January and 3 March operations follow the same order — recloser, lockout, no fuse operation — within 0.02 s of each other. Weather differed; the sequence did not.",
    threadId: "th-feeder",
    turnId: "tn-2",
    derivation: "Inference",
    acceptedBy: actorName("mira"),
    acceptedAt: "yesterday",
    inLattice: true,
    standingOn: [
      {
        sourceId: "s-stormlog",
        title: "storm-log-2026-01.csv",
        locator: "rows 1,204–1,318",
        capture: "excerpt",
        excerpt: "…14 Jan 2026 03:12:07 · FDR-12 · recloser operation · 0.42 s · lockout after 2…"
      }
    ],
    bearsOn: [
      {
        id: "bl-6",
        kind: "hypothesis",
        ref: "H-9",
        title: "One shared upstream device",
        bearing: "Supports"
      }
    ]
  },
  {
    id: "f-revision",
    state: "accepted",
    title: "2024 study index lists a revision",
    body: "The 2024 filings index carries an entry reading \"Protection coordination — Feeder 12, rev. C\", dated 8 November 2024, with no document attached to it.",
    threadId: "th-feeder",
    turnId: "tn-2",
    derivation: "From this turn",
    acceptedBy: actorName("tomas"),
    acceptedAt: "yesterday",
    inLattice: true,
    standingOn: [
      {
        sourceId: "s-nerc",
        title: "NERC-2025-winter-review.pdf",
        locator: "p.44",
        capture: "excerpt",
        excerpt:
          "…the register lists a rev. C for the Feeder 12 pair; the corresponding study was not filed…"
      }
    ],
    bearsOn: [
      {
        id: "bl-7",
        kind: "hypothesis",
        ref: "H-3",
        title: "Coordination never redone",
        bearing: "Contradicts"
      }
    ]
  },
  {
    id: "f-saidi",
    state: "accepted",
    title: "Undergrounding cut SAIDI 38%",
    body: "The 4.1 km undergrounded in Ward 3 in 2023 cut SAIDI by 38% across the two following winters, against 6% on comparable overhead feeders.",
    threadId: "th-underground",
    turnId: "tn-u12",
    derivation: "Inference",
    acceptedBy: actorName("mira"),
    acceptedAt: "6 days ago",
    inLattice: true,
    standingOn: [
      {
        sourceId: "s-nerc",
        title: "NERC-2025-winter-review.pdf",
        locator: "p.12",
        capture: "excerpt",
        excerpt: "…Ward 3 reported 38% fewer customer-minutes across the 2024 and 2025 winters…"
      }
    ],
    bearsOn: [
      {
        id: "bl-8",
        kind: "hypothesis",
        ref: "H-7",
        title: "Undergrounding beats vegetation management",
        bearing: "Supports"
      }
    ]
  },
  {
    id: "f-vegetation",
    state: "accepted",
    title: "Vegetation contact explains 61% of Eastbrook outages",
    body: "Of 1,847 Eastbrook outage events between 2023 and 2025, 1,127 were coded as vegetation contact — 61%, against 34% system-wide.",
    threadId: "th-eastbrook",
    turnId: "tn-e3",
    derivation: "From this turn",
    acceptedBy: actorName("ana"),
    acceptedAt: "3 weeks ago",
    inLattice: true,
    standingOn: [
      {
        sourceId: "s-inventory",
        title: "Substation Inventory",
        locator: "Eastbrook · row 27",
        capture: "locator"
      }
    ],
    bearsOn: [
      {
        id: "bl-9",
        kind: "hypothesis",
        ref: "H-7",
        title: "Undergrounding beats vegetation management",
        bearing: "Contradicts"
      }
    ]
  },
  {
    id: "f-mutualaid",
    state: "accepted",
    title: "Mutual aid arrived 14 hours after the January peak",
    body: "The first out-of-territory crews logged in at 17:40 on 14 January, 14 hours after peak customer-minutes lost. Every comparable filing since 2021 reports under 9 hours.",
    threadId: "th-precedents",
    turnId: "tn-p7",
    derivation: "From this turn",
    acceptedBy: actorName("tomas"),
    acceptedAt: "1 week ago",
    inLattice: true,
    standingOn: [
      { sourceId: "s-nerc", title: "NERC-2025-winter-review.pdf", locator: "p.61", capture: "locator" }
    ],
    bearsOn: []
  }
];

const QUESTIONS: readonly Question[] = [
  {
    id: "q-9",
    ref: "Q-9",
    text: "Why do feeders fail repeatedly?",
    status: "Investigating",
    depth: 0,
    anchored: false
  },
  {
    id: "q-14",
    ref: "Q-14",
    text: "Why did Feeder 12 fail twice?",
    status: "Investigating",
    parentId: "q-9",
    parentText: "Why do feeders fail repeatedly?",
    depth: 1,
    anchored: true
  },
  {
    id: "q-16",
    ref: "Q-16",
    text: "Is Eastbrook exposed the same way?",
    status: "Open",
    parentId: "q-9",
    parentText: "Why do feeders fail repeatedly?",
    depth: 1,
    anchored: false
  },
  {
    id: "q-11",
    ref: "Q-11",
    text: "What did the 2024 study assume?",
    status: "Answered",
    parentId: "q-9",
    parentText: "Why do feeders fail repeatedly?",
    depth: 1,
    anchored: false
  },
  {
    id: "q-21",
    ref: "Q-21",
    text: "What would hardening cost per avoided outage minute?",
    status: "Open",
    depth: 0,
    anchored: false
  },
  {
    id: "q-22",
    ref: "Q-22",
    text: "Which substations carry the most customer-minutes?",
    status: "Answered",
    parentId: "q-21",
    parentText: "What would hardening cost per avoided outage minute?",
    depth: 1,
    anchored: false
  }
];

const HYPOTHESES: readonly Hypothesis[] = [
  {
    id: "h-3",
    ref: "H-3",
    statement: "The relay coordination study was never redone after the 2024 reconductoring.",
    assessment: "Testing",
    confidence: 0.7
  },
  {
    id: "h-5",
    ref: "H-5",
    statement: "Vegetation was the shared cause of both Feeder 12 failures.",
    assessment: "Refuted",
    confidence: 0.9
  },
  {
    id: "h-7",
    ref: "H-7",
    statement: "Undergrounding outperforms vegetation management per pound spent.",
    assessment: "Testing",
    confidence: 0.55
  },
  {
    id: "h-9",
    ref: "H-9",
    statement: "The January and March events cleared through a single shared upstream device.",
    assessment: "Supported",
    confidence: 0.65
  }
];

/**
 * The links, read from the target end: what bears on this question or this
 * hypothesis. The same rows read from the other end are a finding's `bearsOn`.
 */
const BEARINGS: Record<string, readonly Bearing[]> = {
  "h-3": [
    {
      id: "bh-1",
      kind: "finding",
      ref: "F-31",
      title: "Feeder 12 relay mis-coordinated",
      bearing: "Supports"
    },
    {
      id: "bh-2",
      kind: "finding",
      ref: "F-44",
      title: "No coordination study exists after the 2024 reconductoring",
      bearing: "Supports"
    },
    {
      id: "bh-3",
      kind: "finding",
      ref: "F-45",
      title: "2019 settings are invalid at current fault levels",
      bearing: "Supports"
    },
    {
      id: "bh-4",
      kind: "finding",
      ref: "F-38",
      title: "2024 study index lists a revision",
      bearing: "Contradicts"
    }
  ],
  "h-5": [
    {
      id: "bh-5",
      kind: "finding",
      ref: "F-31",
      title: "Feeder 12 relay mis-coordinated",
      bearing: "Contradicts"
    },
    {
      id: "bh-6",
      kind: "finding",
      ref: "F-52",
      title: "Vegetation contact explains 61% of Eastbrook outages",
      bearing: "Supports"
    }
  ],
  "h-7": [
    {
      id: "bh-7",
      kind: "finding",
      ref: "F-19",
      title: "Undergrounding cut SAIDI 38%",
      bearing: "Supports"
    },
    {
      id: "bh-8",
      kind: "finding",
      ref: "F-52",
      title: "Vegetation contact explains 61% of Eastbrook outages",
      bearing: "Contradicts"
    }
  ],
  "h-9": [
    {
      id: "bh-9",
      kind: "finding",
      ref: "F-33",
      title: "January and March share a sequence",
      bearing: "Supports"
    }
  ],
  "q-14": [
    {
      id: "bq-1",
      kind: "hypothesis",
      ref: "H-3",
      title: "The relay coordination study was never redone after the 2024 reconductoring.",
      bearing: "Neutral"
    },
    {
      id: "bq-2",
      kind: "hypothesis",
      ref: "H-5",
      title: "Vegetation was the shared cause of both Feeder 12 failures.",
      bearing: "Neutral"
    },
    {
      id: "bq-3",
      kind: "finding",
      ref: "F-31",
      title: "Feeder 12 relay mis-coordinated",
      bearing: "Neutral"
    }
  ],
  "q-16": [
    {
      id: "bq-4",
      kind: "hypothesis",
      ref: "H-7",
      title: "Undergrounding outperforms vegetation management per pound spent.",
      bearing: "Neutral"
    },
    {
      id: "bq-5",
      kind: "finding",
      ref: "F-52",
      title: "Vegetation contact explains 61% of Eastbrook outages",
      bearing: "Neutral"
    }
  ],
  "q-9": [
    {
      id: "bq-6",
      kind: "hypothesis",
      ref: "H-3",
      title: "The relay coordination study was never redone after the 2024 reconductoring.",
      bearing: "Neutral"
    }
  ]
};

/** The thread itself: its job, its agent, and what it has produced. */
export const thread = (threadId: string): Read<ResearchThread> =>
  read(THREADS.find((candidate) => candidate.id === threadId) ?? THREADS[0]);

export const threadsIn = (projectId: string): Read<readonly ResearchThread[]> => {
  void projectId;
  return read(THREADS);
};

/** Adjacent enquiries, so switching does not require the library subscreen. */
export const otherThreads = (threadId: string): Read<readonly ResearchThread[]> =>
  read(THREADS.filter((candidate) => candidate.id !== threadId));

/** The turn the screen is anchored to. Everything on the centre belongs to this one. */
export const currentTurn = (threadId: string): Read<Turn> => {
  void threadId;
  return read(TURNS[0]);
};

export const turnsIn = (threadId: string): Read<readonly Turn[]> => {
  void threadId;
  return read(TURNS);
};

export const questionsIn = (projectId: string): Read<readonly Question[]> => {
  void projectId;
  return read(QUESTIONS);
};

export const question = (questionId: string): Read<Question> =>
  read(QUESTIONS.find((candidate) => candidate.id === questionId) ?? QUESTIONS[1]);

export const hypothesesIn = (projectId: string): Read<readonly Hypothesis[]> => {
  void projectId;
  return read(HYPOTHESES);
};

export const hypothesis = (hypothesisId: string): Read<Hypothesis> =>
  read(HYPOTHESES.find((candidate) => candidate.id === hypothesisId) ?? HYPOTHESES[0]);

/**
 * What bears on one question or one hypothesis. One door for both because the
 * link is the same row either way — the question lens splits it by `kind`, and
 * the hypothesis lens by `bearing`.
 */
export const bearingOn = (targetId: string): Read<readonly Bearing[]> =>
  read(BEARINGS[targetId] ?? []);

/** What the current turn came up with, awaiting a decision. */
export const proposedIn = (turnId: string): Read<readonly Finding[]> =>
  read(FINDINGS.filter((finding) => finding.state === "proposed" && finding.turnId === turnId));

export const acceptedIn = (threadId: string): Read<readonly Finding[]> =>
  read(FINDINGS.filter((finding) => finding.state === "accepted" && finding.threadId === threadId));

/** What the project already knows, established somewhere other than here. */
export const acceptedElsewhere = (threadId: string): Read<readonly Finding[]> =>
  read(FINDINGS.filter((finding) => finding.state === "accepted" && finding.threadId !== threadId));

export const finding = (findingId: string): Read<Finding> =>
  read(FINDINGS.find((candidate) => candidate.id === findingId) ?? FINDINGS[0]);

/** What this answer stands on. */
export const sourcesForTurn = (turnId: string): Read<readonly Source[]> => {
  const ids = SOURCES_BY_TURN[turnId] ?? [];
  return read(SOURCES.filter((source) => ids.includes(source.id)));
};

/**
 * Everything read across the thread, deduplicated. The use count is what
 * identifies the source the thread keeps returning to.
 */
export const sourcesInThread = (threadId: string): Read<readonly Source[]> => {
  void threadId;
  return read(SOURCES);
};

export const source = (sourceId: string): Read<Source> =>
  read(SOURCES.find((candidate) => candidate.id === sourceId) ?? SOURCES[0]);

/** The agent's steps, grouped by turn, newest first. */
export const traceIn = (threadId: string): Read<readonly TurnTrace[]> => {
  void threadId;
  return read(
    TURNS.map((turn: Turn, index: number) => ({
      turnId: turn.id,
      heading: index === 0 ? `This turn · ${turn.at}` : turn.at,
      calls: CALLS.filter((call: ToolCall) => call.turnId === turn.id)
    }))
  );
};

export const toolCall = (callId: string): Read<ToolCall> =>
  read(CALLS.find((candidate) => candidate.id === callId) ?? CALLS[0]);

/** Set once for the thread: there is no per-turn scope switch. */
export const searchScope = (threadId: string): Read<ThreadScope> => {
  void threadId;
  return read({
    name: "Field reports 2024–25",
    resources: 96,
    web: true,
    resolvedAt: "10:21:04",
    indexed: 88,
    withoutMaterial: 8,
    unbounded: false
  });
};
