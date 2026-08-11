# AI Agent Surface

The AI Agent Surface is Taurus's persistent coordination layer for agents, live knowledge, and cross-resource work. It is not merely a help input and not a detached chat product.

From anywhere meaningful work can begin, the user should be able to describe the next move, see its scope and consequence, route it appropriately, inspect the result, and continue without leaving the work surface.

## Modes

- **Ask:** answer against current context or knowledge, with trace where relevant.
- **Action:** make a direct resource change when the work is simple, or route substantial work through the existing task system.
- **Plan:** create a reviewable sequence that opens inside the inspector.

## Scope

The active resource is implicit. Optional context can include the current selection, project knowledge, linked sources, files, and directories. Available choices should be contextual rather than universally dumped into the UI.

## Behavior

The compact state stays available and calm. It shows an Ask/Action/Plan selector, contextual input, and submit control. Input expands upward through four lines and then scrolls internally. The bar becomes visually solid on hover, focus, or AI Agent inspector selection.

The inspector stays shallow: mode guidance, an inline Context disclosure, and Recent chats. Submitting with no selection creates a chat; selecting one makes later prompts continue it. Ask, Action, and Plan are prompt intents, while chat state is Chat, Running, or Done. Plan and task artifacts live inside their chat; only plan detail temporarily replaces the transcript and provides direct Back and Accept actions. It should not grow into a permanent chat panel or navigation maze inside editors.

Before material action, the user should understand:

- what mode is active;
- what context Taurus will use;
- where the result will go;
- whether work is immediate, previewed, delegated, or review-gated;
- how to cancel, inspect, or recover.

## State language

Use explicit Idle, Focused, Resolving, Agent running, Needs review, Applied, and Failed states. Cyan signals focus and live computation; violet signals intelligence or agent routing; amber signals judgment; green signals applied work; red signals failure. Copy and structure always accompany color.

## Flow and accessibility

Focusing the surface should not destroy the prior selection. After completion or escape, return focus to the prior work context when safe. Mode, context, submit, navigation, and status must be keyboard accessible and text-readable. Reduced motion removes expansion choreography, not state clarity.

Source: [Taurus AI Quarterback Surface](https://app.notion.com/p/392b6410e50281399bf3d2ec623307e7)
