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

export const KINDS: ScopeDoor[] = [
  {
    where: "A prompt's scope names it",
    opens: "scope",
    title: "A group of resources",
    confirms: "Always answered: what the caller chose, else the default, else the whole project",
    writes: "Built in the scope builder, and stored as a row when it excludes or names resources"
  },
  {
    where: "A template atom in the prose names it",
    opens: "text",
    title: "Words",
    confirms: "What the caller typed, else the parameter's own default words, else nothing — which is the only thing that holds a placement up",
    writes: "The atom becomes a literal, and the block's display follows"
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
    work: "name is optional and boundTo is added; NamedResourceSetFields became ResourceSetFields, because a row is no longer necessarily named."
  },
  {
    path: "representation/data/types/core/resource-set.ts",
    status: "changed",
    area: "vocabulary",
    work: "One added union, BoundTo: a template's variable, or a placed resource's. Neither term union moved."
  },
  {
    path: "representation/data/behavior/core/scope-draft.ts",
    status: "new",
    area: "vocabulary",
    work: "The whole of it: the two lists, the kinds vocabulary, whether a rule needs a row, which addition would close a cycle, what a rule selects now, the sentence, and the rows and offers the builder is handed."
  },
  {
    path: "representation/data/behavior/core/test/unit/scope-draft.test.ts",
    status: "new",
    area: "vocabulary",
    work: "Sixteen cases: the floor, the replacements, the two doors out, the cycle, the count, and the view."
  },
  {
    path: "capabilities/resource-sets/api/shared/validation.ts",
    status: "changed",
    area: "sets",
    work: "boundToOf admits an owner and refuses anything else. The existing size limits stand."
  },
  {
    path: "capabilities/resource-sets/api/shared/projection.ts",
    status: "changed",
    area: "sets",
    work: "A stored row carries a name or an owner and never both or neither; the listing keeps to named rows, which is what every offer list wants."
  },
  {
    path: "capabilities/templates/api/shared/scopes.ts",
    status: "new",
    area: "templates",
    work: "The one place a rule becomes a term: inline when it can be, a written row when it cannot, the owner's row rewritten rather than repeated, and a stored default read back as the rule it holds."
  },
  {
    path: "capabilities/templates/api/shared/validation.ts",
    status: "changed",
    area: "templates",
    work: "A chosen default is validated wider than a stored one, because it may exclude things and name resources until the server normalises it."
  },
  {
    path: "capabilities/templates/api/shared/projection.ts",
    status: "changed",
    area: "templates",
    work: "A variable's default naming a bound row is expanded into that row's rule, so the builder opens on what somebody built. A named set is left alone."
  },
  {
    path: "capabilities/templates/api/shared/stages.ts",
    status: "changed",
    area: "templates",
    work: "Discarding a working copy takes the rows that copy owns."
  },
  {
    path: "capabilities/templates/api/update-template/",
    status: "changed",
    area: "templates",
    work: "Each default is normalised against its own variable, a set from another project is refused, and a variable that disappears takes its row with it."
  },
  {
    path: "capabilities/templates/api/instantiate-template/",
    status: "changed",
    area: "templates",
    work: "The resource is minted first so an answer that needs a row has an owner; the answers are normalised, the scopes resolved, and a refusal rolls back exactly what was written."
  },
  {
    path: "capabilities/templates/api/remove-template/",
    status: "changed",
    area: "templates",
    work: "Deleting a template deletes the rows its variables own."
  },
  {
    path: "capabilities/templates/test/unit/answers.test.ts",
    status: "changed",
    area: "templates",
    work: "Six cases: the row written, the row cleared, the row rewritten, a default naming resources, an answer that excludes, and a foreign set refused."
  },
  {
    path: "components/authored/scope-builder/",
    status: "new",
    area: "cross-cutting",
    work: "The builder, and its barrel. It is handed rows, offers, a sentence and a count, and answers with the keys it was given; nothing under components/ may reach the vocabulary itself."
  },
  {
    path: "app-views/categories/document-editor/procedures/templating.ts",
    status: "changed",
    area: "editors",
    work: "The local kind list, ruleOf, ruleFrom and the answer options went; what stays re-exports the shared draft and turns chosen rules into answers."
  },
  {
    path: "app-views/categories/document-editor/context/templates.svelte",
    status: "changed",
    area: "editors",
    work: "The toggle modal is the builder; the ask modal lists each variable's rule with Change and Use the default beside it, and the builder opens as a modal of its own."
  },
  {
    path: "app-views/categories/slide-deck-editor/procedures/templating.ts",
    status: "changed",
    area: "editors",
    work: "The same removal, so the twin is no longer a second copy of the vocabulary."
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
    work: "The third byte-identical copy went the same way."
  },
  {
    path: "app-views/categories/templates/inspector/template.svelte",
    status: "changed",
    area: "library",
    work: "Default scope and Use open the builder, and the rule under the button is the shared sentence."
  },
  {
    path: "app-views/categories/project-overview/procedures/contexts.ts",
    status: "changed",
    area: "contexts",
    work: "The fourth copy, which had drifted, is gone; the panel now reads the same words as everything else."
  },
  {
    path: "app-views/categories/project-overview/context/contexts.svelte",
    status: "changed",
    area: "contexts",
    work: "The kind toggles are replaced by the builder, so a named set can finally exclude something and name a particular resource."
  },
  {
    path: "app-views/categories/*/procedures/test/unit/",
    status: "changed",
    area: "evidence",
    work: "Three suites lost the tests for their own copies and now check what they still own."
  },
  {
    path: "seed/resourceSets.json · seed/templates.json",
    status: "changed",
    area: "evidence",
    work: "A bound row owned by a seeded template's variable, holding an exclusion, so every panel has one to draw before anyone builds one."
  },
  {
    path: "test/browser/template-features.spec.ts",
    status: "changed",
    area: "evidence",
    work: "Answering through the builder on insert, building a named set through it in Contexts, and a default built with an exclusion, stored, and read back."
  }
];

