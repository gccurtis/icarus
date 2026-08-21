/**
 * Personas and Automations: who the agents are, and the standing rules that ask
 * them for things.
 *
 * `docs/screen-panel-views/context/agents/` and `inspector/agents/` are what these
 * serve. Two subjects in one module because they meet at one point: a rule
 * dispatches to a persona, and the reason a rule cannot fire is almost always a
 * permission on the persona it names.
 *
 * There is no run table. An Automation's last fire is the whole history, the fire
 * count is approximate, and no door here answers with a series — which is why
 * `LastFire` is a record rather than the head of a list, and why nothing returns
 * runs.
 */
import { AGENTS, RESOURCES, actorName, type AgentId, type Resource } from "$mock-capabilities/cast";
import { read, type Read } from "$mock-capabilities/read";

/** Who may be named as an agent here. The cast's three, plus one that is nobody's. */
export type PersonaRef = AgentId | "skeptic";

/** A global persona is not this project's to edit, which is what the grouping is for. */
export type PersonaScope = "This project" | "Everywhere";

/** A row in the roster. The counts are the identifying detail: two personas with
 * similar prose are told apart by what they have done. */
export type PersonaRow = {
  readonly id: PersonaRef;
  readonly name: string;
  readonly describes: string;
  readonly scope: PersonaScope;
  readonly tasks: number;
  readonly running: number;
};

/** The per-persona aggregate the model does not have. *Failed* is in it
 * deliberately — a record that only counts successes is not a record. */
export type PersonaRecord = {
  readonly tasks: number;
  readonly running: number;
  readonly failed: number;
  readonly completed: number;
  readonly conversations: number;
  readonly findings: number;
};

export type PersonaProfile = {
  readonly id: PersonaRef;
  readonly name: string;
  readonly describes: string;
  /** Initials, until there is somewhere to keep a picture. */
  readonly avatar: string;
  readonly scope: PersonaScope;
  readonly revision: number;
  readonly createdBy: string;
  readonly updated: string;
  readonly record: PersonaRecord;
};

/** One task this persona ran. */
export type WorkItem = {
  readonly id: string;
  readonly persona: PersonaRef;
  readonly title: string;
  /** Waiting is a running state: the Work view's Running section covers both. */
  readonly state: "waiting" | "running" | "failed" | "completed";
  /** A person or an Automation. Which it is changes what the row means, so it is
   * on the row rather than behind the task. */
  readonly startedBy: string;
  /** The step while it runs, the reason when it failed, the yield when it finished. */
  readonly detail: string;
  readonly when: string;
};

/** A `PersonaChat` thread. Listed beside tasks because both are work this agent did. */
export type ConversationRow = {
  readonly id: string;
  readonly persona: PersonaRef;
  readonly title: string;
  readonly startedBy: string;
  readonly turns: number;
  readonly age: string;
};

export type BehaviourName = "Focus" | "Background" | "Approach" | "Output" | "Verification";

/** One of the five definition fields. Empty is a state, not an error — an empty
 * section is left out of the prompt entirely, and a persona with five empty ones
 * and a scope is legal. */
export type BehaviourSection = {
  readonly id: string;
  readonly persona: PersonaRef;
  readonly name: BehaviourName;
  /** Static. Nothing about the five names says what tells them apart. */
  readonly purpose: string;
  readonly text: string;
  /** Characters, counted from the text so the two cannot drift. A proxy for
   * tokens, and the honest measure of what the section costs on every call. */
  readonly characters: number;
};

/** What the agent may look things up in — retrievable material, never prompt material. */
export type LookupScope = {
  readonly id: string;
  readonly name: string;
  readonly contains: number;
  /** Always the smaller number. The gap decides what the agent will actually find. */
  readonly searchable: number;
  /** A bounded resolve, so a scope that has drifted is visible from the profile. */
  readonly sample: readonly string[];
  /** Whether the scope resolves outside this project. A named project Context does
   * not travel, which is what makes a global persona materially more limited. */
  readonly travels: boolean;
};

/** One permission, phrased for someone deciding whether to grant it rather than
 * for someone calling it. */
export type ToolPermission = {
  readonly id: string;
  readonly allowed: boolean;
  readonly does: string;
};

/** A binding name and nothing else. Providers, credentials and deployment setup
 * belong outside the project workbench. */
