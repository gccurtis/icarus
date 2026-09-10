# store

The current table definitions and admission contracts. This directory owns no
open files, mutable Store instance, or persistence workflows.

| Home | Responsibility |
| --- | --- |
| `tables.ts` | Public table vocabulary, exported from the domain modules |
| `tables/{agents,collaboration,data,editors,foundations,investigation,semantic,templates,workspace}.ts` | Current row fields and branded row types, grouped by domain |
| `tables/names.ts` | Exact table-name vocabulary |
| `tables/registry.ts` | Compile-time mapping from table names to row fields |
| `schema/` | Required and optional field policies for each current table |
| `current-schema.ts` and `current-values.ts` | Exhaustive field-policy and recursive-value validator registries |
| `current-row.ts` | Exact current-row admission, including own keys and nested values |
| `admission.ts` | Canonical table names and row IDs |

The server Store model in `model/server/store/` owns loaded state and delegates
reads, writes, transactions, and journal recovery to its method modules. The
server runtime constructs that model using the configured data directory.
Transactions publish related table changes together; their durable journal
supports recovery after interrupted publication.

Only the current representation is admitted. Malformed rows and obsolete fields
are rejected at load, read, commit, and recovery boundaries. There are no schema
migrations or compatibility readers.
