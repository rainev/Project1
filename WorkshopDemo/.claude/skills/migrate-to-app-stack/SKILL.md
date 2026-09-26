---
name: migrate-to-app-stack
description: Transfer an existing site or app onto App-Stack — journeys mapped before pixels, a vocabulary check that may halt, then config. Use when a working product must be rebuilt as App-Stack configuration.
---

Take something that already works and express it as App-Stack configuration.

**This is a transfer, not a copy.** The target's markup, its component boundaries and its file layout
are how *it* solved the problem; App-Stack has its own vocabulary and will arrange the same result
differently. What must survive is the behaviour, the copy, and the journeys — not the DOM.

Pixel parity is how a faithful transfer is **proved**, at the end. It is not the objective, and
chasing it first is the mistake this skill exists to prevent.

**Loop position:** replaces *Understand* and *Audit* for a transfer, then hands its gap list to
`/roadmap-goodbehavior`. Per-item work is `/gate-build-goodbehavior` as usual.

**Vocabulary:** the framework is **App-Stack**. BlitzPi is the agent and governance layer around it.
Config is App-Stack config; never call the framework BlitzPi.

---

## Standing rules

Each one cost this framework real time.

- **The source is the authority; the rendered site is a fallback.** Ask for the repository, export or
  design file before reading a DOM. Rendered HTML has lost the intent — a `gap-6` that survived a
  refactor and a `gap-6` that was chosen read identically.
- **Never invent copy.** Not a heading, not a caption, not a confirmation message. Copy written from
  memory of a page you scrolled past is the defect that survives every visual check, because the
  page looks finished.
- **Only the deployed URL is evidence.** A localhost run proves nothing about what ships.
- **A transitioned property cannot be measured in a backgrounded tab.** It reports its start value
  indefinitely, and convincingly. Disable transitions before reading any style.
- **Config only.** No hardcoded content in a component, no one-off component to obtain a shape. A
  layout is an arrangement of primitives; reach for a composite only when the same arrangement
  repeats. See `.app-stack/docs/stack/13-screens.md`.

---

## Phase 0 — Find the source

**Ask for the source repository, export or design file before reading a single page.** Ask once,
plainly; if there genuinely is none, say so in the plan and work from the rendered site knowing the
intent is gone.

Produce a one-screen inventory: where the source lives, what builds it, which files hold the routes,
which hold the copy. **Name every page the target serves** — including the ones no link reaches,
which are usually confirmation and error states, and are usually the ones a transfer ships without.

## Phase 1 — Map the journeys, before any pixel

**A product is a set of journeys, not a set of pages.** For each actor the target serves, write the
path end to end: entry → each step → the state each step leaves behind → the terminal screen.

| | |
|---|---|
| **Screen** | the page or panel, and whether it exists in the target's source |
| **Actor** | who can reach it, and what makes them that actor |
| **State** | what must already be true for this step to render |
| **Effect** | what it writes, sends or changes |

**Walk each journey on the target itself, to its end.** A step that cannot be completed there — a
form that 404s, a confirmation nobody links to — is a finding **now**, not a discovery made three
days later while measuring the page above it.

Output: `docs/audit/<n>-journeys.md`. Every gap tagged P0/P1/P2 and `✔` or `⚠`.

## Phase 2 — Vocabulary check · **this phase may halt**

**Walk the target's classes and shapes through `.app-stack/docs/stack/15-mirroring.md` before transcribing
anything.** Collect the target's distinct utilities and layout shapes, look each up, write down what
it maps to.

Then produce **one list of everything that does not map**, and stop.

**Present that list as a decision, not as work already begun.** For each gap: what the target does,
what App-Stack has nearest, what closing it would cost. The user chooses — extend the framework,
accept an approximation, or drop the element.

**Do not extend the framework mid-phase because a wall appeared.** That reflex is what turns one
list into thirty undesigned primitives discovered one at a time. **Halting here with a list is
success.** Proceeding with an unread list is the failure.

Remember where the line is: `x-hooks` and `x-actions` are the supported escape hatch for app
behaviour. A missing component, prop or keyword is a **framework change** — fixed in app-stack,
released, and the version bumped in the app. Never a local patch, and in a packaged project not even
possible: the framework is extracted from a tarball on every build.

## Phase 3 — Transcribe

Only now write config. Per page, **in journey order** — phase 1 decides what gets built first, not
the visual prominence of a section.

- **Transcribe from the source file, open, section by section.** Not from a screenshot, not from
  memory of the section above.
- **Block style, always.** A comma inside a flow mapping ends the entry; an unquoted `#` starts a
  comment; a colon turns a list item into a mapping. Boot refuses all three by name now, but they
  are still easy to write.
- **Gate what only some actors see with `when:`.** A panel absent for the current actor never
  reaches the browser, so no comparison of two pages can see it — which is exactly why phase 4
  drives the journeys rather than only measuring.
- **Restart after every config change.** Config compiles at boot and only at boot.

`.app-stack/docs/stack/16-building-a-feature.md` crosses the layers in the order you work.

## Phase 4 — Verify, and drive

Two halves. **Neither substitutes for the other.**

**The page at rest** — `verify:parity <deployed> <reference>`. Compare the **deployed** URL. Expect
the section count to match before reading a single delta: a count mismatch means the selectors are
wrong, and a transfer's nesting rarely matches its source's, so reach for the `++` union operator
rather than for the config.

**The journeys in motion** — drive each one from phase 1 end to end, as its actor, on the deployed
app. Submit the form. Reach the confirmation. Read what the server actually recorded. A zero-delta
table over a journey that dead-ends measures the wrong thing.

---

## Definition of done

Every journey from phase 1 completes on the deployed app as its actor, every page it touches shows a
zero-delta parity table, and the phase-2 gap list is closed — each item either built, or recorded in
the backlog **as a decision the user made**. Then the user confirms.
