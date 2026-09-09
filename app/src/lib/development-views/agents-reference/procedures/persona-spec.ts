import type { Chain } from "$development-views/agents-reference/types";

export const PERSONA_SYSTEM = `flowchart LR
  subgraph views["app-views / categories / agents"]
    ctx["context/personas.svelte"]
    surface["content/persona.svelte"]
    lens["inspector/persona.svelte"]
    def["components/definition-panel.svelte"]
    grants["components/grants.svelte"]
    read["procedures/library.svelte.ts"]
  end

  subgraph cap["capabilities / agents"]
    remote["index.remote.ts"]
    create["create-persona"]
    update["update-persona"]
    dup["duplicate-persona"]
    remove["remove-persona"]
    readOne["read-persona"]
    library["read-agents-library"]
    projection["api/shared/projection.ts"]
    lookup["api/shared/lookup.ts"]
  end

  store[("personas")]

  ctx --> read
  surface --> read
  lens --> read
  def --> read
  grants --> read
  read --> remote
  remote --> create
  remote --> update
  remote --> dup
  remote --> remove
  remote --> readOne
  remote --> library
  create --> store
  update --> lookup
  dup --> lookup
  remove --> lookup
  readOne --> lookup
  lookup --> projection
  projection --> store
  library --> projection
  update --> store
  dup --> store
  remove --> store`;

export const PERSONA_STATE = `erDiagram
  PERSONAS ||--o{ AGENTTASKS : "named by"
  PERSONAS ||--o{ AUTOMATIONS : "named by"
  PERSONAS ||--o{ RESEARCHTHREADS : "answers in"

  PERSONAS {
    string name "required"
    string description "optional"
    PersonaDefinition definition "five sections, never partial"
    ResourceSet scope "optional, what it may read"
    ToolId-array tools "the grants"
    Cast cast "optional, label and two levels"
    PersonaAvatar avatar "optional, emoji or image"
    id projectId "required: everything is project-gated"
    Actor createdBy "required"
    number revision "compare-and-swap"
    number updatedAt "required"
  }
  AGENTTASKS {
    id personaId "required"
    ResourceSet scope "optional"
    ToolId-array tools "copied at creation"
  }
  AUTOMATIONS {
    id personaId "required"
    ResourceSet scope "optional"
    ToolId-array tools "copied at creation"
  }
  RESEARCHTHREADS {
    id personaId "optional: a persona chat is a research chat"
    string title "required"
  }`;

export const PERSONA_VISIBILITY = `flowchart TB
  row(["a personas row"]) --> sound{"is the shape sound?"}
  sound -->|"_id is not a string, or revision is not an integer at least 1"| drop["silently dropped"]
  sound -->|yes| named{"is name a string?"}
  named -->|no| drop
  named -->|yes| mine{"is projectId the scope's project?"}
  mine -->|yes| visible["visible"]
  mine -->|no| drop
  visible --> gate["its id joins personaIds"]
  gate --> deps["tasks, automations and chats are kept only if personaIds has their personaId"]
  drop --> hidden["so is everything that names it"]`;

export const PERSONA_UPDATE = `sequenceDiagram
  autonumber
  participant S as a surface
  participant R as index.remote.ts
  participant U as update-persona.ts
  participant L as lookup and projection
  participant D as store

  S->>R: updatePersona(personaId, baseRevision, patch)
  R->>U: updatePersona(input)
  U->>U: requireScope, then validateUpdatePersona
  U->>L: findVisible(store, scope, "personas", id)
  L->>D: visibleIn builds the whole visible set
  L-->>U: found, or missing
  alt missing
    U-->>S: refused not-found, revision null
  else revision moved
    U-->>S: refused stale, with the row's current revision
  else
    U->>U: undefined means unchanged, null means clear
    U->>D: store.update("personas.id", the whole row at revision + 1)
    U-->>R: accepted, id, revision
    R->>R: readAgentsLibrary().refresh, readPersona().refresh
  end`;

export const PERSONA_INHERITANCE = `flowchart TB
  subgraph server["on the server, at creation only"]
    create["createTask or createAutomation"] --> tools{"did the caller send tools?"}
    tools -->|yes| own["tools: the caller's"]
    tools -->|no| copied["tools: a copy of the persona's"]
    create --> scope{"did the caller send a scope?"}
    scope -->|yes| kept["scope: the caller's"]
    scope -->|no| absent["no scope field at all"]
  end

  subgraph client["on the client, every time it is drawn"]
    item["taskItem.scope is null when the field is absent"] --> resolve{"is it null?"}
    resolve -->|yes| ask["read the persona's scope and show that"]
    resolve -->|no| showOwn["show the row's own"]
  end

  absent --> item
  copied --> note["a later change to the persona's tools does not propagate"]`;

