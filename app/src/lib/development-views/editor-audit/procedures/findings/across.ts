import type { Finding } from "$development-views/editor-audit/types";

export const ACROSS_FINDINGS: readonly Finding[] = [
  {
    id: "BOTH-01",
    area: "Across both editors",
    severity: "P2",
    status: "Fixed in this audit",
    title: "Comment composition sat below history and duplicated Reply",
    symptom: "The lens offered Reply at the top and repeated composition after the entire reply history; Resolve was detached from the composer.",
    cause: "Navigation and thread mutation shared the header while the composer was treated as the final reply.",
    fix: "Order original comment, divider, composer with Resolve/Reply, divider, then replies; reserve the header for genuine Show navigation.",
    acceptance: "The composer precedes history, Reply appears once, and Resolve sits beside it.",
    evidence: ["document-editor/inspector/comment.svelte", "slide-deck-editor/inspector/comment.svelte"]
  },
  {
    id: "BOTH-02",
    area: "Across both editors",
    severity: "P2",
    status: "Fixed in this audit",
    title: "A shared comment presentation masks editor-specific navigation",
    symptom: "Document Show must restore an inline anchor while deck Show must reveal a slide or element; one general lens obscures those different promises.",
    cause: "The entire comment presentation lives under general/ even though locating is editor-owned behavior.",
    fix: "Keep low-level represented comment procedures reusable but give document and deck independent copied lenses and explicit locate contracts.",
    acceptance: "Each editor owns and tests its Comment lens while both retain the same visual sequence.",
    evidence: ["document-editor/inspector/comment.svelte", "slide-deck-editor/inspector/comment.svelte", "representation/data/types/workspace/views.ts"]
  },
  {
    id: "BOTH-03",
    area: "Across both editors",
    severity: "P2",
    status: "Fixed in this audit",
    title: "Visual consistency lacked an explicit control contract",
    symptom: "Typography, marks, colors, paragraph controls, and spacing appeared in different shapes and orders by selection kind.",
    cause: "Each inspector was assembled locally without an ordered cross-editor matrix.",
    fix: "Adopt the same visible order while keeping editor-owned implementations and domain-specific line-height semantics.",
    acceptance: "The matrix on this page is satisfied and either editor can evolve without editing the other's inspector files.",
    evidence: ["document-editor/inspector", "slide-deck-editor/inspector", "components/authored/panel"]
  }
];
