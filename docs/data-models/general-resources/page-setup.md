# Page setup

Physical page dimensions. Shared by all three general resources, because all
three get printed and the question is the same each time.

```ts
interface PageSetup {
  paper: PaperSize;
  orientation: "portrait" | "landscape";
  margins: { top: number; right: number; bottom: number; left: number };
}

type PaperSize =
  | "letter"
  | "legal"
  | "tabloid"
  | "a3"
  | "a4"
  | "a5"
  | { width: number; height: number };
```

## Points, everywhere

All print dimensions are in points — 1/72 inch. Margins, custom paper sizes,
column widths, row heights, header offsets.

Not pixels, because a pixel has no physical size and the whole purpose of these
numbers is to describe something that will exist on paper. Not millimetres or
inches, because picking one makes the other a conversion at every use. Points are
what type has been measured in for centuries and what every print pipeline
already speaks.

The screen renderer converts to pixels at whatever zoom it is showing. That is a
view concern and it is one-directional, so nothing round-trips.

## Named sizes plus an escape hatch

`paper` takes a name or explicit dimensions. Names are stored rather than resolved
to numbers so that "A4" stays A4 — a document set to A4 should not silently become
595.28 × 841.89 points, because then nothing can tell it apart from a custom size
that happens to match, and no UI can show the paper picker on the right entry.

Custom dimensions exist because label stock, unusual formats, and screen-shaped
"pages" are real, and a fixed enum would make them impossible rather than
unusual.

## Orientation is not a swapped size

`orientation` is separate from `paper` rather than being expressed by swapping
width and height. Landscape A4 is still A4 — it prints on the same sheet, from
the same tray — and a model that expressed it as a custom 841 × 595 size would
lose that.

## Margins are the content boundary

The four margins bound where content sits. A [document's](document.md) header and
footer live *outside* them, positioned from the page edge, which is why they carry
their own offset rather than being placed relative to the text area.

## Related

[document](document.md) · [slides](slides.md) · [spreadsheet](spreadsheet.md)
