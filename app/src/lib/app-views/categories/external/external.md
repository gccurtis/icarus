# External

External is the permanent project library for resources that do not have an
editor. This implementation manages files; Findings will join the same manager
later and are not represented by a placeholder control now.

The content surface is an inventory and ingestion surface. Selection keeps the
singleton tab and writes the file id to workspace focus plus `external.file`
inspection. The Inspector is the manager screen: local display rename,
confirmed deletion, provenance, byte identity, represented usage, safe download,
semantic lane state, deterministic profiles, and generated-summary review. It
never decodes a file into a format-specific editor.

Overview, Activity, and Policy context views remain project-wide and do not
follow selection. All data crosses the external-files capability; semantic
refresh crosses the semantic-overlay capability and then refreshes the same
external library/detail query keys.
