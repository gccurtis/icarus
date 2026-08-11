# etc/

Miscellaneous files that configure or accompany the application but are not code.

Today this holds the default configuration manifest:

- [`config.yaml`](config.yaml) — the single source of runtime configuration for
  the core. It is loaded by the composition layer at startup (override the path
  with the `TAURUS_OMEGA_CONFIG` environment variable). The schema and built-in
  defaults live in [`core/platform/config`](../core/platform/config).
