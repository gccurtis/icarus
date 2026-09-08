# resource-sets

The project's resource sets: the scopes a prompt looks things up in.

| procedure | answers |
| --- | --- |
| `readResourceSets` | Every valid **named** set in the scoped project, with its creator's name and how many resources it selects now, plus quarantined invalid rows |
| `createResourceSet` | A set from a name, an optional description, and an include and exclude list |
| `updateResourceSet` | A compare-and-swap change to name, description, or the set itself |
| `removeResourceSet` | A compare-and-swap delete, refused while another set or a template hole's default in this project still names it |

A set is `include` minus `exclude`. A term selects the whole project, a list of
resource kinds matched by segment, named resources, or another set by id. The
count each set reports is resolved when it is read, over the documents, decks,
spreadsheets, findings and research threads the project holds — never stored,
so it cannot go stale. A template's staged copy is left out of that catalogue.

**A row carries a name or an owner, and never both or neither.** A named row is
a project subject: people make it here, it is listed here, and every builder
offers it. A row with `boundTo` instead is a value something else holds, written
because the rule could not be said inline — it is never listed, never named, and
goes when its owner goes. These procedures only ever make and change named rows;
the bound ones belong to whichever capability owns the thing that points at them.

Every stored row is re-admitted before projection or mutation. A malformed row
is quarantined from the list and refused by update and remove, so one corrupt
row cannot take the rest down. A set that would include itself is refused.
