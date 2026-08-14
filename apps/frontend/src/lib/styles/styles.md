# Styles

`app.css` is the only application entry. Its imports expose the full process:

```text
chromatic themes -> semantic sets -> canonical tokens -> integrations
```

Themes define material, sets assign identity, and tokens name stable jobs.
Everything before `tokens/` is private. Integrations translate the complete
`--token-*` API into external vocabularies without adding design meaning.

Application code may use canonical tokens or integration-provided classes. It
must not import stage files or reference `--palette-*`, `--theme-*`,
`--chromatic-*`, or `--semantic-*`. The palette demo is the sole diagnostics
reader of palette values.

Directory shape, dependency direction, registration, and consumer boundaries
are enforced by `pnpm lint:styles`.
