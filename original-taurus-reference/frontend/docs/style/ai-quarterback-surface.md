# AI Agent Surface (authoritative)

> Status: **authoritative — committed stance + implemented frontend shell.**
> Conversation and execution remain mock-backed. Full rationale:
> [reference baseline](../support/reference/style/ai-quarterback-surface.md).

The AI Agent Surface is Taurus's persistent coordination layer for live knowledge
and agentic work. It is not merely a help input and not a detached chat product.
From anywhere meaningful work can begin, the user can describe the next move,
inspect context or results, and continue without leaving the work surface.

## Modes

- **Ask:** answer against current context or knowledge, with trace where relevant.
- **Action:** make a direct change when the work is simple; route substantial
  work to the existing task system when persistence, delegation, or review is
  required.
- **Plan:** turn an outcome into a reviewable sequence that opens in the
  inspector rather than interrupting the user with a modal.

## Scope

Working context is explicit and inspectable. Its source controls are Document,
Current selection, All knowledge, Linked sources, and Web; files and directories
may be attached separately. Available choices are contextual and live in the
inspector, not dumped into the compact composer. Short labels remain visible,
while supporting explanations appear on hover or keyboard focus.

## Behavior

The compact state stays available and calm. Its Ask/Action/Plan selector,
contextual input, and submit control begin at `--spacing-qb` (48px). Input grows
upward through four visible lines, then scrolls internally without moving the
bottom anchor. The surface is translucent when idle and becomes solid on hover,
composer focus, or selection of the AI Agent inspector icon.

The inspector stays shallow. Its home contains mode guidance, one inline Context
accordion, a Current context path, and Recent chats. There is no explicit New
chat control: submitting with no chat selected creates one, while submitting
with a chat selected continues it. The accordion uses one visual boundary and
compact selectable source rows. Current context is the first row inside the
expanded accordion and temporarily replaces the panel with the same source
controls, search, and a removable list of included resources and external
material; Back restores the exact prior panel view. Source rows remain neutral
at rest: hover reveals only a subtle border, while selection uses `action` on a
small transparent checkbox, icon, and label rather than a contrasting surface or
colored fill. Selected and unselected source rows share the same transparent
resting border and subtle border on hover; selection never makes the row border
persistent. Current context is a centered outline button with no directional icon
or fill. Its semantic action border and text strengthen on hover and press.
Recent chats use the same restrained border-only hover treatment.

Ask, Action, and Plan describe the next intent, not the chat's category. Recent
chats instead show **Chat**, **Running**, or **Done**. Plans and tasks appear as
artifacts inside their chat. A plan may replace chat detail temporarily with a
direct Back path and Accept action; accepting it creates running work in that
same chat. The inspector must not become a navigation maze, permanent chat
column, or competitor to the work surface.

Before material action, the user should understand: what mode is active, what
scope Taurus will use, where the result goes, whether work is immediate,
previewed, delegated, or review-gated, and how to cancel, inspect, or recover.

## State language and color

Use explicit Idle, Focused, Resolving, Agent running, Needs review, Applied, and
Failed states. Per the [color roles](color-system.md#semantic-roles): `focus`
(cyan) signals focus and live computation; `intel` (violet) signals intelligence
or agent routing; `attention` (amber) signals judgment; `success` (green) signals
applied work; `danger` (red) signals failure. Copy and structure always accompany
color.

## Flow and accessibility

Focusing the surface must not destroy the prior selection. After completion or
escape, return focus to the prior work context when safe. Mode, context, submit,
navigation, and status must be keyboard-accessible and text-readable. Reduced
motion removes expansion choreography, not state clarity.
