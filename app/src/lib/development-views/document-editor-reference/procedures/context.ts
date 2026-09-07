import type { AreaReference } from "$development-views/document-editor-reference/types";

export const contextReference: AreaReference = {
  slug: "context",
  index: "01",
  title: "Context panel",
  shortTitle: "Context",
  eyebrow: "Navigation and document-wide tools",
  summary:
    "The left panel answers “where am I?” and “what exists across this document?” It hosts document-wide navigation and operations while leaving selection-specific editing to the inspector.",
  contract:
    "A context view may read the active document, select a structural target, scroll the content surface, and submit native document operations. It does not own the document body, selection semantics, or persistence.",
  owns: [
    "Which context tool is active for the current application category",
    "Document-wide views: Layout, Find, Styles, Comments, and Sections",
    "Panel width, collapsed state, rail entry order, and honest placeholders",
    "Navigation intent expressed as structural addresses plus a scroll target"
  ],
  doesNotOwn: [
    "The canonical document body or revision",
    "Text-selection formatting controls",
    "Editor focus or ProseMirror selection state",
    "Server writes outside runtime and store capabilities"
  ],
  changes: [
    {
      title: "Real document tools replace static panel mockups",
      before: "Context rows described intended behavior but were not connected to the document model.",
      now: "Layout, Find, Styles, Comments, and Sections derive from the shared runtime or workspace store and dispatch real operations.",
      why: "A reference interface is only useful when its displayed state and resulting document mutation agree."
    },
    {
      title: "Sections uses structural navigation",
      before: "Fractional placement leaked into labels and long titles could collapse into an almost empty row.",
      now: "Outline entries use rounded layout metrics, preserve titles, select the exact structural block, and request a content-surface scroll.",
      why: "Navigation labels must be stable projections, never raw floating-point layout residue."
    },
    {
      title: "Header and footer editing moves onto the page",
      before: "Layout opened a flattened mini-editor inside the context panel and exposed From edge controls.",
      now: "Edit header/footer targets the canonical furniture block on the page; alignment and indent use normal text tools. Compatibility distance remains in data but is not exposed.",
      why: "Furniture is rich document content and should be edited where it is rendered."
    },
    {
      title: "Comments distinguish open, resolved, and detached",
      before: "Detached comments could appear as misleading floating pins near the page header.",
      now: "The panel owns explicit groups. Only resolvable open spans draw page pins; detached threads remain discoverable in Context.",
      why: "A pin implies a valid spatial anchor, so detached state needs a truthful non-spatial representation."
    },
    {
      title: "Missing tools fail honestly",
      before: "Unimplemented entries could look like broken or blank panel content.",
      now: "Variables, Templates, and Prompts remain in the rail and resolve to a named placeholder when no registered view exists.",
      why: "Visible scope without counterfeit functionality is more useful than hiding planned domains."
    }
  ],
  flows: [
    {
      id: "select-view",
      title: "Open a context tool",
      trigger: "The user selects an item in the left rail.",
      steps: [
        { actor: "Context rail", action: "Looks up the entry in the active category’s rail model.", artifact: "view.railFor(category)" },
        { actor: "Workspace view", action: "Stores the selected context ID and clears collapsed state.", artifact: "view.selectContext(id)" },
        { actor: "Context surface", action: "Maps category and ID to a registered Svelte view.", artifact: "import.meta.glob registry" },
        { actor: "Context view", action: "Attaches to shared runtime/store state and renders current data.", artifact: "documentRuntime + readStore" }
      ],
      outcome: "The requested tool appears without creating a second document body or private cache.",
      failure: "A missing registry entry renders PanelPlaceholder with the tool’s name."
    },
    {
      id: "navigate-section",
      title: "Navigate from Sections",
      trigger: "The user chooses an outline entry.",
      steps: [
        { actor: "Sections view", action: "Finds the stable block and its rounded page/line placement.", artifact: "outlineOf + layout metrics" },
        { actor: "Workspace view", action: "Publishes a next-letter inspection at the block’s structural address.", artifact: "view.inspect" },
        { actor: "Document runtime", action: "Publishes a one-shot block scroll target.", artifact: "runtime.scrollTo" },
        { actor: "Content surface", action: "Reconciles selection and scrolls the matching DOM projection into view.", artifact: "selection effect" }
      ],
      outcome: "The editor caret, visible page, and inspector subject all refer to the same stable block.",
      failure: "If a stale entry no longer resolves, no synthetic selection is created."
    },
    {
      id: "find-replace",
      title: "Find and replace",
      trigger: "The user enters a query, navigates a hit, or requests replacement.",
      steps: [
        { actor: "Find view", action: "Derives hits from the live runtime body using query, case, and mode.", artifact: "hitsOf" },
        { actor: "Find view", action: "Converts a hit into structural ranges and inspection intent.", artifact: "selection address" },
        { actor: "Replace action", action: "Builds native text operations for one hit or the current hit set.", artifact: "DocumentOp[]" },
        { actor: "Document runtime", action: "Applies optimistically, records history, and schedules persistence.", artifact: "runtime.apply" }
      ],
      outcome: "Results and content update from one live body; replacement is undoable as a user gesture.",
      failure: "A hit invalidated by another edit is recomputed rather than applied by stale DOM coordinates."
    },
    {
      id: "edit-layout",
      title: "Change layout or edit furniture",
      trigger: "The user changes page setup, numbering, header, or footer controls.",
      steps: [
        { actor: "Layout view", action: "Reads page setup and derived page metrics from the live document.", artifact: "pageSetupOf + layoutOf" },
        { actor: "Layout control", action: "Builds a set operation at the document-level path.", artifact: "native DocumentOp" },
        { actor: "Document runtime", action: "Applies page setup changes or publishes a furniture focus target.", artifact: "apply / scrollTo" },
        { actor: "Content surface", action: "Repaginates, or activates the one canonical on-page furniture editor.", artifact: "furniture plugin" }
      ],
      outcome: "Page geometry remains derived while stored page settings and furniture content remain collaborative.",
      failure: "Invalid numeric input is rejected at the control boundary; the prior valid value remains visible."
    },
    {
      id: "open-comment",
      title: "Open a comment thread",
      trigger: "The user chooses a thread from Open, Resolved, or Detached.",
      steps: [
        { actor: "Comments view", action: "Joins thread, comment, user, and body queries into a display model.", artifact: "workspace store queries" },
        { actor: "Anchor resolver", action: "Attempts to resolve every stored span against the current body.", artifact: "structural anchor" },
        { actor: "Workspace view", action: "Selects the general comment inspector lens.", artifact: "view.inspect(general.comment)" },
        { actor: "Content surface", action: "Scrolls to a valid primary span; detached threads stay panel-only.", artifact: "runtime.scrollTo" }
      ],
      outcome: "The thread opens in the inspector with its source text, opener, replies, and resolution state.",
      failure: "Unresolvable anchors are classified as detached instead of being positioned at a guessed page coordinate."
    }
  ],
  domains: [
    {
      name: "Context selection",
      owner: "Workspace view model",
      shape: "category + selected context ID + collapsed boolean + persisted panel width",
      states: ["expanded with registered view", "expanded with placeholder", "collapsed"],
      transitions: ["rail select → expanded", "resize to boundary → collapsed", "collapse toggle → prior width restored"],
      invariants: ["Rail remains available while the content region is collapsed", "One context view is active per workspace category"],
      sources: ["src/lib/model/client/view", "src/lib/surfaces/context/context.svelte"]
    },
    {
      name: "Outline entry",
      owner: "Document procedures",
      shape: "stable block ID + title + kind + rounded page and line placement",
      states: ["current", "available", "no outline entries"],
      invariants: ["Identity comes from document IDs, not array offsets", "Display placement is integral and derived"],
      sources: ["src/lib/app-views/categories/document-editor/procedures/outline.ts", "src/lib/app-views/categories/document-editor/context/navigator.svelte"]
    },
    {
      name: "Find session",
      owner: "Find context view",
      shape: "query + replacement + text/regex mode + case flag + derived hit list + active index",
      states: ["empty", "results", "no results", "invalid regular expression"],
      transitions: ["query/options change → recompute", "next/previous → select hit", "replace → native operations"],
      invariants: ["Find state is ephemeral", "Replacement mutates only through the runtime"],
      sources: ["src/lib/app-views/categories/document-editor/context/find.svelte", "src/lib/app-views/categories/document-editor/procedures/find.ts"]
    },
    {
      name: "Comment collection",
      owner: "Workspace store + context projection",
      shape: "persisted threads/comments/users joined to resolved document anchors",
      states: ["open and attached", "resolved", "detached"],
      transitions: ["resolve/reopen", "text edit → shifted or detached anchor", "delete thread target → detached"],
      invariants: ["Detached threads remain reviewable", "Detached and resolved threads do not create page pins"],
      sources: ["src/lib/app-views/categories/document-editor/context/comments.svelte", "src/lib/app-views/categories/document-editor/procedures/comments.ts"]
    }
  ],
  procedures: [
    {
      name: "railFor / context registry",
      role: "Resolve the available and active left-panel tools for an application category.",
      reads: "Workspace category, rail model, filesystem view registry.",
      writes: "Selected context view and collapsed state only.",
      failure: "Missing implementation becomes a named placeholder.",
      sources: ["src/lib/surfaces/context/context.svelte", "src/lib/model/client/view"]
    },
    {
      name: "outlineOf",
      role: "Project heading-like blocks into a stable document outline with layout placement.",
      reads: "DocumentBody and current layout metrics.",
      writes: "Nothing; pure derived projection.",
      failure: "Blocks without usable labels receive a stable fallback label.",
      sources: ["src/lib/app-views/categories/document-editor/procedures/outline.ts"]
    },
    {
      name: "hitsOf / replace operations",
      role: "Find live structural ranges and translate replacement intent into document text operations.",
      reads: "Live body and ephemeral search options.",
      writes: "Document body through runtime.apply.",
      failure: "Invalid regex and stale ranges are surfaced without mutating content.",
      sources: ["src/lib/app-views/categories/document-editor/procedures/find.ts", "src/lib/app-views/categories/document-editor/context/find.svelte"]
    },
    {
      name: "style operations",
      role: "Create, apply, select, and summarize named styles at document scope.",
      reads: "Style set, selected structural ranges, block use counts.",
      writes: "Document styles or block style references through native operations.",
      failure: "Unresolvable targets are omitted; operation validation protects the live body.",
      sources: ["src/lib/app-views/categories/document-editor/context/styles.svelte", "src/lib/app-views/categories/document-editor/procedures/styles.ts"]
    },
    {
      name: "layout operations / focusOfFurniture",
      role: "Edit page setup and turn header/footer actions into structural on-page focus intent.",
      reads: "Page setup, page metrics, furniture roots.",
      writes: "Page settings through runtime.apply; selection and scroll intent through view/runtime state.",
      failure: "Absent furniture roots are created through model operations before focus.",
      sources: ["src/lib/app-views/categories/document-editor/context/layout.svelte", "src/lib/app-views/categories/document-editor/procedures/layout.ts"]
    },
    {
      name: "comment grouping and navigation",
      role: "Join persisted discussion records with current structural anchors and classify their display state.",
      reads: "Comment threads, comments, users, and live DocumentBody.",
      writes: "Inspection and scroll intent; mutations delegate to store capability.",
      failure: "Failed resolution produces detached state rather than false coordinates.",
      sources: ["src/lib/app-views/categories/document-editor/context/comments.svelte", "src/lib/app-views/categories/document-editor/procedures/comments.ts"]
    }
  ],
  structure: [
    { path: "src/lib/surfaces/context/context.svelte", role: "Surface host", note: "Registry lookup, rail rendering, placeholder fallback, resize/collapse composition." },
    { path: "src/lib/app-views/categories/document-editor/context/*.svelte", role: "Context views", note: "One file per document-wide tool; local ephemeral UI state stays at this edge." },
    { path: "src/lib/app-views/categories/document-editor/procedures/*.ts", role: "Pure procedures", note: "Outline, find, layout, style, and comment projections shared with tests." },
    { path: "src/lib/model/client/view", role: "Workspace navigation state", note: "Owns selected tool, inspection subject, structural selection, and panel geometry." },
    { path: "src/lib/model/client/workspace-state", role: "Shared access seam", note: "Returns the one document runtime and persistent store queries used across panels." }
  ],
  review: [
    { tone: "settled", title: "Panel boundary is explicit", detail: "Context owns document-wide discovery and commands; selection-specific appearance stays in Inspector." },
    { tone: "settled", title: "Placeholders are intentional", detail: "Variables, Templates, and Prompts are named scope markers, not partially connected controls." },
    { tone: "watch", title: "Context views repeat some mutation wiring", detail: "If more document-wide tools arrive, a small native-operation action adapter may reduce repetitive runtime.apply/error handling without hiding domain intent." }
  ],
  related: ["content", "inspector", "runtime", "backend"]
};
