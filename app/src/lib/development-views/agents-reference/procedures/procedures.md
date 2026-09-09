# Agents reference procedures

`navigation.ts` is the page records and the root a project's pages hang under.
`questions.ts` is the numbered decisions, each with what was built and the
alternative. `plan.ts` is the phases and the files each touched, with the last
phase being what remains.

The `*-spec.ts` files and `research-chat-chains.ts` / `research-chat-diagrams.ts`
hold what the four specification pages describe: the procedure chains and the
mermaid sources. They are data rather than components because the same chain is
read twice — once as a card and once as a diagram — and because a chain that
drifts from the code should be one edit to correct.
