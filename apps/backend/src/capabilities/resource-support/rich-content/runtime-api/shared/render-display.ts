import type {
  DisplayContent,
  DisplayLine,
  DisplayListItem
} from "#rich-content/types/display-content.js";
import type {
  LinkTarget,
  ResolvedStyle
} from "#rich-content/types/formatting.js";
import type {
  RawContent,
  RawRange,
  TextAtom
} from "#rich-content/types/raw-content.js";
import {
  listMarkForLine,
  rawLines
} from "#rich-content/runtime-api/shared/raw-lines.js";
import { rangeContains } from "#rich-content/runtime-api/shared/ranges.js";

const DEFAULT_STYLE: ResolvedStyle = Object.freeze({
  bold: false,
  italic: false,
  underline: false,
  strike: false,
  code: false,
  fontFamily: "system-ui, sans-serif",
  fontSize: 1,
  fontWeight: 400,
  color: "inherit",
  backgroundColor: "transparent",
  letterSpacing: 0,
  lineHeight: 1.5
});

const listItem = (
  marker: NonNullable<ReturnType<typeof listMarkForLine>>,
  ordinal: number
): DisplayListItem => ({
  listId: marker.listId,
  kind: marker.presentation.kind,
  marker:
    marker.presentation.kind === "unordered"
      ? marker.presentation.marker
      : String(marker.presentation.start + ordinal),
  separator: marker.presentation.separator
});

const markBoundaries = (content: RawContent, atom: TextAtom): number[] => {
  const boundaries = new Set([0, atom.text.length]);
  for (const mark of content.marks) {
    if (mark.kind === "list-item") continue;
    if (mark.range.start.atomId === atom.id) boundaries.add(mark.range.start.offset);
    if (mark.range.end.atomId === atom.id) boundaries.add(mark.range.end.offset);
  }
  return [...boundaries].sort((left, right) => left - right);
};

const segmentRange = (atom: TextAtom, start: number, end: number): RawRange => ({
  start: { atomId: atom.id, offset: start },
  end: { atomId: atom.id, offset: end }
});

const resolveStyle = (content: RawContent, range: RawRange): ResolvedStyle => {
  const style = { ...DEFAULT_STYLE };
  for (const mark of content.marks) {
    if (
      mark.kind === "style" &&
      rangeContains(content, mark.range, range)
    ) {
      Object.assign(style, mark.properties);
    }
  }
  return Object.freeze(style);
};

const linkKey = (target: LinkTarget): string => JSON.stringify(target);

const resolveLinks = (content: RawContent, range: RawRange): readonly LinkTarget[] => {
  const targets = new Map<string, LinkTarget>();
  for (const mark of content.marks) {
    if (
      mark.kind === "link" &&
      rangeContains(content, mark.range, range)
    ) {
      for (const target of mark.targets) {
        targets.set(linkKey(target), target);
      }
    }
  }
  return [...targets.values()];
};

export const renderDisplayContent = (content: RawContent): DisplayContent => {
  let previousListId: string | undefined;
  let ordinal = 0;

  const lines: DisplayLine[] = rawLines(content).map((line) => {
    const listMark = listMarkForLine(content, line);
    if (!listMark || listMark.listId !== previousListId) {
      ordinal = 0;
    } else {
      ordinal += 1;
    }
    previousListId = listMark?.listId;

    let segmentIndex = 0;
    const segments = line.atoms.flatMap((atom) => {
      const boundaries = markBoundaries(content, atom);
      const intervals = atom.text.length === 0
        ? [[0, 0] as const]
        : boundaries.slice(0, -1).map((start, index) =>
            [start, boundaries[index + 1]!] as const
          );
      return intervals.map(([start, end]) => {
        const range = segmentRange(atom, start, end);
        return {
          id: `${content.id}:${content.version}:segment:${line.index}:${segmentIndex++}`,
          kind: "text" as const,
          atomId: atom.id,
          atomRange: { start, end },
          text: atom.text.slice(start, end),
          style: resolveStyle(content, range),
          links: resolveLinks(content, range)
        };
      });
    });

    return {
      id: `${content.id}:${content.version}:line:${line.index}`,
      ...(listMark ? { list: listItem(listMark, ordinal) } : {}),
      segments
    };
  });

  return { contentId: content.id, version: content.version, lines };
};
