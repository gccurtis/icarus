# Capability — Icarus Media Runtime Model

> Mirrored from [Notion](https://app.notion.com/p/3aeb6410e5028167bd7ef7d09b75e8a1).

## Prerequisites
### Required before implementation
- Sources exact image-version reader.
- Platform Intelligence vision, structured-output, OCR, and embedding ports.
- Platform Database, logger, canonical digest utilities, safe bounded image inspection, content-agnostic lattice geometry, and the concurrent job runtime.
### Provides downstream
- Descriptor search for Research, exact image inspection for native Resources, and literal OCR text with image-region provenance for Knowledge.
### Construction boundary
`1-init` injects a bound Media repository, attribution, Source reader, Intelligence ports, and lattice utilities. Requests, Jobs, domain values, and tables carry Source, artifact, projection, and generation identities only. Provider credentials and model selection remain behind Platform Intelligence.
## Purpose and authority
Media makes still images discoverable by visual meaning while preserving a strict distinction between interpretation and source material:
```plain text
generated descriptor -> helps retrieval find an image
original Source image -> is what inspect and open return
literal OCR text      -> may enter Knowledge as a separate projection
```
The capability accepts PNG, JPEG, and WebP still images. It owns:
- deterministic image admission metadata;
- descriptor and OCR build attempts;
- generated descriptors, structured tags, confidence, and inference provenance;
- descriptor vectors and a separate Media lattice;
- OCR policy and literal OCR results with image-region locators;
- immutable derived generations and atomically published heads.
Sources owns original bytes and Source versions. Knowledge owns text windows and its text lattice. Evidence owns admitted assertions. Data owns chart data. Platform Intelligence owns provider mechanics.
## Runtime placement
```plain text
apps/backend/src/3-capabilities/media/
  domain/
    model.ts
    policy.ts
    descriptor.ts
    ocr.ts
    lattice.ts
  application/
    service.ts
    generationBuilder.ts
    corpusPublisher.ts
  ports/
    repository.ts
    sourceReader.ts
    vision.ts
    ocrProjectionReader.ts
  persistence/
    migrations.ts
    sqliteMediaRepository.ts
  index.ts

apps/backend/src/4-job-wiring/media/
  registerMediaEndpointMappings.ts
  createMediaJobs.ts
  mediaSourceAdapters.ts
  mediaOcrProjectionAdapter.ts
```
Image decoding, provider calls, embeddings, and lattice builds run through the bounded concurrent pool. Policy mutation is a short serial command. Shared lattice geometry stays under `0-utils/lattice`; Media owns all Media entries and generations.
## Public operations
<table header-row="true">
<tr>
<td>Operation</td>
<td>Queue</td>
<td>Response</td>
<td>Effect</td>
</tr>
<tr>
<td>`media.ingest-source`</td>
<td>Concurrent</td>
<td>Deferred</td>
<td>Validate, describe, embed, optionally OCR, publish</td>
</tr>
<tr>
<td>`media.refresh-source`</td>
<td>Concurrent</td>
<td>Deferred</td>
<td>Rebuild only changed identity branches</td>
</tr>
<tr>
<td>`media.retry-description`</td>
<td>Concurrent</td>
<td>Deferred</td>
<td>New descriptor attempt against the same bytes</td>
</tr>
<tr>
<td>`media.retry-ocr`</td>
<td>Concurrent</td>
<td>Deferred</td>
<td>New literal OCR attempt</td>
</tr>
<tr>
<td>`media.search`</td>
<td>Concurrent</td>
<td>Inline</td>
<td>Descriptor-lattice search</td>
</tr>
<tr>
<td>`media.inspect`, `media.open`, `media.status`</td>
<td>Concurrent</td>
<td>Inline</td>
<td>Exact reads and Source image reference</td>
</tr>
<tr>
<td>`media.set-policy`</td>
<td>Serial</td>
<td>Inline</td>
<td>Policy ChangeSet under revision CAS</td>
</tr>
<tr>
<td>`media.remove-source`</td>
<td>Concurrent</td>
<td>Deferred</td>
<td>Publish a corpus generation without the image</td>
</tr>
</table>
An ingest can complete partially: descriptor publication may succeed while OCR fails. The image remains searchable, and the OCR failure remains explicit.
## Domain contracts
```typescript
export interface InferenceIdentity {
  provider: string;
  model: string;
  promptVersion: string;
}

export interface VectorIdentity {
  provider: string;
  model: string;
  dimensions: number;
}

export type MediaParentRef =
  | { kind: "source"; sourceId: string }
  | {
      kind: "native_resource";
      resourceKind: "document" | "slides" | "spreadsheet";
      resourceId: string;
      revision: number;
    };

export interface MediaPolicy {
  revision: number;
  ocrMode: "never" | "auto" | "always";
  ocrLikelihoodThreshold: number;
  maxImageBytes: number;
  maxImagePixels: number;
  maxOcrTextBytes: number;
}

export interface MediaArtifact {
  mediaArtifactId: string;
  sourceId: string;
  sourceVersionId: string;
  sourceHash: string;
  format: "png" | "jpeg" | "webp";
  width: number;
  height: number;
  byteSize: number;
  orientationTransform: readonly number[];
  parentRefs: readonly MediaParentRef[];
}

export interface MediaDescriptor {
  name: string;
  summary: string;
  mediaKind: "photo" | "chart" | "diagram" | "screenshot" | "illustration" | "other";
  subjects: Array<{ kind: string; name: string }>;
  setting: string;
  purpose: string;
  composition: string[];
  tags: Array<{ namespace: string; value: string }>;
  visibleText: { likelihood: number; ocrRecommended: boolean; reason: string };
  confidence: number;
}

export interface OcrRegion {
  textStart: number;
  textEnd: number;
  bounds: { x: number; y: number; width: number; height: number };
  confidence: number;
}

export interface OcrResult {
  status: "skipped" | "completed" | "failed";
  text: string | null;
  textHash: string | null;
  regions: readonly OcrRegion[];
  language: string | null;
  confidence: number | null;
}
```
The descriptor is explicitly generated interpretation. OCR instructions require literal visible text in reading order, preserving spelling, ambiguity, truncation, and low-confidence spans.
## Policy CAS and generation identity
Policy commands carry `expectedRevision`, `clientRequestId`, and `requestDigest`. The repository records forward and inverse operations and updates the singleton with `WHERE revision = expectedRevision`. Identical retries return the accepted ChangeSet; changed digests are rejected.
All artifacts, descriptors, OCR outputs, vectors, corpus rows, and lattice rows are rebuildable. A projection generation is identified by:
```plain text
Source hash
+ descriptor policy and prompt version
+ resolved vision route
+ descriptor embedding route and dimensions
+ OCR policy and prompt version
+ resolved OCR route
```
An identical build key is reused. A changed relevant identity creates a new immutable generation. Readers continue using the prior coherent head until the new generation is published atomically.
## SQLite schema
```sql
PRAGMA foreign_keys = ON;

CREATE TABLE media_policies (
  singleton_key INTEGER PRIMARY KEY CHECK (singleton_key = 1),
  revision INTEGER NOT NULL DEFAULT 0 CHECK (revision >= 0),
  ocr_mode TEXT NOT NULL DEFAULT 'auto' CHECK (ocr_mode IN ('never', 'auto', 'always')),
  ocr_likelihood_threshold REAL NOT NULL CHECK (ocr_likelihood_threshold BETWEEN 0.0 AND 1.0),
  max_image_bytes INTEGER NOT NULL CHECK (max_image_bytes > 0),
  max_image_pixels INTEGER NOT NULL CHECK (max_image_pixels > 0),
  max_ocr_text_bytes INTEGER NOT NULL CHECK (max_ocr_text_bytes > 0),
  created_by TEXT NOT NULL,
  updated_by TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
) STRICT;

CREATE TABLE media_policy_changesets (
  singleton_key INTEGER NOT NULL DEFAULT 1 CHECK (singleton_key = 1),
  revision INTEGER NOT NULL CHECK (revision > 0),
  from_revision INTEGER NOT NULL CHECK (from_revision >= 0),
  to_revision INTEGER NOT NULL CHECK (to_revision > 0),
  client_request_id TEXT NOT NULL,
  request_digest TEXT NOT NULL,
  forward_operation_json TEXT NOT NULL CHECK (json_valid(forward_operation_json)),
  inverse_operation_json TEXT NOT NULL CHECK (json_valid(inverse_operation_json)),
  actor_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY (singleton_key, revision),
  UNIQUE (singleton_key, client_request_id),
  FOREIGN KEY (singleton_key) REFERENCES media_policies(singleton_key),
  CHECK (to_revision = revision AND to_revision = from_revision + 1)
) STRICT;

CREATE TABLE media_artifacts (
  artifact_id TEXT PRIMARY KEY,
  source_id TEXT NOT NULL,
  source_version_id TEXT NOT NULL UNIQUE,
  source_hash TEXT NOT NULL,
  format TEXT NOT NULL CHECK (format IN ('png', 'jpeg', 'webp')),
  width INTEGER NOT NULL CHECK (width > 0),
  height INTEGER NOT NULL CHECK (height > 0),
  byte_size INTEGER NOT NULL CHECK (byte_size > 0),
  orientation_transform_json TEXT NOT NULL CHECK (json_valid(orientation_transform_json)),
  parent_refs_json TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(parent_refs_json)),
  created_at TEXT NOT NULL
) STRICT;

CREATE TABLE media_projection_generations (
  generation_id TEXT PRIMARY KEY,
  projection_id TEXT NOT NULL,
  artifact_id TEXT NOT NULL,
  build_key TEXT NOT NULL,
  source_hash TEXT NOT NULL,
  descriptor_provider TEXT NOT NULL,
  descriptor_model TEXT NOT NULL,
  descriptor_prompt_version TEXT NOT NULL,
  embedding_provider TEXT NOT NULL,
  embedding_model TEXT NOT NULL,
  embedding_dimensions INTEGER NOT NULL CHECK (embedding_dimensions > 0),
  ocr_provider TEXT,
  ocr_model TEXT,
  ocr_prompt_version TEXT,
  descriptor_state TEXT NOT NULL CHECK (descriptor_state IN ('pending', 'completed', 'failed')),
  ocr_state TEXT NOT NULL CHECK (ocr_state IN ('skipped', 'pending', 'completed', 'failed')),
  state TEXT NOT NULL CHECK (state IN ('building', 'ready', 'partial', 'failed')),
  created_at TEXT NOT NULL,
  published_at TEXT,
  UNIQUE (projection_id, generation_id),
  UNIQUE (projection_id, generation_id, artifact_id),
  UNIQUE (projection_id, build_key),
  FOREIGN KEY (artifact_id) REFERENCES media_artifacts(artifact_id),
  CHECK ((ocr_provider IS NULL AND ocr_model IS NULL AND ocr_prompt_version IS NULL) OR
         (ocr_provider IS NOT NULL AND ocr_model IS NOT NULL AND ocr_prompt_version IS NOT NULL)),
  CHECK ((state IN ('ready', 'partial') AND published_at IS NOT NULL) OR
         (state IN ('building', 'failed') AND published_at IS NULL))
) STRICT;

CREATE TABLE media_projection_heads (
  projection_id TEXT PRIMARY KEY,
  artifact_id TEXT NOT NULL UNIQUE,
  generation_id TEXT NOT NULL,
  revision INTEGER NOT NULL DEFAULT 0 CHECK (revision >= 0),
  updated_at TEXT NOT NULL,
  FOREIGN KEY (artifact_id) REFERENCES media_artifacts(artifact_id),
  FOREIGN KEY (projection_id, generation_id, artifact_id)
    REFERENCES media_projection_generations(projection_id, generation_id, artifact_id)
) STRICT;

CREATE TABLE media_descriptors (
  generation_id TEXT PRIMARY KEY,
  projection_id TEXT NOT NULL,
  artifact_id TEXT NOT NULL,
  name TEXT NOT NULL,
  summary TEXT NOT NULL,
  media_kind TEXT NOT NULL CHECK (media_kind IN ('photo', 'chart', 'diagram', 'screenshot', 'illustration', 'other')),
  subjects_json TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(subjects_json)),
  setting TEXT NOT NULL,
  purpose TEXT NOT NULL,
  composition_json TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(composition_json)),
  visible_text_likelihood REAL NOT NULL CHECK (visible_text_likelihood BETWEEN 0.0 AND 1.0),
  ocr_recommended INTEGER NOT NULL CHECK (ocr_recommended IN (0, 1)),
  visible_text_reason TEXT NOT NULL,
  confidence REAL NOT NULL CHECK (confidence BETWEEN 0.0 AND 1.0),
  created_at TEXT NOT NULL,
  FOREIGN KEY (projection_id, generation_id, artifact_id)
    REFERENCES media_projection_generations(projection_id, generation_id, artifact_id)
) STRICT;

CREATE TABLE media_tags (
  generation_id TEXT NOT NULL,
  projection_id TEXT NOT NULL,
  artifact_id TEXT NOT NULL,
  ordinal INTEGER NOT NULL CHECK (ordinal >= 0),
  namespace TEXT NOT NULL,
  value TEXT NOT NULL,
  PRIMARY KEY (generation_id, namespace, value),
  UNIQUE (generation_id, ordinal),
  FOREIGN KEY (projection_id, generation_id, artifact_id)
    REFERENCES media_projection_generations(projection_id, generation_id, artifact_id)
) STRICT;

CREATE TABLE media_ocr_results (
  generation_id TEXT PRIMARY KEY,
  projection_id TEXT NOT NULL,
  artifact_id TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('skipped', 'completed', 'failed')),
  text_body TEXT,
  text_hash TEXT,
  regions_json TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(regions_json)),
  language TEXT,
  confidence REAL CHECK (confidence IS NULL OR confidence BETWEEN 0.0 AND 1.0),
  error_code TEXT,
  error_message TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (projection_id, generation_id, artifact_id)
    REFERENCES media_projection_generations(projection_id, generation_id, artifact_id),
  CHECK ((status = 'completed' AND text_body IS NOT NULL AND text_hash IS NOT NULL) OR
         (status IN ('skipped', 'failed') AND text_body IS NULL AND text_hash IS NULL))
) STRICT;

CREATE TABLE media_vectors (
  generation_id TEXT PRIMARY KEY,
  projection_id TEXT NOT NULL,
  artifact_id TEXT NOT NULL,
  provider TEXT NOT NULL,
  model TEXT NOT NULL,
  dimensions INTEGER NOT NULL CHECK (dimensions > 0),
  vector_blob BLOB NOT NULL,
  vector_hash TEXT NOT NULL,
  vector_norm REAL NOT NULL CHECK (vector_norm >= 0.0),
  created_at TEXT NOT NULL,
  FOREIGN KEY (projection_id, generation_id, artifact_id)
    REFERENCES media_projection_generations(projection_id, generation_id, artifact_id)
) STRICT;

CREATE TABLE media_corpus_generations (
  corpus_generation_id TEXT PRIMARY KEY,
  corpus_id TEXT NOT NULL,
  build_key TEXT NOT NULL,
  embedding_provider TEXT NOT NULL,
  embedding_model TEXT NOT NULL,
  embedding_dimensions INTEGER NOT NULL CHECK (embedding_dimensions > 0),
  state TEXT NOT NULL CHECK (state IN ('building', 'ready', 'failed')),
  created_at TEXT NOT NULL,
  published_at TEXT,
  UNIQUE (corpus_id, corpus_generation_id),
  UNIQUE (corpus_id, build_key),
  CHECK ((state = 'ready' AND published_at IS NOT NULL) OR
         (state IN ('building', 'failed') AND published_at IS NULL))
) STRICT;

CREATE TABLE media_corpus_heads (
  corpus_id TEXT PRIMARY KEY,
  corpus_generation_id TEXT NOT NULL,
  revision INTEGER NOT NULL DEFAULT 0 CHECK (revision >= 0),
  updated_at TEXT NOT NULL,
  FOREIGN KEY (corpus_id, corpus_generation_id)
    REFERENCES media_corpus_generations(corpus_id, corpus_generation_id)
) STRICT;

CREATE TABLE media_corpus_members (
  corpus_generation_id TEXT NOT NULL,
  corpus_id TEXT NOT NULL,
  ordinal INTEGER NOT NULL CHECK (ordinal >= 0),
  projection_id TEXT NOT NULL,
  projection_generation_id TEXT NOT NULL,
  PRIMARY KEY (corpus_generation_id, projection_id),
  UNIQUE (corpus_generation_id, ordinal),
  FOREIGN KEY (corpus_id, corpus_generation_id)
    REFERENCES media_corpus_generations(corpus_id, corpus_generation_id),
  FOREIGN KEY (projection_id, projection_generation_id)
    REFERENCES media_projection_generations(projection_id, generation_id)
) STRICT;

CREATE TABLE media_lattice_nodes (
  corpus_generation_id TEXT NOT NULL,
  corpus_id TEXT NOT NULL,
  node_id TEXT NOT NULL,
  level INTEGER NOT NULL CHECK (level >= 0),
  centroid_blob BLOB NOT NULL,
  centroid_hash TEXT NOT NULL,
  member_count INTEGER NOT NULL CHECK (member_count > 0),
  created_at TEXT NOT NULL,
  PRIMARY KEY (corpus_generation_id, node_id),
  FOREIGN KEY (corpus_id, corpus_generation_id)
    REFERENCES media_corpus_generations(corpus_id, corpus_generation_id)
) STRICT;

CREATE TABLE media_lattice_memberships (
  corpus_generation_id TEXT NOT NULL,
  corpus_id TEXT NOT NULL,
  parent_node_id TEXT NOT NULL,
  member_kind TEXT NOT NULL CHECK (member_kind IN ('descriptor', 'node')),
  member_key TEXT NOT NULL,
  descriptor_projection_id TEXT,
  descriptor_generation_id TEXT,
  child_node_id TEXT,
  position INTEGER NOT NULL CHECK (position >= 0),
  distance REAL NOT NULL CHECK (distance >= 0.0),
  PRIMARY KEY (corpus_generation_id, parent_node_id, member_kind, member_key),
  UNIQUE (corpus_generation_id, parent_node_id, position),
  FOREIGN KEY (corpus_generation_id, parent_node_id)
    REFERENCES media_lattice_nodes(corpus_generation_id, node_id),
  FOREIGN KEY (corpus_generation_id, child_node_id)
    REFERENCES media_lattice_nodes(corpus_generation_id, node_id),
  FOREIGN KEY (descriptor_projection_id, descriptor_generation_id)
    REFERENCES media_projection_generations(projection_id, generation_id),
  FOREIGN KEY (corpus_id, corpus_generation_id)
    REFERENCES media_corpus_generations(corpus_id, corpus_generation_id),
  CHECK ((member_kind = 'descriptor' AND
          descriptor_projection_id IS NOT NULL AND descriptor_generation_id IS NOT NULL AND
          child_node_id IS NULL AND
          member_key = descriptor_projection_id || ':' || descriptor_generation_id) OR
         (member_kind = 'node' AND
          descriptor_projection_id IS NULL AND descriptor_generation_id IS NULL AND
          child_node_id IS NOT NULL AND member_key = child_node_id))
) STRICT;

CREATE TABLE media_level_indexes (
  corpus_generation_id TEXT NOT NULL,
  corpus_id TEXT NOT NULL,
  level INTEGER NOT NULL CHECK (level >= 0),
  entry_node_id TEXT NOT NULL,
  node_count INTEGER NOT NULL CHECK (node_count > 0),
  max_neighbors INTEGER NOT NULL CHECK (max_neighbors > 0),
  distance_metric TEXT NOT NULL CHECK (distance_metric IN ('cosine', 'dot', 'euclidean')),
  PRIMARY KEY (corpus_generation_id, level),
  FOREIGN KEY (corpus_id, corpus_generation_id)
    REFERENCES media_corpus_generations(corpus_id, corpus_generation_id),
  FOREIGN KEY (corpus_generation_id, entry_node_id)
    REFERENCES media_lattice_nodes(corpus_generation_id, node_id)
) STRICT;

CREATE TABLE media_build_attempts (
  attempt_id TEXT PRIMARY KEY,
  branch TEXT NOT NULL CHECK (branch IN ('descriptor', 'ocr', 'corpus')),
  build_key TEXT NOT NULL,
  attempt_number INTEGER NOT NULL CHECK (attempt_number > 0),
  artifact_id TEXT,
  projection_id TEXT,
  corpus_id TEXT,
  state TEXT NOT NULL CHECK (state IN ('queued', 'running', 'succeeded', 'failed')),
  provider TEXT,
  model TEXT,
  request_digest TEXT NOT NULL,
  error_code TEXT,
  error_message TEXT,
  started_at TEXT,
  finished_at TEXT,
  created_at TEXT NOT NULL,
  UNIQUE (branch, build_key, attempt_number),
  FOREIGN KEY (artifact_id) REFERENCES media_artifacts(artifact_id),
  CHECK ((branch IN ('descriptor', 'ocr') AND artifact_id IS NOT NULL AND projection_id IS NOT NULL AND corpus_id IS NULL) OR
         (branch = 'corpus' AND artifact_id IS NULL AND projection_id IS NULL AND corpus_id IS NOT NULL)),
  CHECK ((state IN ('succeeded', 'failed') AND finished_at IS NOT NULL) OR
         (state IN ('queued', 'running') AND finished_at IS NULL))
) STRICT;

CREATE INDEX media_policy_changesets_revision
  ON media_policy_changesets(singleton_key, revision DESC);
CREATE INDEX media_policy_changesets_submission
  ON media_policy_changesets(client_request_id, request_digest);
CREATE INDEX media_artifacts_source_version
  ON media_artifacts(source_version_id, source_hash);
CREATE INDEX media_artifacts_source
  ON media_artifacts(source_id, created_at DESC, artifact_id);
CREATE INDEX media_projection_heads_artifact
  ON media_projection_heads(artifact_id, generation_id);
CREATE INDEX media_projection_generations_build
  ON media_projection_generations(build_key, state, created_at DESC);
CREATE INDEX media_descriptors_generation
  ON media_descriptors(projection_id, generation_id, artifact_id);
CREATE INDEX media_tags_identity
  ON media_tags(generation_id, namespace, value);
CREATE INDEX media_tags_lookup
  ON media_tags(namespace, value, generation_id);
CREATE INDEX media_ocr_results_artifact_recent
  ON media_ocr_results(artifact_id, created_at DESC, generation_id);
CREATE INDEX media_vectors_identity_hash
  ON media_vectors(provider, model, dimensions, vector_hash);
CREATE INDEX media_corpus_members_projection
  ON media_corpus_members(projection_id, projection_generation_id, corpus_generation_id);
CREATE INDEX media_lattice_nodes_level
  ON media_lattice_nodes(corpus_generation_id, level, node_id);
CREATE INDEX media_lattice_memberships_identity
  ON media_lattice_memberships(corpus_generation_id, member_kind, member_key);
CREATE INDEX media_lattice_memberships_parent
  ON media_lattice_memberships(corpus_generation_id, parent_node_id, position);
CREATE INDEX media_lattice_memberships_member
  ON media_lattice_memberships(descriptor_projection_id, descriptor_generation_id, corpus_generation_id);
CREATE INDEX media_level_indexes_lookup
  ON media_level_indexes(corpus_generation_id, level, entry_node_id);
CREATE INDEX media_build_attempts_key_branch
  ON media_build_attempts(build_key, branch, attempt_number DESC);
CREATE INDEX media_build_attempts_status
  ON media_build_attempts(state, created_at, attempt_id);
```
The schema contains sixteen tables and nineteen explicit indexes. Source identities cross the Sources boundary through `ImageSourceReader`; the repository verifies exact Source bytes before it admits an artifact. Polymorphic lattice members are constrained structurally in SQL and validated semantically by the repository.
Policy CAS uses a guarded singleton update. Projection and corpus publication each insert a complete immutable generation, then update the corresponding head with an expected revision. A failed build never changes the readable head.
## Retrieval and OCR admission
Media search embeds the query through Platform Intelligence, requires an exact vector identity match, descends only the Media lattice, and returns descriptor metadata plus an `originalImageRef`. Opening that reference always resolves the pinned Source version.
`OcrProjectionReader` exposes literal OCR text, text hash, Source identity, generation identity, and normalized image regions. Knowledge admits that output through its own Job and tables. Generated descriptor text never enters Knowledge through this port.
## Rebuildable outputs
1. **Media descriptor projection** — structured descriptor, tags, inference provenance, and one vector per admitted image generation.
2. **Media descriptor lattice** — corpus generations, nodes, memberships, and level entry records over descriptor vectors.
3. **OCR text projection** — literal text and region locators exposed to Knowledge.
Only the Media policy and its ChangeSets are canonical mutable state. Every other Media table rebuilds from immutable Source bytes plus pinned policy and Intelligence identities.
## Invariants
1. Every artifact pins one immutable image Source version.
2. Search indexes generated interpretation; open returns the original image.
3. OCR stores literal visible text and exact image-region locators.
4. Media vectors and Knowledge vectors never share a corpus or lattice table.
5. Vector comparisons require equal provider, model, and dimensions.
6. The visible-text assessment drives `auto`; `never` and `always` remain deterministic.
7. Descriptor success with OCR failure is explicit partial success.
8. Invalid signatures and configured byte or pixel limits fail before provider submission.
9. An unchanged build identity reuses its existing generation.
10. Failed rebuilds leave prior heads readable.
11. Logs exclude image bytes, OCR bodies, provider payloads, and signed material.
## Acceptance criteria
- An image is searchable by descriptor and opens the exact Source image.
- Descriptor output is labeled generated interpretation.
- All three OCR policy modes have distinct, testable results.
- OCR admitted to Knowledge preserves Source and image-region provenance.
- Re-ingesting an unchanged build identity reuses the generation.
- Changing only OCR identity rebuilds only the OCR branch.
- All derived Media state can be deleted and regenerated from Sources and pinned identities.
## References
- [Architecture — Icarus Ideal Backend Runtime, Capabilities & Data Map](../runtime/backend-map.md)
- [Model — Media Capability & Descriptor Lattice](https://app.notion.com/p/3acb6410e50281dfa3abd6a5ed892917)
- [Design — Multi-Lattice Ingestion Architecture](https://app.notion.com/p/3acb6410e50281bf8f16ec589da555d3)
