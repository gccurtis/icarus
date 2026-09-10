export const STORE_GATES = [
  {
    path: ["model", "server", "store", "methods", "shared", "load.server.ts"],
    name: "load",
    required: /tables\.set\(table,\s*admitAnyRows\(table,\s*stored\)\)/,
    message: "the Store load path bypasses exact current-row admission"
  },
  {
    path: ["model", "server", "store", "methods", "shared", "state.ts"],
    name: "replaceRows",
    required: /const current = admitAnyRows\(table,\s*rows\)/,
    message: "the Store row-replacement path bypasses exact current-row admission"
  },
  {
    path: ["model", "server", "store", "methods", "transaction", "commit.server.ts"],
    name: "commit",
    required: /rows:\s*admitAnyRows\(table,\s*unit\.tables\.get\(table\) \?\? \[\]\)/,
    message: "the Store commit path bypasses exact current-row admission"
  },
  {
    path: ["model", "server", "store", "methods", "transaction", "journal.server.ts"],
    name: "recovery",
    required: /return admitAnyRows\(table,\s*value\)/,
    message: "the Store recovery path bypasses exact current-row admission"
  }
];
