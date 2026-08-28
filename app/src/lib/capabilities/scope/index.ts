/**
 * Contexts: what a question is allowed to look at.
 *
 * `docs/screen-panel-views/context/scope/` and `inspector/scope/` are what these
 * serve. A Context is a rule, not a list — Include minus Take out, one level
 * deep, resolved at the moment it is read. That is why every door here is scoped
 * by a Context id and answers with counts as of now rather than with a stored
 * membership: a document created tomorrow that fits the rule is in it without
 * anyone editing anything.
 *
 * The worked example is *Everything but drafts*, which is the project (248) plus
 * the *Regulatory corpus* set (34, already inside it), minus every template (37),
 * leaving 211 — of which 88 have anything indexed. Those five numbers appear in
 * six panels and are the same five numbers everywhere.
 */
import { RESOURCES, type Resource, type ResourceKind } from "$capabilities/cast";
import { read, type Read } from "$capabilities/read.svelte";

/** Which half of the subtraction a term sits on. There is no third side. */
export type Side = "include" | "take-out";

/** The rule kinds the model supports. Add offers the first three. */
export type TermRule = "everything" | "context" | "kind" | "named" | "connector";

/** A saved scope as the all-Contexts table and the Contexts view read it. */
export type ContextRow = {
  readonly id: string;
  readonly name: string;
  /** Generated from the definition, never typed. It is what makes the list scannable. */
  readonly inWords: string;
  readonly contains: number;
  /**
   * How much of `contains` can actually be searched. A separate column because
   * the gap between the two is the difference between a scope that looks right
   * and one that works.
   */
  readonly retrievable: number;
  /** Only consumers the backend can query truthfully. Partial by construction. */
  readonly usedBy: string;
};

export type ContextRecord = {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  /** The whole rule as one sentence, for someone who did not build it. */
  readonly inPlainWords: string;
  readonly contains: number;
  readonly retrievable: number;
  readonly revision: number;
  readonly state: "saved" | "edited";
  /** How many terms exist only in the editor. Zero whenever `state` is saved. */
  readonly unsaved: number;
  /** Why Delete is disabled. There is no reverse index that could enable it. */
  readonly deleteBlocked: string;
};

/** One term on one half, as either list renders it. */
export type ScopeTerm = {
  readonly id: string;
  readonly side: Side;
  readonly label: string;
  readonly rule: TermRule;
  /** The one-line qualifier under the label — "Including anything created later". */
  readonly what: string;
  readonly matches: number;
  readonly unsaved: boolean;
};

/** "Everything in this project", with the retrievable split its lens discloses. */
export type EverythingTerm = ScopeTerm & {
  readonly ruleInWords: string;
  readonly indexed: number;
  readonly nothingIndexed: number;
};

/** A reference to another saved Context — not a copy, so it moves when that one does. */
export type ContextRefTerm = ScopeTerm & {
  readonly ruleInWords: string;
  readonly referencedId: string;
  readonly circular: boolean;
  /** Names from this Context outward. Three is readable; the panel cannot draw six. */
  readonly chain: readonly string[];
};

export type KindTerm = ScopeTerm & {
  readonly ruleInWords: string;
  readonly kind: ResourceKind;
  /**
   * What this term removes from *this* Context, not how many of that kind the
   * project holds. The two differ whenever Include is narrower than the project,
   * and only this one is useful.
   */
  readonly takesOut: number;
  readonly sample: readonly string[];
};

export type RuleOption = {
  readonly id: string;
  readonly rule: TermRule;
  readonly title: string;
  readonly detail: string;
  /** Every rule here re-reads. A connector or a named resource does not. */
  readonly live: boolean;
};

/** Something addable by name. A connector stands for the files it synced. */
export type NamedCandidate = {
  readonly id: string;
  readonly name: string;
  readonly kind: ResourceKind;
  readonly detail: string;
  /** Present on a connector: how many files the term would bring in. */
  readonly expandsTo?: number;
};

/** Anything the resolver could not do. The term is kept as written regardless. */
export type ContextProblem = {
  readonly id: string;
  readonly title: string;
  /** Verbatim, so a broken term is visible rather than silently repaired. */
  readonly term: string;
  readonly detail: string;
  readonly tone: "danger" | "attention";
};