export type ModelBinding = {
  readonly name: string;
  readonly isDefault: boolean;
  /** Deployment configuration rather than project data, which is the open question
   * on the lens — but the chooser needs the list either way. */
  readonly available: readonly string[];
};

type Named = {
  readonly id: PersonaRef;
  readonly name: string;
  readonly purpose: string;
  readonly scope: PersonaScope;
};

type PersonaExtra = {
  readonly persona: PersonaRef;
  readonly avatar: string;
  readonly revision: number;
  readonly createdBy: string;
  readonly updated: string;
  readonly record: PersonaRecord;
};

/** The Skeptic is not in the cast: it is available everywhere, belongs to no
 * project, and does its six tasks elsewhere. Everything else here is the cast's. */
const NAMED: readonly Named[] = [
  ...AGENTS,
  {
    id: "skeptic",
    name: "Skeptic",
    purpose: "Argues the other side of a position before anyone files it.",
    scope: "Everywhere"
  }
];

const EXTRAS: readonly PersonaExtra[] = [
  {
    persona: "grid-analyst",
    avatar: "GA",
    revision: 14,
    createdBy: "Mira Jain",
    updated: "3 days ago",
    record: { tasks: 41, running: 2, failed: 1, completed: 38, conversations: 6, findings: 128 }
  },
  {
    persona: "filing-editor",
    avatar: "FE",
    revision: 9,
    createdBy: "Mira Jain",
    updated: "1 week ago",
    record: { tasks: 18, running: 1, failed: 1, completed: 16, conversations: 2, findings: 0 }
  },
  {
    persona: "source-checker",
    avatar: "SC",
    revision: 6,
    createdBy: "Ana Reyes",
    updated: "2 weeks ago",
    record: { tasks: 23, running: 0, failed: 1, completed: 22, conversations: 1, findings: 0 }
  },
  {
    persona: "skeptic",
    avatar: "SK",
    revision: 3,
    createdBy: "Tomas Kaur",
    updated: "1 month ago",
    record: { tasks: 6, running: 0, failed: 0, completed: 6, conversations: 0, findings: 0 }
  }
];

const GRID_ANALYST: Named = NAMED[0];
const GRID_ANALYST_EXTRA: PersonaExtra = EXTRAS[0];

const namedOf = (personaId: string): Named =>
  NAMED.find((entry: Named) => entry.id === personaId) ?? GRID_ANALYST;

const extraOf = (personaId: string): PersonaExtra =>
  EXTRAS.find((entry: PersonaExtra) => entry.persona === personaId) ?? GRID_ANALYST_EXTRA;

const WORK: readonly WorkItem[] = [
  {
    id: "w-overnight",
    persona: "grid-analyst",
    title: "Summarise overnight outage reports",
    state: "running",
    startedBy: "Ana Reyes",
    detail: "Step 3 of 5",
    when: "12m ago"
  },
  {
    id: "w-brief",
    persona: "grid-analyst",
    title: "Brief the Feeder 12 relay finding",
    state: "running",
    startedBy: "Brief on new finding",
    detail: "Step 2 of 3",
    when: "41m ago"
  },
  {
    id: "w-crosswalk",
    persona: "grid-analyst",
    title: "Rebuild substation crosswalk",
    state: "failed",
    startedBy: "Ana Reyes",
    detail: "Tool not permitted: web.search",
    when: "Yesterday"
  },
  {
    id: "w-precedents",
    persona: "grid-analyst",
    title: "Extract 2024 storm precedents",
    state: "completed",
    startedBy: "Ana Reyes",
    detail: "14 findings accepted",
    when: "2h"
  },
  {
    id: "w-talking-points",
    persona: "grid-analyst",
    title: "Draft board talking points",
    state: "completed",
    startedBy: "Tomas Kaur",
    detail: "6 points, 2 charts",
    when: "1d"
  },
  {
    id: "w-cluster",
    persona: "grid-analyst",
    title: "Cluster the winter-storm findings",
    state: "completed",
    startedBy: "Mira Jain",
    detail: "18 findings clustered",
    when: "2d"
  },
  {
    id: "w-reliability",
    persona: "filing-editor",
    title: "Draft the reliability section",
    state: "waiting",
    startedBy: "Ana Reyes",
    detail: "Waiting for the outage totals",
    when: "2h"
  },
  {
    id: "w-board-pack",
    persona: "filing-editor",
    title: "Assemble the October board pack",
    state: "failed",
    startedBy: "Mira Jain",
    detail: "Tool not permitted: web.search",
    when: "3d"
  },
  {
    id: "w-register",
    persona: "filing-editor",
    title: "Rewrite the filing summary in register style",
    state: "completed",
    startedBy: "Mira Jain",
    detail: "1,240 words",
    when: "3d"
  },
  {
    id: "w-saidi",
    persona: "filing-editor",
    title: "Fold the SAIDI finding into section 4",
    state: "completed",
    startedBy: "Ana Reyes",
    detail: "Section 4 rewritten",
    when: "5d"
  },
  {
    id: "w-citations",
    persona: "source-checker",
    title: "Check citations in the filing draft",
    state: "failed",
    startedBy: "Ana Reyes",
    detail: "The connector could not be read",
    when: "1d"
  },
  {
    id: "w-nerc",
    persona: "source-checker",
    title: "Verify the NERC winter review citations",
    state: "completed",
    startedBy: "Ana Reyes",
    detail: "31 of 34 claims carried",
    when: "3d"
  },
  {
    id: "w-interconnect",
    persona: "source-checker",
    title: "Re-check the Interconnect Failure Review",
    state: "completed",
    startedBy: "Mira Jain",
    detail: "18 claims carried",
    when: "6d"
  },
  {
    id: "w-undergrounding",
    persona: "skeptic",
    title: "Argue the other side of the undergrounding case",
    state: "completed",
    startedBy: "Mira Jain",
    detail: "4 objections",
    when: "1w"
  },
  {
    id: "w-budget",
    persona: "skeptic",
    title: "Attack the 46,000,000 budget basis",
    state: "completed",
    startedBy: "Devi Okonkwo",
    detail: "2 objections",
    when: "3w"
  }
];

