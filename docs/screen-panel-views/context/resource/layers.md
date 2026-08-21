# Layers

| View | What it is for | Sections |
| --- | --- | --- |
| Layers | What is on this slide, in stacking order, and which of it you may touch | Slide objects · Layout objects |

The visible object list, and the accessibility fallback for a canvas. Anything
selectable by clicking is selectable here.

## Layout

| 300px |
| --- |
| actions |
| slide objects |
| slide objects |
| layout objects |

## Slide objects

Everything the slide owns, front to back. Front-to-back order is the list order,
so the list is the stacking order rather than a description of it.

**Shows**

- Chart element — Front
- Body text — Middle
- Title — Back

**Needs** — the slide's element list with z-order.

## Layout objects

What the layout owns and the slide cannot edit here, shown so the slide is
complete rather than mysteriously missing its footer.

**Shows** — *Footer wordmark* — Locked · layout-owned; *Slide number* — Locked · layout-owned

**Needs** — the resolved layout's locked elements.

**Open** — cross-layer order between layout-owned and slide-owned objects is
undefined in the model. Two lists cannot express one stack, and this view is
currently pretending they can.

## Panel furniture

The action row: **Front**, **Forward**, **Back**, **Behind**.

Shift-clicking on the canvas or here selects several; align and distribute then
appear in the inspector rather than here, because they are properties of the
selection.