/** What the edited definition would do, against the saved one. */
export type PendingChange = {
  readonly id: string;
  readonly name: string;
  readonly effect: "added" | "taken-out";
  /** Which unsaved term does it, so the row reads as a consequence rather than a surprise. */
  readonly because: string;
};

/** One resource that survived the rule, and the proof of why it did. */
export type ResolvedResource = {
  readonly id: string;
  readonly name: string;
  readonly kind: ResourceKind;
  readonly updated: string;
  /** The term that put it here. */
  readonly inBecause: string;
  /** The connector it came through, when it came through one. */
  readonly via?: string;
  /** The same proof as a sentence, traced back through whatever it came through. */
  readonly whyInWords: string;
  /** Zero means it is in the scope but nothing in it can be retrieved. */
  readonly indexedRegions: number;
};

export type Retrievability = {
  readonly contains: number;
  readonly indexed: number;
  /**
   * Everything else, as one number: nothing upstream separates *not processed
   * yet* from *cannot be processed*, and those want different responses.
   */
  readonly nothingIndexed: number;
};

export type GeneratedBlock = {
  readonly id: string;
  readonly name: string;
  readonly prompt: string;
  readonly resource: string;
  readonly location: string;
  readonly runs: string;
  readonly scope: string;
  readonly model: string;
  /**
   * False where the owning prompt block could not be found: a DerivedOutput
   * stores no owner pointer, so *Lives in* is a reverse query that sometimes
   * comes back empty.
   */
  readonly ownerResolved: boolean;
};

/** Retrieval internals. Nothing here is a product concept and nothing is editable. */
export type LatticeNode = {
  readonly id: string;
  readonly label: string;
  readonly level: "window" | "cluster" | "theme";
  readonly tier: number;
  readonly members: number;
  readonly windows: number;
  readonly density: number;
  readonly cohesion: number;
  /**
   * Plural on purpose. The record describes a single parent while the clustering
   * describes overlapping cliques; until that is settled no panel may promise a
   * hierarchy, so the door cannot hand one down.
   */
  readonly parents: readonly string[];
};

export type Dependent = {
  readonly id: string;
  readonly group: "Personas" | "Prompt blocks";
  readonly name: string;
  readonly detail: string;
};

/** The scope as it stood when a search ran, recorded with the result. */
export type SearchedManifest = {
  readonly contents: number;
  readonly searchable: number;
  readonly at: string;
};

export type SearchHit = {
  readonly id: string;
  /** The retrieved region, verbatim. */
  readonly passage: string;
  readonly source: string;
  /** Absent where the source has no pages. */
  readonly page?: number;
  readonly offsets: { readonly from: number; readonly to: number };
  readonly relevance: number;
  readonly density: number;
  readonly searched: SearchedManifest;
};

const CONTEXTS: readonly ContextRow[] = [
  {
    id: "cx-drafts",
    name: "Everything but drafts",
    inWords: "Everything in this project and Regulatory corpus, minus every template.",
    contains: 211,
    retrievable: 88,
    usedBy: "2 agents"
  },
  {
    id: "cx-corpus",
    name: "Regulatory corpus",
    inWords: "Documents, and the Filings set.",
    contains: 34,
    retrievable: 34,
    usedBy: "1 agent · 1 automation"
  },
  {
    id: "cx-field",
    name: "Field reports 2024–25",
    inWords: "12 named resources, and the files SharePoint — Ops Reports synced.",
    contains: 96,
    retrievable: 71,
    usedBy: "1 automation"
  },
  {
    id: "cx-filings",
    name: "Filings",
    inWords: "Every resource filed with the commission, live.",
    contains: 18,
    retrievable: 16,
    usedBy: "1 agent"
  },
  {
    id: "cx-relay",
    name: "Relay evidence",
    inWords: "Findings and the field data behind them, minus slide decks.",
    contains: 27,
    retrievable: 24,
    usedBy: "—"
  },
  {
    id: "cx-precedents",
    name: "Storm precedents",
    inWords: "Nothing matches it right now.",
    contains: 0,
    retrievable: 0,
    usedBy: "—"
  }
];

