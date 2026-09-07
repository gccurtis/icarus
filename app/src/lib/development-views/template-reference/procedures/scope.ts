import type {
  LifecycleStep,
  Refusal,
  Rule,
  ScopeDoor,
  ScopeFork,
  ScopeGap,
  ScopeTerm,
  ScopeWork
} from "$development-views/template-reference/types";

export const TERMS: ScopeTerm[] = [
  {
    select: "project",
    reads: "Everything in the project",
    picks: "Every resource the project holds when the scope is read, including ones made after it was chosen.",
    inABody: "Yes",
    inADefault: "Yes",
    inALiveResource: "Yes"
  },
  {
    select: "kinds",
    reads: "Documents, Findings",
    picks: "Every resource whose kind matches one named, by prefix, so naming a kind names its subkinds.",
    inABody: "Yes",
    inADefault: "Yes",
    inALiveResource: "Yes"
  },
  {
    select: "set",
    reads: "The row's name, or the rule it holds when it has none",
    picks: "Whatever that row's rule picks, followed recursively, with a cycle contributing nothing.",
    inABody: "Stripped when a template is made",
    inADefault: "Yes, and this is the change",
    inALiveResource: "Yes"
  },
  {
    select: "resources",
    reads: "These three, and nothing else",
    picks: "Exactly the rows named, and only while they still exist.",
    inABody: "Stripped when a template is made",
    inADefault: "Not in the vocabulary",
    inALiveResource: "Yes"
  },
  {
    select: "variable",
    reads: "Whatever source_material holds",
    picks: "The answer given for that variable, else its default, else the whole project.",
    inABody: "Yes",
    inADefault: "Yes, one variable may defer to another",
    inALiveResource: "No"
  }
];

export const DOORS: ScopeDoor[] = [
  {
    where: "Templates panel · a variable card on a working copy",
    opens: "Default scope",
    title: "Default scope for Source material",
    confirms: "Set the default scope",
    writes: "updateTemplate with a rule; the server stores a row if the rule needs one"
  },
  {
    where: "Templates library · the inspector's variable list",
    opens: "Default scope",
    title: "Default scope for Source material",
    confirms: "Set the default scope",
    writes: "The same procedure, from the other door"
  },
  {
    where: "Insert · one row per variable in the ask modal",
    opens: "Change",
    title: "What Source material selects here",
    confirms: "Use this",
    writes: "Nothing yet; the rule is held until Insert is pressed"
  },
  {
    where: "Use in the library · the same ask modal",
    opens: "Change",
    title: "What Source material selects here",
    confirms: "Use this",
    writes: "Nothing yet; the rule is held until Use is pressed"
  },
  {
    where: "Project Overview · Contexts panel",
    opens: "New set, or a set's Edit",
    title: "A set of resources",
    confirms: "Create · Save",
    writes: "createResourceSet or updateResourceSet with a name, which makes the row a project subject"
  }
];

export const LIFECYCLE: LifecycleStep[] = [
  {
    index: "1",
    title: "Open",
    person: "Presses Default scope on a variable, or Change beside a variable in the ask modal",
    client: "The builder opens on the rule that is there now, which is the whole project when nothing was chosen",
    server: "Nothing. It reads the project's resource index and the project's named sets, both already loaded",
    rows: "None"
  },
  {
    index: "2",
    title: "Build",
    person: "Adds kinds, named sets or particular resources to Include, and the same to Exclude",
    client: "Each addition appends one term to one of two flat lists. Nothing nests and nothing is ordered",
    server: "Nothing",
    rows: "None"
  },
  {
    index: "3",
    title: "Count",
    person: "Reads how many resources the rule selects right now, and can open the list",
    client: "resolveResourceSet over the project index and the named sets, on every change",
    server: "Nothing",
    rows: "None"
  },
  {
    index: "4",
    title: "Confirm a default",
    person: "Presses Set the default scope",
    client: "Sends the rule as it stands, with no id and no name",
    server: "updateTemplate stores a bound row when the rule needs one and rewrites the default as a single set term",
    rows: "templates at N+1, and resourceSets +1 or one row at its next revision"
  },
  {
    index: "5",
    title: "Confirm an answer",
    person: "Presses Use this, then Insert or Use",
    client: "Holds the rule beside the variable's name until the placing call",
    server: "instantiateTemplate does the same normalisation, owning each row it writes to the resource it makes",
    rows: "The new resource, plus one row per answer that needs one"
  },
  {
    index: "6",
    title: "Forget",
    person: "Deletes the template, or the prompt that asked for the variable",
    client: "Nothing",
    server: "removeTemplate deletes the rows its variables own, the way it already discards the stage",
    rows: "resourceSets −1 per bound row"
  }
];

