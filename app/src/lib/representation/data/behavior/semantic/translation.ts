import { coordinateLength, slicesByCoordinates } from "$representation/data/behavior/semantic/encoding";
import { segmentAlignedField } from "$representation/data/behavior/semantic/segmentation";
import { alignTokenField } from "$representation/data/behavior/semantic/token-alignment";
import type { SemanticSourceInput } from "$representation/data/types/semantic/source";
import type {
  PreparedTranslation,
  ProviderUsage,
  TokenEmbeddingField,
  TranslationConfiguration,
  TranslationResult
} from "$representation/data/types/semantic/translation";

const validateSource = (source: SemanticSourceInput): void => {
  if (!source.ref.kind.trim() || !source.ref.id.trim()) {
    throw new Error("Semantic sources require a resource kind and id");
  }
  if (!Number.isInteger(source.revision) || source.revision < 0) {
    throw new Error("Semantic source revision must be a non-negative integer");
  }
  if (!source.text.trim()) throw new Error("Semantic source text must contain content");
};

/**
 * Complete all deterministic work between the boundary-vector response and the
 * final dense-vector request. The returned span texts are sent to that request.
 */
export const prepareTranslation = (
  source: SemanticSourceInput,
  field: TokenEmbeddingField,
  configuration: TranslationConfiguration
): PreparedTranslation => {
  validateSource(source);
  const aligned = alignTokenField(source, field);
  const { ranges } = segmentAlignedField(aligned, configuration);
  const coordinates = ranges.map((range) => {
    const from = aligned.spans[range.fromSpan].from;
    const to = aligned.spans[range.toSpan - 1].to;
    return { from, to };
  });
  const texts = slicesByCoordinates(source.text, source.encoding, coordinates);
  const spans = coordinates.map(({ from, to }, index) => ({ from, to, text: texts[index] }));
  if (spans[0]?.from !== 0 || spans[spans.length - 1]?.to !== coordinateLength(source.text, source.encoding)) {
    throw new Error("Prepared semantic spans do not cover the source");
  }
  return { source, aligned, ranges, spans };
};

/** Attach the final contextual dense vectors and produce the publication message. */
export const completeTranslation = (
  prepared: PreparedTranslation,
  vectors: number[][],
  usage: ProviderUsage[] = []
): TranslationResult => {
  if (vectors.length !== prepared.spans.length) {
    throw new Error("Final vector count must equal the prepared semantic span count");
  }
  const dimensions = vectors[0]?.length ?? 0;
  if (dimensions < 1) throw new Error("Final semantic vectors must not be empty");
  for (const vector of vectors) {
    if (vector.length !== dimensions || vector.some((value) => !Number.isFinite(value))) {
      throw new Error("Final semantic vectors must share one finite dimension");
    }
  }
  return {
    source: prepared.source,
    objects: prepared.spans.map((span, index) => ({ span, vector: [...vectors[index]] })),
    usage: [...usage]
  };
};
