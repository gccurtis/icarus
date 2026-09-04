<script lang="ts">
  import Bot from "@lucide/svelte/icons/bot";
  import Globe from "@lucide/svelte/icons/globe";
  import Library from "@lucide/svelte/icons/library";
  import Plus from "@lucide/svelte/icons/plus";
  import Send from "@lucide/svelte/icons/send";
  import X from "@lucide/svelte/icons/x";

  import { PanelChip, PanelQuote } from "$authored-components/panel";
  import {
    ScreenAction,
    ScreenCard,
    ScreenDecision,
    ScreenEmpty,
    ScreenGroup,
    ScreenNote,
    ScreenSurface
  } from "$authored-components/screen";
  import { Button } from "$vendored-components/button";
  import * as Select from "$vendored-components/select";
  import { Textarea } from "$vendored-components/textarea";
  import { workspaceState } from "$model/client/workspace-state";

  const view = workspaceState();

  type AgentId = "grid-analyst" | "filing-editor" | "source-checker";

  type Agent = {
    readonly id: AgentId;
    readonly name: string;
    readonly purpose: string;
    readonly scope: "Personal" | "Shared" | "Project";
  };

  type ThreadMode = "Discover" | "Question" | "Hypothesis";

  type ResearchThread = {
    readonly id: string;
    readonly title: string;
    readonly mode: ThreadMode;
    readonly job: "Look around" | "Answer one question" | "Test an idea";
    readonly anchor?: { readonly ref: string; readonly text: string };
    readonly turns: number;
    readonly accepted: number;
    readonly proposed: number;
    readonly sources: number;
    readonly lastAsked: string;
    readonly agent: AgentId;
    readonly toolsAllowed: number;
    readonly createdBy: string;
    readonly revision: number;
    readonly updated: string;
  };

  type Turn = {
    readonly id: string;
    readonly prompt: string;
    readonly answer: string;
    readonly at: string;
    readonly ago: string;
    readonly produced: string;
    readonly proposed: number;
    readonly accepted: number;
  };

  type Source = {
    readonly id: string;
    readonly title: string;
    readonly kind: "Resource" | "External file" | "Web";
    readonly locator: string;
    readonly excerpt: string;
    readonly capturedAt?: string;
    readonly scores?: { readonly relevance: number; readonly density: number };
    readonly uses: number;
    readonly usedBy: readonly string[];
  };

  type ToolCall = {
    readonly id: string;
    readonly turnId: string;
    readonly name: string;
    readonly outcome: "Success" | "Nothing found" | "Failed";
    readonly duration: string;
    readonly result: string;
    readonly input: string;
    readonly resolvedScope: string;
  };

  type TurnTrace = {
    readonly turnId: string;
    readonly heading: string;
    readonly calls: readonly ToolCall[];
  };

  type Bearing = {
    readonly id: string;
    readonly kind: "question" | "hypothesis" | "finding";
    readonly ref: string;
    readonly title: string;
    readonly bearing: "Supports" | "Contradicts" | "Neutral";
  };

  type FindingSource = {
    readonly sourceId: string;
    readonly title: string;
    readonly locator: string;
    readonly capture: "excerpt" | "locator";
    readonly excerpt?: string;
  };

  type Finding = {
    readonly id: string;
    readonly state: "proposed" | "accepted";
    readonly title: string;
    readonly body: string;
    readonly threadId: string;
    readonly turnId: string;
    readonly derivation: "From this turn" | "Inference";
    readonly acceptedBy?: string;
    readonly acceptedAt?: string;
    readonly inLattice: boolean;
    readonly standingOn: readonly FindingSource[];
    readonly bearsOn: readonly Bearing[];
  };

  type ThreadScope = {
    readonly name: string;
    readonly resources: number;
    readonly web: boolean;
    readonly resolvedAt: string;
    readonly indexed: number;
    readonly withoutMaterial: number;
    readonly unbounded: boolean;
  };

  type Read<T> = {
    readonly current: T;
    readonly error: undefined;
    readonly loading: false;
    refresh: () => Promise<void>;
  };

  const read = <T,>(current: T): Read<T> => ({
    current,
    error: undefined,
    loading: false,
    refresh: async () => {}
  });

  const AGENTS: readonly Agent[] = [
    {
      id: "grid-analyst",
      name: "Grid Analyst",
      purpose: "Reads field data and relay logs; refuses to speculate past the record.",
      scope: "Project"
    },
    {
      id: "filing-editor",
      name: "Filing Editor",
      purpose: "Turns findings into filing prose in the commission's register.",
      scope: "Shared"
    },
    {
      id: "source-checker",
      name: "Source Checker",
      purpose: "Verifies that a claim is carried by the source it cites.",
      scope: "Personal"
    }
  ];

  const actorName = (id: string): string =>
    AGENTS.find((agent) => agent.id === id)?.name ?? id;

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
      createdBy: "Ana Reyes",
      revision: 7,
      updated: "yesterday"
    },
    {
      id: "th-under",
      title: "Undergrounding beats vegetation management",
      mode: "Hypothesis",
      job: "Test an idea",
      anchor: {
        ref: "H-7",
        text: "Undergrounding outperforms vegetation management per pound spent"
      },
      turns: 22,
      accepted: 9,
      proposed: 1,
      sources: 31,
      lastAsked: "2 days ago",
      agent: "grid-analyst",
      toolsAllowed: 4,
      createdBy: "Mira Jain",
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
      createdBy: "Tomas Kaur",
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
      createdBy: "Ana Reyes",
      revision: 6,
      updated: "3 weeks ago"
    },
    {
      id: "th-2024",
      title: "What did the 2024 study assume?",
      mode: "Question",
      job: "Answer one question",
      anchor: { ref: "Q-11", text: "What did the 2024 coordination study assume?" },
      turns: 6,
      accepted: 2,
      proposed: 0,
      sources: 9,
      lastAsked: "2 weeks ago",
      agent: "source-checker",
      toolsAllowed: 3,
      createdBy: "Mira Jain",
      revision: 9,
      updated: "2 weeks ago"
    },
    {
      id: "th-2019",
      title: "Did the 2019 hardening program hit its targets?",
      mode: "Hypothesis",
      job: "Test an idea",
      anchor: { ref: "H-3", text: "The 2019 hardening program met its stated targets" },
      turns: 9,
      accepted: 3,
      proposed: 0,
      sources: 22,
      lastAsked: "3 weeks ago",
      agent: "grid-analyst",
      toolsAllowed: 4,
      createdBy: "Tomas Kaur",
      revision: 15,
      updated: "3 weeks ago"
    }
  ];

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
      input:
        '{ "query": "Feeder 12 recloser operation January March", "scope": "rs_field_reports_2024_25" }',
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
      acceptedBy: "Ana Reyes",
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
      acceptedBy: "Mira Jain",
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
      body: 'The 2024 filings index carries an entry reading "Protection coordination — Feeder 12, rev. C", dated 8 November 2024, with no document attached to it.',
      threadId: "th-feeder",
      turnId: "tn-2",
      derivation: "From this turn",
      acceptedBy: "Tomas Kaur",
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
      threadId: "th-under",
      turnId: "tn-u12",
      derivation: "Inference",
      acceptedBy: "Mira Jain",
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
      acceptedBy: "Ana Reyes",
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
      acceptedBy: "Tomas Kaur",
      acceptedAt: "1 week ago",
      inLattice: true,
      standingOn: [
        {
          sourceId: "s-nerc",
          title: "NERC-2025-winter-review.pdf",
          locator: "p.61",
          capture: "locator"
        }
      ],
      bearsOn: []
    }
  ];

  const thread = (threadId: string): Read<ResearchThread> =>
    read(THREADS.find((candidate) => candidate.id === threadId) ?? THREADS[0]);

  const threadsIn = (projectId: string): Read<readonly ResearchThread[]> => {
    void projectId;
    return read(THREADS);
  };

  const currentTurn = (threadId: string): Read<Turn> => {
    void threadId;
    return read(TURNS[0]);
  };

  const proposedIn = (turnId: string): Read<readonly Finding[]> =>
    read(FINDINGS.filter((found) => found.state === "proposed" && found.turnId === turnId));

  const acceptedIn = (threadId: string): Read<readonly Finding[]> =>
    read(FINDINGS.filter((found) => found.state === "accepted" && found.threadId === threadId));

  const sourcesForTurn = (turnId: string): Read<readonly Source[]> => {
    const ids = SOURCES_BY_TURN[turnId] ?? [];
    return read(SOURCES.filter((source) => ids.includes(source.id)));
  };

  const traceIn = (threadId: string): Read<readonly TurnTrace[]> => {
    void threadId;
    return read(
      TURNS.map((turn: Turn, index: number) => ({
        turnId: turn.id,
        heading: index === 0 ? `This turn · ${turn.at}` : turn.at,
        calls: CALLS.filter((call: ToolCall) => call.turnId === turn.id)
      }))
    );
  };

  const searchScope = (threadId: string): Read<ThreadScope> => {
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

  /**
   * One line of enquiry: the turn you are on, and what it produced.
   *
   * **A thread is a tab.** It is a thing you open, work in and close — like a
   * document and unlike a library — so it is keyed by its own id in the frame's
   * strip, several are open at once, and closing one is closing a tab. A private
   * strip inside this category would be a second answer to a question the frame
   * already answers.
   *
   * **Which threads exist is the rail's business; which are open is the frame's.**
   * The context panel lists every thread in the project and opening one mints or
   * activates its tab. A list of threads is a map, and a map belongs in the panel
   * that holds maps rather than in a centre of its own.
   *
   * The centre is anchored to a single turn rather than scrolled through all of
   * them; earlier turns are the History view in the context panel, not scrollback
   * here.
   *
   * **The tracks are 1.35fr and 1fr because the judgment is made across them.**
   * Accepting a finding is decided while reading the answer, so the two have to
   * be readable at once — but the answer is prose at a reading measure and a
   * finding is a title and a line, so the answer gets the larger share and the
   * findings column stays a column rather than becoming a second body of text.
   *
   * **The ask band is `auto`, the answer's two are `1fr` each.** The layout
   * table gives the ask one band and the answer two; a prompt is two lines, and
   * giving it a literal third of the plane would be a hole above the thing that
   * matters. Proportion is kept where it is load-bearing: whatever height the
   * ask does not want, the answer takes.
   *
   * A proposed finding has no state in the real model yet — proposed, accepted
   * and dismissed live only in the mock door — so the decision made here is held
   * in view state and says so as a verdict on the card rather than by claiming a
   * write. A decided proposal stays where it was: a card that vanished on Accept
   * would leave the reader unable to check what they had just done.
   */
  /**
   * Which thread this is.
   *
   * `resourceId`, because it is what makes two threads two tabs — the same field
   * a document tab is keyed by, for the same reason. The fallback is the
   * isolation test's, where a panel is rendered with an empty prop bag.
   */
  const threadId = $derived(view.active.resourceId ?? "th-feeder");

  const everyThread = $derived(threadsIn(view.project).current);

  /**
   * A new thread is a real one from the library, chosen for having no tab yet.
   *
   * Nothing creates a thread, so inventing an id would put a row in the strip
   * that no door can answer for.
   */
  const startThread = () => {
    const open = new Set(
      view.tabs.filter((tab) => tab.category === "research").map((tab) => tab.resourceId)
    );
    const fresh = everyThread.find((row: ResearchThread) => !open.has(row.id));
    if (fresh) view.open({ category: "research", resourceId: fresh.id });
  };

  const it = $derived(thread(threadId).current);
  const turn = $derived(currentTurn(threadId).current);
  const scope = $derived(searchScope(threadId).current);
  const sources = $derived(sourcesForTurn(turn.id).current);
  const trace = $derived(traceIn(threadId).current.find((section) => section.turnId === turn.id));

  /**
   * The persona is the thread's, not the turn's. The control sets it for
   * everything the thread will do next; there is no per-turn switch.
   */
  let chosenAgent = $state<string | undefined>(undefined);
  const agent = $derived(chosenAgent ?? it.agent);

  /** Accept and Dismiss, held here: the model has nowhere to put either yet. */
  let decided = $state<Record<string, "accepted" | "dismissed">>({});

  /** Everything this turn proposed, decided or not, and what the thread has
   * accepted. Neither band is filtered by the decision: it is carried on the
   * card instead. */
  const proposed = $derived(proposedIn(turn.id).current);
  const accepted = $derived(acceptedIn(threadId).current);

  /** The decision as a word. The band holds all three, so `proposed` — the state
   * of one nothing has been done to yet — is worth saying rather than assuming. */
  const VERDICT = {
    proposed: { label: "Proposed", tone: "pending" },
    accepted: { label: "Accepted", tone: "accepted" },
    dismissed: { label: "Dismissed", tone: "dismissed" }
  } as const;

  let next = $state("");
  let useContext = $state(true);
  let useWeb = $state(true);

  const BEARING_TONE = {
    Supports: "success",
    Contradicts: "danger",
    Neutral: "neutral"
  } as const;

  /** The result reads as a sentence; inside a chip beside two other facts it reads as a fragment. */
  const unpunctuated = (result: string): string => result.replace(/\.$/, "");

  const isSelected = (kind: string, id: string): boolean =>
    view.selection?.kind === kind && view.selection.id === id;
</script>

<ScreenSurface wide>
  <div class="board">
    <!--
      The thread's name, what job it has, and who is answering. The mode chip is
      the job named, and it is not a control: what a thread is for is chosen when
      it starts.
    -->
    <div class="area-header flex flex-wrap items-center gap-2">
      <h1 class="text-h3 leading-h3 m-0 me-1 font-semibold tracking-tight">{it.title}</h1>
      <PanelChip>{it.mode}</PanelChip>
      <Select.Root
        type="single"
        value={agent}
        onValueChange={(chosen: string) => (chosenAgent = chosen)}
      >
        <Select.Trigger size="sm" aria-label="Answering as" class="text-caption w-auto gap-1.5">
          <Bot class="text-ink-muted size-3.5" aria-hidden="true" />
          {actorName(agent)}
        </Select.Trigger>
        <Select.Content>
          {#each AGENTS as persona (persona.id)}
            <Select.Item value={persona.id} label={persona.name}>{persona.name}</Select.Item>
          {/each}
        </Select.Content>
      </Select.Root>
      <span class="ms-auto">
        <ScreenAction label="New thread" icon={Plus} onclick={startThread} />
      </span>
    </div>

    <!-- The prompt, as a card, with what it was allowed to look at. -->
    <div class="area-ask flex min-h-0 flex-col gap-2">
      <div class="border-border-subtle bg-surface-panel rounded-panel flex flex-col gap-2 border p-3">
        <span class="text-caption text-ink-muted">
          You asked · <span class="tabular-nums">{turn.at}</span>
        </span>
        <p class="text-body text-ink-primary m-0 max-w-prose">{turn.prompt}</p>
        <div class="flex flex-wrap gap-1">
          <PanelChip>{scope.name}</PanelChip>
          {#if scope.web}
            <PanelChip>Web</PanelChip>
          {/if}
        </div>
      </div>

      <ScreenNote tone="gap">
        Those chips are the thread's scope as it stands now, not the scope this turn ran under.
        Per-request scope is not stored, so reopening an earlier turn cannot show what it could
        actually see.
      </ScreenNote>
    </div>

    <!--
      The reply, its citations, then the trace — in that order, so the claim
      comes before the machinery.
    -->
    <div class="area-answer flex min-h-0 flex-col gap-4 overflow-y-auto">
      <p class="text-body text-ink-primary m-0 max-w-prose">{turn.answer}</p>

      <ScreenGroup label="Stands on" count={String(sources.length)}>
        <div class="flex flex-col gap-2">
          {#each sources as source (source.id)}
            <PanelQuote
              source={`${source.title} · ${source.locator}`}
              sourceLabel="Source"
              onopen={() =>
                view.inspect("research.source", { kind: "source", id: source.id })}
            >
              {source.excerpt}
            </PanelQuote>
          {/each}
        </div>
      </ScreenGroup>

      {#if trace}
        <ScreenGroup label="How it was produced" count={String(trace.calls.length)}>
          <div class="flex flex-wrap gap-1.5">
            {#each trace.calls as call (call.id)}
              <!--
                A call that found nothing is an outcome rather than an error, and
                it is the most informative chip on the screen when an answer came
                back thin — so it is toned, and the other two are not.
              -->
              <button
                type="button"
                class="text-start"
                onclick={() =>
                  view.inspect("research.tool-call", { kind: "tool-call", id: call.id })}
              >
                <PanelChip tone={call.outcome === "Nothing found" ? "attention" : "neutral"}>
                  <span class="font-mono">{call.name}</span>
                  · {unpunctuated(call.result)} · <span class="tabular-nums">{call.duration}</span>
                </PanelChip>
              </button>
            {/each}
          </div>
        </ScreenGroup>
      {/if}
    </div>

    <!--
      What the answer produced, decided one at a time. A finding is a conclusion
      you accept, not a passage you copied — which is why the derivation is on
      the card and why one of these reads *Inference* rather than pretending a
      source says it outright.
    -->
    <div class="area-findings flex min-h-0 flex-col gap-4 overflow-y-auto">
      <ScreenGroup label="Proposed here" count={String(proposed.length)}>
        <div class="flex flex-col gap-2">
          {#each proposed as found (found.id)}
            {@const decision = decided[found.id] ?? "proposed"}
            <ScreenDecision
              title={found.title}
              meta={found.derivation}
              verdict={VERDICT[decision]}
              selected={isSelected("finding", found.id)}
              onselect={() =>
                view.inspect("research.proposed-finding", {
                  kind: "finding",
                  id: found.id
                })}
            >
              <div class="flex flex-col gap-1.5">
                <span>{found.body}</span>
                <span class="flex flex-wrap gap-1">
                  {#each found.standingOn as standing (standing.sourceId)}
                    <PanelChip>{standing.title}</PanelChip>
                  {/each}
                  {#each found.bearsOn as bearing (bearing.id)}
                    <PanelChip tone={BEARING_TONE[bearing.bearing]}>
                      {bearing.ref} · {bearing.bearing}
                    </PanelChip>
                  {/each}
                </span>
              </div>

              <!--
                The controls change with the decision rather than going away: a
                dismissed finding can be accepted after all, which is the reason
                the card is still here.
              -->
              {#snippet actions()}
                {#if decision !== "accepted"}
                  <Button size="xs" onclick={() => (decided[found.id] = "accepted")}>Accept</Button>
                  <!-- Edit opens the proposal's lens: a proposal is editable, an acceptance is not. -->
                  <Button
                    size="xs"
                    variant="outline"
                    onclick={() =>
                      view.inspect("research.proposed-finding", {
                        kind: "finding",
                        id: found.id
                      })}
                  >
                    Edit
                  </Button>
                {/if}
                {#if decision !== "dismissed"}
                  <Button
                    size="xs"
                    variant="ghost"
                    onclick={() => (decided[found.id] = "dismissed")}
                  >
                    Dismiss
                  </Button>
                {/if}
              {/snippet}
            </ScreenDecision>
          {:else}
            <ScreenEmpty title="This turn proposed nothing">
              An answer that produced no conclusion is a result, not a failure — the trace beside it
              says what was read to get there.
            </ScreenEmpty>
          {/each}
        </div>
      </ScreenGroup>

      <ScreenGroup label="Accepted in this thread" count={String(accepted.length)}>
        <div class="flex flex-col gap-2">
          {#each accepted as found (found.id)}
            <ScreenCard
              title={found.title}
              sub={found.derivation}
              selected={isSelected("finding", found.id)}
              onselect={() =>
                view.inspect("research.accepted-finding", {
                  kind: "finding",
                  id: found.id
                })}
            >
              <span class="text-body-sm text-ink-secondary">{found.body}</span>
              <span class="flex flex-wrap items-center gap-1">
                <!-- Accepted is retrievable project-wide and proposed is not. That is the whole difference. -->
                <PanelChip tone="success">In the lattice</PanelChip>
                {#if found.acceptedBy}
                  <span class="text-caption text-ink-muted">
                    {found.acceptedBy}{found.acceptedAt ? ` · ${found.acceptedAt}` : ""}
                  </span>
                {/if}
              </span>
            </ScreenCard>
          {/each}
        </div>
      </ScreenGroup>
    </div>

    <!-- The next question, framed by what the thread already is. -->
    <div class="area-composer flex flex-col gap-2">
      <div class="flex flex-wrap items-center gap-2">
        <PanelChip>{it.mode} mode</PanelChip>
        {#if it.anchor}
          <span class="text-caption text-ink-muted">
            anchored to {it.anchor.ref} · {it.anchor.text}
          </span>
        {/if}
      </div>

      <div class="border-border-subtle bg-surface-panel rounded-panel flex flex-col gap-2 border p-2">
        <Textarea
          bind:value={next}
          rows={2}
          placeholder="Ask the next question…"
          aria-label="Ask the next question"
          class="text-body-sm min-h-0 border-none bg-transparent shadow-none focus-visible:ring-0"
        />
        <div class="flex flex-wrap items-center gap-1.5">
          <Button
            size="xs"
            variant={useContext ? "default" : "outline"}
            title={scope.name}
            onclick={() => (useContext = !useContext)}
          >
            <Library aria-hidden="true" />
            Context
          </Button>
          <Button
            size="xs"
            variant={useWeb ? "default" : "outline"}
            onclick={() => (useWeb = !useWeb)}
          >
            <Globe aria-hidden="true" />
            Web
          </Button>
          <Button size="sm" class="ms-auto" disabled={next.trim() === ""} onclick={() => (next = "")}>
            <Send aria-hidden="true" />
            Ask
          </Button>
        </div>
      </div>
    </div>
  </div>
</ScreenSurface>

<style>
  /**
   * The specification's layout table, as `grid-template-areas`. The board fills
   * the surface rather than growing with its content: the composer belongs at
   * the foot of the screen, and the answer and the findings scroll inside their
   * own regions so that neither pushes it off.
   */
  .board {
    display: grid;
    flex: 1 1 auto;
    min-height: 0;
    gap: calc(var(--token-spacing-unit) * 4);
    grid-template-columns: 1.35fr 1fr;
    grid-template-rows: auto auto minmax(0, 1fr) minmax(0, 1fr) auto;
    grid-template-areas:
      "header   header"
      "ask      findings"
      "answer   findings"
      "answer   findings"
      "composer composer";
  }

  .area-header {
    grid-area: header;
  }
  .area-ask {
    grid-area: ask;
  }
  .area-answer {
    grid-area: answer;
  }
  .area-findings {
    grid-area: findings;
  }
  .area-composer {
    grid-area: composer;
  }

  /*
    One column below the width where a reading measure and a column of cards
    stop fitting side by side. The order is the order of the turn — what you
    asked, what came back, what it produced — with the composer still last.
  */
  @media (max-width: 60rem) {
    .board {
      flex: 0 0 auto;
      grid-template-columns: 1fr;
      grid-template-rows: none;
      grid-template-areas:
        "header"
        "ask"
        "answer"
        "findings"
        "composer";
    }

    /* Nothing scrolls inside a region once the surface itself is the scroll. */
    .area-answer,
    .area-findings {
      overflow-y: visible;
    }
  }
</style>
