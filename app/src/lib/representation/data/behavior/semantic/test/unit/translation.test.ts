import { describe, expect, it } from "vitest";
import {
  coordinateLength,
  sliceByCoordinates,
  utf8Bytes
} from "$representation/data/behavior/semantic/encoding";
import {
  distanceDiscountedPull,
  segmentAlignedField
} from "$representation/data/behavior/semantic/segmentation";
import { alignTokenField } from "$representation/data/behavior/semantic/token-alignment";
import {
  completeTranslation,
  prepareTranslation
} from "$representation/data/behavior/semantic/translation";
import type { SemanticSourceInput } from "$representation/data/types/semantic/source";
import type {
  AlignedTokenField,
  TokenEmbeddingField,
  TranslationConfiguration
} from "$representation/data/types/semantic/translation";

const configuration = (
  overrides: Partial<TranslationConfiguration> = {}
): TranslationConfiguration => ({
  maxTokens: 320,
  minTokens: 1,
  changeThreshold: 0.28,
  basinProminenceThreshold: 0,
  basinMassFraction: 0,
  attractionDecayTokens: 2,
  attractionStationaryThreshold: 0.005,
  ...overrides
});

const source = (
  text: string,
  encoding: SemanticSourceInput["encoding"] = "utf-16"
): SemanticSourceInput => ({
  ref: { kind: "document", id: "documents:fixture" },
  revision: 7,
  text,
  encoding
});

describe("semantic source coordinates", () => {
  it("lets the encoding fully determine the offset unit", () => {
    const text = "A🙂é";

    expect(utf8Bytes(text)).toHaveLength(7);
    expect(coordinateLength(text, "utf-8")).toBe(7);
    expect(coordinateLength(text, "utf-16")).toBe(4);
    expect(sliceByCoordinates(text, "utf-8", 1, 5)).toBe("🙂");
    expect(sliceByCoordinates(text, "utf-16", 1, 3)).toBe("🙂");
  });
});

describe("Jina token alignment", () => {
  const text = "- apples\n- 数据处理流程\nCafé adversity emoji🙂  double  spaces";
  const labels = [
    "Pass",
    "age",
    ":",
    "-",
    "apples",
    "Ċ",
    "-",
    "æķ°æį®",
    "å¤ĦçĲĨ",
    "æµģç¨ĭ",
    "Ċ",
    "C",
    "af",
    "Ã©",
    "adversity",
    "emoji",
    "ðŁĻĤ",
    "",
    "double",
    "",
    "spaces"
  ];
  const field: TokenEmbeddingField = {
    labels,
    vectors: labels.map(() => [1, 1, 1])
  };

  it.each(["utf-8", "utf-16"] as const)(
    "aligns real byte-level labels over a %s source",
    (encoding) => {
      const aligned = alignTokenField(source(text, encoding), field);

      expect(aligned.spans[0].from).toBe(0);
      expect(aligned.spans.at(-1)?.to).toBe(coordinateLength(text, encoding));
      expect(aligned.spans.reduce((total, span) => total + span.modelTokens, 0)).toBe(
        labels.length - 3
      );
      expect(aligned.vectors.every((vector) => vector.length === 3)).toBe(true);
      for (let index = 1; index < aligned.spans.length; index += 1) {
        expect(aligned.spans[index - 1].to).toBe(aligned.spans[index].from);
      }
    }
  );

  it("fails instead of approximating a non-whitespace gap", () => {
    expect(() =>
      alignTokenField(source("source"), {
        labels: ["Pass", "age", ":", "wrong"],
        vectors: [[1], [1], [1], [1]]
      })
    ).toThrow(/cannot be aligned/);
  });
});

describe("distance-discounted attraction", () => {
  it("implements the signed exponential equation directly", () => {
    const pull = distanceDiscountedPull(
      { boundaryPositionTokens: 5, semanticChange: 0.4 },
      [
        { boundaryPositionTokens: 3, semanticChange: 0.5 },
        { boundaryPositionTokens: 5, semanticChange: 0.4 },
        { boundaryPositionTokens: 7, semanticChange: 0.8 },
        { boundaryPositionTokens: 8, semanticChange: 0.2 }
      ],
      2
    );

    expect(pull).toBeCloseTo(0.3 / Math.E, 12);
  });

  it("selects a stationary semantic-change peak", () => {
    const spans = Array.from({ length: 8 }, (_, index) => ({
      from: index,
      to: index + 1,
      modelTokens: 1
    }));
    const field: AlignedTokenField = {
      spans,
      vectors: [...Array.from({ length: 4 }, () => [1, 0]), ...Array.from({ length: 4 }, () => [0, 1])]
    };

    const result = segmentAlignedField(field, configuration());

    expect(result.ranges).toEqual([
      { fromSpan: 0, toSpan: 4 },
      { fromSpan: 4, toSpan: 8 }
    ]);
    expect(result.peaks.find((peak) => peak.boundarySpan === 4)).toMatchObject({
      semanticChange: 1,
      stationary: true,
      eligible: true,
      selected: true
    });
  });

  it("enforces maxTokens even when no semantic peak survives", () => {
    const field: AlignedTokenField = {
      spans: Array.from({ length: 10 }, (_, index) => ({
        from: index,
        to: index + 1,
        modelTokens: 1
      })),
      vectors: Array.from({ length: 10 }, () => [1, 0])
    };

    const result = segmentAlignedField(
      field,
      configuration({ maxTokens: 4, changeThreshold: 2, basinProminenceThreshold: 2 })
    );

    expect(result.ranges[0].fromSpan).toBe(0);
    expect(result.ranges.at(-1)?.toSpan).toBe(10);
    expect(result.ranges.every((range) => range.toSpan - range.fromSpan <= 4)).toBe(true);
  });
});

describe("provider-free translation boundary", () => {
  it("prepares exact span texts and attaches final dense vectors", () => {
    const input = source("alpha beta");
    const tokenField: TokenEmbeddingField = {
      labels: ["Pass", "age", ":", "alpha", "beta"],
      vectors: [[0, 0], [0, 0], [0, 0], [1, 0], [0, 1]]
    };

    const prepared = prepareTranslation(input, tokenField, configuration());
    const result = completeTranslation(prepared, prepared.spans.map((_, index) => [index, 1]));

    expect(prepared.spans.map((span) => span.text).join("")).toBe(input.text);
    expect(result.source).toBe(input);
    expect(result.objects.map((object) => object.span)).toEqual(prepared.spans);
    expect(result.objects.every((object) => object.vector.length === 2)).toBe(true);
  });
});