export const PERSONA_CHAINS: readonly Chain[] = [
  {
    name: "createPersona",
    kind: "command",
    file: "capabilities/agents/api/create-persona/create-persona.ts",
    input: [
      { name: "name", type: "string", note: "At most 160 characters." },
      { name: "description", type: "string, optional", note: "At most 500." }
    ],
    output: [
      { name: "accepted", type: "true", note: "Always. This procedure cannot refuse." },
      { name: "id", type: "string" },
      { name: "revision", type: "number", note: "Always 1." }
    ],
    steps: [
      { does: "Establish who is asking and about which project.", calls: "requireScope()" },
      { does: "Check the shape and the two strings.", calls: "validateCreatePersona(input) · fieldsOf · only · nameOf · optionalTextOf" },
      { does: "Build the row: an empty definition, the whole project as its scope, and the two default grants.", calls: "emptyDefinition() · DEFAULT_TOOLS" },
      { does: "Write it at revision one, owned by the viewer.", calls: "store.create(\"personas\", fields)", writes: "personas" }
    ],
    refuses: [],
    refreshes: ["readAgentsLibrary()"]
  },
  {
    name: "updatePersona",
    kind: "command",
    file: "capabilities/agents/api/update-persona/update-persona.ts",
    input: [
      { name: "personaId", type: "string" },
      { name: "baseRevision", type: "number", note: "The revision the caller read." },
      { name: "patch.name", type: "string, optional" },
      { name: "patch.description", type: "string | null, optional", note: "null clears it." },
      { name: "patch.section", type: "{ name, text }, optional", note: "One of the five definition sections." },
      { name: "patch.scope", type: "ResourceSet | null, optional", note: "null clears it." },
      { name: "patch.cast", type: "Cast | null, optional" },
      { name: "patch.tools", type: "ToolId[], optional" }
    ],
    output: [
      { name: "accepted", type: "true, with id and the new revision" },
      { name: "accepted: false", type: "reason, revision, detail" }
    ],
    steps: [
      { does: "Establish the scope, then validate. An empty patch is rejected before the store is read.", calls: "requireScope() · validateUpdatePersona(input)" },
      { does: "Find it among what this viewer can see. The lookup is the authorisation.", calls: "findVisible(store, scope, \"personas\", id)" },
      { does: "Compare and swap on the revision." },
      { does: "Apply the patch: undefined leaves a field alone, null removes it, a section merges into the definition." },
      { does: "Replace the whole row at revision plus one.", calls: "store.update(`personas.${id}`, fields)", writes: "personas" }
    ],
    refuses: [
      { reason: "not-found", when: "no visible persona has that id" },
      { reason: "stale", when: "authored against a revision the row has moved past" }
    ],
    refreshes: ["readAgentsLibrary()", "readPersona({ personaId })"]
  },
  {
    name: "duplicatePersona",
    kind: "command",
    file: "capabilities/agents/api/duplicate-persona/duplicate-persona.ts",
    input: [{ name: "personaId", type: "string" }],
    output: [{ name: "accepted", type: "true, with the new id and revision 1" }],
    steps: [
      { does: "Establish the scope and validate the id.", calls: "requireScope() · validateDuplicatePersona" },
      { does: "Find the source among the visible personas.", calls: "findVisible(...)" },
      { does: "Find a free name: name (copy), then (copy 2), comparing lowercased against every visible persona." },
      { does: "Copy the definition, tools, description, scope, cast and avatar; stamp the project and the viewer as creator.", writes: "personas" }
    ],
    refuses: [{ reason: "not-found", when: "the source is not visible. There is no baseRevision, so it cannot be stale." }],
    refreshes: ["readAgentsLibrary()"]
  },
  {
    name: "removePersona",
    kind: "command",
    file: "capabilities/agents/api/remove-persona/remove-persona.ts",
    input: [
      { name: "personaId", type: "string" },
      { name: "baseRevision", type: "number" }
    ],
    output: [{ name: "accepted", type: "true, with the revision it had", note: "The revision is not bumped: the row is gone." }],
    steps: [
      { does: "Establish the scope and validate.", calls: "requireScope() · validateRemovePersona" },
      { does: "Find it, then compare and swap on the revision.", calls: "findVisible(...)" },
      { does: "Count what still names it, over the same visible snapshot: tasks, automations and chats." },
      { does: "Refuse with the count written out, so the message says what is in the way." },
      { does: "Delete the whole row. A path with no field segments is a row delete.", calls: "store.remove(`personas.${id}`)", writes: "personas" }
    ],
    refuses: [
      { reason: "not-found", when: "no visible persona has that id" },
      { reason: "stale", when: "the revision moved" },
      { reason: "in-use", when: "still named by 2 tasks, 1 chat, and so on" }
    ],
    refreshes: ["readAgentsLibrary()", "readPersona({ personaId })"]
  },
  {
    name: "readPersona",
    kind: "query",
    file: "capabilities/agents/api/read-persona/read-persona.ts",
    input: [{ name: "personaId", type: "string" }],
    output: [
      { name: "PersonaDetail", type: "PersonaItem plus definition, cast and avatar" },
      { name: "null", type: "when it is not visible", note: "An absence, not a refusal." }
    ],
    steps: [
      { does: "Establish the scope and validate the id.", calls: "requireScope() · validateReadPersona" },
      { does: "Find it among the visible personas.", calls: "findVisible(...)" },
      { does: "Project it, rebuilding the definition section by section so a missing one reads as empty rather than undefined.", calls: "personaDetail(row, visible)" }
    ],
    refuses: [],
    refreshes: []
  },
  {
    name: "readAgentsLibrary",
    kind: "query",
    file: "capabilities/agents/api/read-agents-library/read-agents-library.ts",
    input: [],
    output: [
      { name: "personas", type: "PersonaItem[]", note: "Sorted by name." },
      { name: "tasks · automations · chats · activity", type: "the rest of the category" },
      { name: "tools · resources · resourceSets", type: "the vocabularies a surface needs" }
    ],
    steps: [
      { does: "Establish the scope. It takes no input, so it has no validator.", calls: "requireScope()" },
      { does: "Build the visible set once, then project everything from it.", calls: "library(store, scope)" },
      { does: "Count each persona's tasks, running, review, finished, automations and chats from that same snapshot.", calls: "personaCounts(id, visible)" }
    ],
    refuses: [],
    refreshes: []
  }
];
