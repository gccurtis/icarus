import type { Finding } from "$development-views/editor-audit/types";

export const PRESENTATION_FINDINGS: readonly Finding[] = [
  {
    id: "PRESENTATION-01",
    area: "Presentation editor",
    severity: "P1",
    status: "Fixed in this audit",
    title: "Distribute was not idempotent for overlapping objects",
    symptom: "Repeated vertical distribution could move the same three objects differently each time.",
    cause: "Origin sorting plus negative edge gaps let mixed-size overlapping objects cross and reorder; exact float comparison also emitted microscopic changes.",
    fix: "Preserve a stable center order, equalize center intervals, canonicalize coordinates, and compare with an epsilon.",
    acceptance: "For overlap, mixed sizes, and either axis, a second distribution emits no change.",
    evidence: ["presentation-editor/procedures/arrange.ts", "presentation-editor/procedures/test/unit/arrange.test.ts"]
  },
  {
    id: "PRESENTATION-02",
    area: "Presentation editor",
    severity: "P1",
    status: "Fixed in this audit",
    title: "Segmented labels collapsed into ambiguous initials",
    symptom: "Relative to showed S/S and Find showed F/R plus A/S/N even where full words fit.",
    cause: "PanelChoice sized its container from compact content and its fallback took an unchecked first letter.",
    fix: "Make the group full-width, reveal complete words with a container query, and use explicit or shortest-unique compact labels only at constrained widths.",
    acceptance: "Every option is visually distinct and keeps a full accessible name at supported widths.",
    evidence: ["components/authored/panel/panel-choice.svelte", "presentation-editor/context/find.svelte"]
  },
  {
    id: "PRESENTATION-03",
    area: "Presentation editor",
    severity: "P2",
    status: "Fixed in this audit",
    title: "Align controls wrapped instead of preserving axis rows",
    symptom: "Left/Center/Right and Top/Middle/Bottom could break into uneven rows.",
    cause: "The controls used a wrapping action strip rather than an axis-specific grid.",
    fix: "Use one fixed three-cell row per axis, with full labels when space permits and persistent aria-labels/tooltips.",
    acceptance: "Each axis remains one row at every supported inspector width.",
    evidence: ["presentation-editor/components/arrange-section.svelte"]
  },
  {
    id: "PRESENTATION-04",
    area: "Presentation editor",
    severity: "P3",
    status: "Fixed in this audit",
    title: "Match size was grouped under Distribute",
    symptom: "Width, Height, and Size read as extra distribution modes.",
    cause: "Two geometric concepts shared one section only because both operated on multiple elements.",
    fix: "Give Match size its own Width/Height/Both subsection and keep Distribute as Horizontal/Vertical.",
    acceptance: "Each subsection contains one predictable class of geometric operation.",
    evidence: ["presentation-editor/components/arrange-section.svelte"]
  },
  {
    id: "PRESENTATION-05",
    area: "Presentation editor",
    severity: "P2",
    status: "Fixed in this audit",
    title: "Shape selection lacked enough identity",
    symptom: "The inspector title said only Shape even when several shapes were being reviewed in sequence.",
    cause: "The lens already knew the shape kind and optional text but did not use them as identity.",
    fix: "Use Rectangle, Diamond, and so on as the title, with a bounded text excerpt underneath.",
    acceptance: "The selected shape is identifiable without looking back to the canvas.",
    evidence: ["presentation-editor/inspector/shape.svelte"]
  },
  {
    id: "PRESENTATION-06",
    area: "Presentation editor",
    severity: "P1",
    status: "Fixed in this audit",
    title: "Presentation Named Styles had no real inspector route",
    symptom: "Styles were squeezed into Theme with a reduced control set while the named inspector key had no implementation.",
    cause: "The style data model landed before its workspace lens and procedure layer.",
    fix: "Add an independent presentation Named Style lens: editable title, Font, Size, B/I/U/S, colors, horizontal/vertical alignment, spacing, line height, and indent.",
    acceptance: "Selecting a style opens a dedicated complete lens and every visible field persists and renders.",
    evidence: ["presentation-editor/inspector/named-style.svelte", "presentation-editor/procedures/styles.ts"]
  },
  {
    id: "PRESENTATION-07",
    area: "Presentation editor",
    severity: "P2",
    status: "Fixed in this audit",
    title: "Speaker Notes stopped short of the text-inspector contract",
    symptom: "Notes omitted the body-style portion and changed visual grammar when moving from slide text.",
    cause: "The notes lens explicitly disabled paragraph and spacing controls.",
    fix: "Use the presentation-owned text-style order with B/I/U/S, colors, alignment, vertical alignment, spacing, unitless line height, and indent.",
    acceptance: "Notes and slide text feel related without importing document-editor implementations.",
    evidence: ["presentation-editor/inspector/speaker-notes.svelte", "presentation-editor/components/text-style.svelte"]
  },
  {
    id: "PRESENTATION-08",
    area: "Presentation editor",
    severity: "P1",
    status: "Fixed in this audit",
    title: "Clicking one member could not collapse a multi-selection",
    symptom: "After selecting several objects, an ordinary click on one selected object left all objects selected and the multi-selection inspector stuck.",
    cause: "Pointer-down deliberately preserved the group for dragging, but pointer-up never distinguished a click from a drag and never collapsed the group.",
    fix: "Keep the group through pointer movement, then collapse an unmodified stationary press to its one object on pointer-up.",
    acceptance: "A click opens the selected object's inspector while a drag still moves the whole selection.",
    evidence: ["components/authored/slide-surface/slide-surface.svelte", "presentation-editor.spec.ts"]
  }
];
