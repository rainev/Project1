# Memory — this project's durable learnings

One line per learning, newest last. The file it names holds the whole of it.

Traps that belong to the FRAMEWORK, not to this app, ship with the release and
live in `.app-stack/docs/learnings/`. Read those before debugging App-Stack
behaviour; write here only what is true of this application.

- [Page requires projects one model](page-requires-projects-one-model.md) — why each owner-maintained model has its own page; a lookup rendering as a text box
- [BoardScreen cannot send requirements](board-screen-cannot-send-requirements.md) — the board sorts by `title` and can't collect a step's count; use Tabs of DataGrids
- [Refuse with a field error](refuse-with-a-field-error.md) — `{ deny }` shows "forbidden"; throw ValidationFailure; hook paths and hook order
- [Grid dialog covered on phone](grid-dialog-covered-on-phone.md) — at 390px Confirm hides under the pinned column; record steps on the detail page
- [Run environment](run-environment.md) — bun ≥ 1.4, no `t:` keys without languages, stopping the server