const CONVERSATIONS: readonly ConversationRow[] = [
  {
    id: "chat-relay",
    persona: "grid-analyst",
    title: "Relay coordination history",
    startedBy: "Ana Reyes",
    turns: 14,
    age: "2h"
  },
  {
    id: "chat-2024",
    persona: "grid-analyst",
    title: "Reading the 2024 study",
    startedBy: "Mira Jain",
    turns: 9,
    age: "1d"
  },
  {
    id: "chat-hardening",
    persona: "grid-analyst",
    title: "What counts as a hardening measure?",
    startedBy: "Tomas Kaur",
    turns: 5,
    age: "4d"
  },
  {
    id: "chat-register",
    persona: "filing-editor",
    title: "How the register wants cost stated",
    startedBy: "Mira Jain",
    turns: 11,
    age: "5d"
  },
  {
    id: "chat-carry",
    persona: "source-checker",
    title: "Does the NERC review carry this claim?",
    startedBy: "Ana Reyes",
    turns: 7,
    age: "3d"
  }
];

const PURPOSES: Record<BehaviourName, string> = {
  Focus: "What to concentrate on and what to leave alone.",
  Background: "What it is expected to already know before the first call.",
  Approach: "How to go about the work — the order, the method, and where to stop.",
  Output: "The shape of what comes back, so it can be read without being reformatted.",
  Verification: "What has to be true before it answers at all."
};

const section = (persona: PersonaRef, name: BehaviourName, text: string): BehaviourSection => ({
  id: `${persona}-${name.toLowerCase()}`,
  persona,
  name,
  purpose: PURPOSES[name],
  text,
  characters: text.length
});

/** All five for every persona, in the fixed order. An unwritten one is an empty
 * string rather than an absent row, because the panel shows emptiness as a state. */