const RECORDS: readonly ContextRecord[] = [
  {
    id: "cx-drafts",
    name: "Everything but drafts",
    description: "Everything the filing may cite, minus template bodies.",
    inPlainWords: "Everything in this project and Regulatory corpus, minus every template.",
    contains: 211,
    retrievable: 88,
    revision: 9,
    state: "edited",
    unsaved: 2,
    deleteBlocked: "Nothing can find every Context, Persona and prompt block depending on this one."
  },
  {
    id: "cx-corpus",
    name: "Regulatory corpus",
    description: "What the commission has already seen, plus the filings themselves.",
    inPlainWords: "Every document in this project and Filings.",
    contains: 34,
    retrievable: 34,
    revision: 4,
    state: "saved",
    unsaved: 0,
    deleteBlocked: "Nothing can find every Context, Persona and prompt block depending on this one."
  },
  {
    id: "cx-precedents",
    name: "Storm precedents",
    description: "Winter-storm rate cases in neighbouring jurisdictions.",
    inPlainWords: "Every finding tagged precedent, minus this project's own findings.",
    contains: 0,
    retrievable: 0,
    revision: 2,
    state: "saved",
    unsaved: 0,
    deleteBlocked: "Nothing can find every Context, Persona and prompt block depending on this one."
  }
];

/**
 * Both halves in one array. Two terms a side is not padding: the halves are a
 * subtraction over live rules, and the arithmetic has to hold — 248 − 37 − 0 =
 * 211 in every panel that shows any part of it.
 */
const TERMS: readonly ScopeTerm[] = [
  {
    id: "tm-everything",
    side: "include",
    label: "Everything in this project",
    rule: "everything",
    what: "Including anything created later",
    matches: 248,
    unsaved: false
  },
  {
    id: "tm-corpus",
    side: "include",
    label: "Regulatory corpus",
    rule: "context",
    what: "Another saved Context, at its current contents",
    matches: 34,
    unsaved: true
  },
  {
    id: "tm-templates",
    side: "take-out",
    label: "Every template",
    rule: "kind",
    what: "By kind",
    matches: 37,
    unsaved: true
  },
  {
    id: "tm-d88a2",
    side: "take-out",
    label: "d_88a2",
    rule: "named",
    what: "By name — no longer exists",
    matches: 0,
    unsaved: false
  }
];

/** Pulls a row's name, kind and age from the cast rather than restating them. */
const fromProject = (
  resourceId: string,
  inBecause: string,
  whyInWords: string,
  indexedRegions: number
): ResolvedResource => {
  const resource: Resource = RESOURCES.find((candidate) => candidate.id === resourceId) ?? RESOURCES[0];
  return {
    id: resource.id,
    name: resource.name,
    kind: resource.kind,
    updated: resource.updated,
    inBecause,
    whyInWords,
    indexedRegions
  };
};

const CONTENTS: readonly ResolvedResource[] = [
  fromProject(
    "r-memo",
    "Everything in this project",
    "Everything in this project covers every resource here, including this one.",
    9
  ),
  fromProject(
    "r-board",
    "Everything in this project",
    "Everything in this project covers every resource here, including this one.",
    4
  ),
  fromProject(
    "r-cost",
    "Everything in this project",
    "Everything in this project covers every resource here, including this one.",
    0
  ),
  fromProject(
    "r-nerc",
    "Regulatory corpus",
    "Regulatory corpus includes every document, and this file was filed as one.",
    0
  ),
  {
    // Not a project resource: a connector expands to the files it synced, and the
    // connector record itself is never retrievable content.
    id: "sp-feeder-12-relay",
    name: "feeder-12-relay.pdf",
    kind: "file",
    updated: "6 days ago",
    inBecause: "Regulatory corpus",
    via: "SharePoint — Ops Reports",
    whyInWords:
      "Regulatory corpus includes SharePoint — Ops Reports, which produced this file.",
    indexedRegions: 12
  },
  {
    id: "sp-jan-event-log",
    name: "jan-event-log-2026.csv",
    kind: "file",
    updated: "6 days ago",
    inBecause: "Regulatory corpus",
    via: "SharePoint — Ops Reports",
    whyInWords:
      "Regulatory corpus includes SharePoint — Ops Reports, which produced this file.",
    indexedRegions: 0
  }
];

