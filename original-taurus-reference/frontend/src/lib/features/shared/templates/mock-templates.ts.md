# mock-templates.ts

The fixed **mock template catalog** behind the Templates rail panel and its Add-template modal:
six entries (four document, two slides), each `{id, name, description, kind}`, plus
`searchTemplates(query)` — case-insensitive substring match over name + description, blank
returns everything. Pure, so `mock-templates.test.ts` pins the search rules in node.

This file **is** the mock: when the template backend is designed (standalone request first, per
the playbook), it gets replaced by a real client and the panel/modal keep their shape.