const BEHAVIOUR: readonly BehaviourSection[] = [
  section(
    "grid-analyst",
    "Focus",
    "Concentrate on outage causation from field evidence: relay logs, event sequences, weather records. Leave cost allocation and rate design to the Filing Editor."
  ),
  section(
    "grid-analyst",
    "Background",
    "Northwind Power is filing a winter-storm hardening case for 2026. The 2025 storms left 4,182 recorded outage events across 41 substations, and the commission has already questioned interconnect performance at Feeder 12 twice."
  ),
  section(
    "grid-analyst",
    "Approach",
    "Start from the record. Read the relay log before the summary that quotes it, and name the substation and the event window for every claim. Where the evidence stops, say so and stop with it."
  ),
  section(
    "grid-analyst",
    "Output",
    "A short finding: what happened, what carries it, and what it changes. One paragraph, then the sources, each with its substation and date."
  ),
  section(
    "grid-analyst",
    "Verification",
    "Every number traces to a row in the outage log or the relay log. A figure that cannot be traced does not go in the finding."
  ),
  section(
    "filing-editor",
    "Focus",
    "Turn accepted findings into filing prose. Do not re-argue a finding, and do not introduce evidence the findings do not carry."
  ),
  section(
    "filing-editor",
    "Background",
    "The filing reaches the commission's register on 14 Nov 2026 and is read by staff who have the 2025 winter review open beside it."
  ),
  section(
    "filing-editor",
    "Approach",
    "Write in the order the register expects: position, evidence, cost, remedy. Quote a finding rather than paraphrasing it wherever the wording is contested."
  ),
  section(
    "filing-editor",
    "Output",
    "Register prose: numbered sections, no bullets, figures written to the nearest thousand dollars."
  ),
  section("filing-editor", "Verification", ""),
  section(
    "source-checker",
    "Focus",
    "Decide one thing per claim: does the cited source carry it. Nothing about whether the claim is true otherwise."
  ),
  section("source-checker", "Background", ""),
  section("source-checker", "Approach", ""),
  section("source-checker", "Output", ""),
  section(
    "source-checker",
    "Verification",
    "Quote the passage that carries the claim, with its page. A claim with no quotable passage is reported as uncarried, never as wrong."
  ),
  section(
    "skeptic",
    "Focus",
    "Find the strongest argument against the position, not the easiest one."
  ),
  section("skeptic", "Background", ""),
  section(
    "skeptic",
    "Approach",
    "Take the position at its best, then attack the weakest premise it depends on. Say which premise, and what would have to be shown to save it."
  ),
  section("skeptic", "Output", ""),
  section("skeptic", "Verification", "")
];

const SCOPES: readonly LookupScope[] = [
  {
    id: "scope-field-reports",
    name: "Field reports 2024–25",
    contains: 96,
    searchable: 88,
    sample: [
      "storm-log-2026-01.csv",
      "feeder-12-relay.pdf",
      "Ward 3 undergrounding report",
      "NERC-2025-winter-review.pdf"
    ],
    travels: false
  },
  {
    id: "scope-regulatory",
    name: "Regulatory corpus",
    contains: 34,
    searchable: 34,
    sample: ["Regulatory Filing Draft", "NERC-2025-winter-review.pdf", "docket-2024-118.pdf"],
    travels: false
  },
  {
    id: "scope-whole-project",
    name: "Everything in this project",
    contains: RESOURCES.length,
    searchable: RESOURCES.length - 1,
    sample: RESOURCES.slice(0, 4).map((resource: Resource) => resource.name),
    travels: true
  }
];

const WHOLE_PROJECT: LookupScope = SCOPES[2];

type ScopeBinding = { readonly persona: PersonaRef; readonly scope: LookupScope };

const SCOPE_BINDINGS: readonly ScopeBinding[] = [
  { persona: "grid-analyst", scope: SCOPES[0] },
  { persona: "filing-editor", scope: SCOPES[1] },
  { persona: "source-checker", scope: SCOPES[2] },
  { persona: "skeptic", scope: SCOPES[2] }
];

type ToolEntry = { readonly id: string; readonly does: string };

/** The whole catalogue. Both halves of the Tools view are drawn from it, so a
 * denial is a row rather than an absence. */
const CATALOGUE: readonly ToolEntry[] = [
  {
    id: "lattice.retrieve",
    does: "Retrieves verbatim regions from the knowledge lattice, within what this persona can look up."
  },
  {
    id: "resource.read",
    does: "Opens a resource in this project and reads it whole. Bounded by project membership, always."
  },
  {
    id: "finding.create",
    does: "Writes a finding with the evidence it rests on. A person still has to accept it."
  },
  {
    id: "analysis.evaluate",
    does: "Runs a saved analysis and reads the result. It cannot change the analysis."
  },
  {
    id: "resource.write",
    does: "Edits a resource in place. Everything it writes is attributed to this persona."
  },
  {
    id: "web.search",
    does: "Searches the public web and reads what it finds. Nothing it retrieves is bounded by the project."
  }
];

type Allowance = { readonly persona: PersonaRef; readonly allowed: readonly string[] };