export const FORKS: ScopeFork[] = [
  {
    index: "1",
    question: "Does a row have to be named?",
    recommended: "No, and that is how it is built. name is optional; a row without one carries an owner instead.",
    because:
      "Anonymity was the point of the change. A synthesised name would appear in every offer list and in the Contexts panel, and somebody would eventually rename it.",
    alternative: "Keep name required, generate one, and filter bound rows out of every list by their owner.",
    cost: "The projection now refuses a row that carries both or neither, which is the rule stated once."
  },
  {
    index: "2",
    question: "Does every chosen scope write a row?",
    recommended:
      "No, and the line landed narrower than planned: a row is written only when the rule excludes something or names particular resources.",
    because:
      "Those are exactly the two things a template's vocabulary cannot say. Kinds and named sets are already sayable inline, so writing rows for them would fill the table with rows that add an indirection and nothing else.",
    alternative: "Always write a row, so there is one code path and one place to look.",
    cost: "One predicate, needsRow, named once and tested on its own."
  },
  {
    index: "3",
    question: "How does a bound row know what owns it?",
    recommended:
      "An explicit boundTo, and it names the variable on both sides: a template's variable, or a placed resource's.",
    because:
      "One resource may answer several variables, so the owner has to be the pair rather than the resource. Ownership is a fact worth storing; a sweep has to be written, scheduled and trusted.",
    alternative: "No owner, and a collector that removes rows nothing reaches.",
    cost: "One column, and three procedures that already delete things delete these too."
  },
  {
    index: "4",
    question: "Who turns a rule into a row: the client or the server?",
    recommended: "The server, inside the call that was going to be made anyway.",
    because:
      "There are four doors. A client-side write would repeat the same normalisation four times and put a second round trip in front of every save, which can half-fail.",
    alternative: "The client writes the row, then sends its id.",
    cost:
      "Instantiation mints its resource before resolving, because an answer's row is owned by the resource being made, and a refusal rolls back what it wrote."
  },
  {
    index: "5",
    question: "Does the Contexts panel keep its own editor?",
    recommended: "No. It opens the same builder, and it gained exclusions and particular resources by doing so.",
    because:
      "Two editors for one rule is how the two drift, and they already had: four copies of the same prose, one of which said Selects nothing where the others said Nothing.",
    alternative: "Leave Contexts alone and build only for templates.",
    cost: "One panel changed, and a fourth copy of the vocabulary deleted."
  },
  {
    index: "6",
    question: "Can the builder save what you built as a named set?",
    recommended: "Not yet, as recommended.",
    because:
      "It is an update to a row that already exists, so it stays cheap to add, and offering it invites naming at the moment somebody is trying not to name anything.",
    alternative: "Offer it, so a rule somebody rebuilds twice can be kept.",
    cost: "Nothing was lost by waiting."
  },
  {
    index: "7",
    question: "Where does the builder live?",
    recommended:
      "components/authored/scope-builder, with every piece of arithmetic in representation behavior — and the split is stricter than planned.",
    because:
      "Nothing under components/ may reach representation at all, not even for a type. So the builder is handed rows, offers, a sentence and a count, and answers with the keys it was given. It is the better shape: the component cannot express a rule the vocabulary would refuse.",
    alternative: "A component under the templates category that the others import.",
    cost: "One function, builderView, that the four callers pass straight through."
  },
  {
    index: "8",
    question: "Where does the live count come from?",
    recommended: "The project resource index, resolved in the client on every change.",
    because: "It is already loaded, the arithmetic is pure, and a count that lags the toggle is worse than no count.",
    alternative: "A server procedure that counts.",
    cost: "Each of the four surfaces reads the index it was already entitled to."
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
    order: "Done. All four now read one module, and the drifted copy is gone"
  },
  {
    title: "A resource picker needs the index inside an editor",
    detail:
      "Naming a particular resource means listing the project's resources from a panel, which today only Project Overview does.",
    order: "Done. All four surfaces read the index, and the count comes from it"
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