const BLOCKS: readonly GeneratedBlock[] = [
  {
    id: "gb-outage",
    name: "Outage summary",
    prompt: "Summarise this week's outage reports by substation.",
    resource: "Q3 Resilience Memo",
    location: "page 2",
    runs: "On open, and whenever the block is re-run",
    scope: "Everything but drafts",
    model: "analyst-default",
    ownerResolved: true
  },
  {
    id: "gb-precedent",
    name: "Storm precedent brief",
    prompt: "Draw the three closest precedents for a winter-storm hardening rate case.",
    resource: "Storm Hardening Options",
    location: "slide 3",
    runs: "On open, and whenever the block is re-run",
    scope: "Everything but drafts",
    model: "analyst-default",
    ownerResolved: false
  },
  {
    id: "gb-reliability",
    name: "Reliability section draft",
    prompt: "Write the reliability section from accepted findings only, citing each one.",
    resource: "Regulatory Filing Draft",
    location: "section 4",
    runs: "On open, and whenever the block is re-run",
    scope: "Everything but drafts",
    model: "filing-default",
    ownerResolved: true
  },
  {
    id: "gb-costnote",
    name: "Cost note",
    prompt: "Explain the avoided-minutes figure in one sentence a commissioner would accept.",
    resource: "Outage Cost Model",
    location: "C14",
    runs: "On open, and whenever the block is re-run",
    scope: "Everything but drafts",
    model: "analyst-default",
    ownerResolved: true
  }
];

const NODES: readonly LatticeNode[] = [
  {
    id: "ln-relay",
    label: "relay coordination",
    level: "cluster",
    tier: 2,
    members: 14,
    windows: 41,
    density: 0.37,
    cohesion: 0.72,
    parents: ["winter storm response"]
  },
  {
    id: "ln-underground",
    label: "undergrounding cost",
    level: "cluster",
    tier: 2,
    members: 22,
    windows: 63,
    density: 0.29,
    cohesion: 0.64,
    parents: ["winter storm response", "capital programme"]
  },
  {
    id: "ln-vegetation",
    label: "vegetation management",
    level: "cluster",
    tier: 2,
    members: 11,
    windows: 27,
    density: 0.33,
    cohesion: 0.69,
    parents: ["winter storm response"]
  },
  {
    id: "ln-storm",
    label: "winter storm response",
    level: "theme",
    tier: 3,
    members: 61,
    windows: 188,
    density: 0.18,
    cohesion: 0.51,
    parents: []
  },
  {
    id: "ln-feeder12",
    label: "feeder 12",
    level: "window",
    tier: 1,
    members: 4,
    windows: 9,
    density: 0.55,
    cohesion: 0.81,
    parents: ["relay coordination"]
  }
];

/** Recorded once and carried on every hit, because a result without it cannot be read. */
const MANIFEST: SearchedManifest = { contents: 211, searchable: 88, at: "12:04:31" };

const HITS: readonly SearchHit[] = [
  {
    id: "sr-1",
    passage:
      "…no coordination study appears in the filings index after the 2024 reconductoring, though the reconductoring itself raised available fault current on the tie…",
    source: "feeder-12-relay.pdf",
    page: 7,
    offsets: { from: 18420, to: 18604 },
    relevance: 0.86,
    density: 0.41,
    searched: MANIFEST
  },
  {
    id: "sr-2",
    passage:
      "…utilities that undergrounded the worst-performing 5% of feeder miles reported a 38% fall in SAIDI across the two following winters…",
    source: "NERC-2025-winter-review.pdf",
    page: 23,
    offsets: { from: 9120, to: 9302 },
    relevance: 0.79,
    density: 0.38,
    searched: MANIFEST
  },
  {
    id: "sr-3",
    passage:
      "…1,842,000 customer-minutes lost across the January event, nearly a third of them on the eight feeders listed below…",
    source: "Q3 Resilience Memo",
    page: 2,
    offsets: { from: 4310, to: 4468 },
    relevance: 0.74,
    density: 0.52,
    searched: MANIFEST
  },
  {
    id: "sr-4",
    passage:
      "…avoided minutes valued at 4.2 per customer per year against a 46,000,000 hardening programme, over an eight-year recovery…",
    source: "Outage Cost Model",
    offsets: { from: 2040, to: 2192 },
    relevance: 0.68,
    density: 0.44,
    searched: MANIFEST
  }
];

export const contexts = (): Read<readonly ContextRow[]> => read(CONTEXTS, "scope.contexts");