const ALLOWANCES: readonly Allowance[] = [
  {
    persona: "grid-analyst",
    allowed: ["lattice.retrieve", "resource.read", "finding.create", "analysis.evaluate"]
  },
  { persona: "filing-editor", allowed: ["resource.read", "resource.write"] },
  { persona: "source-checker", allowed: ["lattice.retrieve", "resource.read", "web.search"] },
  { persona: "skeptic", allowed: ["lattice.retrieve", "resource.read"] }
];

const BINDINGS = ["analyst-default", "editor-default", "long-context-review"] as const;

type ModelChoice = { readonly persona: PersonaRef; readonly name: string };

const MODELS: readonly ModelChoice[] = [
  { persona: "grid-analyst", name: "analyst-default" },
  { persona: "filing-editor", name: "editor-default" },
  { persona: "source-checker", name: "long-context-review" },
  { persona: "skeptic", name: "analyst-default" }
];

/** Every persona available here, project ones first. */
export const personasIn = (projectId: string): Read<readonly PersonaRow[]> => {
  void projectId;
  return read(
    NAMED.map((entry: Named): PersonaRow => {
      const record = extraOf(entry.id).record;
      return {
        id: entry.id,
        name: entry.name,
        describes: entry.purpose,
        scope: entry.scope,
        tasks: record.tasks,
        running: record.running
      };
    })
  );
};

export const persona = (personaId: string): Read<PersonaProfile> => {
  const entry = namedOf(personaId);
  const extra = extraOf(personaId);
  return read({
    id: entry.id,
    name: entry.name,
    describes: entry.purpose,
    avatar: extra.avatar,
    scope: entry.scope,
    revision: extra.revision,
    createdBy: extra.createdBy,
    updated: extra.updated,
    record: extra.record
  });
};

/**
 * Everything this persona has done here, in one list rather than one door per
 * state, because the Work view's totals — *of 38* — have to be counted against
 * the same set the sections are filled from.
 */
export const workBy = (personaId: string): Read<readonly WorkItem[]> =>
  read(WORK.filter((item: WorkItem) => item.persona === personaId));

export const conversationsBy = (personaId: string): Read<readonly ConversationRow[]> =>
  read(CONVERSATIONS.filter((chat: ConversationRow) => chat.persona === personaId));

export const behaviourOf = (personaId: string): Read<readonly BehaviourSection[]> =>
  read(BEHAVIOUR.filter((entry: BehaviourSection) => entry.persona === personaId));

export const lookupScopeOf = (personaId: string): Read<LookupScope> =>
  read(
    SCOPE_BINDINGS.find((binding: ScopeBinding) => binding.persona === personaId)?.scope ??
      WHOLE_PROJECT
  );

/** The catalogue with this persona's allowance applied — allowed and not allowed
 * in one answer, since the view splits them and both halves need the same source. */
export const toolsFor = (personaId: string): Read<readonly ToolPermission[]> => {
  const allowed =
    ALLOWANCES.find((entry: Allowance) => entry.persona === personaId)?.allowed ?? [];
  return read(
    CATALOGUE.map(
      (tool: ToolEntry): ToolPermission => ({
        id: tool.id,
        allowed: allowed.includes(tool.id),
        does: tool.does
      })
    )
  );
};

export const modelBindingOf = (personaId: string): Read<ModelBinding> => {
  const name = MODELS.find((choice: ModelChoice) => choice.persona === personaId)?.name ?? BINDINGS[0];
  return read({ name, isDefault: name === BINDINGS[0], available: [...BINDINGS] });
};

/** A time, a repeat and a timezone. The timezone is stored, not inferred: "02:00"
 * without one is ambiguous to everyone but its author. */
export type Schedule = {
  readonly at: string;
  readonly repeats: "Daily" | "Weekdays" | "Weekly" | "Custom";
  readonly timezone: string;
  /** From the scheduler, never computed here. Absent when the rule is off, because
   * then there is no next fire to report. */
  readonly nextFire?: string;
  /** The stored form, which lives behind Advanced. */
  readonly cron: string;
};

/** The trigger as it is stored. A rule has exactly one. */
export type Trigger =
  | { readonly kind: "schedule"; readonly schedule: Schedule }
  | { readonly kind: "resource-change"; readonly watches: string }
  | { readonly kind: "connector-sync"; readonly connector: string }
  | { readonly kind: "finding-accepted"; readonly question?: string }
  | { readonly kind: "manual" };

