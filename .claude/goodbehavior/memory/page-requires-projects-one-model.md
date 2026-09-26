---
name: page-requires-projects-one-model
description: A model's lookups, operations and transitions reach the browser only for a model named in some page's `requires`; a page names one
metadata: { type: gotcha }
---
The first Setup page carried a greenhouse form and an area form with no `requires`. It booted
cleanly, but the area form's `greenhouseId` rendered as a plain text box instead of the lookup
picker. The server projects model facts (`ops`, `lookups`, `states`) only for the models named by
a visible page's `requires`, and `requires` is one string
(`.app-stack/packages/core/src/projection.ts`, the `named` set).

**Why:** without the facts, a lookup is a text box, a grid has no Delete, and a lifecycle has no
buttons, and nothing errors.

**How to apply:** give each model the owner maintains its own page with `requires: <model>`. That is
why this app has `/setup/greenhouses` and `/setup/areas` rather than one Setup page.
