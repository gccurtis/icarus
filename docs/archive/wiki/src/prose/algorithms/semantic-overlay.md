## What it does

The semantic overlay turns a resource's text into a list of spans, each with a vector, so that meaning can be indexed and cited without the text being copied. Four pure files under `representation/data/behavior/semantic/` do all the deterministic work; the two provider calls — a token-level embedding of the whole text, and a dense embedding per final span — happen outside them. [[file:app/src/lib/representation/data/behavior/semantic/translation.ts]] is the entry: `prepareTranslation(source, tokenField, configuration)` aligns and segments, and `completeTranslation(prepared, vectors)` attaches the final vectors and produces the publication message.

## Encoding and alignment

A span is addressed in the source's own coordinates — UTF-8 bytes or UTF-16 units, as `source.encoding` says — and [[file:app/src/lib/representation/data/behavior/semantic/encoding.ts]] converts between them without a platform `TextEncoder`, refusing an offset inside a code point. [[file:app/src/lib/representation/data/behavior/semantic/token-alignment.ts]] maps the provider's byte-level token labels (Jina's visible-byte alphabet, decoded by `displayedTokenBytes`) onto exact source offsets: it skips the injected `Passage:` prefix, scans forward through the source bytes for each piece, allows only whitespace gaps, and sums the vectors of the model tokens that make up one source atom. The result is an `AlignedTokenField`: contiguous spans covering the whole source, each backed by one or more model tokens and one summed vector.

## Distance-discounted attraction

[[file:app/src/lib/representation/data/behavior/semantic/segmentation.ts]] decides where to cut. Every boundary between two aligned spans is a candidate, provided both sides hold at least `minTokens`; its `semanticChange` is `1 − cosine(left region vector, right region vector)`, computed from prefix sums so a region vector is one subtraction. The candidates form a one-dimensional field, and each local maximum owns a basin — every candidate that reaches it by ascent. A basin's mass is the change above the field's floor summed over its members; its prominence is its peak above the highest saddle to any higher peak.

The attraction at a peak is the signed sum over every higher candidate of `(c_j − c_i) · exp(−|x_j − x_i| / decay) · sign(x_j − x_i)` — `distanceDiscountedPull`. A peak with a strong pull is being drawn toward a nearby stronger boundary and is not a boundary of its own.

## Basins and boundaries

A basin is stationary when `|pull| ≤ attractionStationaryThreshold`, and eligible when its peak's change is at least `changeThreshold`, its prominence at least `basinProminenceThreshold`, and its share of the total mass at least `basinMassFraction`. Stationary, eligible basins are the boundaries — after `suppressCloseAttractors` drops the weaker of any two closer than `minTokens`, ranking by pull, then mass, then change, then position. The cuts become `SegmentRange`s; `enforceHardMax` then splits any range longer than `maxTokens` at its own strongest candidate, or halfway if there is none. The `peaks` the function returns carry every intermediate number, which is what the `/demo/semantic-overlay` pages draw.

## Configuration

Seven numbers make a `TranslationConfiguration`, validated before anything runs. The values in `app/configuration/semantic-overlay.yaml` are `maxTokens 320`, `minTokens 6`, `changeThreshold 0.28`, `basinProminenceThreshold 0.02`, `basinMassFraction 0.04`, `attractionDecayTokens 2`, `attractionStationaryThreshold 0.005`. Nothing under `src/` reads that file through the configuration object; the algorithm takes the configuration as an argument and the demo supplies its own.