export const context = (contextId: string): Read<ContextRecord> =>
  read(RECORDS.find((record) => record.id === contextId) ?? RECORDS[0], "scope.context");

export const includeTerms = (contextId: string): Read<readonly ScopeTerm[]> => {
  void contextId;
  return read(TERMS.filter((term) => term.side === "include"), "scope.includeTerms");
};

export const takeOutTerms = (contextId: string): Read<readonly ScopeTerm[]> => {
  void contextId;
  return read(TERMS.filter((term) => term.side === "take-out"), "scope.takeOutTerms");
};

export const everythingTerm = (termId: string): Read<EverythingTerm> => {
  void termId;
  return read(
    {
      id: "tm-everything",
      side: "include",
      label: "Everything in this project",
      rule: "everything",
      what: "Including anything created later",
      matches: 248,
      unsaved: false,
      ruleInWords:
        "Every resource in this project, including anything created after this Context was saved.",
      indexed: 103,
      nothingIndexed: 145
    },
    "scope.everythingTerm"
  );
};

export const contextTerm = (termId: string): Read<ContextRefTerm> => {
  void termId;
  return read(
    {
      id: "tm-corpus",
      side: "include",
      label: "Regulatory corpus",
      rule: "context",
      what: "Another saved Context, at its current contents",
      matches: 34,
      unsaved: true,
      ruleInWords: "Whatever Regulatory corpus contains at the moment this one is read.",
      referencedId: "cx-corpus",
      circular: false,
      chain: ["Everything but drafts", "Regulatory corpus", "Filings"]
    },
    "scope.contextTerm"
  );
};

export const kindTerm = (termId: string): Read<KindTerm> => {
  void termId;
  return read(
    {
      id: "tm-templates",
      side: "take-out",
      label: "Every template",
      rule: "kind",
      what: "By kind",
      matches: 37,
      unsaved: true,
      ruleInWords: "Every resource whose kind is template, whenever this is read.",
      kind: "template",
      takesOut: 37,
      sample: ["Regulatory filing shell", "Board update", "Cost model", "Section divider"]
    },
    "scope.kindTerm"
  );
};

/** The rule kinds Add offers. A rule keeps matching; a name does not. */
export const ruleKinds = (): Read<readonly RuleOption[]> =>
  read(
    [
      {
        id: "rk-everything",
        rule: "everything",
        title: "Everything in this project",
        detail: "Live — includes what is made later",
        live: true
      },
      {
        id: "rk-kind",
        rule: "kind",
        title: "Everything of one kind",
        detail: "All documents, all findings…",
        live: true
      },
      {
        id: "rk-context",
        rule: "context",
        title: "Another saved Context",
        detail: "At its current contents",
        live: true
      }
    ],
    "scope.ruleKinds"
  );

/** Specific things, searched by name. Connectors sit here because a term may name one. */
export const namedCandidates = (query: string): Read<readonly NamedCandidate[]> => {
  const all: readonly NamedCandidate[] = [
    ...RESOURCES.slice(0, 6).map(
      (resource: Resource): NamedCandidate => ({
        id: resource.id,
        name: resource.name,
        kind: resource.kind,
        detail: `Updated ${resource.updated} · ${resource.updatedBy}`
      })
    ),
    {
      id: "cn-sharepoint",
      name: "SharePoint — Ops Reports",
      kind: "connector",
      detail: "Expands to the files it synced",
      expandsTo: 312
    }
  ];
  const needle = query.trim().toLowerCase();
  return read(
    needle === ""
      ? all
      : all.filter((candidate: NamedCandidate) => candidate.name.toLowerCase().includes(needle)),
    "scope.namedCandidates"
  );
};

export const problemsIn = (contextId: string): Read<readonly ContextProblem[]> => {
  void contextId;
  return read(
    [
      {
        id: "pb-1",
        title: "One named resource no longer exists",
        term: "d_88a2",
        detail: "Kept as written, on Take out. Repairing it silently would hide the term.",
        tone: "attention"
      },
      {
        id: "pb-2",
        title: "A connector could not be re-read",
        term: "SharePoint — Ops Reports",
        detail:
          "Authentication expired. Its 312 files resolved from the last successful sync, 6 Aug 2026.",
        tone: "danger"
      }
    ],
    "scope.problemsIn"
  );
};