export const RULES: Rule[] = [
  {
    rule: "A set stores the rule that selects its members, never the members.",
    because:
      "A list captured on save means the project as it was, and starts decaying immediately. A rule resolved when it is read already contains the document made this morning."
  },
  {
    rule: "A row with a name is a project subject. A row without one is bound to whatever points at it.",
    because:
      "Naming is the whole difference. A named set is something people curate and reuse. A bound set is a value a variable happens to hold, and asking someone to name it is asking them to file something they never wanted to keep."
  },
  {
    rule: "A bound row has exactly one owner and dies with it.",
    because:
      "It exists to give one rule an id. Deleting the template, the variable or the resource that points at it leaves nothing that could read it again."
  },
  {
    rule: "The caller sends a rule. The server decides whether it needs a row.",
    because:
      "Two doors set a default and two more give an answer. If each client wrote its own row first, every one of them would need the same normalisation, and each would be a separate round trip that can half-fail."
  },
  {
    rule: "Include, then exclude. The difference is computed when the set is read.",
    because:
      "Every set is a difference, so both lists exist even though the exclude list is usually empty."
  },
  {
    rule: "The whole project, and a bare list of kinds, need no row.",
    because:
      "They are the common case, they are already expressible inline, and writing rows for them would fill the table with rows that say nothing."
  },
  {
    rule: "A template's body never names a set or a resource. It names a variable.",
    because:
      "That is what makes a template a function rather than a value. Portability already strips both, and this work does not change it."
  },
  {
    rule: "A variable's default may name a set, because a template belongs to a project.",
    because:
      "The default is project-local metadata rather than body. When a template is later taken out of its project, the default is one more thing the strip removes."
  }
];

export const REFUSALS: Refusal[] = [
  {
    when: "A set is added to itself, or to a set that already reaches it",
    answer: "The builder refuses the addition and says which set closes the loop",
    where: "The shared draft, before the write; updateResourceSet already refuses it as corrupt"
  },
  {
    when: "A named set is deleted while a set or a template variable names it",
    answer: "in-use, naming what holds it",
    where: "removeResourceSet, which already walks templates.variables"
  },
  {
    when: "A rule names a set from another project",
    answer: "unsupported-body, naming the set",
    where: "instantiateTemplate, which already checks this; updateTemplate gains the same check"
  },
  {
    when: "A rule is sent with both a name and an owner, or with neither",
    answer: "named-bound-set",
    where: "The resource-sets validator"
  },
  {
    when: "An answer names a resource the project does not hold",
    answer: "unknown-resource, naming it",
    where: "validateInstantiateTemplate"
  },
  {
    when: "A prompt names a variable the template does not declare",
    answer: "unsupported-body, with the names",
    where: "Unchanged"
  },
  {
    when: "A variable is answered with a raw difference that reached resolution",
    answer: "unsupported-body, as today",
    where: "resolveTemplateScopes, which should now be unreachable from either door"
  }
];