/** A prompt block somewhere in a document, deck or spreadsheet. */
export type GeneratedBlock = {
  readonly id: string;
  readonly name: string;
  /** What the block asks for, verbatim. */
  readonly prompt: string;
  /** The owning resource — a reverse query in the real model, since a
   * `DerivedOutput` stores no pointer back to what it lives in. */
  readonly resource: string;
  readonly location: string;
};

/** The action as it is stored. A rule has exactly one of these too. */
export type Action =
  | { readonly kind: "ask-agent"; readonly agent: PersonaRef; readonly prompt: string }
  | { readonly kind: "refresh-block"; readonly block: string };

type Chooser = {
  readonly name: string;
  /** What it is, in the words the collapsed row shows. */
  readonly blurb: string;
  readonly chosen: boolean;
};

/**
 * One of the five, ready to render. The detail is present only on the chosen one:
 * the other four collapse to their names, and a rule that is not on a schedule has
 * no schedule to show.
 */
export type TriggerOption =
  | (Chooser & { readonly kind: "schedule"; readonly schedule?: Schedule })
  | (Chooser & { readonly kind: "resource-change"; readonly watches?: string })
  | (Chooser & { readonly kind: "connector-sync"; readonly connector?: string })
  | (Chooser & { readonly kind: "finding-accepted"; readonly question?: string })
  | (Chooser & { readonly kind: "manual" });

/** One of the two. The block chooser carries every block either way, because the
 * section is a list of candidates as well as a summary of the choice. */
export type ActionOption =
  | (Chooser & {
      readonly kind: "ask-agent";
      readonly agent?: PersonaRef;
      readonly agentName?: string;
      /** Sent verbatim. Nothing is added to it and nothing is templated into it. */
      readonly prompt?: string;
    })
  | (Chooser & {
      readonly kind: "refresh-block";
      readonly blocks: readonly GeneratedBlock[];
      readonly chosenBlock?: string;
    });

/** The rule in words. Two clauses rather than one string, because the workspace
 * heading colours each half in the role it belongs to — and because the list, the
 * lens and the heading must all read the same rule the same way. */
export type RuleSentence = {
  readonly triggerClause: string;
  readonly actionClause: string;
};

/** What a fire produced. It opens in the Copilot's task lens, which is the answer
 * to "where do I see what happened" — the Automation records only the dispatch. */
export type DispatchedTask = {
  readonly id: string;
  readonly title: string;
  readonly state: WorkItem["state"];
  readonly detail: string;
};

/** Started means the task was created. It never means the task finished, and a
 * later failure never rewrites this line. */
export type FireResult = "Started" | "Couldn't start" | "Never";

export type LastFire = {
  readonly when: string;
  readonly result: FireResult;
  /** The whole reason, for the lens. */
  readonly why?: string;
  /** The same failure in two words, for a row with no space for the sentence. */
  readonly fault?: string;
  /** Approximate on purpose. There is no run table to count, so the tilde a panel
   * puts in front of this number is load-bearing. */
  readonly firedAbout: number;
  /** Absent in the two cases that make no task: a fire that could not start, and a
   * block re-run, which leaves no run record of its own. */
  readonly task?: DispatchedTask;
};

export type AutomationRow = {
  readonly id: string;
  readonly name: string;
  readonly enabled: boolean;
  /** The trigger in the fewest words that still tell two rules apart. */
  readonly when: string;
  readonly does: string;
  readonly sentence: RuleSentence;
  /** The entire history. Nothing that reads this may imply a series. */
  readonly lastFire: LastFire;
};

/** The lens is the row plus its attribution, so there is one table behind both and
 * the list and the lens cannot disagree about a rule. */
export type AutomationRecord = AutomationRow & {
  readonly createdBy: string;
  readonly revision: number;
};

export type HealthRow = {
  readonly id: string;
  readonly name: string;
  readonly group: "Not working" | "Never fired" | "Working";
  /** Why it is in that group. Absent for a rule that simply works. */
  readonly reason?: string;
  readonly lastFired: string;
  readonly firedAbout: number;
};

const BLOCKS: readonly GeneratedBlock[] = [
  {
    id: "block-outage-summary",
    name: "Outage summary",
    prompt: "Summarise this week's outage reports by substation.",
    resource: "Q3 Resilience Memo",
    location: "page 2"
  },
  {
    id: "block-precedents",
    name: "Storm precedent brief",
    prompt: "List the 2024 storm precedents this filing leans on, with their dockets.",
    resource: "Storm Hardening Options",
    location: "slide 6"
  },
  {
    id: "block-cost-basis",
    name: "Cost basis note",
    prompt: "Explain how the 46,000,000 hardening budget splits across the three programmes.",
    resource: "Regulatory Filing Draft",
    location: "page 11"
  }
];

