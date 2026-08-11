# ContextAttachments.svelte

The chat-scoped attachments block inside the Context disclosure: File / Folder pickers plus
the attached list. Omega feeds a text attachment to the turn as context.

- **Capability degrade** — behind Omega's Files capability; when
  `$aiAgent.attachmentsUnavailable`, the whole block is one honest notice ("Attachments aren't
  enabled on this server.") rather than buttons that would fail.
- **Hidden pickers** — the buttons forward to `sr-only` file inputs. `webkitdirectory` is set
  imperatively on the folder input because it is not in the HTML attribute types. Each input
  clears its `value` after handing files to `attachFiles`/`attachFolder`, so re-picking the
  same file still fires `change`.
- **Chat-scoped** — both buttons are disabled with a "Start a chat to attach files." hint until
  a chat exists, because the attachment POST needs a chat id.
- The attached list shows each name (full `relativePath` in the `title`) with a remove button
  per row.
