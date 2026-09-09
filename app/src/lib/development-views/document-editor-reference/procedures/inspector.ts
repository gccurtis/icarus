import type { AreaReference } from "$development-views/document-editor-reference/types";

export const inspectorReference: AreaReference = {
  slug: "inspector",
  index: "02",
  title: "Inspector panel",
  shortTitle: "Inspector",
  eyebrow: "Selection-specific editing",
  summary:
    "The right panel describes and changes the current semantic subject: selected text, the next typed letter, an empty line, a named style, an image, a table, or a comment thread.",
  contract:
    "A lens reads live state using a stable structural subject and expresses mutations as native document or store operations. Focus may move into controls without changing the inspected subject or erasing the editor’s visible selection.",
  owns: [
    "Choosing a registered lens for the semantic inspection subject",
    "Selection-specific controls, mixed-state projections, validation, and action labels",
    "Responsive control composition across narrow, default, and wide widths",
    "Comment conversation hierarchy and per-occurrence link metadata"
  ],
  doesNotOwn: [
    "Browser focus as a proxy for editor selection",
    "A private copy of the document body or stored marks",
    "Hard-coded appearance for Quote or Link semantics",
    "Persistence protocols, revision arbitration, or raw store access"
  ],
  changes: [
    {
      title: "Inspection survives focus movement and live selection offsets",
      before: "Clicking inspector controls could remount the lens, collapse the selection, or make the highlight disappear.",
      now: "The surface keys text lenses by stable block span while each lens reads the live selection; a held-selection decoration preserves every visible range.",
      why: "A panel interaction is part of one editing gesture and must not invalidate its subject."
    },
    {
      title: "Formatting is responsive and semantic",
      before: "Code appeared alongside wrapping word chips, even though it was not in the required tool set.",
      now: "One full-width row exposes Bold, Italic, Underline, and Strikethrough; container width switches their labels to B/I/U/S when needed.",
      why: "The available actions stay constant while their labels adapt to real panel width."
    },
    {
      title: "Color uses one shared instrument",
      before: "Foreground/background controls were separate swatch walls and repeated replacement could fail.",
      now: "Color and Background share a row and each invokes PanelColorPicker with palette, EyeDropper capability state, and More colours/custom hex entry. Replacement is computed against evolving operation state.",
      why: "A shared primitive prevents visual drift while correct mark algebra permits unlimited replacement."
    },
    {
      title: "Alignment and spacing follow their visual roles",
      before: "Alignment and ambiguous Before/After spacing were separate; numeric controls were crowded with plus/minus buttons and zero looked disabled.",
      now: "A full-width icon row controls Alignment inside Style; a collapsed Spacing section contains Space above, Space below, Line height, and Indent. Direct number inputs use native arrow keys, clear units, and normal zero styling.",
      why: "Alignment changes how the text reads, while the lower-priority spacing controls remain available without dominating the inspector."
    },
    {
      title: "Links separate meaning from appearance",
      before: "Link styling was immutable and notes were discarded.",
      now: "Each occurrence owns a validated URL and optional note; blue foreground and underline are ordinary removable marks.",
      why: "Navigation metadata should persist independently from a document author’s visual system."
    },
    {
      title: "Comments expose a readable conversation",
      before: "Selected text, opener, replies, and composer visually blended together.",
      now: "Commented text is a distinct top section, followed by a labeled conversation, emphasized opening comment, replies, composer, and resolve/reopen actions.",
      why: "Source material and discussion turns carry different roles and need different visual weight."
    },
    {
      title: "Quote and continuation are data-driven",
      before: "Quote received a special bar and Enter could label a new block Body while leaving Quote presentation behind.",
      now: "Quote has no hard-coded ornament. The Enter procedure applies the named style’s next-style rule and rebuilds presentation from the new block’s actual data.",
      why: "A named style should never smuggle presentation through editor-only CSS or stale projection state."
    }
  ],
  flows: [
    {
      id: "resolve-lens",
      title: "Resolve the active lens",
      trigger: "The workspace inspection subject changes.",
      steps: [
        { actor: "Workspace view", action: "Publishes category, lens ID, and structural selection/subject.", artifact: "view.inspected + view.selection" },
        { actor: "Inspector surface", action: "Maps a category lens or general lens through its filesystem registry.", artifact: "import.meta.glob + pathOf" },
        { actor: "Subject lifetime", action: "Keys text lenses by block-span identity, not live character offsets.", artifact: "structuralSubject" },
        { actor: "Lens", action: "Derives current values and mixed states from the shared runtime body.", artifact: "documentRuntime" }
      ],
      outcome: "The correct semantic controls render once and remain mounted while the user adjusts them.",
      failure: "Unknown lens IDs resolve to PanelPlaceholder instead of a blank inspector."
    },
    {
      id: "format-selection",
      title: "Format selected text",
      trigger: "The user chooses a mark, foreground, background, or named style.",
      steps: [
        { actor: "Text lens", action: "Reads every structural range and derives on/off/mixed control state.", artifact: "selectedRanges" },
        { actor: "Mark procedure", action: "Builds removal/insertion operations against an evolving working body.", artifact: "mark operations" },
        { actor: "Document runtime", action: "Applies the gesture optimistically and adds one history entry.", artifact: "runtime.apply" },
        { actor: "Content surface", action: "Reprojects body changes and restores the complete selection bookmark.", artifact: "projection + heldSelection" }
      ],
      outcome: "All selected spans visibly update while selection direction, primary range, and secondary ranges remain intact.",
      failure: "Invalid or unresolved structural endpoints are refused without partially applying the gesture."
    },
    {
      id: "format-next-letter",
      title: "Set the next typed letter",
      trigger: "The caret is collapsed and the user changes inline appearance.",
      steps: [
        { actor: "Next-letter lens", action: "Combines marks at the caret with any pending local choices.", artifact: "carried + pending marks" },
        { actor: "Document runtime", action: "Stores pending marks as ephemeral editor intent, not document data.", artifact: "runtime.pendingMarks" },
        { actor: "Content surface", action: "Maps pending structural marks into ProseMirror stored marks.", artifact: "stored marks effect" },
        { actor: "Typing", action: "Translation emits text plus the chosen semantic marks into native operations.", artifact: "translate" }
      ],
      outcome: "The next character receives the chosen formatting without manufacturing an empty persisted mark.",
      failure: "Moving the caret recomputes applicable marks and clears incompatible pending intent."
    },
    {
      id: "edit-link",
      title: "Create or edit a link",
      trigger: "The user adds a URL/note to selected text or edits an existing occurrence.",
      steps: [
        { actor: "Link editor", action: "Validates and normalizes the URL while retaining the optional note.", artifact: "MarkLink" },
        { actor: "Link procedure", action: "Removes the exact prior occurrence and inserts the replacement over the same structural ranges.", artifact: "link operations" },
        { actor: "Document runtime", action: "Applies and persists link metadata as ordinary document operations.", artifact: "runtime.apply" },
        { actor: "Appearance controls", action: "Independently add or remove foreground and underline marks.", artifact: "ordinary marks" }
      ],
      outcome: "Navigation data survives reload while link appearance remains fully authorable.",
      failure: "Unsafe URLs are rejected inline; the previous link remains unchanged."
    },
    {
      id: "comment-thread",
      title: "Create and manage a comment",
      trigger: "The user comments on one contiguous text range, or opens an existing thread.",
      steps: [
        { actor: "Text lens", action: "Converts the selected range into canonical structural spans across its blocks.", artifact: "AnchorWithin" },
        { actor: "Store capability", action: "Creates the thread and opening comment with user/project ownership.", artifact: "commentThreads + comments" },
        { actor: "Comment lens", action: "Joins selected text, opener, replies, authors, and resolution state.", artifact: "general.comment" },
        { actor: "Store capability", action: "Adds replies or changes resolved state; queries refresh.", artifact: "native store operations" }
      ],
      outcome: "One thread can truthfully refer to non-contiguous text and remains navigable after edits.",
      failure: "If all spans are deleted, the thread remains persisted and becomes Detached in Context."
    }
  ],
  domains: [
    {
      name: "Inspection subject",
      owner: "Workspace view model",
      shape: "lens ID + semantic target + optional structural selection",
      states: ["text selection", "next letter", "empty line", "named style", "image", "table", "general comment", "placeholder"],
      transitions: ["editor selection → text/next-letter/empty-line", "context action → named style/comment", "object selection → image/table"],
      invariants: ["Subject comes from semantics, not focus location", "Changing character offsets inside the same block span does not remount a text lens"],
      sources: ["src/lib/surfaces/inspector/inspector.svelte", "src/lib/model/client/view"]
    },
    {
      name: "Inline appearance",
      owner: "Document representation",
      shape: "structural mark endpoints carrying bold/italic/underline/strike/color/background/link semantics",
      states: ["off", "on", "mixed across ranges", "pending at caret"],
      transitions: ["toggle", "replace value", "remove", "type with pending marks"],
      invariants: ["Code is not an authored inspector action", "Link metadata does not force foreground or underline", "All ranges participate"],
      sources: ["src/lib/app-views/categories/document-editor/procedures/marks.ts", "src/lib/app-views/categories/document-editor/inspector/text-selection.svelte"]
    },
    {
      name: "Text alignment and spacing",
      owner: "Block format + named style resolution",
      shape: "alignment + spaceBefore + spaceAfter + lineHeight + indent",
      states: ["single value", "mixed", "inherited", "direct override"],
      transitions: ["direct edit", "named style application", "reset/inherit"],
      invariants: ["Zero is a valid editable value", "Space labels describe their physical effect", "Quote receives no private CSS ornament"],
      sources: ["src/lib/components/authored/panel/panel-alignment.svelte", "src/lib/components/authored/panel/panel-spacing.svelte", "src/lib/app-views/categories/document-editor/procedures/styles.ts"]
    },
    {
      name: "Link occurrence",
      owner: "Document mark model",
      shape: "structural span + safe URL + optional note",
      states: ["absent", "editing draft", "valid persisted link", "invalid draft"],
      transitions: ["add", "edit URL/note", "remove"],
      invariants: ["Notes are per occurrence", "Unsafe schemes never enter the live body", "Appearance remains independent"],
      sources: ["src/lib/app-views/categories/document-editor/procedures/links.ts", "src/lib/representation/data/types/content/content-block.ts"]
    },
    {
      name: "Conversation",
      owner: "Store representation + inspector projection",
      shape: "thread anchor and status + ordered opening comment/replies + author records",
      states: ["open attached", "resolved", "detached"],
      transitions: ["create", "reply", "resolve", "reopen", "anchor shift/detach"],
      invariants: ["Commented text precedes conversation UI", "Opening comment and replies remain distinguishable", "Detached state does not invent a page pin"],
      sources: ["src/lib/app-views/general/comment/comment.svelte", "src/lib/app-views/categories/document-editor/procedures/comments.ts"]
    }
  ],
  procedures: [
    {
      name: "pathOf / structuralSubject",
      role: "Resolve the registered lens and define a stable component lifetime for text subjects.",
      reads: "Inspected lens ID and current structural selection.",
      writes: "Component identity only.",
      failure: "Unknown paths show a placeholder; absent selection yields an honest empty state.",
      sources: ["src/lib/surfaces/inspector/inspector.svelte"]
    },
    {
      name: "mark state and operation builders",
      role: "Summarize marks across multiple spans and build safe add/remove/replace operations.",
      reads: "Live body, selected ranges, current mark set.",
      writes: "Document marks through runtime.apply.",
      failure: "Unresolvable endpoints return an explicit failure before mutation.",
      sources: ["src/lib/app-views/categories/document-editor/procedures/marks.ts", "src/lib/app-views/categories/document-editor/procedures/colours.ts"]
    },
    {
      name: "PanelColorPicker",
      role: "Provide one palette, system eyedropper bridge, and custom-color entry contract.",
      reads: "Current color, supported EyeDropper capability, palette choices.",
      writes: "A selected normalized color through its callback.",
      failure: "Unsupported or cancelled eyedropper returns to the open picker without mutation.",
      sources: ["src/lib/components/authored/panel/panel-color-picker.svelte"]
    },
    {
      name: "PanelNumber",
      role: "Validate, clamp, quantize, and label direct numeric values without private stepper buttons.",
      reads: "Value, min/max/step, and unit contract.",
      writes: "Validated number through its change callback.",
      failure: "Invalid draft is visibly invalid and does not replace the last valid value.",
      sources: ["src/lib/components/authored/panel/panel-number.svelte"]
    },
    {
      name: "link operations",
      role: "Validate URL/note and replace one exact structural link occurrence.",
      reads: "Selected ranges or existing MarkLink.",
      writes: "Link mark operations through runtime.apply.",
      failure: "Unsafe URLs and stale endpoints are rejected without dropping the prior link.",
      sources: ["src/lib/app-views/categories/document-editor/procedures/links.ts"]
    },
    {
      name: "comment actions",
      role: "Create a multi-span thread, reply, resolve/reopen, and navigate back to source.",
      reads: "Workspace queries, username, structural selection, live body.",
      writes: "Store operations plus view inspection/scroll intent.",
      failure: "Store errors stay visible in the lens; a detached source remains accessible in Context.",
      sources: ["src/lib/app-views/categories/document-editor/inspector/text-selection.svelte", "src/lib/app-views/general/comment/comment.svelte"]
    },
    {
      name: "next-style continuation",
      role: "Determine the semantic style of a new block and prevent stale visual attributes from carrying across Enter.",
      reads: "Current block, style definition, next-style reference.",
      writes: "New structural block operations via the content translation path.",
      failure: "Missing next style falls back to defined body behavior rather than stale presentation.",
      sources: ["src/lib/app-views/categories/document-editor/procedures/editing.ts", "src/lib/app-views/categories/document-editor/procedures/styles.ts"]
    }
  ],
  structure: [
    { path: "src/lib/surfaces/inspector/inspector.svelte", role: "Surface host", note: "Registry resolution, stable subject lifetime, placeholder, and resize/collapse composition." },
    { path: "src/lib/app-views/categories/document-editor/inspector/*.svelte", role: "Document lenses", note: "Text selection, next letter, empty line, named style, image, and table semantics." },
    { path: "src/lib/app-views/general/comment/comment.svelte", role: "General lens", note: "Comment source/conversation projection and thread actions shared beyond one category." },
    { path: "src/lib/components/authored/panel/*", role: "Authored controls", note: "Marks, inline style, color picker, number input, spacing, rows, and groups." },
    { path: "src/lib/app-views/categories/document-editor/procedures/*", role: "Domain procedures", note: "Selection summaries and native operation construction kept outside presentation." }
  ],
  review: [
    { tone: "settled", title: "Selection and focus are separate", detail: "Inspector interactions preserve a structural subject and the content decoration, even though browser focus moves to a control." },
    { tone: "settled", title: "Shared controls carry the responsive contract", detail: "Lenses compose PanelMarks, PanelInlineStyle, PanelColorPicker, PanelNumber, and PanelSpacing instead of cloning them." },
    { tone: "watch", title: "Text-selection lens is a near-term extraction seam", detail: "It coordinates many coherent domains but is now large enough to split link, comment, and appearance sections into focused child components while keeping one selection model." },
    { tone: "deferred", title: "Custom color maker can deepen later", detail: "The contract and hex path exist now; a richer hue/saturation surface can replace that detail without changing lens or operation APIs." }
  ],
  related: ["context", "content", "runtime", "backend"]
};
