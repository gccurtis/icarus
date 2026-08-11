---
title: "Interface - Slides Editor Context Panel Lenses"
notion_page_id: "3acb6410e50281ae9244e2f9a57f579f"
notion_url: "https://app.notion.com/3acb6410e50281ae9244e2f9a57f579f"
project: "Taurus Yesod"
role: "Primary"
format: "Spec"
created: "2026-07-29 00:48:22Z"
mirrored_at: "2026-07-30"
mirrored_from_notion: true
---

# Interface - Slides Editor Context Panel Lenses

> Source mirror. Preserve this page as planning evidence; use the agent-facing execution packet when one exists.

<callout icon="🧭" color="blue_bg">
	**Implementation-facing Taurus Yesod specification.** This page defines the complete context-panel lens set for the Slides editor. It describes what every lens looks like, displays, and does; selection-specific formatting remains in the inspector.
</callout>
# Decision
Slides contributes a complete, Yesod-owned left-rail lens registry. Every lens has a stable serializable ID, a semantically matched Lucide icon, and a component that reads a Slides-owned session/read model. The shell renders the registry without knowing Slides domain details.
Slides uses two complementary structure maps: **Slides** maps named sections and the positional order of slides; **Layers** maps the active slide’s VisualObject tree. Slides have stable IDs but no user-facing names. Sections and templates may have names. Notes remain selection-specific and therefore stay in the inspector.
The left panel answers **“What exists around this work?”** (<mention-page url="https://app.notion.com/p/e12b6939dbc444698aca18d4162bab10"/>). The contract is defined by Yesod product and runtime requirements and remains independent of any current editor implementation.
# Context versus inspector
The context panel is the Slides map. It may navigate, filter, reveal relationships, and invoke resource-level commands. It does not become the formatting surface for the current selection.
Selecting a slide updates Slides and Layers; selecting a VisualObject highlights it in Layers. Neither selection forces a lens switch. Text, shape, image, chart, table, equation, group, geometry, and notes controls remain in the inspector.
The right inspector continues to answer **“What can I change about this selection?”**. Focusing the universal AI Quarterback still opens the right-side AI lens; the left-side **AI Tasks** lens is the durable task/status map and does not duplicate prompt composition.
Companion selection and inspector contract: <mention-page url="https://app.notion.com/p/3acb6410e50281a7a32dd1c2551a7851"/>.
# Shared shell and visual contract
```plain text
┌──────── icon rail ────────┬──────── expanded content rail ────────┐
│ 32 × 32 lens button       │ ACTIVE LENS LABEL                     │
│   16 × 16 Lucide icon     │ primary control / summary             │
│   tooltip on hover/focus  │ filters or grouped sections           │
│   active tint + color     │ scrollable content                    │
│                           │ honest loading / empty / error state   │
│ collapse control at foot  │                                        │
└───────────────────────────┴────────────────────────────────────────┘
```
- The preferred content width is 280px, with a 220px minimum and 380px maximum.
- Verify each icon export against the target application dependency before implementation; do not substitute a semantically weaker glyph merely because it is already imported elsewhere.
- The icon rail remains visible when collapsed. Selecting a different icon selects that lens and expands the panel; selecting the active icon while expanded collapses it.
- The open rail displays the active lens label in the fixed header. Icons never carry meaning without the tooltip and open-state label.
- Active treatment uses the action color at restrained opacity; inactive icons use muted color and receive an elevated hover/focus surface. Celestial and Night change colors only.
- Lens order is stable. The persisted value is the stable ID, never a component reference. An unknown or retired ID repairs to `info`.
- Each editor instance remembers its selected lens. Tab changes restore the lens for that resource without persisting transient selection, query text, drafts, hover, or loading state.
- The content rail uses one continuous surface, dividers, compact rows, and restrained badges. It does not place every row in a floating card.
- If the icon set exceeds available height, only the lens list scrolls; the collapse control stays fixed at the bottom.
# Lens registry
<table header-row="true">
<tr>
<td>Order</td>
<td>Stable ID</td>
<td>Label</td>
<td>Lucide icon</td>
<td>Primary job</td>
</tr>
<tr>
<td>1</td>
<td>`info`</td>
<td>Info</td>
<td>`Info` — a circled information mark; deck identity</td>
<td>Summarize the deck, its canvas, sections, slides, and health.</td>
</tr>
<tr>
<td>2</td>
<td>`search`</td>
<td>Search</td>
<td>`Search` — a magnifying glass; deck-wide rescue</td>
<td>Find and navigate every searchable part of the deck.</td>
</tr>
<tr>
<td>3</td>
<td>`slides`</td>
<td>Slides</td>
<td>`Layout` — an ordered layout map; sections and slide positions</td>
<td>Provide the primary sectioned thumbnail map and ordering surface for the deck.</td>
</tr>
<tr>
<td>4</td>
<td>`layers`</td>
<td>Layers</td>
<td>`Layers3` — three stacked layers; active-slide object hierarchy and z-order</td>
<td>Map every visual object on the active slide and make stacking/grouping legible.</td>
</tr>
<tr>
<td>5</td>
<td>`templates`</td>
<td>Templates</td>
<td>`SquareStack` — stacked rectangles; reusable slides and decks</td>
<td>Browse, save, import, and apply named slide or deck templates.</td>
</tr>
<tr>
<td>6</td>
<td>`references`</td>
<td>References</td>
<td>`BookOpenText` — an open book with text; resources and files connected to the deck</td>
<td>Show inbound and outbound resource, file, data, formula, chart, and embed relationships.</td>
</tr>
<tr>
<td>7</td>
<td>`comments`</td>
<td>Comments</td>
<td>`MessageSquareText` — a speech bubble with text; collaborative annotations</td>
<td>Review and resolve discussion anchored to the deck, sections, slides, objects, text, or notes.</td>
</tr>
<tr>
<td>8</td>
<td>`ai-tasks`</td>
<td>AI Tasks</td>
<td>`ListTodo` — a checklist; durable agent work scoped to the deck</td>
<td>Track generation, review, import, and agent work associated with the deck.</td>
</tr>
<tr>
<td>9</td>
<td>`history`</td>
<td>History</td>
<td>`Clock` — a clock face; deck ChangeSet history</td>
<td>Expose operation-level deck history with targeted navigation and safe undo/redo.</td>
</tr>
</table>
# Lens specifications
## Info lens
**Stable ID:** `info`  
**Icon:** Lucide `Info` — a circled information mark; deck identity.  
**Outcome:** Summarize the deck, its canvas, section/slide structure, and health.
### Default composition
```plain text
[DECK NAME · double-click to rename]
Created / updated / creator / collaborators
Sections | Slides | Hidden | Objects | Notes
Canvas / theme / templates
Generated / stale / failed / sync status
```
### Displays
- Deck name, creator, created/updated time, revision, lifecycle, sync, and collaboration state.
- Canvas dimensions and aspect ratio, active theme, slide-template and deck-template counts, named-section count, slide count, hidden slides, object-kind counts, notes coverage, and media count.
- Health counts for generated content, chart/embed snapshots, missing files, stale results, errors, comments, and active tasks.
- Slides are summarized by position and stable ID when disambiguation is needed; a slide has no user-facing name.
### Actions
- Rename the deck through `rename_deck`; open canvas/theme settings in the deck inspector; filter to hidden, stale, failed, or missing-source items.
- Copy the deck link or open export/derived-artifact status when available.
### Behavior and states
- Counts come from the resolved logical revision; thumbnail/export freshness is labelled separately.
- A missing theme/template/file names the affected section and identifies each affected slide by current ordinal plus stable SlideID.
- No selected slide still leaves deck identity and global health usable.
**Boundary:** Canvas, theme, section, and slide/object formatting controls belong to their owning surfaces; Info summarizes and routes to them.
## Search lens
**Stable ID:** `search`  
**Icon:** Lucide `Search` — a magnifying glass; deck-wide rescue.  
**Outcome:** Find and navigate every searchable part of the deck.
### Default composition
```plain text
[Search this deck…] [Replace ▾]
Scope: all slides / current slide / notes
Kinds: text / alt text / formula / prompt / section / template
N matches grouped by section and slide
Thumbnail · slide ordinal · object kind · excerpt
```
### Displays
- Matches across section names, template names, text objects, shape text, tables, notes, image/embed/chart alt text, formula source, and generated prompts.
- Filters for current slide/all slides, section, hidden slides, object kind, notes, generated content, case, whole word, and regular expression.
- Results grouped by named section and positional slide. Each result may show thumbnail, current ordinal, stable SlideID, template name, object type, stable target, and contextual excerpt.
### Actions
- Navigate to the slide by stable ID and select the exact object/text range or notes anchor.
- Replace one or all eligible text matches after a review summary; excluded/locked/generated targets are counted and explained.
- Open hidden slides or reveal the layer in Layers without silently unhiding it.
### Behavior and states
- Bulk replacement expands to bounded typed text operations and previews affected stable IDs before commit.
- Reordering changes ordinals but never invalidates a saved result’s SlideID.
- Search indexes alt text and notes but never displays protected media bytes.
- No-result state retains filters and distinguishes no match from unindexed derived content.
**Boundary:** Search changes text only through validated operations; it does not rewrite section/template names, generated output, formulas, locked objects, or template-owned content without an explicit owning action.
## Slides lens
**Stable ID:** `slides`  
**Icon:** Lucide `Layout` — an ordered layout map; sections and slide positions.  
**Outcome:** Provide the primary sectioned thumbnail map and ordering surface for the deck.
### Default composition
```plain text
[+ New slide] [+ Section] [filter]
SECTION: Introduction                  ⋯
  01  thumbnail  Template: Title
  02  thumbnail  Hidden
SECTION: Analysis                      ⋯
  03  thumbnail  Template: Chart
drag handle · comment/error badges · stable ID on demand
```
### Displays
- Named section dividers with stable SectionIDs, deterministic rank, slide count, collapse state, and section actions.
- Virtualized ordered thumbnails with current ordinal, template name, hidden state, notes/comment/error badges, and active selection. A slide row never displays or edits a slide name because slides are unnamed.
- Stable SlideID on hover, details, copy-link, accessibility text, and any ambiguity/error state; ordinal remains the primary human reference.
- Drop destination, multi-selection, and collaborator-presence indicators when relevant.
### Actions
- Select, insert, duplicate, move, hide/show, and delete slides using stable SlideIDs plus target SectionID and rank/anchor.
- Create, rename, reorder, and delete named sections. Deleting a non-empty section requires an explicit rehome destination; it never implicitly deletes slides.
- Move one or many slides within or across sections; keyboard reorder and multi-select preserve deterministic accepted order.
- Apply a slide template through an explicit action or open slide details in the inspector.
- There is no rename-slide action or `set_slide_name` operation.
### Behavior and states
- Slide ordinals are revision-specific projections. Stable IDs do not change when slides move or when preceding slides are inserted/deleted.
- The active slide is clear without relying on color alone.
- Concurrent inserts after the same anchor reconcile to accepted section/rank and ID.
- The no-section state is presented as **Unsectioned** without requiring a stored pseudo-section. Users may later create sections and move slides into them.
- Delete warns about objects, notes, comments, and stale operations; it never accepts an array index as identity.
**Boundary:** Section/slide navigation and ordering live here. Object formatting and notes editing remain in the inspector.
## Layers lens
**Stable ID:** `layers`  
**Icon:** Lucide `Layers3` — three stacked layers; active-slide object hierarchy and z-order.  
**Outcome:** Map every visual object on the active slide and make stacking/grouping legible.
### Default composition
```plain text
Active slide · object count
▾ Group name
  [T] Title text · locked
  [□] Shape · hidden
[chart] Revenue chart
z-order drag / visibility / lock
```
### Displays
- A tree/list of active-slide VisualObjects with name, kind glyph, z-rank, group parent, template binding, locked/hidden state, and generated/error indicators.
- Groups remain shallow and cycles are impossible; template objects are visually distinct from ordinary slide objects.
- Selection synchronization for one or many objects without replacing the user’s active lens.
### Actions
- Select/reveal an object; rename its presentation label; change z-order; toggle visibility or lock; group/ungroup eligible objects; navigate to its template binding or reference.
- Drag reorder emits stable-ID reorder operations; keyboard alternatives expose move forward/back/front/back.
### Behavior and states
- Hidden or locked objects remain discoverable and selectable for inspection according to permission.
- Deleting or ungrouping reconciles the list after accepted operations without losing neighboring expansion state.
- No active slide explains that Slides chooses the context; an empty slide offers insert actions.
**Boundary:** Layers controls identity, visibility, lock, grouping, and stacking. Geometry and object styling belong to the inspector.
## Templates lens
**Stable ID:** `templates`  
**Icon:** Lucide `SquareStack` — stacked rectangles; reusable slides and decks.  
**Outcome:** Browse, save, import, and apply named slide or deck templates without conflating a template name with a slide name.
### Default composition
```plain text
[Search templates…] [Upload deck]
Slide templates | Deck templates

Template preview · template name · version
Slots / required inputs / source
[Insert] [Apply] [Save current slide]
```
### Displays
- Named, versioned **slide templates** and **deck templates**, clearly separated by scope.
- Slide-template thumbnails, slots, repeated objects, compatible canvas/theme requirements, and current-slide binding/override summary.
- Deck-template previews with sections, slide count, theme/canvas, template dependencies, and import requirements.
- Provenance and version for a template used by a slide. The name belongs to the template; the materialized slide remains unnamed.
### Actions
- Preview and insert a new slide from a slide template; apply/change the active slide template; or save the current slide as a named template/version.
- Upload or save an entire deck as a named deck template.
- Create a new deck from a deck template or import a deck template into the current deck after a complete structural preview.
- Inspect which fields inherit and which explicit overrides remain before applying.
- Open, copy, favorite, or select a specific version, subject to template-library permissions.
### Behavior and states
- Every materialized section, slide, object, text node, and other stable entity receives a fresh ID. Source-template IDs remain provenance, not runtime identity.
- Template updates identify affected slides and never clobber explicit overrides.
- A deleted/inaccessible template leaves authored slide objects intact and marks the broken binding.
- Deck-template import previews section-name collisions, theme/canvas differences, template dependencies, files, external bindings, and expected operations before commit.
- Large uploads/imports run as durable, idempotent jobs; accepted results return through typed Slides ChangeSets.
- The Template Library owns asset metadata, versions, previews, and permissions. Slides owns the materialized deck state.
- The exact boundary between prompt blocks, template parameters, and authored text is deliberately open. This document does not prematurely choose that representation.
**Boundary:** This lens manages reusable slide/deck assets and their materialization. Fine-grained slide/object style remains in the inspector.
## References lens
**Stable ID:** `references`  
**Icon:** Lucide `BookOpenText` — an open book with text; resources and files connected to the deck.  
**Outcome:** Show inbound and outbound resource, file, data, formula, chart, and embed relationships.
### Default composition
```plain text
This deck uses
  Resource / file / formula name
  Slide → object → binding @ revision
Used by
  Resource → slide/object
Missing / stale / unauthorized
```
### Displays
- Outgoing files, images, embeds, chart bindings, Formula-backed atoms, prompt/evidence sources, and linked resources grouped by slide/object.
- Incoming project resources that reference this deck or a slide/object.
- Captured revision, selector, snapshot freshness, alt-text presence, and missing/access states.
### Actions
- Open the source/consumer at its selector; navigate to the deck object; replace or relink a missing file; refresh an eligible snapshot; copy a stable reference.
- Filter by kind, slide, missing/stale state, or inbound/outbound direction.
### Behavior and states
- Derived chart/embed snapshots are distinguished from canonical bindings.
- Deleting or losing access preserves a safe tombstone and does not leak protected metadata.
- Refresh results are stale-safe and cannot overwrite a newer binding.
**Boundary:** References maps relationships. Editing chart specs, alt text, crop, or formula source belongs to the selected object inspector.
## Comments lens
**Stable ID:** `comments`  
**Icon:** Lucide `MessageSquareText` — a speech bubble with text; collaborative annotations.  
**Outcome:** Review and resolve discussion anchored to the deck, sections, slides, objects, text, or notes.
### Default composition
```plain text
[Comment on current selection…]
Open | All
Author · age · anchor
Quoted target / thread preview
Reply · Resolve · Go to
```
### Displays
- Open/all threads with author, time, anchor type, named section, current slide ordinal, stable SlideID when needed, template context, target excerpt, reply count, and resolved status.
- Anchors for deck, section, slide, object, text range, and notes range using stable IDs plus transformable text anchors.
- Orphaned or inaccessible anchors with recoverable thread content.
### Actions
- Add a comment on the current valid selection, reply, resolve/reopen, mention collaborators, and navigate to the anchor.
- Filter by section, slide ID, author, open/resolved, or mention.
### Behavior and states
- Navigation reveals hidden slide/object only with explicit permission; otherwise it explains the hidden target.
- Reordering updates the displayed ordinal while the anchor remains attached to stable SlideID.
- Concurrent anchor changes transform or mark orphaned rather than silently drifting.
- Read-only users can inspect threads but cannot mutate them.
**Boundary:** Comments are owned by the shared annotation capability; Slides stores no competing comment authority.
## AI Tasks lens
**Stable ID:** `ai-tasks`  
**Icon:** Lucide `ListTodo` — a checklist; durable agent work scoped to the deck.  
**Outcome:** Track generation, review, and agent work associated with the deck.
### Default composition
```plain text
[New task from deck]
Active | All
Task · status · persona
Scope: deck / slide / object
Origin · result · approvals
```
### Displays
- Tasks scoped to deck, slide, object, notes, or selected text with persona, status, approvals, origin, result, and timestamps.
- Generated-content and media jobs are labelled separately from agent tasks even if both are asynchronous.
- Active/all filters and links to affected slides/objects.
### Actions
- Create, open, review, or navigate to a task; inspect approval state and result; open the originating prompt or object.
- Create a new compensating or follow-up task rather than pretending undo reverses external work.
### Behavior and states
- Active tasks update live without decorative animation; completed rows settle.
- Missing targets retain task history and explain the deleted slide/object.
- Agent outages do not erase accepted deck content.
**Boundary:** Agent owns execution and approvals; Slides accepts resulting content only through typed stale-safe operations.
## History lens
**Stable ID:** `history`  
**Icon:** Lucide `Clock` — a clock face; deck ChangeSet history.  
**Outcome:** Expose operation-level deck history with targeted navigation and safe undo/redo.
### Default composition
```plain text
Filters: actor / slide / object / area
Revision · actor · action
Slide/object target · summary
Before / after detail
Undo / redo eligibility
```
### Displays
- Accepted ChangeSets for deck metadata, templates, slides, objects, text, notes, generated content, and derived snapshots.
- Affected slide/object/text targets, actor, timestamp, revision, footprint, and before/after detail.
- System jobs and user/agent edits with clear authorship.
### Actions
- Open detail; navigate to the affected slide/object; append inverse/reapply operations; copy revision link; filter by actor/area/target.
### Behavior and states
- Undo explains conflicts with newer overlapping footprints.
- Pruned details remain honestly unavailable while summaries persist.
- A slide deleted after the target change may block direct navigation without corrupting history.
**Boundary:** History is append-only and never rewrites accepted deck history.
# Shared data and command boundary
Every lens reads from a Slides context snapshot and calls typed actions. It does not import editor internals, mutate stores directly, or write persistence records.
# Implementation registry
```typescript
import { Info, Search, Layout, Layers3, SquareStack, BookOpenText, MessageSquareText, ListTodo, Clock } from '@lucide/svelte';

export const slidesContextSections: PanelSection[] = [
  { id: 'info', label: 'Info', icon: Info, content: DeckInfoPanel },
  { id: 'search', label: 'Search', icon: Search, content: DeckSearchPanel },
  { id: 'slides', label: 'Slides', icon: Layout, content: SlideListPanel },
  { id: 'layers', label: 'Layers', icon: Layers3, content: SlideLayersPanel },
  { id: 'templates', label: 'Templates', icon: SquareStack, content: SlidesTemplatesPanel },
  { id: 'references', label: 'References', icon: BookOpenText, content: SlidesReferencesPanel },
  { id: 'comments', label: 'Comments', icon: MessageSquareText, content: SlidesCommentsPanel },
  { id: 'ai-tasks', label: 'AI Tasks', icon: ListTodo, content: SlidesAiTasksPanel },
  { id: 'history', label: 'History', icon: Clock, content: SlidesHistoryPanel }
];
```
Rules:
- Every command includes project scope, resource ID, expected revision, stable target IDs, actor, and an idempotent submission ID.
- Navigation-only actions may stay client-side; canonical edits use the resource capability’s ChangeSet path.
- Loading, stale, derived, estimated, local-only, and failed data are labeled honestly. A locally interactive control cannot imply persistence that Omega does not implement.
- A lens may optimistically update only when it can reconcile the accepted revision or restore the prior projection on rejection.
- Search results, references, comments, tasks, and history paginate or virtualize rather than growing the rail without bound.
# Interaction rules
- Opening a resource begins on `info` unless a valid lens ID was restored for that same resource.
- Changing editor selection does not automatically steal the user’s chosen context lens. Selection-aware lenses update their content in place.
- Clicking a search result, structure item, reference, comment, task source, or history target navigates the work surface and keeps the originating lens open.
- Destructive commands require a named target, confirmation proportional to reversibility, and placement at the end of the action group.
- Undo and redo append canonical inverse/reapply operations; they do not rewrite history.
- Live statuses update without global spinners. Preserve readable last-good content while derived work refreshes.
# Loading, empty, error, and permission states
- **Loading:** retain the lens header and controls; use quiet skeleton rows or compact status copy in the content region.
- **Empty:** explain what would appear here and give one primary next action when the user can resolve the empty state.
- **No results:** retain the query and filters, report zero matches, and offer a clear-filters action.
- **Error:** preserve cached or last-good rows when safe, name what failed, and provide retry. Do not replace the whole panel with a generic failure.
- **Offline:** allow navigation over cached data and mark commands that will queue or are unavailable.
- **Read-only:** show the same map and provenance while disabling mutation with a concise permission explanation.
- **Conflict:** keep the user’s draft, show the accepted current state, and offer retry, compare, or reapply when the operation contract permits it.
# Accessibility and keyboard contract
- Each icon button has `aria-label`, `title`, and `aria-pressed`; the content region is labelled by the visible lens heading.
- The icon rail supports Tab plus arrow-key movement without forcing the panel to expand until activation.
- Status is communicated through text and icon in addition to color. Counts use descriptive accessible names.
- Search/result rows, tree nodes, disclosure controls, and reordering controls expose correct roles, expanded/selected state, and keyboard equivalents.
- Navigation moves editor focus to the destination only after announcing it. The user can return to the originating lens without losing query or expansion state.
- At 200% zoom the rail and content remain operable; at 400% the content becomes a single scroll region without horizontal dependence.
- Reduced motion changes transitions, not behavior or spatial organization.
# Required cross-capability dependencies and model alignment
- File, Formula, Resource, chart rendering, and embed/media jobs supply behavior through the existing Slides ports.
- Agent supplies task execution and approval truth; a shared Annotation capability supplies comment threads and stable anchors.
- A Template Library owns named/versioned slide and deck template assets. Slides owns sections and the fresh materialized deck entities produced from a template.
- The Slides runtime model must include named stable-ID sections, optional `Slide.SectionID`, and section operations. It must not include `Slide.Name` or a slide-rename operation.
These dependencies retain their own authority and return accepted results through typed Slides or annotation operations.
# Deliberate exclusions
- Notes is not a context lens. Notes belongs to the active slide and remains an inspector lens.
- Object styling, geometry, crop, chart specification, and text formatting do not migrate into Layers or References.
- Deck theme and canvas are summarized in Info and edited through the deck/default inspector rather than a generic Layout context lens.
# Acceptance checklist
- [ ] Every registered lens has the exact stable ID, label, icon, tooltip, open-state heading, implemented content component, and accessible name defined here.
- [ ] Lens order, collapse behavior, width, restoration, and unknown-ID repair match the shared shell contract.
- [ ] Every lens has useful loading, empty, no-results, error, offline, read-only, and permission behavior.
- [ ] Navigation actions focus the correct stable resource target and preserve the open lens.
- [ ] Canonical mutations go through typed operations with expected revision and conflict handling.
- [ ] Mock or locally projected behavior is visibly identified and cannot masquerade as saved capability.
- [ ] Celestial and Night preserve identical layout, iconography, ordering, and motion.
- [ ] Keyboard, screen-reader, forced-color, reduced-motion, 200% zoom, and 400% zoom tests pass.
- [ ] Realistic large-resource fixtures prove pagination or virtualization and do not make the rail jank.
# Sources
## Governing Yesod sources
- <mention-page url="https://app.notion.com/p/3abb6410e50281df8762c162e9a6eb13"/>
- <mention-page url="https://app.notion.com/p/e12b6939dbc444698aca18d4162bab10"/>
- <mention-page url="https://app.notion.com/p/39ab6410e50281798739fa3a9e8931ac"/>

