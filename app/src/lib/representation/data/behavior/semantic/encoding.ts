import type { SemanticEncoding } from "$representation/data/types/semantic/source";

/** Encode a JavaScript string without relying on a platform TextEncoder. */
export const utf8Bytes = (value: string): number[] => {
  const output: number[] = [];
  for (let offset = 0; offset < value.length; offset += 1) {
    const first = value.charCodeAt(offset);
    let codePoint = first;
    if (first >= 0xd800 && first <= 0xdbff) {
      const second = value.charCodeAt(offset + 1);
      if (!(second >= 0xdc00 && second <= 0xdfff)) {
        throw new Error("Semantic source text contains an unmatched UTF-16 surrogate");
      }
      codePoint = 0x10000 + ((first - 0xd800) << 10) + (second - 0xdc00);
      offset += 1;
    } else if (first >= 0xdc00 && first <= 0xdfff) {
      throw new Error("Semantic source text contains an unmatched UTF-16 surrogate");
    }

    if (codePoint <= 0x7f) {
      output.push(codePoint);
    } else if (codePoint <= 0x7ff) {
      output.push(0xc0 | (codePoint >> 6), 0x80 | (codePoint & 0x3f));
    } else if (codePoint <= 0xffff) {
      output.push(
        0xe0 | (codePoint >> 12),
        0x80 | ((codePoint >> 6) & 0x3f),
        0x80 | (codePoint & 0x3f)
      );
    } else {
      output.push(
        0xf0 | (codePoint >> 18),
        0x80 | ((codePoint >> 12) & 0x3f),
        0x80 | ((codePoint >> 6) & 0x3f),
        0x80 | (codePoint & 0x3f)
      );
    }
  }
  return output;
};

/** UTF-8 byte boundary to JavaScript UTF-16 offset. */
export const byteToUtf16Offsets = (value: string): Map<number, number> => {
  const output = new Map<number, number>([[0, 0]]);
  let byteOffset = 0;
  for (let utf16Offset = 0; utf16Offset < value.length; ) {
    const first = value.charCodeAt(utf16Offset);
    const width = first >= 0xd800 && first <= 0xdbff ? 2 : 1;
    const character = value.slice(utf16Offset, utf16Offset + width);
    byteOffset += utf8Bytes(character).length;
    utf16Offset += width;
    output.set(byteOffset, utf16Offset);
  }
  return output;
};

export const coordinateLength = (value: string, encoding: SemanticEncoding): number =>
  encoding === "utf-8" ? utf8Bytes(value).length : value.length;

export const coordinateAtByteBoundary = (
  value: string,
  byteOffset: number,
  encoding: SemanticEncoding
): number => {
  if (encoding === "utf-8") {
    if (!byteToUtf16Offsets(value).has(byteOffset)) {
      throw new Error("Semantic span ends inside a UTF-8 code point");
    }
    return byteOffset;
  }
  const coordinate = byteToUtf16Offsets(value).get(byteOffset);
  if (coordinate === undefined) throw new Error("Semantic span ends inside a UTF-8 code point");
  return coordinate;
};

/** Slice by the coordinate contract carried by a semantic source. */
export const sliceByCoordinates = (
  value: string,
  encoding: SemanticEncoding,
  from: number,
  to: number
): string => slicesByCoordinates(value, encoding, [{ from, to }])[0];

/** Slice several spans while constructing the source's byte-boundary map once. */
export const slicesByCoordinates = (
  value: string,
  encoding: SemanticEncoding,
  spans: { from: number; to: number }[]
): string[] => {
  const offsets = encoding === "utf-8" ? byteToUtf16Offsets(value) : undefined;
  return spans.map(({ from, to }) => {
    if (!Number.isInteger(from) || !Number.isInteger(to) || from < 0 || to < from) {
      throw new Error("Semantic span coordinates must be ordered non-negative integers");
    }
    if (encoding === "utf-16") {
      if (to > value.length) throw new Error("Semantic span exceeds its source");
      return value.slice(from, to);
    }

    const utf16From = offsets?.get(from);
    const utf16To = offsets?.get(to);
    if (utf16From === undefined || utf16To === undefined) {
      throw new Error("UTF-8 semantic spans must end on code-point boundaries");
    }
    return value.slice(utf16From, utf16To);
  });
};