export const WORK: ScopeWork[] = [
  {
    path: "representation/store/tables.ts",
    status: "changed",
    area: "vocabulary",
    work: "name becomes optional and boundTo is added. NamedResourceSetFields is renamed, because a row is no longer necessarily named."
  },
  {
    path: "representation/data/types/core/resource-set.ts",
    status: "changed",
    area: "vocabulary",
    work: "One added union, BoundTo: a template variable, or a resource. Neither term union moves."
  },
  {
    path: "representation/data/behavior/core/scope-draft.ts",
    status: "new",
    area: "vocabulary",
    work: "The pure half of the builder: two term lists, add, remove, whether a term is already held, whether a rule needs a row, which addition would close a cycle, and the rule as a sentence."
  },
  {
    path: "representation/data/behavior/core/test/unit/scope-draft.test.ts",
    status: "new",
    area: "vocabulary",
    work: "The draft term by term, including the inline cases that write no row and the cycle it refuses."
  },
  {
    path: "representation/data/behavior/core/resource-set.ts",
    status: "changed",
    area: "vocabulary",
    work: "A companion that reports the cycle it stopped at, so the builder can name the set rather than silently selecting nothing."
  },
  {
    path: "representation/data/behavior/core/test/unit/resource-set.test.ts",
    status: "changed",
    area: "vocabulary",
    work: "The reported cycle, and a bound row reached through a named one."
  },
  {
    path: "representation/data/behavior/templates/scopes.ts",
    status: "changed",
    area: "vocabulary",
    work: "No behaviour change. Its refusal on a difference is the reason the row exists, and a test says so."
  },
  {
    path: "capabilities/resource-sets/types/resource-sets.ts",
    status: "changed",
    area: "sets",
    work: "An optional name and an owner on create; the read result says whether a row is named or bound."
  },
  {
    path: "capabilities/resource-sets/api/shared/validation.ts",
    status: "changed",
    area: "sets",
    work: "Named or bound but never both, the owner's shape, and the project check on every set term. The existing size limits stand."
  },
  {
    path: "capabilities/resource-sets/api/shared/projection.ts",
    status: "changed",
    area: "sets",
    work: "namedSetsIn and projectSets keep listing named rows only; itemOf reports the owner."
  },
  {
    path: "capabilities/resource-sets/api/create-resource-set/",
    status: "changed",
    area: "sets",
    work: "Takes an owner and no name, or a name and no owner."
  },
  {
    path: "capabilities/resource-sets/api/read-resource-set/",
    status: "new",
    area: "sets",
    work: "One row by id, for a builder opening on a rule that is already stored."
  },
  {
    path: "capabilities/resource-sets/api/read-resource-sets/",
    status: "changed",
    area: "sets",
    work: "Unchanged in shape; bound rows stay out of the list, which is what every offer list wants."
  },
  {
    path: "capabilities/resource-sets/api/remove-resource-set/",
    status: "changed",
    area: "sets",
    work: "An owner's rows can be removed by the capability that owns them; a named row still refuses while anything names it."
  },
  {
    path: "capabilities/resource-sets/index.remote.ts",
    status: "changed",
    area: "sets",
    work: "One new door, and the changed shapes."
  },
  {
    path: "capabilities/resource-sets/test/unit/resource-sets.test.ts",
    status: "changed",
    area: "sets",
    work: "Named against bound, the owner rules, and removal by owner."
  },
  {
    path: "capabilities/resource-sets/resource-sets.md",
    status: "changed",
    area: "sets",
    work: "Named and bound, said once, in the capability that owns the table."
  },
  {
    path: "capabilities/templates/api/shared/normalise-scope.ts",
    status: "new",
    area: "templates",
    work: "The one place a rule becomes a term: inline when it can be, a written row when it cannot. Both update and instantiate call it."
  },
  {
    path: "capabilities/templates/api/shared/validation.ts",
    status: "changed",
    area: "templates",
    work: "variablesOf admits a default that names a set; answersOf keeps taking a concrete rule, which is what the builder produces."
  },
  {
    path: "capabilities/templates/api/shared/variables.ts",
    status: "changed",
    area: "templates",
    work: "Finding a variable also reports the row it owns, so a variable that disappears takes its row with it."
  },
  {
    path: "capabilities/templates/api/shared/projection.ts",
    status: "changed",
    area: "templates",
    work: "A projected variable carries the rule as a sentence and the row's id, so no panel derives it again."
  },
  {
    path: "capabilities/templates/api/update-template/",
    status: "changed",
    area: "templates",
    work: "A default arrives as a rule, is normalised, and is checked to belong to this project and this variable."
  },
  {
    path: "capabilities/templates/api/instantiate-template/",
    status: "changed",
    area: "templates",
    work: "The same normalisation for answers, with each row it writes owned by the resource it makes."
  },
  {
    path: "capabilities/templates/api/remove-template/",
    status: "changed",
    area: "templates",
    work: "Deletes the rows its variables own, beside the stage it already discards."
  },
  {
    path: "capabilities/templates/test/unit/answers.test.ts",
    status: "changed",
    area: "templates",
    work: "An answer that excludes something now resolves instead of refusing, because it became a row."
  },
  {
    path: "components/authored/scope-builder/",
    status: "new",
    area: "cross-cutting",
    work: "The builder: two lists, three add sources, the live count, the preview, and PanelSentence for the rule. Four callers, no caller-specific behaviour inside it."
  },
  {
    path: "app-views/categories/document-editor/procedures/templating.ts",
    status: "changed",
    area: "editors",
    work: "The kind vocabulary, ruleOf, ruleFrom and the answer options leave; the panel's own wiring stays."
  },
  {
    path: "app-views/categories/document-editor/context/templates.svelte",
    status: "changed",
    area: "editors",
    work: "The toggle modal is replaced by the builder; the ask modal's rows gain Change beside the summary."
  },
  {
    path: "app-views/categories/slide-deck-editor/procedures/templating.ts",
    status: "changed",
    area: "editors",
    work: "The same removal, so the twin stops being a second copy of the vocabulary."
  },
  {
    path: "app-views/categories/slide-deck-editor/context/templates.svelte",
    status: "changed",
    area: "editors",
    work: "The same two replacements."
  },
  {
    path: "app-views/categories/templates/procedures/library.svelte.ts",
    status: "changed",
    area: "library",
    work: "The third byte-identical copy of the vocabulary goes the same way."
  },
  {
    path: "app-views/categories/templates/inspector/template.svelte",
    status: "changed",
    area: "library",
    work: "Default scope and Use open the builder; the rule beneath the button becomes the shared sentence."
  },
  {
    path: "app-views/categories/project-overview/procedures/contexts.ts",
    status: "changed",
    area: "contexts",
    work: "The fourth copy, which had drifted, is replaced by the shared draft; its own wording is what the sentence keeps."
  },
  {
    path: "app-views/categories/project-overview/context/contexts.svelte",
    status: "changed",
    area: "contexts",
    work: "New set and Edit open the builder with a name field above it, so a named set is built exactly like a bound one."
  },
  {
    path: "app-views/categories/*/procedures/test/unit/",
    status: "changed",
    area: "evidence",
    work: "Four suites lose the tests for the four copies and gain one for the shared draft."
  },
  {
    path: "seed/resourceSets.json",
    status: "changed",
    area: "evidence",
    work: "A bound row owned by a seeded template's variable, so every panel has one to draw before anyone builds one."
  },
  {
    path: "test/browser/template-features.spec.ts",
    status: "changed",
    area: "evidence",
    work: "A default is built with an exclusion and a named resource, the count is read, and the placed copy is checked for the set term."
  },
  {
    path: "docs/superpowers/specs/",
    status: "changed",
    area: "documentation",
    work: "The design note gains the section this page is the long form of."
  }
];

