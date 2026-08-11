# 0128 — Running the whole suite found two real bugs under four stale tests

The intelligence group had been run constantly; the rest of the suite had not.
Running `./dev-test/run.sh all` produced six failures. Four were tests that had
drifted behind the code. Two were product defects that no unit test could see.

## Bug 1 — every unknown URL answered 409, not 404

The `names` suite asked for an endpoint that does not exist and expected 404.
It got `409 {"error":"select a project first"}`.

Echo's `Group` registers its own catch-all route (`/*`) carrying the group's
middleware, so that group middleware still runs for paths the router does not
match. Both of our groups are declared with an **empty prefix**, so those
catch-alls span the entire API surface, and the last one registered wins. The
practical effect: any unknown URL anywhere in the API was answered by
`requireProject` — a typo'd path reported on the caller's session state instead
of reporting that the address does not exist.

`New` now registers its own `/*` after the groups, returning a 404 JSON body.
The reasoning is recorded in the route file and its companion, because the line
looks removable and is not.

## Bug 2 — a heading rendered its own marker as content

The `agents` suite asserted a heading atom reading `The Clockmaker's Orchard`
and got `# The Clockmaker's Orchard`.

`newTextRow` takes structure from the model's `kind` and passes the markdown to
`ParseBlockMarkdown`, which handles **inline** spans only. A model writing
markdown naturally writes the block marker too — kind `heading_1` *and* text
`# Title` — so the marker survived into the atom and the heading carried it
twice: once as structure, once as content.

`stripBlockMarker` removes only the marker the declared kind already expresses:
any depth of `#` run followed by whitespace (the kind, not the hash count,
decides the level), and a leading `>` for a quote. A paragraph about
`#hashtags` keeps its text, and `#nospace` is untouched, because a marker is
only a marker when whitespace follows it. It takes the model-facing kind rather
than the stored sub-kind, since `quote` is stored as body text and by then the
intent is gone.

## The four stale tests

| Suite | Drift |
| --- | --- |
| `references` | Sent `kind:"paragraph"`; the valid block kind is `text` |
| `resources` | Asserted only `["document"]` is creatable; connectors became a resource kind |
| `connectors` | Expected the bare connector id as a lattice source id, but sources are keyed **per file** (`connectorID` + separator + path, see `FileSourceID`) |
| `intelligence` | Used the free Nemotron embedding model, which intermittently returns an empty vector list — the same model removed from production config in [0127](0127-model-frontier.md) |

One more assertion was tightened rather than fixed: the `agents` story objective
asked for "at least 250 words" and the model wrote 239. A hard threshold on a
creative task with no headroom is a coin flip, so the objective now asks for 400
and the structural assertion keeps its 250 floor.

## The lesson worth keeping

Suites that run constantly stay honest; suites that do not, rot — and rot
silently, because a stale test fails for reasons that look like product bugs.
Four of these six had drifted, and the two genuine defects were sitting
underneath them where nobody would look. `all` is worth running on a schedule,
not only the group that happens to be under active development.

## Postscript: the word floor

Raising the objective from 250 to 400 words did not raise the output — three
runs against the same objective produced 239, 157 and 280 words. Length
adherence is sampled and is not what the assertion is for: the check exists to
prove the agent can author *structure* through the markdown tool path (a title,
several sections, inline emphasis landing as real blocks and marks), and the
structure came out right in every run. The floor now sits at 120 words, well
below the ask, as a proxy for "wrote prose, not a stub" — with the reasoning
written beside it so nobody later reads the low number as sloppiness.

## Postscript 2: the suites were not running the shipped basket

The first all-green run used gpt-4o-mini as primary, which matched production —
but its backup was `deepseek/deepseek-chat` and its embedding
`openai/text-embedding-3-small`, neither of which production uses after
[0127](0127-model-frontier.md). The suite defaults in `lib.sh` had simply not
been moved when the cast tables were rewritten, so a green run was quietly
weaker evidence than it appeared: it never exercised the shipped embedding model
or the shipped fallback.

The defaults now mirror the config (`openai/gpt-oss-120b` backup,
`qwen/qwen3-embedding-4b` embedding), and the full suite was re-run on that
exact basket: **all suites passed** (only `web` skips, which needs an external
endpoint). Worth stating as a rule: a test basket that drifts from the shipped
one turns a passing suite into a claim about a configuration nobody runs.
