import type {
  DeliveredCapability,
  DeliveredPanel,
  DeliveryFact,
  VocabularyChange
} from "$development-views/project-overview-delivery/types";

export const DELIVERED_PANELS: readonly DeliveredPanel[] = [
  {
    name: "Overview",
    surface: "Context",
    key: "project-overview.overview",
    reads: "readProjectOverview()",
    presents: "Project status, the viewer's role, and project creation date.",
    behavior: "A deliberately sparse resting context; it does not repeat the title, roster, counts, mentions, or activity from the centre."
  },
  {
    name: "History",
    surface: "Context",
    key: "project-overview.history",
    reads: "readProjectHistory({ search, since, before, limit })",
    presents: "A searched, date-windowed, paged chronology of immutable project activity.",
    behavior: "Search and dates are server-owned filters; selecting a row opens its Activity inspector. Mentions remain in the centre review area."
  },
  {
    name: "Person",
    surface: "Inspector",
    key: "general.person",
    reads: "readProjectPerson({ userId })",
    presents: "Safe profile identity, project role, join date, contribution totals, and five recent events.",
    behavior: "The general lens can be reached from any category, but its facts remain scoped to the active project. Presence is omitted until represented."
  },
  {
    name: "Comment",
    surface: "Inspector",
    key: "project-overview.comment",
    reads: "readProjectComment({ threadId })",
    presents: "Target resource, current anchor, selected text, original remark, replies, authors, and resolution state.",
    behavior: "Reply, resolve, reopen, resource navigation, author inspection, and locate-in-editor reuse their existing scoped owners."
  },
  {
    name: "Activity",
    surface: "Inspector",
    key: "project-overview.activity",
    reads: "readProjectActivity({ activityId })",
    presents: "What happened, where, who performed it, when, plus frozen detail and optional context.",
    behavior: "Read-only by design: an activity record is historical evidence. Stored verbs are translated for readers without mutating the event."
  },
  {
    name: "Resource",
    surface: "Inspector",
    key: "project-overview.resource",
    reads: "readProjectResource({ resourceId })",
    presents: "Editable summary, resource-specific counts, provenance, creator, creation date, and five recent events.",
    behavior: "Documents and decks can open in their native editor. Other kinds remain inspectable without pretending an editor route exists."
  }
];

export const DELIVERED_CAPABILITIES: readonly DeliveredCapability[] = [
  {
    name: "readProjectOverview",
    kind: "Query",
    input: "Resolved request scope",
    result: "Status · viewer role · createdAt",
    guarantee: "The project and membership must both belong to the active request scope."
  },
  {
    name: "readProjectHistory",
    kind: "Query",
    input: "search · since · before · limit",
    result: "entries · matched · total · hasMore",
    guarantee: "Filtering, date windows, totals, ordering, and paging are computed over project activity on the server."
  },
  {
    name: "readProjectPerson",
    kind: "Query",
    input: "userId",
    result: "Safe identity · membership · contributions · recent activity",
    guarantee: "Foreign memberships and authentication-only user fields never cross the capability."
  },
  {
    name: "readProjectActivity",
    kind: "Query",
    input: "activityId",
    result: "One immutable projected event or null",
    guarantee: "No adjacent or inferred history is returned, and frozen actor labels remain historical."
  },
  {
    name: "readProjectComment",
    kind: "Query",
    input: "threadId",
    result: "Thread · target · current anchor · ordered remarks",
    guarantee: "Every joined thread, comment, resource, and actor is checked against the active project."
  },
  {
    name: "readProjectResource",
    kind: "Query",
    input: "resourceId",
    result: "Summary · facts · provenance · activity · openability",
    guarantee: "Authored bodies stay behind native capabilities; only bounded counts and metadata cross."
  },
  {
    name: "updateProjectResourceSummary",
    kind: "Command",
    input: "resourceId · summary",
    result: "resourceId · summary · updatedAt",
    guarantee: "Resource ownership is resolved inside one transaction; summary, timestamp, and editor commit or recover together."
  }
];

export const CAPABILITY_FLOW: readonly DeliveryFact[] = [
  { label: "01 · Selection", value: "Workspace state", detail: "A context key or typed subject selection identifies the requested lens." },
  { label: "02 · View entry", value: "Svelte component", detail: "The registered view composes panel vocabulary and delegates behavior." },
  { label: "03 · Procedure", value: "Named read / command", detail: "Effects and async state live outside component markup with an explicit lifetime." },
  { label: "04 · Capability", value: "Project boundary", detail: "Validation and request scope constrain the operation before data is projected." },
  { label: "05 · Store", value: "Reads / transaction", detail: "Queries return bounded view models; the only write runs through a unit of work." }
];

export const VOCABULARY_CHANGES: readonly VocabularyChange[] = [
  { component: "Panel", addition: "titleLines", reason: "Clamp an arbitrarily long subject title while retaining the full title on hover." },
  { component: "PanelEditableText", addition: "field appearance · previewLines", reason: "Give summaries a persistent edit affordance and a bounded resting height." },
  { component: "PanelField", addition: "hierarchy", reason: "Allow sparse executive metadata to use eyebrow labels and stronger values." },
  { component: "PanelFields", addition: "proportional", reason: "Let both columns shrink together when neither is a fixed metadata key." },
  { component: "PanelLink", addition: "lines", reason: "Bound long targets while preserving the complete destination as hover text." },
  { component: "PanelQuote", addition: "collapsible · previewLines", reason: "Keep long comments and event excerpts readable without consuming the lens." },
  { component: "PanelTimeline", addition: "interactiveRows · compact", reason: "Make a whole history event one coherent target and bound feed density." }
];

export const INTENTIONAL_BOUNDARIES: readonly DeliveryFact[] = [
  {
    label: "Presence",
    value: "Not represented",
    detail: "The Person inspector does not invent online or location state. The visual reference marks this single data gap."
  },
  {
    label: "Native opening",
    value: "Documents + decks",
    detail: "Resource inspection supports every represented kind; only editors with a real workspace path expose Open."
  },
  {
    label: "Files + connectors",
    value: "Dedicated lenses",
    detail: "Their established inspectors remain separate because their facts and actions do not match the generic resource contract."
  },
  {
    label: "Authored bodies",
    value: "Never returned",
    detail: "Project Overview receives useful counts, summaries, and frozen labels—not document, deck, sheet, or research bodies."
  },
  {
    label: "Legacy shapes",
    value: "Unsupported",
    detail: "The delivery contains no migrations, aliases, fallbacks, or compatibility readers for superseded comment anchors or views."
  }
];