export const FORKS: ScopeFork[] = [
  {
    index: "1",
    question: "Does a row have to be named?",
    recommended: "No. name becomes optional, and a row without one is bound.",
    because:
      "Anonymity is the point of the change. A synthesised name would appear in every offer list and in the Contexts panel, and somebody would eventually rename it.",
    alternative: "Keep name required, generate one, and filter bound rows out of every list by their owner.",
    cost: "One optional column against a filter every reader has to remember."
  },
  {
    index: "2",
    question: "Does every chosen scope write a row?",
    recommended: "No. The whole project and a bare list of kinds stay inline; everything else writes one.",
    because:
      "Those two are the common case and both are already expressible. Writing rows for them fills the table with rows that say nothing.",
    alternative: "Always write a row, so there is one code path and one place to look.",
    cost: "Uniformity against a table where most rows are the word project."
  },
  {
    index: "3",
    question: "How does a bound row know what owns it?",
    recommended: "An explicit boundTo on the row.",
    because: "Ownership is a fact worth storing. A sweep has to be written, scheduled and trusted.",
    alternative: "No owner, and a collector that removes rows nothing reaches.",
    cost: "One column against a background job and a window in which orphans are live."
  },
  {
    index: "4",
    question: "Who turns a rule into a row: the client or the server?",
    recommended: "The server, inside the call that was going to be made anyway.",
    because:
      "There are four doors. A client-side write would repeat the same normalisation four times and put a second round trip in front of every save, which can half-fail.",
    alternative: "The client writes the row, then sends its id.",
    cost: "One shared server helper against four client copies and a two-step save."
  },
  {
    index: "5",
    question: "Does the Contexts panel keep its own editor?",
    recommended: "No. It opens the same builder with a name field above it.",
    because:
      "Two editors for one rule is how the two drift, and they already have: four copies of the same prose, one of which says Selects nothing where the others say Nothing. The panel is also the weaker of the two, since it cannot name a resource.",
    alternative: "Leave Contexts alone and build only for templates.",
    cost: "One panel changed now against two ways to say the same thing forever."
  },
  {
    index: "6",
    question: "Can the builder save what you built as a named set?",
    recommended: "Not yet.",
    because:
      "It is an update to a row that already exists, so it is cheap to add later, and offering it invites naming at the moment the person is trying not to name anything.",
    alternative: "Offer it, so a rule someone rebuilds twice can be kept.",
    cost: "Nothing is lost by waiting."
  },
  {
    index: "7",
    question: "Where does the builder live?",
    recommended: "components/authored/scope-builder, with its arithmetic in representation behavior.",
    because: "Four callers in three trees, and the arithmetic is pure. Neither half belongs to a category.",
    alternative: "A component under the templates category that the others import.",
    cost: "A category importing another category's component is the thing the trees exist to prevent."
  },
  {
    index: "8",
    question: "Where does the live count come from?",
    recommended: "The project resource index, resolved in the client on every change.",
    because: "It is already loaded, the arithmetic is pure, and a count that lags the toggle is worse than no count.",
    alternative: "A server procedure that counts.",
    cost: "A round trip per keystroke against a count only as fresh as the index."
  }
];

