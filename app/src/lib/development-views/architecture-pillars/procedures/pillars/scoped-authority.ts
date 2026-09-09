import type { ArchitecturePillar } from "$development-views/architecture-pillars/types";

export const SCOPED_AUTHORITY: ArchitecturePillar = {
  code: "PIL-03",
  slug: "scoped-authority",
  name: "The client requests intent; the server binds authority",
  short: "Client choice is safe when a capability defines and constrains what that choice means.",
  thesis:
    "The browser is allowed to choose resources, types, commands, and domain options. The architectural boundary fails only when an input becomes an unchecked persistence instruction or when resolved identity and project scope do not constrain the operation.",
  supports:
    "This preserves an expressive client without treating browser input as authority. Subject capabilities remain the auditable place where identity, ownership, validation, and domain invariants converge.",
  contract: [
    "A capability is named for a domain intent, not a storage verb such as arbitrary create/update/remove.",
    "Every input discriminator has a capability-defined allowlist and subject meaning.",
    "Project and user scope are resolved on the server and actually participate in lookup, authorization, or a scoped model call.",
    "The server derives storage coordinates from authorized domain identity wherever possible.",
    "Administrative or generic storage operations are not exported to an ordinary browser capability surface."
  ],
  example: {
    title: "Generic store create accepts a table after throwing scope away",
    source: "capabilities/store/api/create/create.ts",
    shape: `await requireScope();
const { table, fields } = validateCreate(input);
return serverModel().store.create(table, fields);`,
    observed:
      "The procedure correctly opens with the project/user gate, but it discards the result. Validation proves that table and fields have a store-compatible shape; it does not prove that the target row belongs to this project or that a subject capability grants this write.",
    antagonism:
      "The client is no longer choosing a domain option inside a contract. It is supplying storage vocabulary directly, and the server's resolved authority has no effect on where the write lands.",
    repair:
      "Move ordinary writes to subject capabilities such as Comments, Documents, or Slide Decks. Those procedures derive project ownership and storage targets, validate the domain intent, and call Store through a scoped/transactional method. Delete the generic browser mutators rather than retaining a legacy adapter.",
    nuance:
      "A client-selected kind is not inherently wrong. A generic project key/value capability could be safe if the server prefixes the namespace from scope, strictly allowlists keys and value schemas, prevents cross-project addressing, and intentionally grants that exact operation. Likewise an internal admin endpoint can expose broader storage controls under a distinct authority model. The current create/update/remove procedures satisfy none of those narrower contracts."
  },
  equivalence: {
    rule: "Untrusted input determines more authority or storage reach than the named capability contract grants.",
    generalRepair:
      "Replace storage coordinates with domain intent, resolve identity server-side, consume scope in an ownership decision, and expose exceptional generic access only through a separately authorized contract.",
    members: [
      "Scope is called for ordering but its value is discarded",
      "Remote input contains arbitrary table names or store paths",
      "A row id is mutated without proving project ownership",
      "Shape validation is mistaken for authorization",
      "An admin-strength operation is exported to a normal project client"
    ]
  },
  desiredFlow: [
    "Client chooses domain intent and permitted options",
    "Capability resolves request identity + active project",
    "Validator narrows untrusted data to the subject command",
    "Subject lookup proves the target belongs to the resolved project",
    "Server model commits the authorized state transition"
  ],
  checkers: [
    {
      id: "AUTH-01",
      name: "procedure-opens-with-scope",
      status: "Enforced",
      wave: 1,
      mechanism: "TypeScript AST",
      guarantee: "Every capability entry calls requireScope() before any other action.",
      detects: "Missing gates and procedure statements that precede identity/project resolution.",
      implementation: "Retain capabilities/no-procedure-acts-outside-a-scope and its generator-aligned convention.",
      current: "Enforced across every capability entry and clean in the current suite.",
      limit: "It proves ordering only. It does not prove that the returned scope constrains the action."
    },
    {
      id: "AUTH-02",
      name: "capability-scope-is-consumed",
      status: "Enforced",
      wave: 1,
      mechanism: "TypeScript binding-use analysis",
      guarantee: "Resolved project/user authority is bound and visibly participates in the procedure rather than being discarded.",
      detects: "Bare await requireScope(), unused scope variables, and explicit void/no-op uses.",
      implementation:
        "Resolve each binding produced by the first requireScope call and require a meaningful subsequent AST use; declarations and void, no-op, or direct-return references do not count.",
      current: "Enforced; the three generic Store mutators that discard scope are baselined.",
      limit: "Binding flow cannot prove that the eventual sink enforces ownership; AUTH-04 must attempt cross-project targets in executable contracts."
    },
    {
      id: "AUTH-03",
      name: "browser-capabilities-hide-persistence-coordinates",
      status: "Enforced",
      wave: 1,
      mechanism: "Remote capability type-home scan",
      guarantee: "Ordinary remote capability type modules do not import Store vocabulary or declare raw table/path coordinates.",
      detects: "Store type imports and table/path properties typed as TableName, StorePath, or string.",
      implementation:
        "Scan the types/ home of each browser-reachable capability for Store imports and raw persistence-coordinate properties. A future internal-admin surface must live behind a separately catalogued authority boundary.",
      current: "Enforced; four browser-reachable Store input types exposing coordinates are baselined.",
      limit: "A field named path may be legitimate domain input; a deliberately narrow exception needs domain context rather than a global exemption."
    },
    {
      id: "AUTH-04",
      name: "subject-write-proves-ownership",
      status: "Enforced",
      wave: 2,
      mechanism: "Capability contract tests",
      guarantee: "Possessing another project's id never grants read or write authority.",
      detects: "Cross-project update, removal, comment anchoring, snapshot submission, and child creation.",
      implementation:
        "Generate two projects and two users, then run each subject mutator with foreign ids. Require a uniform refusal and unchanged store snapshot.",
      current: "Enforced through executable ownership-contract registration; seven capability families are baselined.",
      limit: "Static rules narrow the surface; only execution against representative state proves ownership behavior."
    },
    {
      id: "AUTH-05",
      name: "procedure-validates-before-action",
      status: "Enforced",
      wave: 1,
      mechanism: "TypeScript AST",
      guarantee: "A capability with input narrows it immediately after the scope gate and before acting.",
      detects: "Input-bearing entries whose next statement is not a recognized validator.",
      implementation: "Retain capabilities/procedure-validates-first and its generated validator naming convention.",
      current: "Enforced, but it checks validation placement and naming rather than authorization semantics.",
      limit: "A validator can prove shape while omitting domain invariants and ownership."
    },
    {
      id: "AUTH-06",
      name: "generic-browser-mutations-do-not-exist",
      status: "Enforced",
      wave: 1,
      mechanism: "Capability export/type scan",
      guarantee: "The normal browser capability surface cannot issue arbitrary persistence CRUD.",
      detects: "Generic create/update/remove exports and typed aliases that expose raw Store operations.",
      implementation:
        "Forbid generic mutators in browser-reachable capability indexes. Permit only a separately named internal-admin tree with an explicit non-project authority mechanism.",
      current: "Enforced; the three generic browser Store mutations are baselined.",
      limit: "Do not ban domain commands named create or remove; this targets operations generic over persistence subjects."
    }
  ],
  rollout: [
    "Move current comment callers from generic Store mutations to the Comments capability.",
    "Delete browser-reachable raw create/update/remove inputs rather than preserving a compatibility layer.",
    "Add executable two-project ownership contracts to each baselined mutating capability family.",
    "Bind every resolved scope value into ownership lookup or a scoped model call before removing its debt record."
  ],
  relatedFindings: ["ARCH-01", "ARCH-09"]
};
