import type { Finding } from "$development-views/editor-audit/types";

export const DOCUMENT_FINDINGS: readonly Finding[] = [
  {
    id: "DOC-01",
    area: "Document editor",
    severity: "P0",
    status: "Fixed in this audit",
    title: "Document line height mixed pixels with unitless ratios",
    symptom: "Transformer Bank Replacement Decision and Substation 14 Incident Write-up overlapped and paginated incorrectly.",
    cause: "The renderer emitted lineHeight as pixels while fixtures stored ratios such as 1.5, producing literal 1.5px leading and corrupting paginator estimates.",
    fix: "Keep document leading as absolute pixels, normalize legacy ratio values at the read boundary, migrate seed/template fixtures, and retain unitless ratios only for decks.",
    acceptance: "Affected documents have sane computed leading and no overlap between blocks sharing horizontal space.",
    evidence: ["representation/data/behavior/documents/typography.ts", "document-editor/procedures/styles.ts", "seed/documentSnapshots.json"]
  },
  {
    id: "DOC-02",
    area: "Document editor",
    severity: "P1",
    status: "Fixed in this audit",
    title: "Control multi-select trusted browser-native range anchors",
    symptom: "Firefox Control-drag extended from the first range and highlighted everything between; modified double-click could also lose the held range.",
    cause: "The plugin preserved the first range but treated the browser's interim contenteditable selection as the second. Firefox anchors that modified drag at the existing selection, unlike the Chromium path the regression suite exercised.",
    fix: "Capture each modified drag's own pointer-down and pointer-up positions, build its range independently of the native DOM selection, own modifier double-click finalization, and reserve Shift for contiguous extension.",
    acceptance: "Control/Command drag and double-click add distinct ranges in Firefox and Chromium, Shift spans the interval, and no ProseMirror endpoint warning occurs.",
    evidence: ["document-editor/procedures/multi-selection.ts", "document-editor.spec.ts"]
  },
  {
    id: "DOC-03",
    area: "Document editor",
    severity: "P1",
    status: "Fixed in this audit",
    title: "Multi-range comment handling could freeze the inspector",
    symptom: "One thread projected through several anchors could throw duplicate-key errors and freeze the inspector; the creation UI also allowed a comment across disjoint selections.",
    cause: "Each anchor span mapped back to the same thread, but the inspector rendered that array keyed by thread ID without deduplication.",
    fix: "Deduplicate legacy multi-anchor thread projections by ID, preserve them for compatibility, and allow new comments only from one contiguous selection.",
    acceptance: "A disjoint selection shows an explanation and no composer; a contiguous selection can create one thread; existing multi-anchor threads still render once.",
    evidence: ["document-editor/procedures/comments.ts", "document-editor.spec.ts"]
  },
  {
    id: "DOC-04",
    area: "Document editor",
    severity: "P2",
    status: "Fixed in this audit",
    title: "The inspector described only the primary selected range",
    symptom: "Several visible highlights could be present while the quote and count described only one.",
    cause: "Selected-text projection ignored MultiSelection secondary ranges.",
    fix: "Show aggregate range/character counts and bounded snippets for every selected range.",
    acceptance: "The inspector count and snippets match every range highlighted on the page.",
    evidence: ["document-editor/inspector/text-selection.svelte"]
  },
  {
    id: "DOC-05",
    area: "Document editor",
    severity: "P2",
    status: "Fixed in this audit",
    title: "Selection synchronization ignored secondary ranges",
    symptom: "A secondary highlight could change without refreshing the inspector if the primary endpoints stayed put.",
    cause: "The equality shortcut compared kind/id/at but not the ordered ranges collection.",
    fix: "Use one canonical equality function that includes every secondary endpoint.",
    acceptance: "Adding, removing, or moving any secondary range updates both canvas and inspector.",
    evidence: ["document-editor/procedures/inspecting.ts", "document-editor/content/document.svelte"]
  },
  {
    id: "DOC-06",
    area: "Document editor",
    severity: "P2",
    status: "Fixed in this audit",
    title: "Section rows spent width on the wrong hierarchy",
    symptom: "A generic icon, clipped title, line number, and page number competed in the narrow rail.",
    cause: "The known heading level was not the primary scan label, while approximate line metadata consumed scarce width.",
    fix: "Render H1/H2/H3 badges, an ellipsized small title with tooltip, tree depth, and P1-style page metadata only.",
    acceptance: "At minimum width the heading level and page remain visible and the full title remains discoverable.",
    evidence: ["document-editor/context/navigator.svelte"]
  },
  {
    id: "DOC-07",
    area: "Document editor",
    severity: "P2",
    status: "Fixed in this audit",
    title: "Named Style used a different typography language",
    symptom: "Identity, Key, Reads as, Weight, Italic switch, and Usage replaced the compact formatting controls used elsewhere.",
    cause: "The lens evolved as a metadata editor rather than as the same formatting contract applied to a reusable style.",
    fix: "Use an Enter-saved editable heading plus Font, Size, B/I/U/S, foreground/background, and Body style; remove metadata sections and the redundant style dropdown.",
    acceptance: "Text selection, Next letter, and Named style use the same control order and shapes.",
    evidence: ["document-editor/inspector/named-style.svelte", "components/authored/panel/panel-inline-style.svelte"]
  },
  {
    id: "DOC-08",
    area: "Document editor",
    severity: "P2",
    status: "Fixed in this audit",
    title: "The style schema could not express strike cleanly",
    symptom: "Inline text supported strikethrough but document named styles did not, while bold and fontWeight competed.",
    cause: "The style-set type lacked strikethrough and did not define precedence for two bold representations.",
    fix: "Add strikethrough across schema/renderer and define explicit Boolean-bold precedence while clearing legacy weight through the control.",
    acceptance: "Every visible style toggle round-trips through snapshot, template, renderer, and editor.",
    evidence: ["representation/data/types/documents/style-set.ts", "document-editor/procedures/styles.ts"]
  },
  {
    id: "DOC-09",
    area: "Document editor",
    severity: "P3",
    status: "Fixed in this audit",
    title: "Next letter exposed irrelevant Placement metadata",
    symptom: "Page/In metadata occupied the top of a lens opened to control carried formatting.",
    cause: "Caret whereabouts were treated as editable style context even though they were neither an action nor necessary identity.",
    fix: "Remove Placement and begin with the same typography/body-style stack as Text selection.",
    acceptance: "Next letter and Text selection align from their first formatting control downward.",
    evidence: ["document-editor/inspector/next-letter.svelte"]
  },
  {
    id: "DOC-10",
    area: "Document editor",
    severity: "P2",
    status: "Fixed in this audit",
    title: "Header/footer controls implied a per-page model that did not exist",
    symptom: "A long toggle plus Edit action made repeated page projections look independently editable.",
    cause: "DocumentBody owns one global header and footer; each page projects the same furniture and only the canonical instance is editable.",
    fix: "Use compact Add/Remove actions beneath explicit Header and Footer labels, with editable on-page placeholders.",
    acceptance: "Control wording, canvas behavior, and persistence all promise the same document-wide scope.",
    evidence: ["document-editor/context/layout.svelte", "document-editor/procedures/furniture.ts"]
  },
  {
    id: "DOC-11",
    area: "Document editor",
    severity: "P2",
    status: "Fixed in this audit",
    title: "Next letter hid comments and links under the caret",
    symptom: "Collapsing a selection removed annotation context while the caret remained inside a comment anchor or link.",
    cause: "The lens projected carried formatting only; link lookup also required a non-empty range.",
    fix: "Add caret-owned Comments and Links sections using left-affinity boundary rules and deduplicated thread projections.",
    acceptance: "Caret movement into or out of a comment/link updates both counts and rows immediately.",
    evidence: ["document-editor/components/next-letter-comments.svelte", "document-editor/components/next-letter-links.svelte"]
  },
  {
    id: "DOC-12",
    area: "Document editor",
    severity: "P1",
    status: "Fixed in this audit",
    title: "Template color tokens were emitted as invalid CSS",
    symptom: "Instantiated styles could silently ignore token-backed foreground or background colors.",
    cause: "A stored token such as --token-ink-secondary was interpolated directly instead of as var(--token-ink-secondary).",
    fix: "Resolve token names only at the CSS boundary while retaining literals and existing var(...) values.",
    acceptance: "Every document template produces valid computed foreground/background styles.",
    evidence: ["document-editor/procedures/colours.ts", "document-editor/procedures/styles.ts"]
  }
];
