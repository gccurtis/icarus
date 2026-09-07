# resource-sets

The project's named resource sets: the scopes a prompt looks things up in.

| procedure | answers |
| --- | --- |
| `readResourceSets` | Every valid set in the scoped project, with its creator's name and how many resources it selects now, plus quarantined invalid rows |
| `createResourceSet` | A set from a name, an optional description, and an include and exclude list |
| `updateResourceSet` | A compare-and-swap change to name, description, or the set itself |
| `removeResourceSet` | A compare-and-swap delete, refused while another set or a template variable's default in this project still names it |

A set is `include` minus `exclude`. A term selects the whole project, a list of
resource kinds matched by segment, named resources, or another set by id. The
count each set reports is resolved when it is read, over the documents, decks,
spreadsheets, findings and research threads the project holds — never stored,
so it cannot go stale. A template's staged copy is left out of that catalogue.

Every stored row is re-admitted before projection or mutation. A malformed row
is quarantined from the list and refused by update and remove, so one corrupt
row cannot take the rest down. A set that would include itself is refused.
