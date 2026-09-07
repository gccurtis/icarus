import type { AreaReference } from "$development-views/document-editor-reference/types";

export const contentReference: AreaReference = {
  slug: "content",
  index: "03",
  title: "Content surface",
  shortTitle: "Content",
  eyebrow: "Editing, projection, and page composition",
  summary:
    "The center surface is a projection and interaction adapter. It renders one live document body as paginated rich content, translates editor transactions into native operations, and keeps structural selection synchronized with the workspace.",
  contract:
    "ProseMirror may represent pixels, browser selection, and immediate editing intent, but its JSON is never stored. The document runtime remains the client truth; pagination, zoom, and page numbering remain derived views.",
  owns: [
    "One EditorView, its plugins, DOM event policy, and projection lifecycle",
    "Bidirectional translation between visible body rows and ProseMirror state",
    "Pagination, zoom-to-fit, held selections, comment decorations, and page-number projection",
    "Publishing semantic inspection and structural selection back to the workspace"
  ],
  doesNotOwn: [
    "The durable document body or revision",
    "A second undo history independent of document gestures",
    "Persisted page breaks created by reflow or zoom",
    "Panel-specific control state or server conflict arbitration"
  ],
  changes: [
    {
      title: "One live body drives every repaint",
      before: "Panel writes and editor reprojection could disagree, reset selection, or leave stale appearance behind.",
      now: "The runtime body is projected into one EditorView; external changes restore a complete structural bookmark and update held-selection decorations.",
      why: "The center cannot become an independent truth if context, inspector, undo, and remote catch-up must converge."
    },
    {
      title: "Native operations leave the editor boundary",
      before: "Rich editor JSON risked becoming an implicit persistence model.",
      now: "Local ProseMirror transactions are translated into structural insert/remove/text/mark/block operations relative to the last sent body.",
      why: "One operation language gives client optimism, server validation, inversion, and anchor shifting the same semantics."
    },
    {
      title: "Selection restoration is complete",
      before: "Repaint could collapse multi-selection, lose direction, or drop highlight when a panel gained focus.",
      now: "Bookmarks retain primary/secondary ranges, direction, selection type, and held state across local, accepted, remote, layout, and inspector-driven updates.",
      why: "The user’s subject is durable editing state even when DOM positions are reconstructed."
    },
    {
      title: "Pointer gestures are explicit",
      before: "Ctrl/Cmd-click could select an entire raw text block instead of opening a link.",
      now: "Ctrl/Cmd-click safely opens a resolved link, double-click keeps native word selection, and Shift-double-click selects the semantic block without exposing node-selection chrome.",
      why: "Navigation, word selection, and block selection are separate gestures and must not compete."
    },
    {
      title: "Partial header and footer rendering is removed",
      before: "The first page hosted rich editable blocks while repeated pages flattened the same content and lost styling.",
      now: "Header/footer content stays in the backward-compatible representation but does not enter the editor schema, selection map, or translator. Page numbers use a dedicated read-only projection.",
      why: "The editor should not ship a document feature until every occurrence can preserve visual and behavioral parity."
    },
    {
      title: "Comments use structural multi-span decoration",
      before: "A single approximate range and detached floating pin could misrepresent source text.",
      now: "All valid spans are decorated and highlighted; pins are deduplicated/stacked by page position; resolved or detached threads draw no pin.",
      why: "Annotation geometry must follow resolvable document identity, not cached screen coordinates."
    },
    {
      title: "Quote continuation is semantic",
      before: "Enter could create a Body-labeled block that still looked like Quote, and Quote had an editor-only bar.",
      now: "Custom Enter logic resolves next-style, emits fresh block data, and projection derives appearance only from that result; Quote has no hard-coded bar.",
      why: "Displayed style and stored style must never diverge."
    }
  ],
  flows: [
    {
      id: "mount",
      title: "Mount and paint a document",
      trigger: "A document tab opens or the surface receives a new resource ID.",
      steps: [
        { actor: "Content component", action: "Attaches the workspace-owned document runtime and subscribes to its live body.", artifact: "view.documentRuntime(id)" },
        { actor: "Projection", action: "Converts visible body rows, atoms, styles, marks, and page metadata into a ProseMirror document.", artifact: "docOf" },
        { actor: "Editor host", action: "Constructs one EditorState and EditorView with the document plugin set.", artifact: "paint" },
        { actor: "Layout pass", action: "Stamps stable DOM IDs, measures blocks, and derives page placement without history.", artifact: "lay + paginate" }
      ],
      outcome: "One editable surface renders the runtime body and derived pages without persisting editor JSON or layout transactions.",
      failure: "Projection or editor errors are surfaced in the document chrome instead of silently replacing the live body."
    },
    {
      id: "local-edit",
      title: "Apply a local editing gesture",
      trigger: "Typing, deletion, Enter, formatting, or structural editing changes EditorState.",
      steps: [
        { actor: "EditorView", action: "Applies the transaction and preserves ProseMirror’s immediate browser behavior.", artifact: "dispatchTransaction" },
        { actor: "Translation seam", action: "Compares the new editor document with the last sent DocumentBody.", artifact: "bodyOf + sent body" },
        { actor: "Translator", action: "Builds native document operations and touched structural paths.", artifact: "translate" },
        { actor: "Document runtime", action: "Optimistically applies operations, records gesture history, and schedules a server flush.", artifact: "runtime.apply" }
      ],
      outcome: "The editor and runtime converge immediately; persistence proceeds asynchronously through the same native operation language.",
      failure: "Translation failure leaves an explicit editor error and never substitutes ProseMirror JSON as document truth."
    },
    {
      id: "external-repaint",
      title: "Reconcile an external body change",
      trigger: "Inspector/context operations, undo/redo, server acceptance, catch-up, or remote sync changes runtime.body.",
      steps: [
        { actor: "Selection bridge", action: "Captures a full structural bookmark from current EditorState.", artifact: "selection-bookmark" },
        { actor: "Projection", action: "Rebuilds the editor document from the new runtime body.", artifact: "docOf" },
        { actor: "Selection bridge", action: "Resolves and restores primary/secondary ranges, direction, type, and held state.", artifact: "restore bookmark" },
        { actor: "Decoration plugins", action: "Refresh held selection, annotations, page numbers, and layout metadata.", artifact: "plugin meta" }
      ],
      outcome: "Pixels, live data, inspector subject, and visible selection agree after every update origin.",
      failure: "Deleted endpoints fall back to the nearest legal structural position without fabricating deleted content."
    },
    {
      id: "select",
      title: "Publish an editor selection",
      trigger: "The user moves the caret, selects text/ranges, or chooses a semantic object.",
      steps: [
        { actor: "Editor selection", action: "Identifies ProseMirror positions and the active selection type.", artifact: "EditorState.selection" },
        { actor: "Projection map", action: "Maps positions back to stable row/block/atom offsets and all selected ranges.", artifact: "selection address" },
        { actor: "Inspection resolver", action: "Chooses text-selection, next-letter, empty-line, image, or table lens.", artifact: "inspectionOf" },
        { actor: "Workspace view", action: "Stores structural selection and inspection only when meaningfully changed.", artifact: "signal" }
      ],
      outcome: "Context and Inspector can act on semantic identity without reading or retaining DOM positions.",
      failure: "Transient layout selections and read-only page-number projections are filtered before workspace publication."
    },
    {
      id: "layout",
      title: "Paginate and zoom",
      trigger: "Content, page setup, viewport size, or zoom intent changes.",
      steps: [
        { actor: "Layout observer", action: "Measures projected block geometry and available viewport width.", artifact: "ResizeObserver + metrics" },
        { actor: "Paginator", action: "Groups derived block heights into page placements.", artifact: "paginate" },
        { actor: "Editor transaction", action: "Applies layout metadata with addToHistory=false.", artifact: "layout plugin meta" },
        { actor: "Surface", action: "Applies explicit zoom or a bounded fit-to-width scale.", artifact: "zoom state" }
      ],
      outcome: "Pages and scale change visually without creating collaborative content operations.",
      failure: "Incomplete measurement retains a stable prior layout until the next observer pass."
    },
    {
      id: "gesture",
      title: "Interpret link and selection gestures",
      trigger: "The user double-clicks, Shift-double-clicks, or Ctrl/Cmd-clicks content.",
      steps: [
        { actor: "Pointer policy", action: "Classifies modifier, click count, target, and safe resolved link metadata.", artifact: "pointer gestures" },
        { actor: "Link activation", action: "Opens a safe href for Ctrl/Cmd-click without changing editor selection.", artifact: "window.open" },
        { actor: "Word selection", action: "Leaves ordinary double-click to deterministic text selection.", artifact: "browser/editor selection" },
        { actor: "Block selection", action: "Maps Shift-double-click to a full structural text range, not NodeSelection.", artifact: "multi-selection" }
      ],
      outcome: "Each gesture has one predictable effect and the user never sees raw editor node chrome.",
      failure: "Unsafe or unresolved links are not opened and remain ordinary selectable text."
    }
  ],
  domains: [
    {
      name: "Projection baseline",
      owner: "Content component",
      shape: "last DocumentBody represented by the current EditorState (`sent`)",
      states: ["unmounted", "painted and aligned", "local transaction awaiting translation", "external repaint"],
      transitions: ["attach → paint", "transaction → translate → update baseline", "runtime body change → repaint"],
      invariants: ["Editor JSON is never durable", "One EditorView exists per mounted document surface", "Translation is relative to an explicit body baseline"],
      sources: ["src/lib/app-views/categories/document-editor/content/document.svelte", "src/lib/app-views/categories/document-editor/procedures/projection.ts"]
    },
    {
      name: "Selection bookmark",
      owner: "Projection/selection procedures",
      shape: "selection kind + direction + primary range + secondary ranges + held flag using structural endpoints",
      states: ["caret", "text range", "multi-range", "semantic object", "held while focus is outside editor"],
      transitions: ["DOM selection → structural bookmark", "body repaint → resolved editor selection", "panel focus → held"],
      invariants: ["All ranges survive a valid repaint", "Focus loss does not imply selection loss", "No raw text-block NodeSelection is exposed"],
      sources: ["src/lib/app-views/categories/document-editor/procedures/selection-bookmark.ts", "src/lib/app-views/categories/document-editor/procedures/multi-selection.ts"]
    },
    {
      name: "Page layout",
      owner: "Content projection",
      shape: "derived page number + block placement + measured geometry + zoom",
      states: ["measuring", "laid out", "fit-to-width", "explicit zoom"],
      transitions: ["body/setup/resize → measure", "measure → paginate", "zoom command → scale"],
      invariants: ["Page layout never enters collaborative history", "Visible page numbering follows page setup", "Floating-point metrics are rounded at display boundaries"],
      sources: ["src/lib/app-views/categories/document-editor/procedures/paginate.ts", "src/lib/app-views/categories/document-editor/procedures/layout.ts"]
    },
    {
      name: "Page-number projection",
      owner: "Document body + page-number plugin",
      shape: "numbering settings + top/bottom compatibility edge + repeated read-only labels",
      states: ["absent", "visible on every page", "hidden on first page"],
      transitions: ["layout action → configure", "page count change → repeat projection", "disable → remove projections"],
      invariants: ["Page numbers are never editable canvas content", "Header/footer rows are not projected", "Legacy top-edge numbering remains readable"],
      sources: ["src/lib/app-views/categories/document-editor/procedures/page-numbers.ts", "src/lib/app-views/categories/document-editor/content/document.svelte"]
    },
    {
      name: "Annotation projection",
      owner: "Content annotations plugin",
      shape: "resolved multi-span decorations + deduplicated page pin placements + thread state",
      states: ["open attached", "resolved", "partially resolved", "detached"],
      transitions: ["query/body change → resolve", "text operations → shifted spans", "all spans removed → detached"],
      invariants: ["Every valid span highlights", "Resolved/detached threads draw no pin", "Pin geometry is derived, never persisted"],
      sources: ["src/lib/app-views/categories/document-editor/procedures/annotations.ts", "src/lib/app-views/categories/document-editor/procedures/comments.ts"]
    }
  ],
  procedures: [
    {
      name: "paint",
      role: "Create or replace the single EditorState/View from a live DocumentBody projection.",
      reads: "Runtime body, schema, plugins, current structural bookmark.",
      writes: "EditorState/View and projection baseline only.",
      failure: "Surfaces editorError; durable runtime data remains untouched.",
      sources: ["src/lib/app-views/categories/document-editor/content/document.svelte", "src/lib/app-views/categories/document-editor/procedures/projection.ts"]
    },
    {
      name: "emit / translate",
      role: "Turn a local editor-state delta into the minimal native document operations.",
      reads: "Previous sent body, new ProseMirror document, projection mapping.",
      writes: "Runtime body, buffer, and gesture history through runtime.apply.",
      failure: "Translation errors are explicit and do not persist editor JSON.",
      sources: ["src/lib/app-views/categories/document-editor/content/document.svelte", "src/lib/app-views/categories/document-editor/procedures/translate.ts"]
    },
    {
      name: "signal / inspectionOf",
      role: "Map editor selection into structural workspace selection and the correct semantic lens.",
      reads: "Editor selection, projected node metadata, live body.",
      writes: "Workspace view selection and inspection state.",
      failure: "Non-semantic/transient selections are ignored.",
      sources: ["src/lib/app-views/categories/document-editor/content/document.svelte", "src/lib/app-views/categories/document-editor/procedures/inspecting.ts"]
    },
    {
      name: "lay / paginate",
      role: "Measure stable block DOM nodes and derive page placement.",
      reads: "DOM geometry, page setup, block identities.",
      writes: "Layout plugin metadata with history disabled.",
      failure: "Defers until measurement is complete; creates no document operations.",
      sources: ["src/lib/app-views/categories/document-editor/content/document.svelte", "src/lib/app-views/categories/document-editor/procedures/paginate.ts"]
    },
    {
      name: "selection bookmark restore",
      role: "Preserve and resolve complete selection semantics across reconstruction.",
      reads: "Structural bookmark, new body, new projection map.",
      writes: "Editor selection and held-selection plugin state.",
      failure: "Uses nearest legal positions only when the original endpoint was deleted.",
      sources: ["src/lib/app-views/categories/document-editor/procedures/selection-bookmark.ts", "src/lib/app-views/categories/document-editor/procedures/multi-selection.ts", "src/lib/app-views/categories/document-editor/procedures/highlight.ts"]
    },
    {
      name: "page-number projection",
      role: "Repeat page-number labels without projecting or editing their compatibility host content.",
      reads: "Page-number settings, compatibility edge/distance, and derived pages.",
      writes: "Derived page-number plugin metadata only.",
      failure: "Missing numbering produces no decoration; represented header/footer rows remain untouched.",
      sources: ["src/lib/app-views/categories/document-editor/procedures/page-numbers.ts"]
    },
    {
      name: "annotation decoration",
      role: "Resolve persisted comment spans into highlights and page-pin geometry.",
      reads: "Live body, thread queries, projection mapping, layout metrics.",
      writes: "Editor decorations and ephemeral pin placement.",
      failure: "Unresolved spans are omitted; fully unresolved threads become panel-only detached items.",
      sources: ["src/lib/app-views/categories/document-editor/procedures/annotations.ts"]
    },
    {
      name: "Enter and pointer commands",
      role: "Override only semantic continuation and explicit document gestures around the editor base behavior.",
      reads: "Selection, block/style data, pointer modifiers, link metadata.",
      writes: "Editor transactions that subsequently pass through translation, or safe external navigation.",
      failure: "Falls through to base behavior when no custom semantic contract applies.",
      sources: ["src/lib/app-views/categories/document-editor/procedures/editing.ts", "src/lib/app-views/categories/document-editor/content/document.svelte"]
    }
  ],
  structure: [
    { path: "src/lib/app-views/categories/document-editor/content/document.svelte", role: "Composition coordinator", note: "Attaches runtime, owns EditorView lifecycle/effects, hosts page chrome, and is the principal current hotspot." },
    { path: "src/lib/app-views/categories/document-editor/procedures/projection.ts", role: "Model → editor projection", note: "Builds rich ProseMirror nodes and mapping metadata for visible body rows." },
    { path: "src/lib/app-views/categories/document-editor/procedures/translate.ts", role: "Editor → model translation", note: "Diffs the projected result back into native operations relative to an explicit body." },
    { path: "src/lib/app-views/categories/document-editor/procedures/schema.ts", role: "Editor schema", note: "Declares the rendering vocabulary; not a persistence schema." },
    { path: "src/lib/app-views/categories/document-editor/procedures/*", role: "Focused editor procedures", note: "Selection, pagination, annotations, page numbers, editing, marks, links, styles, and layout." }
  ],
  review: [
    { tone: "settled", title: "Persistence boundary is clean", detail: "No ProseMirror JSON or page geometry is persisted; all durable changes are native document operations." },
    { tone: "watch", title: "document.svelte is the largest composition hotspot", detail: "Its responsibilities are related but broad. Extracting an editor bridge/controller and presentation styles is the clearest next seam without changing ownership." },
    { tone: "watch", title: "Projection and mark algebra are substantial", detail: "projection.ts and marks.ts are cohesive but large. Split by structural root/block family and range algebra only when tests can preserve bidirectional contracts." },
    { tone: "settled", title: "Gesture behavior is covered in Chromium", detail: "The convergence suite exercises selection persistence, repeated colors, links, comments, continuation, and console/network cleanliness in the desktop target engine." }
  ],
  related: ["context", "inspector", "runtime", "backend"]
};
