import type { ArchitecturePillar } from "$development-views/architecture-pillars/types";

export const PROCEDURAL_TRANSPARENCY: ArchitecturePillar = {
  code: "PIL-02",
  slug: "procedural-transparency",
  name: "Behavior is named and located",
  short: "A file's place in the tree should predict whether it declares state, renders, or acts.",
  thesis:
    "Components and model definitions are readable ledgers only when multi-step behavior sits behind named procedures. Extraction is not ceremony: it turns anonymous event/effect code into call paths that can be reviewed and tested independently.",
  supports:
    "A reviewer can first inspect state, then rendering, then the exact procedure invoked by an interaction. Behavior becomes composable without coupling otherwise independent editor implementations.",
  contract: [
    ".svelte files declare props, construct a local controller, derive presentation, bind events, and render.",
    "Each nontrivial event calls one named procedure; each nontrivial lifecycle synchronization has one named effects/ module.",
    "Model definitions expose stored fields only; every derived read and action is a free function receiving the model explicitly.",
    "Stored data remains direct (runtime.body); computed reads use free queries such as getBody(runtime), never getters.",
    "Remote command state, validation, sequencing, refresh, and error handling live in a procedure rather than markup.",
    "A procedure directory is split by entry call chain, not used as one category-scale miscellaneous file."
  ],
  example: {
    title: "The document surface is still its editor controller",
    source: "app-views/categories/document-editor/content/document.svelte",
    shape: `document.svelte
  → owns editor/DOM refs and projection state
  → defines selection, comment, sizing, and dispatch behavior
  → coordinates runtime and ProseMirror
  → runs eleven inline lifecycle effects
  → renders the document`,
    observed:
      "The component has 472 script lines before its markup. Similar controller concentration exists in presentation.svelte, slide-surface.svelte, spreadsheet sheet.svelte, analysis chart.svelte, research thread.svelte, and the template inspector.",
    antagonism:
      "The file name promises presentation but the file owns the behavior graph. Effects have no durable names, event chains cannot be tested without mounting, and a visual change conflicts with synchronization and command code.",
    repair:
      "Create a component-instance state module, move each effect to procedures/effects/<purpose>.svelte.ts, move each user command to a named procedure entry, and leave the .svelte script as wiring and derived presentation.",
    nuance:
      "Do not force document and presentation behavior into shared code merely because the panels look alike. Give each editor the same procedure shape and contracts while retaining independent implementations."
  },
  equivalence: {
    rule: "A declaration or presentation file also performs a multi-step state transition, remote command, lifecycle synchronization, or adapter protocol.",
    generalRepair:
      "Name the behavior by intent, extract the complete call chain to the nearest procedures/methods tree, and make the original site a one-line call boundary.",
    members: [
      "Inline $effect/onMount/onDestroy chains",
      "Capabilities imported directly by a .svelte file",
      "Methods, getters, timers, persistence, or retry loops attached to a model definition",
      "Async command/loading/error orchestration beside markup",
      "One procedures file holding unrelated entry chains"
    ]
  },
  desiredFlow: [
    "Markup event → procedures/<gesture>.ts → local controller or free model query/command",
    "Lifecycle trigger → procedures/effects/<synchronization>.svelte.ts → explicit cleanup",
    "Model query/command(model, input) → methods/<operation>.ts → explicit owned state",
    "Remote intent → component procedure(context, input) → capability index adapter → capability(context, input)"
  ],
  checkers: [
    {
      id: "BEH-01",
      name: "production-svelte-imports-no-capability",
      status: "Enforced",
      wave: 1,
      mechanism: "Import graph",
      guarantee: "Presentation components do not own remote procedure chains.",
      detects: "Any runtime import from $capabilities in a production .svelte file.",
      implementation:
        "Scan production app views and surfaces; type-only imports may be allowed. BEH-03 separately requires a colocated procedure to receive its executable capability port.",
      current: "Enforced; eight production .svelte capability imports are baselined.",
      limit: "Moving one import is insufficient if the extracted procedure remains a giant presentation-specific repository; other checks cover granularity."
    },
    {
      id: "BEH-02",
      name: "component-effects-have-a-home",
      status: "Enforced",
      wave: 1,
      mechanism: "Svelte/TypeScript AST + filesystem",
      guarantee: "Production markup files contain no inline $effect, $effect.pre, onMount, or onDestroy registration.",
      detects: "$effect, $effect.pre, onMount, and onDestroy calls in production .svelte script blocks.",
      implementation:
        "Parse production Svelte script blocks and report every explicit lifecycle registration beside markup; pair this with the existing rule that effect modules use a compiled rune-aware extension.",
      current: "Enforced for $effect, $effect.pre, onMount, and onDestroy; 66 component findings are baselined.",
      limit: "A file boundary does not prove cleanup correctness; LIFE-04 supplies the behavioral contract test."
    },
    {
      id: "BEH-03",
      name: "explicit-dependency-functions",
      status: "Enforced",
      wave: 2,
      mechanism: "TypeScript AST",
      guarantee: "Capability, model, and component-procedure behavior receives every state and effect boundary explicitly.",
      detects: "Model methods/getters/callable properties, capability entries without explicit context, unbound remote entries, this, ambient clocks/globals, and direct imports of effect authorities.",
      implementation:
        "Use one shared AST authority scan with capability-, model-, and component-procedure policies. Permit stored fields, constructors, local callbacks, pure helper imports, and calls or mutations rooted in explicit parameters. Bind authenticated capability context only at the remote adapter.",
      current: "Enforced for new code; existing attached behavior and ambient/imported authority remain exact ratcheted debt.",
      limit: "Syntax proves where authority is acquired, not the semantics of an arbitrary supplied port. Types and focused contracts still decide whether a port grants the right operations."
    },
    {
      id: "BEH-04",
      name: "procedure-entry-matches-directory",
      status: "Enforced",
      wave: 1,
      mechanism: "Filesystem + export AST",
      guarantee: "A procedure or free model operation has a predictable entry file and export name.",
      detects: "Mismatched capability procedure entries and model-operation trees whose paths or names do not resolve.",
      implementation:
        "Retain capability/entry-matches-directory and model/method-entry-matches-directory; extend the same convention to view procedure entry directories.",
      current: "Enforced for capability, model, and app-view procedure trees; 45 view procedure files are baselined.",
      limit: "Naming makes behavior discoverable but says nothing about whether the procedure has too many responsibilities."
    },
    {
      id: "BEH-05",
      name: "async-command-state-lives-with-command",
      status: "Enforced",
      wave: 2,
      mechanism: "AST pattern + reviewed exceptions",
      guarantee: "A production component may await one delegated call but cannot contain a multi-statement async command body or inline async markup handler.",
      detects: "Async component callables with await and more than one statement, plus inline async event handlers in markup.",
      implementation:
        "Parse every production Svelte script callable, permit only a single call/return/await delegation, and fingerprint any larger async body by normalized source rather than line number.",
      current: "Enforced with structural function fingerprints; 34 multi-step component handlers are baselined.",
      limit: "This structural threshold cannot infer whether two statements form one trivial operation; a new case must extract the chain or receive an explicit reviewed debt record."
    }
  ],
  rollout: [
    "Move the eight direct capability calls into named component procedures.",
    "Extract one editor's lifecycle effects at a time into colocated procedures/effects modules.",
    "Replace attached model methods and getters with exported queries/commands, starting with one runtime family.",
    "Split multi-entry view procedure files and move pending/error/refresh orchestration out of markup."
  ],
  relatedFindings: ["ARCH-05", "ARCH-09", "ARCH-10", "ARCH-12"]
};
