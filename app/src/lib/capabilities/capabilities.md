# capabilities

The one crossing. A capability is what a view is allowed to ask, and the only
route from a surface to stored state.

**One directory per subject, entered at its index.** A capability that crosses to
the server is `index.remote.ts`, and callers name that file — a directory import
resolves to `index.ts`, which SvelteKit does not transform into remote functions.

**A capability exists once it answers something.** There are no placeholders: a
directory holding an empty index is a door with nothing behind it, and it reads
as built to everything that looks at the tree.

The current subject inventory is:

- `agents` owns personas, tasks, automations and the activity they leave behind;
- `comments` owns comment threads and their messages;
- `derived-output` owns grounded prompt results and refresh work;
- `development` owns explicitly non-production fixtures;
- `document` owns document resources and revisions;
- `external-files` owns the project-scoped External library, strict file admission,
  virtual directory projection, lifecycle history, reference-safe management,
  and semantic outbox intents for supported native files;
- `project` owns Project Overview summaries, history, people, comments, and resource metadata;
- `project-resources` projects the resources visible in one project;
- `research-chat` owns research threads, the turns that answer them, and the run in flight;
- `resource-sets` owns named reusable resource scopes;
- `semantic-overlay` owns semantic translation, material profiles, indexes, and synchronization;
- `slide-deck` owns slide-deck resources and revisions;
- `spreadsheet` owns spreadsheet resources, cells, formatting, formulas, and revisions;
- `store` exposes scoped reads of represented data;
- `templates` owns templates, stages, holes, and instantiation;
- `variables` owns project-scoped named values;
- `workspace` reads and writes the workspace state a person has per project.

What the views call and nothing provides is a compile error naming the missing
module, which is the honest form of the same list a tree of empty directories was
keeping.
