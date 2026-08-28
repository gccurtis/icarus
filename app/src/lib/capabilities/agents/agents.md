# agents

Personas and Automations: who the agents are, and the standing rules that ask
them for things.

Two subjects in one capability because they meet at one point — a rule dispatches
to a persona, and the reason a rule cannot fire is almost always a permission on
the persona it names. Splitting them would put that answer in neither.

Serves `docs/screen-panel-views/{context,inspector}/agents/`.

**It answers from sample rows.** `index.ts` holds the stubs a panel calls; there
is no `api/` yet, so nothing here reaches the store.
