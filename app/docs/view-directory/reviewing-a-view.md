# Reviewing a View

`pnpm lint:views` checks the structure. These are the items it cannot.

1. **Does it know the application exists?** A view reads the client model, calls
   a capability browser door, or owns state coordinating the tree it renders.
   Something that only takes props and renders them belongs in its parent's
   `components/`, or in `simple-components/` / `unique-components/`.

2. **Did a promoted child earn its own directory?** A view holding a root
   component and nothing else is a file in its parent's tree.

3. **Was the state classified at the right lifetime?** State one component needs
   stays in that component. State that must survive the view, coordinate several
   views, or be persisted belongs in `model/client/`. `shared/` is only for what
   dies with this mounted instance.

4. **Is each interaction named for intent rather than its event?** An interaction
   named for a DOM event has usually kept mechanics that belong in the component.

5. **Does each effect name what it observes and who cleans it up?** An effect
   whose document cannot say is either a disguised interaction or synchronizing
   something nobody asked for.

6. **Is `procedures/` a set of named operations rather than a drawer?** A
   procedure named for its shape rather than its job is a `utils/` file under
   another name.

7. **Is the key mapping total in both directions?** A key with no component, and
   a component no key reaches, are both defects.

8. **Is every rendered state the surface can reach documented?** Loading, empty,
   stale, failure, denied — an unlisted failure state is usually an unhandled one.

9. **Is an interaction's failure path tested, not only its success path?** An
   optimistic update with no tested rollback is an untested corruption.

10. **Is `shared/` proven independent across two mounts?** A singleton leak is
    invisible until a test mounts twice, mutates one, and asserts the other is
    unchanged.

11. **Did a value graduate to `styles/semantic-tokens/` for a real reason?** One zone
    reading its own width many times is still view geometry.

12. **Does each document say anything?** A document that restates its code has
    failed; one that contradicts its code is worse than none.
