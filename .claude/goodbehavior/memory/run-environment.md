---
name: run-environment
description: Local run facts — bun ≥ 1.4 for the lockfile, no languages block means no t: keys, restart after every config change
metadata: { type: gotcha }
---
- **bun ≥ 1.4.** The kit's `bun.lock` is lockfileVersion 2. bun 1.3.11 ignores it, deletes it, and
  links nothing ("No packages!"). bun 1.4.2 installs cleanly with `--frozen-lockfile`. Install
  links packages inside `.app-stack/packages/*/node_modules`, not at the root.
- **English only means no catalogue.** With no `languages` block in `app.yaml`, a `t:key` renders
  literally ("t:nav.home"). This app writes every label in the view.
- **Stopping the server.** `pkill -f` with a pattern that also appears in the calling command
  kills the calling shell (exit 144). Stop it from a script whose own command line lacks the pattern.
