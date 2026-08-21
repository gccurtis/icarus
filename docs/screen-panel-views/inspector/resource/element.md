# An element

| Selecting | What it is | Sections |
| --- | --- | --- |
| One element on the slide | The spatial object: what is in it, where it sits, how it stacks, how the box is drawn | Content · Position and size · Arrange · Overflow · Box format · Placeholder origin |

An element is a box on the canvas. What is *inside* it is a block, which has its
own [lens](text-block-deck.md) — the two are separate because frame, rotation and
overflow must never leak into content.

## Layout

| 300px |
| --- |
| content |
| position and size |
| position and size |
| arrange |
| overflow |
| box format |
| placeholder origin |

## Content

What it holds, and the way into editing that content.

**Shows** — "Feeder 12 in detail", with **Edit text**

**Needs** — the element's content summary, and a route into the nested block
editor.

## Position and size

The frame. Values are fractions of the slide in the model, so a deck survives a
change of aspect ratio; they are pixels under the pointer.

**Shows** — `X · 0.070`, `Y · 0.110`, `Width · 0.640`, `Height · 0.160`, `Rotation · 0°`

**Needs** — the element frame and rotation.

**Open** — whether the panel shows fractions or a real unit. Fractions are honest
about the model and useless for typing a value.

## Arrange

Stacking, as four buttons.

**Shows** — **Front**, **Forward**, **Back**, **Behind**

Shift-clicking a second element makes align and distribute appear here, which the
section says rather than leaving to be discovered.

**Needs** — z-order mutation on the slide's element list.

## Overflow

What happens when content does not fit the box.

**Shows** — Clip · Shrink · Grow

**Needs** — an overflow mode on the element.

## Box format

How the box itself is drawn, as opposed to its content. Starts collapsed.

**Shows** — `Fill · None`, `Border · None`, `Padding · 8 pt`

**Needs** — fill, border and padding on the element.

## Placeholder origin

Where this element came from, if it came from a layout placeholder. Starts
collapsed.

**Shows** — `From placeholder · title`, `Reset eligible · Yes — one match in this layout`

**Needs** — a `fromPlaceholder` reference resolvable to exactly one placeholder.

**Open** — `SlidePlaceholder` has no stable key, so "one match" is inferred from
role. Duplicate-role reset stays gated.
