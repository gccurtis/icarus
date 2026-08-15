# View Document Templates

These templates are the documentation inputs for the view generators. Copy the
template into its destination and substitute the view name before adding
view-specific content.

| Template | Destination | Created when |
| --- | --- | --- |
| [view.md](view.md) | View root | Every view |
| [components.md](components.md) | `components/components.md` | The first child component is created |
| [interactions.md](interactions.md) | `interactions/interactions.md` | The first interaction is created |
| [effects.md](effects.md) | `effects/effects.md` | The first effect is created |
| [shared.md](shared.md) | `shared/shared.md` | Shared view state is created |
| [procedures.md](procedures.md) | `procedures/procedures.md` | The first general procedure is created |

## Substitutions

| Variable | Meaning | Example |
| --- | --- | --- |
| `{{View Name}}` | Human-readable title | `Document Editor` |
| `{{view-name}}` | Kebab-case directory and root filename | `document-editor` |

The generator substitutes these variables. Remaining decisions are written as
`TODO` so `rg TODO` finds every unfinished part of a generated document.

## Rules

- The view root and each present concern directory have one document.
- Nested component, interaction, effect, and procedure directories have no
  documents. Their root concern document carries the complete tree.
- Keep every required heading. Write `None` when a section does not apply.
- Trees and tables name real paths. Renaming code requires updating its owning
  document.
- The block between the `generated:inventory` markers is maintained by
  `pnpm new-view-part`. Everything outside the markers is authored by hand.
- `docs/` contains supporting material that belongs to no one concern directory
  and therefore has no structural template.
