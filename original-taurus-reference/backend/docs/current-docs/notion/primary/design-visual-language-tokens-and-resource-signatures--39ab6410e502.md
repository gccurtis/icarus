---
title: "Design - Visual Language, Tokens & Resource Signatures"
notion_page_id: "39ab6410e50281798739fa3a9e8931ac"
notion_url: "https://app.notion.com/39ab6410e50281798739fa3a9e8931ac"
project: "Taurus Yesod"
role: "Primary"
format: "Document"
created: "2026-07-11 15:21:23Z"
mirrored_at: "2026-07-30"
mirrored_from_notion: true
---

# Design - Visual Language, Tokens & Resource Signatures

> Source mirror. Preserve this page as planning evidence; use the agent-facing execution packet when one exists.

<callout icon="✦" color="blue_bg">
	**Reviewed for Taurus Yesod — governing visual-language and token-architecture authority as of July 28, 2026.** Exact implemented values are mirrored from Taurus Alpha where noted. New values remain candidates until validated in realistic resource scenes.
</callout>
> **System outcome:** one calm, smooth, weightless celestial instrument whose resources feel purpose-built while participating in the same cloud-formed citadel.
This page translates [Design — Emotional & Aesthetic Doctrine](https://app.notion.com/p/392b6410e5028150b8d3fa2a8aa95895) and [Design — Color, Light & Material System](https://app.notion.com/p/64f538abd9ec4a8d82591c66c7e17a49) into spatial, typographic, geometric, material, motion, component, and resource contracts.
# Visual grammar
Taurus is formed before it is decorated.
The visual system combines:
- **luminous cloud-like fields** with **precise interactive boundaries**;
- **weightless outer composition** with **strong internal organization**;
- **drawing curves** with **exact grids and alignment**;
- **familiar controls** with **futuristic sophistication at the system level**;
- **stable shell geography** with **resource-specific work surfaces**;
- **sparse semantic color** with **strong non-color state cues**;
- **local, responsive motion** with **complete stillness at rest**.
The single metaphor is a futuristic citadel formed from and resting within a sea of clouds. It is nearly white, light despite its scale, and beautiful because its complete formation is coherent.
This metaphor must be perceptible through:
- the silhouette and proportion of major regions;
- the relationship between surfaces;
- consistent curvature;
- tonal layering;
- spatial rhythm;
- the continuity of transitions;
- the way local components participate in the complete screen.
It must not be depicted through cloud images, castle imagery, ornamental architecture, or atmospheric effects placed over the work.
# Whole-system composition
The screen is the primary unit of visual beauty. Components are refined participants in that composition.
## Formation before detail
Establish the center of gravity, region hierarchy, alignment, measure, and negative space before adding gradient, shadow, glow, texture, or illustration.
## Coherence before novelty
Every component should appear to have been formed from the same material and organizational intelligence. Familiar affordances remain familiar; sophistication appears in their relationships and behavior.
## Majesty through assembly
Individual controls are quiet. Complete workspaces, transitions, presentation states, and finished artifacts may produce a stronger sense of scale and beauty.
## Immanent response
Interaction should feel present within the touched object:
- focus appears at the object;
- inspection unfolds from the selection;
- motion begins at its cause;
- state changes preserve identity;
- AI assistance remains attached to relevant work.
This local responsiveness gives the system its subtle biologic quality without introducing biological imagery.
# Stable cognitive topology
The Taurus shell is a place the user learns once.
```plain text
┌──────────────────────────────── global identity / navigation ────────────────────────────────┐
│ resource tabs and current location                                                            │
├──────────────┬───────────────────────────────────────────────┬─────────────────────────────────┤
│ Context      │                                               │ Inspector                       │
│ sources,     │              Primary work surface             │ properties, state, provenance,  │
│ outline,     │                                               │ validation, consequences        │
│ resources    │                                               │                                 │
├──────────────┴───────────────────────────────────────────────┴─────────────────────────────────┤
│ AI coordination surface / “quarterback” — available, collapsible, never the whole product     │
└────────────────────────────────────────────────────────────────────────────────────────────────┘
```
## Placement laws
- **Center:** the artifact and direct manipulation.
- **Left:** what feeds, locates, or scopes the artifact.
- **Right:** what describes, validates, transforms, or explains the current selection.
- **Bottom:** cross-resource AI coordination and concise system status.
- **Near the object:** common and reversible object-local actions.
- **Modal or blocking layer:** only for decisions that cannot safely remain in context.
Resource differences may change panel lenses and work-surface tools, not the meaning of the shell regions.
## Current Alpha shell dimensions
These are implementation baselines, not universal viewport requirements:
```css
--size-topbar: 44px;
--size-tabstrip: 36px;
--size-rail: 44px;
--size-statusbar: 24px;
--size-quarterback: 48px;

--size-context: 280px;
--size-context-min: 220px;
--size-context-max: 380px;

--size-inspector: 320px;
--size-inspector-min: 280px;
--size-inspector-max: 440px;
```
At constrained widths, preserve work first, then collapse supporting regions into explicit overlays or tabs. Do not squeeze the artifact into a decorative center sliver.
# Shape grammar
## Curves welcome; geometry coordinates
Curves draw attention inward, connect surfaces, and keep the large composition from feeling heavy. Rectilinear grids make the internal work legible and exact. The result is a refined formation: weightless at the scale of the whole and precise at the scale of interaction.
- Controls: modest radius.
- Panels: softened but structural.
- Overlays: more generous radius because they read as temporary responsive layers.
- Data grids, rulers, slide bounds, baselines, and selection boxes: exact.
- Pills: reserved for short categorical states, compact filters, or segmented choices.
- Sharp points and aggressive diagonals: rare, consequential, and never decorative.
- Integrated form: created by nested contour, proportion, and transition—not arbitrary blobs.
## Current Alpha radius baseline
```css
--radius-control: 6px;
--radius-panel: 10px;
--radius-overlay: 16px;
```
A child surface should not have a visually larger radius than the containing surface unless it is floating above it.
# Typography
## Product-interface family
**IBM Plex is the Taurus product-interface type family.**
- **IBM Plex Sans** is the default for shell chrome, navigation, panels, controls, labels, status, dialogs, and Taurus-authored product UI.
- **IBM Plex Mono** is used for code, formulas, identifiers, coordinates, revision IDs, fixed-width data, and compact technical provenance.
- IBM Plex Serif is not a default product face; it may be evaluated only for a specific editorial or marketing use.
This decision governs Taurus itself. It does **not** force editor content to use IBM Plex:
- a document may use its document style;
- a spreadsheet may use its sheet or cell style;
- a slide deck may use its theme fonts;
- imported resources preserve their supported font intent;
- user-authored content and product-interface typography remain separate layers.
## Type scale
```css
--type-display-size: 34px;  --type-display-line: 42px;
--type-h1-size: 28px;       --type-h1-line: 36px;
--type-h2-size: 24px;       --type-h2-line: 32px;
--type-h3-size: 20px;       --type-h3-line: 28px;
--type-body-lg-size: 18px;  --type-body-lg-line: 30px;
--type-body-size: 16px;     --type-body-line: 26px;
--type-body-sm-size: 14px;  --type-body-sm-line: 22px;
--type-label-size: 13px;    --type-label-line: 18px;
--type-caption-size: 12px;  --type-caption-line: 16px;
```
## Font-weight roles
```css
--font-weight-regular: 400;
--font-weight-medium: 500;
--font-weight-semibold: 600;
```
- body and sustained reading use regular;
- controls and short labels may use medium;
- section headings and exceptional emphasis may use semibold;
- bold is not the default hierarchy mechanism;
- lighter weights are avoided for required text.
## Typographic laws
- Product UI uses IBM Plex consistently across resource types.
- Do not encode hierarchy with size alone; combine weight, position, measure, and spacing.
- Labels stay legible; they do not become tiny because the interface is dense.
- Muted text retains full token opacity.
- Uppercase is reserved for very short technical labels.
- Monospace indicates syntax or coordinate-like data, not futurism.
- Long-form reading measure should normally remain near 60–80 characters.
- Numeric tables should enable tabular figures where alignment matters.
- Product UI never silently inherits the current editor-content font.
- Font loading must use stable fallbacks and avoid disruptive layout shift.
## Font stacks
```css
--font-ui:
  "IBM Plex Sans",
  ui-sans-serif,
  system-ui,
  -apple-system,
  "Segoe UI",
  sans-serif;

--font-mono:
  "IBM Plex Mono",
  ui-monospace,
  "SFMono-Regular",
  Consolas,
  monospace;
```
# Spacing and density
Use a 4px base with an 8px primary rhythm.
```plain text
space-1   4px    tight internal relationship
space-2   8px    control interior / paired items
space-3  12px    compact group
space-4  16px    default component gap
space-5  24px    section separation
space-6  32px    major local separation
space-7  48px    composition separation
space-8  64px    ceremonial / marketing extent
```
Professional density is allowed. Calmness comes from alignment, grouping, limited competing emphasis, and predictable disclosure—not oversized gaps everywhere.
# Elevation and material
Use four conceptual planes:
1. **Ambient field:** app canvas and surrounding space.
2. **Work plane:** the active artifact.
3. **Support plane:** context, inspector, tools, and stable secondary surfaces.
4. **Overlay plane:** temporary menus, dialogs, object-responsive layers, and drag previews.
Elevation is semantic:
- surface steps and borders establish stable planes;
- shadow establishes true overlap;
- scrim establishes focus and consequence;
- halo establishes active state, never generic elevation.
Do not surround every region with a card. Prefer shared planes, sectional rhythm, and local dividers.
# Motion language
Motion verbs:
- **unfold:** detail emerges from its source;
- **glide:** a region changes size or position while preserving continuity;
- **settle:** a newly created or resolved object reaches stable state;
- **trace:** a brief line or highlight explains provenance or destination;
- **dissolve:** non-spatial transient feedback departs without implying movement.
Avoid bounce, wobble, ambient float, parallax, constant breathing, and global pulses.
## Current Alpha motion baseline
```css
--ease-standard: cubic-bezier(0.2, 0.8, 0.2, 1);
--duration-micro: 100ms;
--duration-small: 150ms;
--duration-panel: 220ms;
--duration-overlay: 260ms;
--duration-theme: 420ms;
```
All motion must be interruptible. Every permitted transition should be smooth enough to disappear into the causal story of the interaction. Reduced-motion mode collapses spatial and atmospheric animation while preserving state change through immediate layout, opacity, text, icon, or boundary cues.
# Theme invariance contract
Celestial and Night are chromatic environments inside one design system. A theme switch may change only:
- surface, text, boundary, semantic, shadow, scrim, halo, and gradient colors;
- transparency values needed to preserve the same material relationship;
- the operating-system `color-scheme` declaration.
A theme switch must not change shell topology, dimensions, spacing, type family or scale, component shape, resource signature, disclosure, interaction behavior, motion verb, duration, easing, or reduced-motion behavior. Night's zero-gravity digital-flow quality comes from its color field; it does not add motion.
```typescript
interface TaurusChromaticEnvironment {
  name: "celestial" | "night";
  colorScheme: "light" | "dark";
  color: TaurusThemeTokens;
  effectColor: {
    shadow: string;
    scrim: string;
    halo: string;
    gradients: Record<string, string>;
  };
}

interface TaurusThemeInvariant {
  geometry: TaurusGeometryTokens;
  typography: TaurusTypographyTokens;
  motion: TaurusMotionTokens;
  disclosure: TaurusDisclosureContract;
}

type ResolvedTaurusTheme = TaurusThemeInvariant & TaurusChromaticEnvironment;

function resolveTheme(
  invariant: TaurusThemeInvariant,
  environment: TaurusChromaticEnvironment
): ResolvedTaurusTheme {
  return { ...invariant, ...environment };
}
```
The types are illustrative contracts. Implementation mechanics may differ, but review must be able to prove that the invariant fields do not differ between theme snapshots.
# Token architecture
Tokens move from low-level fact to user-facing meaning:
```plain text
Foundation → Semantic → Component → Resource → Instance state
```
## Foundation
Raw palette, type sizes, spacing, radii, duration, easing, opacity, blur, and elevation values.
## Semantic
Surface, text, boundary, action, focus, intelligence, judgment, success, danger, selection, disabled, and provenance roles.
## Component
Button, input, tab, panel, menu, tooltip, selection handle, toast, and dialog aliases.
## Resource
Document canvas, spreadsheet grid, slide stage, chat turn, evidence node, and their selection/inspection states.
## Instance
The concrete active, hover, selected, invalid, streaming, conflicted, disabled, or read-only state.
Components should consume semantic or component tokens, not raw hex values.
## Typed contract
```typescript
type TaurusThemeName = "celestial" | "night";
type ResourceKind = "document" | "spreadsheet" | "slides" | "chat" | "evidence";

interface TaurusThemeTokens {
  surface: {
    canvas: string;
    work: string;
    panel: string;
    elevated: string;
  };
  text: {
    primary: string;
    secondary: string;
    muted: string;
    onAction: string;
  };
  border: {
    subtle: string;
    strong: string;
  };
  role: {
    action: string;
    focus: string;
    intelligence: string;
    judgment: string;
    success: string;
    danger: string;
  };
}

interface TaurusGeometryTokens {
  radius: { control: number; panel: number; overlay: number };
  spacing: Record<"1" | "2" | "3" | "4" | "5" | "6" | "7" | "8", number>;
  shell: {
    topbar: number;
    tabstrip: number;
    rail: number;
    statusbar: number;
    quarterback: number;
    context: { preferred: number; min: number; max: number };
    inspector: { preferred: number; min: number; max: number };
  };
}
```
The interface documents the required shape. Generated code or an implementation mirror may use different mechanics, but it must preserve the roles.
# Component-state contract
Every interactive component must define:
```typescript
type InteractionState =
  | "rest"
  | "hover"
  | "focus-visible"
  | "pressed"
  | "selected"
  | "disabled"
  | "loading"
  | "invalid"
  | "read-only";

interface ComponentStateSpec {
  fill: string;
  text: string;
  boundary: string;
  icon?: string;
  cursor: string;
  motion?: string;
  announcement?: string;
}
```
At minimum:
- hover must not be the only discoverability mechanism;
- focus-visible is never removed;
- selected differs from focused;
- disabled differs from unavailable explanation;
- loading preserves layout where practical;
- invalid state includes a local explanation;
- read-only preserves selection and copying unless unsafe.
# Resource signatures
Resource signatures make each work type immediately recognizable without changing the shell grammar.
## Document
**Character:** luminous page, flowing measure, editorial calm.
- page or continuous canvas remains the visual center;
- headings and blocks create rhythm without card fragmentation;
- comments, citations, and structure enter from context or inspector lenses;
- selection is typographic and local;
- derived content reads as content first, with provenance available nearby.
## Spreadsheet
**Character:** precise calm grid inside a spacious instrument.
The resource is **Spreadsheet**, not Workbook.
- grid geometry, coordinates, selection, and formula state are exact;
- frozen regions and headers remain visually stable;
- row/column emphasis is subtle but unmistakable;
- formula, validation, lineage, and formatting use inspector lenses;
- density is expected; calm comes from alignment and limited chromatic competition.
Charts, images, diagrams, controls, and other visual objects use an **overlay plane** anchored to cells or ranges:
```typescript
interface SpreadsheetOverlay {
  id: string;
  kind: "chart" | "image" | "shape" | "control" | "embedded-resource";
  anchor: {
    sheetId: string;
    startCell: string;
    endCell?: string;
    offsetX: number;
    offsetY: number;
  };
  frame: { width: number; height: number; rotation?: number };
  moveWithCells: boolean;
  sizeWithCells: boolean;
  zIndex: number;
}
```
The overlay approach preserves familiar spreadsheet behavior while remaining extensible. Anchoring and reflow rules must be explicit and inspectable.
## Slides
**Character:** a quiet stage surrounded by exact tools.
- the active slide is the clearest plane;
- the stage surround recedes;
- deck navigation belongs to context;
- object properties, alignment, animation, and provenance belong to inspector lenses;
- selection handles are precise and high-contrast;
- guides appear only while useful;
- presentation mode may increase celestial extent but never reduce content fidelity.
```typescript
interface SlideVisualObject {
  id: string;
  kind: "text" | "image" | "shape" | "chart" | "table" | "media" | "group";
  frame: { x: number; y: number; width: number; height: number; rotation: number };
  styleRef: string;
  contentRef?: string;
  children?: string[];
  zIndex: number;
}
```
## Chat
**Character:** a living thread with visible turns, not a wall of bubbles or an AI shrine.
- conversation is the artifact;
- turns are grouped by causality and authorship;
- prompt and response remain distinct without aggressive opposing colors;
- streaming, tool use, citations, attachments, errors, and edits are inspectable;
- long technical output can become structured content rather than staying trapped in a bubble;
- the composer is stable and calm;
- AI origin is obvious from authorship, not violet wash on every response.
```typescript
interface ChatTurnView {
  turnId: string;
  author: "user" | "assistant" | "system" | "tool";
  status: "draft" | "streaming" | "complete" | "failed" | "superseded";
  contentBlocks: string[];
  citationCount: number;
  attachmentCount: number;
  provenanceAvailable: boolean;
}
```
## Evidence and research
**Character:** connected field of sources with inspectable lineage.
- sources remain distinguishable from claims and derived synthesis;
- provenance is local and traversable;
- connection lines appear on demand, not as permanent visual noise;
- confidence and conflict use more than color;
- opening evidence should preserve the user's place in the work.
# Adaptive panel lenses
The shell regions stay stable while their lenses adapt.
<table header-row="true">
<tr>
<td>Resource</td>
<td>Context lenses</td>
<td>Inspector lenses</td>
</tr>
<tr>
<td>Document</td>
<td>outline, sources, comments, versions</td>
<td>block/style, citations, provenance, accessibility</td>
</tr>
<tr>
<td>Spreadsheet</td>
<td>sheets, names, tables, dependencies</td>
<td>cell/range, formula, format, validation, lineage, overlay</td>
</tr>
<tr>
<td>Slides</td>
<td>deck, layouts, assets, notes</td>
<td>object, arrange, style, animation, provenance</td>
</tr>
<tr>
<td>Chat</td>
<td>threads, participants, attachments, memory scope</td>
<td>turn, sources, tool activity, model/run, provenance</td>
</tr>
</table>
Lenses should be object-aware and preserve selection. A lens is not a new global destination.
# Anti-clutter budgets
Before adding persistent UI, answer:
1. Is this needed in most sessions?
2. Is it needed before the user selects an object?
3. Does it already exist in context, inspector, local action, or command search?
4. Does it deserve persistent contrast?
5. What becomes quieter or disappears when it is present?
Per region:
- one dominant subject;
- one primary action;
- no more than one chromatic emphasis at rest unless multiple states genuinely require it;
- avoid nested card-on-card-on-card framing;
- use elevation only for overlap;
- show transient status near its cause.
# Accessibility contract
- WCAG 2.2 AA is the minimum target; stronger focus appearance is preferred.
- Required boundaries reach appropriate non-text contrast or gain an additional cue.
- Color never carries meaning alone.
- Pointer actions have keyboard alternatives.
- Dragging has a non-drag alternative.
- target size, zoom, reflow, and screen-reader naming are component requirements.
- animation is meaning-complete when removed.
- forced-colors and high-contrast modes keep focus, selection, and state legible.
# Document-first change process
```plain text
1. Describe the experiential or usability problem in Yesod.
2. Identify the affected semantic role, component, resource, and state.
3. Change the governing document and token contract.
4. Update Alpha's docs/style mirror and source tokens together.
5. Verify representative scenes in both themes and accessibility modes.
6. Record deviations or implementation constraints back in Yesod.
```
# Review checklist
A direction is ready when:
- the work is still the strongest visual object;
- the shell can be explained from memory after brief use;
- resource identity is immediate but the product still feels singular;
- common actions are recognizable and local;
- the cloud-citadel character is felt through total formation, curvature, luminous depth, and responsive continuity without literal imagery;
- stillness is the default;
- color retains semantic scarcity;
- focus, selection, save, sync, conflict, failure, and provenance are exact;
- realistic dense content remains calm;
- reduced motion and high contrast preserve meaning;
- the implementation can map the document to explicit tokens and states without inventing missing design decisions.

