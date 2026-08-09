# Database flows

## Endpoint and job ownership

Database registers no endpoints and creates no jobs. Every call originates inside `Knowledge`, itself called by Connector, General Files, or Derived Outputs jobs. The SQLite adapter neither selects queues nor constructs HTTP responses.

## Source add/replace

```mermaid
sequenceDiagram
  participant K as Knowledge.add
  participant S as SQLiteKnowledgeStore
  participant E as Embedder
  K->>S: getSource(sourceId)
  alt matching nonempty revision
    S-->>K: existing record
    K-->>K: skip all writes
  else ingest
    K->>S: getWindows(new content IDs)
    K->>E: embed only missing IDs
    K->>S: deleteWindowsForSource
    K->>S: putWindows (batch transaction)
    K->>S: deleteNodesForSource
    K->>S: putNodes (batch transaction)
    K->>S: list/read other source state
    K->>S: deleteCorpusNodes
    K->>S: putNodes (corpus batch)
    K->>S: putFrontier (replacement transaction)
    K->>S: putSource (upsert)
  end
```

The sequence is not enclosed in one transaction. Notably, the new source record is written after the corpus rebuild.

## Source removal

```mermaid
sequenceDiagram
  participant K as Knowledge.remove
  participant S as SQLiteKnowledgeStore
  K->>S: deleteWindowsForSource
  K->>S: deleteNodesForSource
  K->>S: deleteSource
  K->>S: listSources + node/window reads
  K->>S: deleteCorpusNodes
  K->>S: putNodes
  K->>S: putFrontier
```

Removal of an absent source still rebuilds the corpus tier. Because no foreign keys exist, Knowledge explicitly deletes dependent windows and nodes before the registry row.

## Retrieval

```mermaid
flowchart LR
  R[Knowledge.retrieve] --> F[getFrontier]
  F --> N[getNodes during descent]
  N --> W[getWindows for scoring/leaves]
  W --> A[assemble regions in memory]
```

`getLevelIndex` is not called by the current retrieval path. `topK` in Knowledge retrieval options is also not consumed. Descent makes repeated small node/window reads rather than one joined query.

## Scope resolution

For `Knowledge.resolveScope([])`, the adapter supplies all project source records through `listSources()`. For explicit entries, the resource resolver determines source IDs; the adapter is not consulted to prove that each resolved ID exists. The resulting manifest can therefore name a source not currently stored, which simply yields no windows after descent/filtering.

## Initialization

```mermaid
sequenceDiagram
  participant B as startBackend
  participant C as createKnowledge
  participant S as SQLiteKnowledgeStore
  participant DB as knowledge.db
  B->>C: projectId + Intelligence + Logger + resolver
  C->>S: new(projectId, ./data/knowledge.db)
  S->>DB: mkdir/open/pragmas/schema
  C-->>B: Knowledge(store, embedder, logger)
```

Schema setup is eager and can fail startup. It does not inspect or migrate existing table definitions.

## Test construction

There is no repository-provided temporary-database factory for this platform. A direct adapter test must create a unique temporary directory/database path, instantiate with an isolated project ID, call `close()`, and remove the temporary directory after the test. Current Knowledge-related tests generally replace the port with an in-memory object.
