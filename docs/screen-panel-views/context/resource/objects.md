# Objects

| View | What it is for | Sections |
| --- | --- | --- |
| Objects | Charts and overlays floating over the grid | One section per group |

The grid's equivalent of Layers. Anything that is not a cell lives here, because
an object anchored under another object cannot be found by clicking.

## Layout

| 300px |
| --- |
| charts and overlays |
| charts and overlays |

## Charts and overlays

Each object with its type and where it is anchored. Overlap is flagged, because
overlapping objects on a grid are how one becomes unreachable.

**Shows**

- *Column chart* — Anchored to E9
- *Pie chart* — Anchored to A14 · overlapped

**Needs** — the spreadsheet's object list with type, anchor and size.

Each object row uses the same stable chart id as the canvas and inspector.
Internal datums, axes, and annotations are identified too, so overlap affects
reachability on the grid but never makes an object unaddressable from this list.
