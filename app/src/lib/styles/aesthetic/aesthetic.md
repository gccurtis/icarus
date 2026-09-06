# Celestial

> A formless citadel amongst the clouds, whose curves channel the manifestation
> of the solar will.

Everything under `styles/` is downstream of this sentence. `material/` is what
Celestial is made of, `surfaces/` is what it is built out of, `tokens/` is the
vocabulary a component may use, `integrations/` are adapters. Read in that
order.

## An application is a place in the mind

The interface is not the product. The product is a mental object — a document
being thought about, a table being reasoned over, a decision being made — and
the screen is the channel through which a person holds that object. Pixels are
how the thought is delivered, not what it is.

That reframes every visual question. The test of a screen is not whether it
looks good in a screenshot. It is whether the thing it represents is **easy to
hold in your head**: whether you can put it down, come back, and find your
thought where you left it.

An interface fails this test long before it looks bad. It fails when it makes
you re-derive where you are, when a panel rearranges itself under you, when
something moves that you did not move, when two controls that do the same kind
of work look unrelated. Each of those is a small eviction from your own
thought.

## Formless

The citadel is not fortified and it is not ornamental. **Its intricacy is in its
smoothness.** Think of something enormous that unfolds — a body more like a
jellyfish than a building, natural rather than engineered, whose complexity you
register as continuous curvature rather than as detail you could count.

It reads as almost fractal without showing you a fractal. There is no repeating
motif to find; the sense of depth comes from the fact that every scale is made
the same way, so wherever you look you are looking at the same logic. You feel
it as a fractal of the universe rather than seeing one.

That is the quality worth chasing, because of what it does: **a surface you can
fall into is a surface you can work in.** Ornament asks to be looked at.
Smoothness lets you look past it, at your own work, which is the entire point.

Practically, this means curvature and continuity beat articulation. Fewer
edges, fewer boxes, fewer separate objects; more one thing with internal
structure. It means a shell whose parts flow into one another rather than a
shell assembled from panels that each announce themselves. And it means
restraint is not austerity — it is what smoothness costs.

## The solar will, channelled

Light is not decoration here; it is the thing being transmitted. The citadel's
curves do not generate light, they *channel* it — they give a direction to
something that came from elsewhere, and the shape of the channel is the whole
design.

That is the relationship the interface has to a person's intent. The work is
theirs. The application gives it somewhere to go.

It is also, literally, how the two materials work.

| Material | Reads | Character |
| --- | --- | --- |
| **Celestial Helios** | light | the will manifest directly — day, warm paper, the source |
| **Celestial Selene** | dark | the same will returned by another body — night, cool void, reflection |

There is one aesthetic. Helios and Selene are two materials expressing it, and
they are **not required to mirror each other**. They are required to be good.
See [material](../material/material.md).

## The five qualities

- **Luminous order** — low-glare depth and restrained light, whichever body is
  doing the lighting.
- **Architectural clarity** — strong spatial zones, calm boundaries,
  predictable panels, hierarchy that repeats.
- **Instrument precision** — crisp controls, exact focus, readable data,
  complete interaction states.
- **Invisible intelligence** — derived work appears as resolved output,
  explanation, and reviewable change; never as decoration.
- **Reversibility and trust** — material action is attributable, inspectable,
  recoverable, and honest about where it came from.

## What it must not feel like

A generic SaaS dashboard. An Apple white-and-blue clone. Saturated cyberpunk.
A command line wearing a GUI. An expert-only editor built around secret
shortcuts. A chat product that makes the work surface secondary.

## The laws

1. **Center first.** Reduce chrome intensity before reducing work-surface
   clarity. When something has to give, it is never the work.
2. **The right things visible, in the right place.** What you show matters, and
   *where* you show it matters exactly as much. So does the order you show it
   in. A correct set of controls in an arbitrary arrangement is not a correct
   screen — see [arrangement](arrangement.md).
3. **No secret essentials.** Shortcuts and context menus accelerate visible
   paths. They never replace them.
4. **Panels are cognitive instruments.** Context is a map, the inspector is a
   lens, the drawer is a workbench for one object.
5. **Intelligence is quiet until directed.**
6. **Beauty is legibility.** A person knows what they see, what is selected,
   what changed, where it came from, and what comes next.
7. **Distinction is communication.** A change of ground, a rule, a divider, a
   plane — each one is a sentence saying *this is a different kind of thing*.
   Spend them deliberately and a dense screen explains itself; withhold them
   and it becomes a wall.
8. **Nothing moves without intent.** Motion without intent is disruption — see
   [motion](motion.md).

## Rhythm, not symmetry

Symmetry is the wrong thing to anchor on. Most real screens are not symmetrical
and should not be; a rail is not the width of an inspector, a table is not the
shape of a form.

What actually holds a screen together is **rhythm**: the same interval, the
same height, the same tracking, recurring. Two panels share a rhythm even at
different widths. Two dense rows share a height even with different contents.
Where the rhythm holds, a person stops reading the chrome and reads only the
work.

Grouping is a claim, and it should be one you could defend out loud. When
things are placed together, there is a narrative reason — they are steps in one
sequence, facets of one object, alternatives to one decision. A group assembled
because the items happened to be adjacent in the data is a group the reader has
to disassemble.

Two promises follow, and they are the ones to test a screen against:

- **What you see never looks like clutter.**
- **What you see always seems related to what you want.**

Restraint serves both. Every ramp reaches seven steps and each material uses
five; the most vivid entries are held back, because an interface that spends
its brightest colour on ordinary state has nothing left when something
genuinely needs attention.

## Provenance is part of the aesthetic

A system that derives content has to be able to say where the content came
from. Origin, confidence, review state, and staleness are first-class visual
material, not fine print.

The rule is stronger than showing uncertainty well. **If the system cannot
establish where something came from, it does not show the something.** It says
it could not find it. A derived value with no traceable origin is not a
low-confidence result to be rendered with a caveat; it is an answer the system
does not have, and rendering it anyway is the one dishonesty this aesthetic
cannot absorb.

## On rules

The documents in this directory are a floor, not a cage. They exist so that a
screen built without much thought still comes out coherent, and so that two
people building on different days converge.

They are not a licence to stop looking. When there is visibly a better way to
communicate something than the vocabulary here provides, take it, and then come
back and widen the vocabulary. A system that prevents its own best work has
failed at the only thing it was for.

## The review test

A screen succeeds when a first-time person can identify the work surface, the
current object, the selection, and the likely next action within seconds.

It must remain understandable when colour is removed, and grow calmer — not
more cluttered — as its logic becomes familiar.

## Where the rest of this lives

| Document | The question it answers |
| --- | --- |
| [light](light.md) | Where light comes from, what a plane is, when depth is earned |
| [type](type.md) | What the room sounds like; measure, scale, tracking, the reading voice |
| [motion](motion.md) | How the room moves, and what movement is allowed to mean |
| [arrangement](arrangement.md) | Placement, order, seams, density, disclosure |
| [states](states.md) | What every component must be able to report about itself |

Each ends in the tokens it justifies. A token with no argument behind it in one
of these documents is a value nobody decided.
