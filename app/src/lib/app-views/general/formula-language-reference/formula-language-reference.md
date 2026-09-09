# Formula language reference

Lives at `src/lib/app-views/general/formula-language-reference/`, because
`/app/[project]/reference/**` is a production route. What it draws with is the
`reference` vocabulary in `components/authored`.

Seven pages about one language: what a formula can answer with, how a table is
sliced by position and by meaning, what a reference is and how it expands, how a
refusal behaves, what the evaluator does today, and what a variable is.

Written to be argued with, and argued with. Every page carries what review
settled and why, including what was rejected, and every claim about the code
names the file it came from, so a reader can check rather than believe. What the
settled design costs the representation is listed on the As built page: five
changes, approved and not yet made.

`procedures/` holds the content as data and decides nothing. `components/` renders
it. Served under `/app/<project>/reference/formulas` with the variables page at
`/app/<project>/reference/variables`.

The suite header is rendered by the route rather than by a page, because the
appearance it switches between is a property of the document and belongs to
whoever owns the document. The header sets the choice and never applies it.
