# Motion

> How the room moves. The document with the least code behind it and the
> largest effect on whether the product feels like a thinking space.

## The law

**Motion without intent is disruption.** Every movement must be both *caused*
and *meaningful* — it must have a reason it happened, and it must tell the
person something they did not already know.

A thinking space is a place you can put a thought down and find it again. An
uncaused movement is a small interruption of that: attention is pulled, the
mental model is re-checked, and the thought has to be picked back up. A product
that animates because animation is available is a product that repeatedly
evicts its user from their own reasoning.

This is not an argument for a static interface. It is an argument that motion
is a *statement*, and that spending it on anything but a statement wastes the
one thing it is good for.

## The two things motion is allowed to say

**One: you did that.** A person acted, and the movement confirms the act
landed. A panel opening under the click that opened it, a row settling into a
new sort order, a control taking a press. The movement is an acknowledgement,
and it should feel continuous with the gesture that caused it.

**Two: this happened, and you may want to do something about it.** A toast
saying the change was applied. A pill appearing to say a comment mentions you.
A derived value arriving because a run finished. Nobody asked for these in the
moment they occurred, so the movement carries the information that they are new
— and, often, an implicit question: *does this need me?*

The second kind must not impersonate the first. If it enters the way a click
enters, a person reads it as their own action and stops trusting the
distinction.

## What motion may not say

- **Emphasis.** If a thing needs attention it takes a role colour and copy.
  Movement as a highlighter — a wiggle, a pulse to be noticed — is the visual
  equivalent of shouting, and it is the failure mode this whole document
  exists to prevent.
- **Personality.** Bounce, overshoot, and spring are the interface talking
  about itself.
- **Progress it does not have.** A looping animation is legitimate for a
  genuinely indeterminate wait and for nothing else. If the duration is known,
  show the duration.

## Curves

A curve is how a movement's cause feels, so there are as many curves as there
are distinct causes — no more, and **no artificial ceiling either**. Two are
declared because two kinds of cause are established; a third arrives the day a
third kind of cause does, not before and not never.

| Curve | Cause | Feel |
| --- | --- | --- |
| `standard` | you did it | leaves quickly, arrives gently — responsive out, calm in |
| `arrival` | it happened | enters slowly and settles long — present without claiming to be a response |

## Duration names what moves

| Duration | Range | What |
| --- | --- | --- |
| `micro` | 100ms | press, hover, toggle |
| `small` | 150ms | tooltips, small transitions |
| `panel` | 220ms | panel collapse, drawer, tab change |
| `overlay` | 260ms | modals, popovers |
| `arrival` | 420ms | something that happened rather than something you did |

`arrival` is the long one on purpose. A thing that appears without being asked
for should take long enough to be noticed and not so long that it becomes an
event.

## Distance

Things **rise**; they do not fly. Two distances, and nothing travels further
under its own power.

- `rise` — 4px. A thing settling onto its plane. Menus, tooltips, chips.
- `drift` — 8px. A thing arriving from off-plane. Drawers, panels, derived
  output.

Anything that needs to move more than 8px is not animating, it is relocating,
and relocation should be instant so the person's spatial memory stays true.

## Reduced motion is not a downgrade

`prefers-reduced-motion` collapses animation globally, and every state must
remain fully readable with it on. That is a design constraint before it is an
accessibility one: **if a state is only legible because something moved, the
state was never designed.** Motion is always the second carrier of meaning,
never the first.

The corollary is that reduced motion needs no separate design. Turn every
transition off and the screen should be correct — quieter, but correct.

## Tokens this justifies

| Token | Job |
| --- | --- |
| `--token-ease-standard` | you did it |
| `--token-ease-arrival` | it happened |
| `--token-motion-micro`, `-small`, `-panel`, `-overlay` | duration by what moves |
| `--token-motion-arrival` | the long one, for things that happened |
| `--token-motion-rise`, `--token-motion-drift` | how far a thing may travel |
