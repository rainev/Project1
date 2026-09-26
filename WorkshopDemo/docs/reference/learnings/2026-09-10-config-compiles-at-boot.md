---
name: config-compiles-at-boot
description: Config is compiled once at startup, so editing YAML has no effect until the server restarts
metadata: { type: gotcha }
---
Models, gates and the UI projection are all compiled during `createApp` — deliberately, so a broken
config fails startup rather than a request. The consequence is that **editing any file under
`config/` does nothing until the process restarts**, including the view config that is injected into
the served HTML.

Cost 2026-09-10: view config gained a chart and a grid, the bundle was rebuilt, and the browser kept
rendering the previous screen. Nothing errored — the running server was simply still serving the
projection it compiled at boot, so the symptom looked like a stale bundle or a broken component.

**How to detect / apply:** after any `config/**` edit, restart the server before drawing conclusions
from the browser. There is no watch mode yet; if config editing becomes frequent, that is the fix.
