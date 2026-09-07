# variables

The names a project's formulas can say, and what each one holds.

Three procedures. `readVariables` hands back every variable in the scope's
project. `saveVariable` creates one or replaces the value, type and description
of the one with that name. `removeVariable` takes one away by name.

**A name is the key.** A variable is project scoped and its name is unique
inside that project, so save is an upsert on the name rather than on a row id.
The id still exists and is still what a back reference points at; nothing outside
this capability needs to know it.

**A name is checked before it is stored, not when a formula meets it.** Letters,
digits and underscore, never leading with a digit, never shaped like a cell
address, and never a word the grammar spends. A variable called `B4` could not be
said out loud in a formula, so it is refused at creation.

**A declared type is a promise the value has to keep.** `any` promises nothing.
Anything else is checked against the value's kind on the way in, so a formula can
be told what a name will be before it runs.

**A refusal is an answer, not a throw.** `saved: false` with a reason a surface
can show. Only a genuine fault throws.
