# Architecture pillars

The reference system at `/demo/architecture-pillars` decomposes the desired
state/behavior architecture into eight enforceable pillars. A pillar is an
equivalence class: its concrete infractions share one architectural rule, one
general repair, and one checker family.

Each pillar page records:

- the operational contract;
- one source-level infraction;
- why the current shape conflicts with the desired design;
- the general repair and important nuance;
- every proposed checker, its actual guarantee, current coverage, mechanism,
  implementation direction, and deliberate limit; and
- a rollout sequence linked to the state/behavior audit.

The checking-system page specifies the debt ratchet, enforcement layers,
checker result schema, CI policy, and build waves. The specifications do not
claim that missing or partial checkers have been implemented.