/**
 * The diff between the edited definition and the saved one, resolved. A Context
 * is used by other things, so "what I have set up" and "what is live" have to be
 * two visible states rather than one.
 */
export const unsavedChangesIn = (contextId: string): Read<readonly PendingChange[]> => {
  void contextId;
  return read(
    [
      {
        id: "pc-1",
        name: "NERC-2025-winter-review.pdf",
        effect: "added",
        because: "Regulatory corpus was added to Include"
      },
      {
        id: "pc-2",
        name: "feeder-12-relay.pdf",
        effect: "added",
        because: "Regulatory corpus was added to Include"
      },
      {
        id: "pc-3",
        name: "Regulatory filing shell",
        effect: "taken-out",
        because: "Every template was added to Take out"
      },
      {
        id: "pc-4",
        name: "Board update",
        effect: "taken-out",
        because: "Every template was added to Take out"
      }
    ],
    "scope.unsavedChangesIn"
  );
};

/**
 * What survives, resolved now. The id is the whole argument: a Context stores no
 * membership, so this is a resolve rather than a lookup, and the answer differs
 * between two reads a day apart. Bounded — 6 of 211 here.
 */
export const contentsOf = (contextId: string): Read<readonly ResolvedResource[]> => {
  void contextId;
  return read(CONTENTS, "scope.contentsOf");
};

export const resolvedResource = (
  contextId: string,
  resourceId: string
): Read<ResolvedResource> => {
  void contextId;
  return read(
    CONTENTS.find((row) => row.id === resourceId) ?? CONTENTS[0],
    "scope.resolvedResource"
  );
};

/**
 * Two numbers rather than a percentage: containing a resource and being able to
 * retrieve from it are different things, and a percentage hides which one a
 * reader is looking at.
 */
export const retrievabilityOf = (contextId: string): Read<Retrievability> => {
  void contextId;
  return read({ contains: 211, indexed: 88, nothingIndexed: 123 }, "scope.retrievabilityOf");
};

export const generatedBlocksUsing = (contextId: string): Read<readonly GeneratedBlock[]> => {
  void contextId;
  return read(BLOCKS, "scope.generatedBlocksUsing");
};

export const generatedBlock = (blockId: string): Read<GeneratedBlock> =>
  read(BLOCKS.find((block) => block.id === blockId) ?? BLOCKS[0], "scope.generatedBlock");

export const latticeNodesIn = (contextId: string): Read<readonly LatticeNode[]> => {
  void contextId;
  return read(NODES, "scope.latticeNodesIn");
};

export const latticeNode = (nodeId: string): Read<LatticeNode> =>
  read(NODES.find((node) => node.id === nodeId) ?? NODES[0], "scope.latticeNode");

/**
 * What depends on this Context, grouped. Only consumers that can be queried
 * truthfully are here — there is no universal reverse index — which is why the
 * list is one door with a group on the row and why Delete stays gated.
 */
export const usedBy = (contextId: string): Read<readonly Dependent[]> => {
  void contextId;
  return read(
    [
      {
        id: "ub-1",
        group: "Personas",
        name: "Grid Analyst",
        detail: "What it can look up"
      },
      {
        id: "ub-2",
        group: "Personas",
        name: "Filing Editor",
        detail: "What it can look up"
      },
      {
        id: "ub-3",
        group: "Prompt blocks",
        name: "Q3 Resilience Memo · page 2",
        detail: "Outage summary"
      },
      {
        id: "ub-4",
        group: "Prompt blocks",
        name: "Storm Hardening Options · slide 3",
        detail: "Storm precedent brief"
      },
      {
        id: "ub-5",
        group: "Prompt blocks",
        name: "Regulatory Filing Draft · section 4",
        detail: "Reliability section draft"
      }
    ],
    "scope.usedBy"
  );
};

/**
 * The retrieval test: what an agent searching this scope would actually get. Run
 * against the edited definition, not the saved one, so the answer matches the
 * screen. The query is accepted and ignored here — every mock run returns the
 * same four regions.
 */
export const searchIn = (contextId: string, query: string): Read<readonly SearchHit[]> => {
  void contextId;
  void query;
  return read(HITS, "scope.searchIn");
};

export const searchHit = (hitId: string): Read<SearchHit> =>
  read(HITS.find((hit) => hit.id === hitId) ?? HITS[0], "scope.searchHit");
