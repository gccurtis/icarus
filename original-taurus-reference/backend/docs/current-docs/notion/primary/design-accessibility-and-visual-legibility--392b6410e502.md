---
title: "Design - Accessibility & Visual Legibility"
notion_page_id: "392b6410e50281de8f06c206383e8d2f"
notion_url: "https://app.notion.com/392b6410e50281de8f06c206383e8d2f"
project: "Taurus Yesod"
role: "Primary"
format: "Document"
created: "2026-07-03 18:06:33Z"
mirrored_at: "2026-07-30"
mirrored_from_notion: true
---

# Design - Accessibility & Visual Legibility

> Source mirror. Preserve this page as planning evidence; use the agent-facing execution packet when one exists.

<callout icon="✦" color="blue_bg">
	**Reviewed and retained — binding specialized accessibility authority.** This page supplements the four governing Yesod design documents and is active design guidance.
</callout>
> **Scope:** This page defines the visual and perceptual accessibility floor for Taurus. It governs contrast, typography and legibility, color use, focus visibility, resize and reflow, reduced motion, and visual validation. It does not duplicate application interaction contracts, keyboard routing, screen-reader implementation, editor-specific behavior, or frontend component architecture.
## Governing principle
Accessibility is part of the intended experience of **a quiet workspace with infinite volume**. A surface cannot be calm, soft, or light on the mind if important content is difficult to perceive, text cannot adapt, focus disappears, color carries hidden meaning, or motion creates discomfort.
Taurus-owned web surfaces target **WCAG 2.2 AA** as the release floor. Passing an automated scan is necessary but insufficient. Visual accessibility requires automated checks, manual inspection, assistive-setting review, realistic content, and human testing.
Apple describes accessible interfaces as intuitive, perceivable, and adaptable, and recommends scalable text, sufficient contrast, information conveyed by more than color, and responsiveness to accessibility preferences. See [Apple Human Interface Guidelines — Accessibility](https://developer.apple.com/design/human-interface-guidelines/accessibility). WCAG supplies the stable, testable web requirements. See [Web Content Accessibility Guidelines 2.2](https://www.w3.org/TR/wcag/).
## 1. Contrast and distinguishability
### Text contrast
- Normal text and images of normal text must meet at least **4.5:1** contrast against their actual background.
- Large text must meet at least **3:1** under the WCAG definition.
- Disabled or purely decorative content may fall under WCAG exceptions, but low contrast must not be used to disguise information that remains important to the user.
- Contrast must be calculated against the final composited background, including transparency, overlays, images, gradients, and state changes.
### Non-text contrast
Meaningful boundaries, icons, focus indicators, selected states, input outlines, chart marks, and other interface elements must remain distinguishable under the applicable WCAG non-text contrast requirement. A shadow or glow outside an element is not a reliable substitute for a visible boundary.
### Theme coverage
Every required combination must be checked independently in:
- Celestial;
- Night;
- increased-contrast mode;
- forced-color or system-color mode where supported;
- selected, focused, hovered, active, warning, failure, and disabled states; and
- realistic content behind translucent or elevated surfaces.
Night cannot ship as an inversion of Celestial, and neither theme may assume that the other's contrast or comfort findings transfer. Each environment requires direct contrast calculations, realistic-content screenshots, dim- and bright-display review, focus-state testing, color-vision simulation, and forced-color validation.
The theme invariant is structural: accessibility behavior, spatial organization, typography, motion semantics, and disclosure remain the same. Only the color layer changes.
## 2. Typography and visual legibility
Typography should support sustained professional reading and editing, not merely look refined in an empty mockup.
Requirements:
- Use relative units and a hierarchy that can scale with browser and user preferences.
- Avoid thin weights, low-opacity text, and small type for information that affects meaning, trust, provenance, state, or action.
- Preserve adequate line height and paragraph separation under user text-spacing changes.
- Keep long-form reading measures comfortable; the current 60–85 character target is a working hypothesis to validate, not a reason to constrain inherently tabular or spatial content.
- Use tabular numerals where numerical comparison benefits from alignment.
- Use monospace selectively for formulas, addresses, hashes, and other machine-shaped content; do not apply it as decorative atmosphere.
- Ensure fallback fonts preserve legibility and do not cause clipped controls or material layout breakage.
- Test multilingual content, long labels, dense tables, and zoom before approving a type scale.
IBM Plex Sans is the Taurus product-interface family and IBM Plex Mono is its technical companion, as governed by [Design - Visual Language, Tokens & Resource Signatures](https://app.notion.com/p/39ab6410e50281798739fa3a9e8931ac). Editor content retains its own resource styles. Accessibility validation may require supported fallbacks, user overrides, or specialized modes without changing the brand decision.
## 3. Color must never act alone
Color may reinforce meaning but cannot be the only way Taurus communicates:
- selection or focus;
- success, warning, failure, or destructive action;
- authorship or content origin;
- active versus inactive state;
- chart series or comparison categories;
- required attention;
- connection or processing status; or
- any distinction needed to understand or operate the work.
Pair color with text, icon, shape, border style, pattern, position, or another persistent cue. Validate in grayscale and with simulations of common color-vision deficiencies. Where practical, respect system settings that request differentiation without color.
Semantic color must remain consistent. The same hue cannot mean ordinary navigation in one surface, intelligence in another, and failure somewhere else merely for visual variety.
## 4. Focus visibility
Keyboard focus must be visible, persistent while focused, and distinguishable from selection, hover, and error state.
Requirements:
- Focus cannot depend on a subtle color shift alone.
- The indicator must maintain adequate contrast against both the component and adjacent background.
- Focus cannot be fully obscured by sticky chrome, panels, overlays, or scroll containers.
- Celestial and Night must use independently validated focus treatments.
- High-contrast and forced-color modes may replace the branded treatment with a system treatment while preserving location and meaning.
- A focused item in a dense grid, slide canvas, menu, panel, or toolbar must remain visually locatable without requiring motion.
The exact thickness, offset, and shape are design-system decisions. The current two-pixel perimeter treatment is a working candidate, not a substitute for testing the complete state.
## 5. Resize, zoom, and reflow
WCAG requires text to resize up to 200% without loss of content or functionality and defines reflow expectations for web content. Taurus should meet those requirements for ordinary application and reading surfaces.
At 200% text enlargement and common browser zoom levels:
- labels and values must not clip or overlap;
- essential actions must remain visible and operable;
- text must not disappear behind fixed chrome;
- line wrapping must preserve meaning;
- dialogs and panels must remain reachable;
- status and provenance must remain available; and
- horizontal scrolling should not be required for ordinary prose and controls.
Some Taurus surfaces are inherently two-dimensional, including slide composition and spreadsheet grids. Their spatial nature may prevent ordinary one-dimensional reflow, but surrounding controls, labels, menus, inspector content, and alternative ways to access important information must still scale and remain legible. Spatial-editor exceptions cannot be used to exempt the entire screen.
## 6. Reduced motion and visual comfort
Motion must not be necessary to understand Taurus. Respect the user's reduced-motion preference and provide a meaning-equivalent presentation.
When reduced motion is requested:
- remove or substantially reduce automatic and repetitive movement;
- eliminate bounce, parallax, large zooms, animated depth, and peripheral motion;
- replace spatial movement with instant state change or restrained opacity and boundary changes when appropriate;
- stop decorative shimmer, pulse, particle, or background animation;
- retain text, icon, progress, and state information without relying on animation; and
- avoid flashing and rapid blinking.
Apple specifically cautions against excessive fast-moving, blinking, scaling, and peripheral animation and recommends responding to Reduce Motion. See [Apple Human Interface Guidelines — Accessibility](https://developer.apple.com/design/human-interface-guidelines/accessibility). The detailed visual language belongs in [Design — Motion & Feedback Language](https://app.notion.com/p/39ab6410e50281dabbf3dc3f5b07adb0).
## 7. Visual state and provenance legibility
The visible result should remain readable when an object is processing, unavailable, warning, failed, or selected. Do not replace useful content with an ambiguous colored container or full-surface spinner when the last valid content can remain visible.
Visual feedback should answer, in proportion to the consequence:
- What changed or is happening?
- Where is it happening?
- Is the current work still safe and readable?
- Does the user need to act?
Provenance and derived-content origin should be discoverable without forcing all derived content to remain permanently decorated. At rest, the work remains visually primary; when inspected, source, status, and origin must be unambiguous.
## 8. Images, icons, and decoration
- Functional icons require an accessible name in implementation and a visible label whenever the symbol is not reliably familiar.
- Do not communicate an instruction only through shape, position, direction, or color.
- Images containing essential text should be avoided when real text can be used.
- Decorative imagery must not reduce text contrast or create competing focal points.
- Illustrations, gradients, transparency, and material effects are optional expression; legibility is mandatory.
## Visual validation checklist
A Taurus surface passes this visual-legibility review only when:
- [ ] Normal and large text meet the applicable contrast ratios.
- [ ] Meaningful non-text interface elements remain distinguishable.
- [ ] No required distinction depends on hue alone.
- [ ] Focus is visible, distinguishable, and not obscured.
- [ ] Text and controls remain usable at 200% enlargement.
- [ ] Ordinary prose and controls reflow without avoidable two-dimensional scrolling.
- [ ] Spatial editors keep scalable, legible surrounding UI and alternative access to important information.
- [ ] User text-spacing changes do not hide content or controls.
- [ ] Light, dark, increased-contrast, forced-color, and color-vision conditions have been tested.
- [ ] Reduced-motion mode preserves all meaning without ambient animation.
- [ ] Dense real content remains readable during selection, processing, warning, and failure.
- [ ] Manual human review supplements automated checks.
## Application contracts live elsewhere
This page intentionally does not specify:
- keyboard traversal order or shortcuts;
- drag-and-drop alternatives and pointer event behavior;
- screen-reader names, roles, values, and live-region implementation;
- focus restoration between dialogs, routes, tabs, panels, or editors;
- panel ownership, collapse behavior, routing, or workspace geometry;
- confirmation and error-recovery workflow;
- editor-specific selection models; or
- frontend primitives, TypeScript contracts, package structure, CI wiring, and test harnesses.
Those concerns are maintained in the frontend Taurus project. Current technical references include [Interface — Design System, Accessibility & Interaction Contracts](https://app.notion.com/p/39ab6410e502811f9f65ea9c3abf3191) and [Interface — Interaction & Disclosure System](https://app.notion.com/p/392b6410e50281cea6abf648c701eb27). They may implement this page's visual requirements but cannot weaken them.
## Sources
- [Design — Emotional & Aesthetic Doctrine](https://app.notion.com/p/392b6410e5028150b8d3fa2a8aa95895)
- [Design — Visual Language, Tokens & Resource Signatures](https://app.notion.com/p/39ab6410e50281798739fa3a9e8931ac)
- [Apple Human Interface Guidelines — Accessibility](https://developer.apple.com/design/human-interface-guidelines/accessibility)
- [Apple Human Interface Guidelines — Design principles](https://developer.apple.com/design/human-interface-guidelines/design-principles)
- [W3C — Web Content Accessibility Guidelines 2.2](https://www.w3.org/TR/wcag/)