export const GAPS: ScopeGap[] = [
  {
    title: "Derived outputs have to be made, not carried",
    detail:
      "A template body drops derived-output ids, so a placed copy has prompts with nowhere to put an answer. Instantiation has to create the outputs the body implies, the way it already mints fresh ids for everything else.",
    order: "Lands with derived outputs, before any of this is useful end to end"
  },
  {
    title: "A prompt block is what declares a variable",
    detail:
      "Today a variable appears only because a body already carries a variable scope, which happens when a template with one is inserted into a working copy. The agreed shape is pull-based: making a template walks the prompts it found and asks what each one's scope should be, and two prompts may share a variable.",
    order: "Lands with prompt blocks. The builder is the modal that step opens"
  },
  {
    title: "A prompt block that loads a template",
    detail:
      "The last integration: a prompt naming a template pulls it in and fills its variables with nobody opening a modal.",
    order: "After both, and it needs nothing this plan does not already build"
  },
  {
    title: "The scope vocabulary has four copies",
    detail:
      "ruleOf, ruleFrom, termWords, the kind list and the answer options are byte-identical in the document editor, the deck editor and the library, and a fourth, drifted copy sits in Contexts. The builder would be a fifth.",
    order: "Folded into this work, because it is the reason to do it once"
  },
  {
    title: "A resource picker needs the index inside an editor",
    detail:
      "Naming a particular resource means listing the project's resources from a panel, which today only Project Overview does.",
    order: "Part of this work"
  },
  {
    title: "Taking a template out of its project",
    detail:
      "A default naming a set is project-local. Moving a template elsewhere has to strip defaults the way the body strip already removes set terms.",
    order: "Deferred on purpose, with the rest of the cross-project question"
  },
  {
    title: "A spreadsheet template cannot be opened",
    detail: "openTemplateStage refuses one, because the spreadsheet editor is not on this branch.",
    order: "Unchanged by this work"
  }
];
