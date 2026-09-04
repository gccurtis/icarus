import {
  byteToUtf16Offsets,
  coordinateLength,
  utf8Bytes
} from "$representation/data/behavior/semantic/encoding";
import type { SemanticSourceInput } from "$representation/data/types/semantic/source";
import type {
  AlignedTokenField,
  TokenEmbeddingField
} from "$representation/data/types/semantic/translation";

const PASSAGE_PREFIX = utf8Bytes("Passage:");

const displayedByteDecoder = (): Map<string, number> => {
  const visible: number[] = [];
  for (let value = 33; value <= 126; value += 1) visible.push(value);
  for (let value = 161; value <= 172; value += 1) visible.push(value);
  for (let value = 174; value <= 255; value += 1) visible.push(value);

  const encoded = [...visible];
  let extra = 0;
  for (let value = 0; value < 256; value += 1) {
    if (visible.includes(value)) continue;
    encoded.push(value);
    visible.push(256 + extra);
    extra += 1;
  }
  return new Map(encoded.map((byte, index) => [String.fromCodePoint(visible[index]), byte]));
};

const DISPLAYED_BYTE_DECODER = displayedByteDecoder();

/** Invert the GPT/Qwen visible-byte alphabet used by Jina token labels. */
export const displayedTokenBytes = (label: string): number[] => {
  const output: number[] = [];
  for (const character of label) {
    const byte = DISPLAYED_BYTE_DECODER.get(character);
    output.push(...(byte === undefined ? utf8Bytes(character) : [byte]));
  }
  return output;
};

const startsWithBytes = (value: number[], prefix: number[]): boolean =>
  prefix.length <= value.length && prefix.every((byte, index) => value[index] === byte);

const equalBytes = (left: number[], right: number[]): boolean =>
  left.length === right.length && startsWithBytes(left, right);

const prefixCount = (pieces: number[][]): number => {
  const prefix: number[] = [];
  for (let index = 0; index < pieces.length; index += 1) {
    prefix.push(...pieces[index]);
    if (equalBytes(prefix, PASSAGE_PREFIX)) return index + 1;
    if (!startsWithBytes(PASSAGE_PREFIX, prefix)) break;
  }
  throw new Error("Jina token labels are missing the retrieval passage prefix");
};

const findBytes = (source: number[], piece: number[], from: number): number => {
  if (piece.length === 0) return from;
  const last = source.length - piece.length;
  for (let offset = from; offset <= last; offset += 1) {
    if (piece.every((byte, index) => source[offset + index] === byte)) return offset;
  }
  return -1;
};

const addRows = (rows: number[][], dimensions: number): number[] => {
  const sum = Array.from({ length: dimensions }, () => 0);
  for (const row of rows) {
    for (let column = 0; column < dimensions; column += 1) sum[column] += row[column];
  }
  return sum;
};

const validateField = (field: TokenEmbeddingField): number => {
  if (field.labels.length !== field.vectors.length) {
    throw new Error("Jina token labels and vectors do not align");
  }
  const dimensions = field.vectors[0]?.length ?? 0;
  if (dimensions < 1) throw new Error("Jina returned no token vectors");
  for (const row of field.vectors) {
    if (row.length !== dimensions || row.some((value) => !Number.isFinite(value))) {
      throw new Error("Jina token vectors must share one finite dimension");
    }
  }
  return dimensions;
};

const isWhitespaceGap = (
  source: string,
  byteOffsets: Map<number, number>,
  from: number,
  to: number
): boolean => {
  const utf16From = byteOffsets.get(from);
  const utf16To = byteOffsets.get(to);
  return (
    utf16From !== undefined &&
    utf16To !== undefined &&
    source.slice(utf16From, utf16To).trim().length === 0
  );
};

/** Map Jina's byte-level labels onto exact coordinates in the submitted source. */
export const alignTokenField = (
  source: SemanticSourceInput,
  field: TokenEmbeddingField
): AlignedTokenField => {
  const dimensions = validateField(field);
  const sourceBytes = utf8Bytes(source.text);
  const pieces = field.labels.map(displayedTokenBytes);
  const injectedPrefixCount = prefixCount(pieces);
  const sourcePieces = pieces.slice(injectedPrefixCount);
  const sourceVectors = field.vectors.slice(injectedPrefixCount);
  const byteOffsets = byteToUtf16Offsets(source.text);
  const spans: AlignedTokenField["spans"] = [];
  const vectors: number[][] = [];
  let scanOffset = 0;
  let emittedOffset = 0;
  let pending: number[][] = [];
  const coordinateFor = (byteOffset: number): number => {
    const utf16Offset = byteOffsets.get(byteOffset);
    if (utf16Offset === undefined) throw new Error("Semantic span ends inside a UTF-8 code point");
    return source.encoding === "utf-8" ? byteOffset : utf16Offset;
  };

  for (let index = 0; index < sourcePieces.length; index += 1) {
    const piece = sourcePieces[index];
    pending.push(sourceVectors[index]);
    if (piece.length === 0) continue;
    const found = findBytes(sourceBytes, piece, scanOffset);
    if (found < 0) throw new Error("Jina token labels cannot be aligned to the source");
    if (found > scanOffset && !isWhitespaceGap(source.text, byteOffsets, scanOffset, found)) {
      throw new Error("Jina token labels skipped non-whitespace source text");
    }
    scanOffset = found + piece.length;
    if (!byteOffsets.has(scanOffset)) continue;

    spans.push({
      from: coordinateFor(emittedOffset),
      to: coordinateFor(scanOffset),
      modelTokens: pending.length
    });
    vectors.push(addRows(pending, dimensions));
    emittedOffset = scanOffset;
    pending = [];
  }

  if (
    scanOffset < sourceBytes.length &&
    !isWhitespaceGap(source.text, byteOffsets, scanOffset, sourceBytes.length)
  ) {
    throw new Error("Jina token labels did not cover the complete source");
  }

  const sourceEnd = coordinateLength(source.text, source.encoding);
  if (pending.length > 0) {
    if (spans.length === 0) throw new Error("Jina returned no source-aligned tokens");
    const lastVector = vectors[vectors.length - 1];
    const tailVector = addRows(pending, dimensions);
    vectors[vectors.length - 1] = lastVector.map((value, index) => value + tailVector[index]);
    const lastSpan = spans[spans.length - 1];
    spans[spans.length - 1] = {
      ...lastSpan,
      to: sourceEnd,
      modelTokens: lastSpan.modelTokens + pending.length
    };
  } else if (spans.length > 0 && spans[spans.length - 1].to !== sourceEnd) {
    spans[spans.length - 1] = { ...spans[spans.length - 1], to: sourceEnd };
  }

  if (spans.length === 0 || spans[0].from !== 0 || spans[spans.length - 1].to !== sourceEnd) {
    throw new Error("Jina token alignment does not cover the source");
  }
  for (let index = 1; index < spans.length; index += 1) {
    if (spans[index - 1].to !== spans[index].from) {
      throw new Error("Jina token alignment contains a source gap");
    }
  }
  return { spans, vectors };
};