const RULES: readonly AutomationRecord[] = [
  {
    id: "nightly-digest",
    name: "Nightly filing digest",
    enabled: true,
    when: "02:00 daily",
    does: "Ask Filing Editor",
    sentence: {
      triggerClause: "the clock reaches 02:00 in New York",
      actionClause: "ask Filing Editor to summarise last night's reports"
    },
    lastFire: {
      when: "Today, 02:00",
      result: "Couldn't start",
      why: "Filing Editor may not use web.search",
      fault: "tool not permitted",
      firedAbout: 184
    },
    createdBy: "Mira Jain",
    revision: 4
  },
  {
    id: "outage-summary",
    name: "Refresh outage summary",
    enabled: true,
    when: "When SharePoint syncs",
    does: "Re-run a generated block",
    sentence: {
      triggerClause: "SharePoint — Ops Reports finishes a sync",
      actionClause: "re-run the outage summary in the Q3 Resilience Memo"
    },
    lastFire: { when: "4 days ago", result: "Started", firedAbout: 412 },
    createdBy: "Ana Reyes",
    revision: 2
  },
  {
    id: "finding-brief",
    name: "Brief on new finding",
    enabled: true,
    when: "When a finding is accepted",
    does: "Ask Grid Analyst",
    sentence: {
      triggerClause: "a finding is accepted under Why did Feeder 12 fail twice?",
      actionClause: "ask Grid Analyst to brief it in two paragraphs"
    },
    lastFire: {
      when: "Today, 09:14",
      result: "Started",
      firedAbout: 37,
      task: {
        id: "w-brief",
        title: "Brief the Feeder 12 relay finding",
        state: "running",
        detail: "Step 2 of 3"
      }
    },
    createdBy: "Ana Reyes",
    revision: 1
  },
  {
    id: "board-pack",
    name: "Weekly board pack",
    enabled: false,
    when: "Mondays, 07:00",
    does: "Ask Filing Editor",
    sentence: {
      triggerClause: "the clock reaches 07:00 in New York on a Monday",
      actionClause: "ask Filing Editor to assemble the board pack"
    },
    lastFire: { when: "Never", result: "Never", firedAbout: 0 },
    createdBy: "Tomas Kaur",
    revision: 1
  }
];

const NIGHTLY: AutomationRecord = RULES[0];

const ruleOf = (automationId: string): AutomationRecord =>
  RULES.find((rule: AutomationRecord) => rule.id === automationId) ?? NIGHTLY;

type TriggerBinding = { readonly automation: string; readonly trigger: Trigger };

const TRIGGERS: readonly TriggerBinding[] = [
  {
    automation: "nightly-digest",
    trigger: {
      kind: "schedule",
      schedule: {
        at: "02:00",
        repeats: "Daily",
        timezone: "America/New_York",
        nextFire: "Tomorrow, 02:00",
        cron: "0 2 * * *"
      }
    }
  },
  {
    automation: "outage-summary",
    trigger: { kind: "connector-sync", connector: "SharePoint — Ops Reports" }
  },
  {
    automation: "finding-brief",
    trigger: { kind: "finding-accepted", question: "Why did Feeder 12 fail twice?" }
  },
  {
    automation: "board-pack",
    trigger: {
      kind: "schedule",
      schedule: {
        at: "07:00",
        repeats: "Weekly",
        timezone: "America/New_York",
        cron: "0 7 * * 1"
      }
    }
  }
];

type ActionBinding = { readonly automation: string; readonly action: Action };

const ACTIONS: readonly ActionBinding[] = [
  {
    automation: "nightly-digest",
    action: {
      kind: "ask-agent",
      agent: "filing-editor",
      prompt:
        "Summarise last night's outage reports by substation and flag anything that changes the filing position."
    }
  },
  {
    automation: "outage-summary",
    action: { kind: "refresh-block", block: "block-outage-summary" }
  },
  {
    automation: "finding-brief",
    action: {
      kind: "ask-agent",
      agent: "grid-analyst",
      prompt:
        "Write two paragraphs on the finding just accepted: what it says, what carries it, and what it changes in the filing position."
    }
  },
  {
    automation: "board-pack",
    action: {
      kind: "ask-agent",
      agent: "filing-editor",
      prompt: "Assemble the weekly board pack from the October board update and the latest outage totals."
    }
  }
];

