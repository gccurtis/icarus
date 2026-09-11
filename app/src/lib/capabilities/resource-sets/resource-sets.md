# resource-sets

The project's resource sets: the scopes a prompt looks things up in.

| procedure | answers |
| --- | --- |
| `readResourceSets` | Every **named** set in the scoped project, with its creator's name and how many resources it selects now; any non-current stored row fails the read boundary |
| `createResourceSet` | A set from a name, an optional description, and an include and exclude list; references to missing, private, foreign, ambiguous, or cyclic sets are refused |
| `updateResourceSet` | A compare-and-swap change to name, description, or the set itself, with the same recursive reference checks |
| `removeResourceSet` | A compare-and-swap delete, refused while another set or a template slot's default in this project still names it |

A set is `include` minus `exclude`. A term selects the whole project, a list of
resource kinds matched by segment, named resources, or another set by id. The
count each set reports is resolved when it is read, over the documents, presentations,
spreadsheets, findings and research threads the project holds — never stored,
so it cannot go stale. A template's staged copy is left out of that catalogue.

**A row carries a name or an owner, and never both or neither.** A named row is
a project subject: people make it here, it is listed here, and every builder
offers it. A row with `boundTo` instead is a value something else holds, written
because the rule could not be said inline — it is never listed, never named, and
goes when its owner goes. These procedures only ever make and change named rows;
the bound ones belong to whichever capability owns the thing that points at them.

Every complete table image is re-admitted before projection or mutation. A
malformed or duplicate row is current-store corruption and fails the boundary;
it is never hidden, repaired, or interpreted as an older shape. A resource
owner carries the exact nominal `ResourceRef` (`kind` and matching row id), so
the same id text under another resource kind cannot claim its private row.
Generic scope resolution indexes only admitted, uniquely identified named rows;
an unnamed row can be expanded only by the capability that proves its exact
owner. Set references are checked recursively, so direct and indirect cycles
and every ownership or project boundary are refused before a write.
