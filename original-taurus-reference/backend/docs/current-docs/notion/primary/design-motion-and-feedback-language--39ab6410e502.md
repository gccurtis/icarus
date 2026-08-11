---
title: "Design - Motion & Feedback Language"
notion_page_id: "39ab6410e50281dabbf3dc3f5b07adb0"
notion_url: "https://app.notion.com/39ab6410e50281dabbf3dc3f5b07adb0"
project: "Taurus Yesod"
role: "Primary"
format: "Document"
created: "2026-07-11 15:24:23Z"
mirrored_at: "2026-07-30"
mirrored_from_notion: true
---

# Design - Motion & Feedback Language

> Source mirror. Preserve this page as planning evidence; use the agent-facing execution packet when one exists.

<callout icon="✦" color="blue_bg">
	**Reviewed and retained — specialized motion and feedback authority.** This page supplements the four governing Yesod design documents and is active design guidance.
</callout>
> **Scope:** This page defines Taurus's visual motion and feedback language. It governs how movement, transition, emphasis, and local state feedback should feel. It does not define product state machines, agent lifecycles, application commands, notification routing, accessibility announcements, package structure, or implementation contracts.
## Governing outcome
Motion and feedback must support **a quiet workspace with infinite volume**. They should help the user preserve context, understand cause and effect, and continue working. They must not make the interface feel restless, performative, urgent, or fascinated with its own technology.
The core rule is:
> **Purposeful, brief, smooth, calm, interruptible, local, and reduced-motion-safe.**
If removing an animation makes the interface harder to understand, the static state still needs improvement. Motion may clarify meaning; it cannot be the only carrier of meaning. Every permitted transition should feel continuous enough to disappear into the user's understanding of what changed.
## Motion principles
### 1. Purposeful
Every movement must do at least one useful job:
- preserve continuity between two states;
- show where an object came from or went;
- connect an action to its result;
- reveal hierarchy or containment;
- acknowledge direct manipulation;
- indicate genuine ongoing work; or
- help the user maintain orientation after a change.
Motion that exists only to make Taurus feel advanced, alive, or delightful is not sufficient.
### 2. Brief
Feedback should arrive promptly and settle quickly so the user can continue. Duration should be proportional to distance, consequence, and perceptual need. Small local changes should not wait for a cinematic transition; larger spatial changes may take slightly longer when movement genuinely helps orientation.
Current duration candidates:
<table header-row="true">
<tr>
<td>Motion class</td>
<td>Working range</td>
</tr>
<tr>
<td>Micro feedback</td>
<td>80–120 ms</td>
</tr>
<tr>
<td>Selection, menu, or compact disclosure</td>
<td>120–180 ms</td>
</tr>
<tr>
<td>Panel or region transition</td>
<td>180–240 ms</td>
</tr>
<tr>
<td>Modal or major overlay</td>
<td>200–280 ms</td>
</tr>
</table>
These ranges are hypotheses. Real-device performance, user control, reduced-motion behavior, and task speed determine whether they survive.
### 3. Calm
Use controlled easing, restrained distance, and limited concurrent motion. Avoid bounce, overshoot, elastic effects, dramatic scaling, and choreographed cascades in ordinary work. Taurus should feel responsive and composed, not playful by default.
Multiple parts of the screen should not animate simply because one action occurred. Move only the region necessary to explain the change.
### 4. Interruptible
User input takes precedence over animation. A person should be able to continue clicking, typing, scrolling, switching context, or reversing an action without waiting for decorative motion to finish. Transitions must converge cleanly on the latest state rather than queueing a visual backlog.
### 5. Local
Feedback should appear near the object or region that changed whenever practical. A small local action should not trigger a global banner, full-screen transition, or distant status animation. Broader feedback is justified only when the consequence is broad or the local region is no longer visible.
### 6. Continuous
Direction should match geometry and cause:
- a region leaving to the left moves toward the left;
- a region opening from the right originates from the right;
- an expanding composer grows from its stable anchor;
- an inserted item appears where it enters the sequence; and
- a moved object tracks the user's manipulation rather than teleporting without explanation.
Continuity should preserve the user's sense of location, not enforce physical realism for its own sake.
### 7. Meaning-complete without motion
Text, icon, boundary, shape, and layout must communicate the final state. A pulse, shimmer, slide, or color transition may reinforce a change, but pausing animation or enabling reduced motion cannot remove essential information.
## No ambient distraction
The resting Taurus workspace should be visually still.
Avoid:
- background particles, drifting gradients, or decorative parallax;
- continuous glow, pulse, shimmer, or breathing effects;
- animated borders around ordinary AI-assisted content;
- looping illustrations in the work area;
- peripheral movement that competes with reading or composition;
- persistent status animation after work has completed;
- progress effects when no measurable work is occurring; and
- multiple simultaneous indicators for the same event.
A genuine in-progress operation may use restrained, bounded movement. The animation ends when the operation ends, remains local when possible, and is always accompanied by a stable visual or textual state.
## Visual feedback language
Feedback should be clear, proportionate, and visually consistent across resources. These are visual roles, not a product-state machine.
### Rest
Content is ordinary and readable. No animation or persistent accent is required merely because content was assisted by AI or connected to context.
### Hover
A subtle visual change may indicate interactivity, but hover cannot reveal the only path to an essential action and must not cause layout movement.
### Focus
Focus is stable, high-contrast, and motion-independent. It remains visible until focus moves. Do not animate focus continuously.
### Selected
Selection should feel exact and locked to the selected object through boundary, handles, background, label, or geometry. A brief transition may acknowledge selection, but the resulting static state carries the meaning.
### Processing
Indicate genuine ongoing work with a bounded signal near the affected region. Preserve useful last-known content when possible. Avoid replacing the work with a full-screen spinner when only one object is updating.
### Completion
A restrained local confirmation may appear briefly, then settle into the ordinary completed state. Repeated successful background work should not produce a stream of celebratory effects or notifications.
### Attention
Use proportionate emphasis for an item requiring notice or judgment. The signal should not pulse indefinitely. Persistent importance is communicated through stable label, icon, boundary, and placement.
### Failure
Failure needs a stable, legible state and a clear visual locus. A brief transition may draw attention once; ongoing blinking, shaking, or repeated animation is prohibited. Preserve unaffected work and last useful content when possible.
## Feedback placement
Use the narrowest surface that adequately communicates consequence:
1. **Inside the object:** selection, local processing, validation, or failure.
2. **Adjacent to the object:** a compact explanation or recovery action.
3. **Within the current region:** a change affecting several related objects.
4. **Workspace-level feedback:** only for broad changes, loss of connection, or outcomes not associated with a visible object.
5. **Blocking overlay:** only when continued action would be unsafe or impossible.
This hierarchy prevents a quiet workspace from becoming a notification surface.
## Reduced-motion language
Reduced motion is a first-class visual mode, not a degraded fallback. When the system or user requests it:
- remove parallax, bounce, spring overshoot, and simulated depth movement;
- remove large zoom, scale, rotation, and blur transitions;
- remove automatic and repetitive peripheral animation;
- replace spatial movement with instant state change or a restrained fade when a fade remains comfortable;
- retain position, text, icon, boundary, progress, and completion cues;
- keep all content and controls available; and
- prevent layout from becoming harder to follow merely because animation is absent.
Apple advises reducing automatic and repetitive animations, scaling, depth movement, and peripheral motion when Reduce Motion is enabled. See [Apple Human Interface Guidelines — Accessibility](https://developer.apple.com/design/human-interface-guidelines/accessibility). WCAG also addresses animation from interactions, flashing, pause/stop/hide, and non-interference. See [Web Content Accessibility Guidelines 2.2](https://www.w3.org/TR/wcag/).
## Comfort and performance
Motion contributes to the feeling of quality only when it is smooth, reliable, and timely.
- Do not animate expensive properties merely to preserve a visual flourish.
- A dropped-frame animation is worse than an immediate state change.
- Motion must not delay input readiness or obscure the user's latest action.
- Repeated interactions should remain fast enough that motion does not accumulate into measurable workflow cost.
- Test on realistic hardware, with dense content and concurrent work, not only ideal prototypes.
- Test people who are sensitive to motion and people who simply prefer minimal animation.
Apple's design principles support preserving context, keeping feedback clear, and making delight serve the task rather than decoration. See [Apple Human Interface Guidelines — Design principles](https://developer.apple.com/design/human-interface-guidelines/design-principles).
## Validation matrix
<table header-row="true">
<tr>
<td>Dimension</td>
<td>Pass condition</td>
<td>Revise when</td>
</tr>
<tr>
<td>Purpose</td>
<td>A reviewer can name the orientation or feedback job of each animation</td>
<td>The rationale is “polish,” “energy,” “AI,” or “futurism” alone</td>
</tr>
<tr>
<td>Duration</td>
<td>Feedback feels immediate and settles before it impedes the next action</td>
<td>Users wait for transitions or repeated actions queue motion</td>
</tr>
<tr>
<td>Calm</td>
<td>One local region moves with restrained distance and easing</td>
<td>Motion bounces, overshoots, cascades, or draws the eye away from work</td>
</tr>
<tr>
<td>Interruptibility</td>
<td>New input immediately takes control and the interface converges on current state</td>
<td>Animation blocks input or leaves intermediate visual state</td>
</tr>
<tr>
<td>Locality</td>
<td>Feedback appears at the narrowest meaningful scope</td>
<td>Small actions trigger global banners, overlays, or distant status noise</td>
</tr>
<tr>
<td>Reduced motion</td>
<td>Every meaning survives through static layout, text, icon, tone, and boundary</td>
<td>Orientation, progress, or completion disappears without movement</td>
</tr>
<tr>
<td>Sustained use</td>
<td>Motion remains comfortable and unobtrusive during realistic sessions</td>
<td>Users report distraction, fatigue, nausea, or loss of reading focus</td>
</tr>
<tr>
<td>Performance</td>
<td>Dense real-content scenarios remain smooth and responsive</td>
<td>Frame drops, delayed input, or layout shift makes the product feel heavy</td>
</tr>
</table>
## Acceptance checklist
A motion or feedback pattern is acceptable only when:
- [ ] It has a specific purpose tied to orientation or feedback.
- [ ] It is proportionate to the consequence and spatial distance.
- [ ] It settles quickly and never queues against repeated work.
- [ ] It remains interruptible.
- [ ] It is local unless the consequence is genuinely broad.
- [ ] Its final meaning is fully visible without animation.
- [ ] Reduced-motion mode removes nonessential movement and preserves all information.
- [ ] No ambient or decorative animation competes with the work.
- [ ] It remains smooth with realistic content and supported hardware.
- [ ] It supports the intended feeling of calm, continuity, and control.
## Explicitly out of scope
This page does not define:
- the names or transitions of product-domain states;
- agent, task, memory, resolution, collaboration, or document lifecycles;
- approval, acceptance, rollback, contradiction, or review workflows;
- application commands, events, services, or persistence;
- keyboard order, focus restoration, screen-reader announcements, or live regions;
- notification delivery and routing;
- frontend primitives, package targets, TypeScript types, CSS architecture, or CI implementation; or
- editor-specific behavior and screen geometry.
Those concerns belong in Product, Frontend, Architecture, and Engineering documentation. This page supplies only the visual motion and feedback language those systems must express.
## Sources
- [Design — Emotional & Aesthetic Doctrine](https://app.notion.com/p/392b6410e5028150b8d3fa2a8aa95895)
- [Design — Visual Language, Tokens & Resource Signatures](https://app.notion.com/p/39ab6410e50281798739fa3a9e8931ac)
- [Design — Accessibility & Visual Legibility](https://app.notion.com/p/392b6410e50281de8f06c206383e8d2f)
- [Apple Human Interface Guidelines — Design principles](https://developer.apple.com/design/human-interface-guidelines/design-principles)
- [Apple Human Interface Guidelines — Accessibility](https://developer.apple.com/design/human-interface-guidelines/accessibility)
- [W3C — Web Content Accessibility Guidelines 2.2](https://www.w3.org/TR/wcag/)