const storedTrigger = (automationId: string): Trigger =>
  TRIGGERS.find((binding: TriggerBinding) => binding.automation === automationId)?.trigger ?? {
    kind: "manual"
  };

const storedAction = (automationId: string): Action =>
  ACTIONS.find((binding: ActionBinding) => binding.automation === automationId)?.action ?? {
    kind: "refresh-block",
    block: "block-outage-summary"
  };

export const automationsIn = (projectId: string): Read<readonly AutomationRow[]> => {
  void projectId;
  return read(RULES);
};

export const automation = (automationId: string): Read<AutomationRecord> =>
  read(ruleOf(automationId));

/** All five, always, with one marked. The five are the vocabulary of the feature,
 * and hiding the four that are not chosen makes the feature look smaller than it is. */
export const triggersFor = (automationId: string): Read<readonly TriggerOption[]> => {
  const stored = storedTrigger(automationId);
  return read([
    {
      kind: "schedule",
      name: "On a schedule",
      blurb: "A time and a timezone",
      chosen: stored.kind === "schedule",
      schedule: stored.kind === "schedule" ? stored.schedule : undefined
    },
    {
      kind: "resource-change",
      name: "Something changes",
      blurb: "A kind of resource, or one exact resource",
      chosen: stored.kind === "resource-change",
      watches: stored.kind === "resource-change" ? stored.watches : undefined
    },
    {
      kind: "connector-sync",
      name: "A connector syncs",
      blurb: "One connector",
      chosen: stored.kind === "connector-sync",
      connector: stored.kind === "connector-sync" ? stored.connector : undefined
    },
    {
      kind: "finding-accepted",
      name: "A finding is accepted",
      blurb: "Optionally only under one question",
      chosen: stored.kind === "finding-accepted",
      question: stored.kind === "finding-accepted" ? stored.question : undefined
    },
    {
      kind: "manual",
      name: "Only when I say",
      blurb: "Never fires on its own. Run now is the point of it",
      chosen: stored.kind === "manual"
    }
  ]);
};

export const actionsFor = (automationId: string): Read<readonly ActionOption[]> => {
  const stored = storedAction(automationId);
  return read([
    {
      kind: "ask-agent",
      name: "Ask an agent to do something",
      blurb: "A persona, and what to ask it",
      chosen: stored.kind === "ask-agent",
      agent: stored.kind === "ask-agent" ? stored.agent : undefined,
      agentName: stored.kind === "ask-agent" ? actorName(stored.agent) : undefined,
      prompt: stored.kind === "ask-agent" ? stored.prompt : undefined
    },
    {
      kind: "refresh-block",
      name: "Re-run a generated block",
      blurb: "One prompt block in a document, deck or spreadsheet",
      chosen: stored.kind === "refresh-block",
      blocks: BLOCKS,
      chosenBlock: stored.kind === "refresh-block" ? stored.block : undefined
    }
  ]);
};

/**
 * Every rule's state, derived from the same table the list reads. Two hand-written
 * lists of the same four rules drift, and this one is the view Project Overview's
 * Health links into — so it has to agree.
 */
export const automationHealth = (projectId: string): Read<readonly HealthRow[]> => {
  void projectId;
  return read(
    RULES.map((rule: AutomationRecord): HealthRow => {
      const fire = rule.lastFire;
      const group =
        fire.firedAbout === 0
          ? "Never fired"
          : fire.result === "Couldn't start"
            ? "Not working"
            : "Working";
      const reason =
        group === "Never fired"
          ? rule.enabled
            ? "On, and its trigger has not happened"
            : "Off"
          : fire.fault;
      return {
        id: rule.id,
        name: rule.name,
        group,
        reason,
        lastFired: fire.when,
        firedAbout: fire.firedAbout
      };
    })
  );
};

export const lastFireOf = (automationId: string): Read<LastFire> =>
  read(ruleOf(automationId).lastFire);

/** The three sections of the Automations view, from the two fields that decide them. */
export const automationGroup = (rule: AutomationRow): "not working" | "on" | "off" =>
  !rule.enabled ? "off" : rule.lastFire.result === "Couldn't start" ? "not working" : "on";
