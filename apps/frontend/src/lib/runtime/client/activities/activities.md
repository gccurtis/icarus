# Activities

What the context panel's rail offers for whatever the active tab holds, and which
of them that tab chose.

Named for what it is rather than for the panel it drives. It was `context`, which
collided with Svelte's own `getContext` and — once panel geometry moved out to
the components — no longer described anything but this projection.

## It holds no state

Every value reads through the workbench. That is why this is a plain `.ts` rather
than `.svelte.ts`: reading `$state` through a getter tracks correctly wherever the
read happens, so a component consuming this stays reactive without this owning a
single field.

Worth preserving. The moment this file needs `$state`, something is in the wrong
place — per-tab choices belong to the workbench, and panel geometry belongs to the
component that enforces the drag.

## It takes the workbench rather than importing it

That is what lets two instances exist independently, and what stops this being
the file that quietly reintroduces a singleton. It is guarded like the objects it
projects over even though it holds nothing itself, because a server-side instance
would close over a workbench that must not exist there either.

## Falling back rather than throwing

A tab's stored `activityId` can outlive a change to the activity set. `active`
falls back to the kind's first activity, because a reset rail is a harmless
outcome where a crash is not. `select()` does throw — that is a caller passing an
id the kind never offered, which is a bug rather than drift.

## The registry is static and frozen

What a kind offers is a property of that kind, not something assembled at
runtime. `Record<ResourceKind, …>` rather than a partial map, so adding a kind
fails to compile until it has a rail.

Module scope is safe for it because it is an immutable map of stateless component
references — which stops being true the day it gains a `register()`. The freeze
is the reminder as much as the guard.
