# Screens

A page is a tree of components named by string in view config. Sixteen are registered; config names
one, the registry resolves it, `ConfigNode` renders it. Nothing is imported by a screen directly,
and there is no screen written for a particular model.

```yaml
node:
  type: PageShell
  props: { title: Notes, subtitle: Rendered from config. }
  children:
    - type: SessionBar
    - type: Navigation
    - type: DataGrid
      props:
        model: note
        columns: [{ field: title, label: Title }]
```

Every prop below is checked at boot where it names something: an unknown component, a field a model
does not have, a model that does not exist, a duplicate route, a tied `navOrder`
([01-configuration-and-boot.md](01-configuration-and-boot.md)).

**Until the UI package is typed (WP-07), these tables are the contract.** They are generated from
`defineProps` and gated — see the bottom of this document.

## Shell and chrome

### `PageShell`

| Prop | Type | |
|---|---|---|
| `title` · `subtitle` · `body` | `string` | optional |
| `eyebrow` | `string` | optional |
| `eyebrowVariant` | `'plain' \| 'pill'` | optional |
| `eyebrowIcon` | `string` | optional |
| `display` | `'lg' \| 'md' \| 'plain'` | optional |
| `rule` | `boolean` | optional |
| `actions` | `{ label: string; href: string; emphasis?: string }[]` | optional |
| `width` | `string` | optional — a name (`prose` `app` `wide` `full`) or any CSS length |
| `measure` | `string` | optional |
| `gutter` | `string` | optional |
| `insetGutter` | `boolean` | optional |
| `pad` | `string` | optional |
| `rhythm` | `boolean` | optional — default `true` |
| `columns` | `{ ratio?: string; sticky?: boolean }` | optional |
| `heroMin` · `heroClose` · `heroRatio` | `string` | optional |
| `heroRule` | `boolean` | optional |
| `backdrop` | `boolean \| 'hero' \| 'page'` | optional |
| `brand` | `{ logo?, wordmark?, tagline?, backHref?, backLabel?, backIcon?, backFirst? }` | optional |

The frame every page uses. Children render inside it.

**`insetGutter` decides what `width` means.** Outside (the default) keeps the measure honest, so
`width: 1400px` lays out on 1400px. Inside makes `width` the outer frame, so content runs
`width - 2 × gutter` and stops widening once the viewport passes the frame.

**`rhythm: false` plus `pad`** is for a page that is one centred card rather than a sequence of
sections. Omitting `brand` omits the header rather than drawing an empty bar.

`backdrop: 'hero'` confines the grid and glow to the first fold; `'page'` runs them behind the whole
document. `heroClose` and `heroRule` are the space and the rule a hero ends with — they belong to the
hero, not to the rhythm of whatever follows.

### `SessionBar`

| Prop | Type | |
|---|---|---|
| `session` | `{ id: string; roles: string[]; orgId: string }` | injected |

Never written in config. `createAppStack` injects the session into any `SessionBar` node it finds.

### `Navigation`

| Prop | Type | |
|---|---|---|
| `items` | `{ label: string; href: string; id: string }[]` | injected |
| `currentId` | `string` | injected |

Also injected, from the pages this actor can reach. Navigation is a projection, not a client rule.

### `Prose`

| Prop | Type | |
|---|---|---|
| `heading` | `string` | optional |
| `body` | `string` | optional |
| `items` | `unknown[]` | optional |

Static copy. The one component with no model behind it.

### `Dashboard`

| Prop | Type | |
|---|---|---|
| `title` | `string` | optional |
| `description` | `string` | optional |
| `columns` | `number` | optional |

A grid container for tiles. Each child is filtered independently by the projection, so a tile the
actor may not read is absent rather than empty.

### `LoginScreen`

| Prop | Type | |
|---|---|---|
| `hint` | `string` | optional |
| `mode` | `'login' \| 'register'` | optional; `register` creates an account (WB-001) |
| `doneHref` | `string` | optional; navigate here on success instead of reloading |

## Reading data

### `ListScreen`

| Prop | Type | |
|---|---|---|
| `model` | `string` | **required** |
| `columns` | `{ field: string; label: string }[]` | **required** |
| `limit` | `integer` | optional — 1–500 |

A plain read-only list; `DataGrid` is what a real list page uses. **It cannot link a row** — for a
list that reaches a detail page, use `DataGrid` and its `rowHref`. The schema above was added after a
declaration passed boot carrying `rowHref` here and silently did nothing.

### `DataGrid`

| Prop | Type | |
|---|---|---|
| `model` | `string` | **required** |
| `columns` | `{ field: string; label: string; sortable?: boolean }[]` | **required** |
| `pageSize` | `number` | optional |
| `pageSizes` | `number[]` | optional — sizes a reader may choose between |
| `filterField` | `string` | optional — the field the search box filters with `contains` |
| `filter` | `Record<string, string \| number \| boolean>` | optional — equality filters fixed by config, merged into every query |
| `rowHref` | `string` | optional — makes the first column a link, `:field` substituted from the row |
| `editHref` | `string` | optional — link template for editing; shown only if permitted |
| `rowActions` | `{ op: string; label: string; icon?: string; title?: string; description?: string; when?: { state: string \| string[] } }[]` | optional — custom operations per row, `when` narrowing one to the rows its lifecycle admits |
| `editIcon` | `string` | optional — the icon on the built-in Edit link, by name from `icons.yaml` |
| `deleteIcon` | `string` | optional — the icon on the built-in Delete action |
| `deletable` | `boolean` | optional — offer Delete per row |
| `selectable` | `boolean` | optional — row selection and bulk operations |

TanStack Table in manual mode: the server sorts, filters, counts and pages, and the grid keeps a
**cursor stack** so "previous" works without offsets. Relation columns are resolved by
`resolveLookups`, coalesced into one `where=id:in:…` request per lookup column per page.

`filter` is how a master-detail page scopes a list to its parent — `filter: { customerId: $id }`,
with `$id` substituted from the route. **The server still applies scope and the gates**; this
narrows, it never widens.

`rowActions` build their dialog from the action's `x-require`: `pin` requires `reason` and gets a
text box, `setStatus` requires `status` — an enum — and gets a select, through the same renderers
the forms use. Every action, configured or built in, is offered only when the projection says this
actor may perform the operation, and the server re-checks regardless. Bulk delete goes through
`/v0/batch`, so it is one transaction.

**The actions column is pinned** (`position: sticky; right: 0`), so it stays in view however wide the
table is. It has to be: the data table is exempt from the 320px reflow rule and scrolls inside its
own region, which is right for the data and would otherwise push the controls off-screen — measured
at 1280, four of the notes grid's five actions were outside the visible region (AUD-200).

**An action may be drawn as an icon** — `icon: pin`, a name from the app's `icons.yaml`. `label` stays
the accessible name and becomes the hover title, because `Icon` is `aria-hidden` and an icon-only
button with no `aria-label` announces as "button" and nothing else. Icons are what make the pinned
column affordable: on the notes grid the five actions went from 330px of text to 214px, giving the
data back 116px of a 1022px view. `editIcon` and `deleteIcon` do the same for the two built-ins.

`rowActions[].when` narrows one further, to the rows whose state admits it — `when: { state:
[payment_pending, needs_review] }` offers Confirm on those rows and nowhere else. Same grammar as a
node's `when` ([11-projection-and-frontend.md](11-projection-and-frontend.md)), and the state names
are cross-checked against the model's `x-states` at boot. It is judged in the grid rather than in
the projection, because the subject is a row the server already sent; a node's condition is judged
on the server because the subject is the record the page is about. **Presentation either way** — the
transition's own `from` and `access` refuse the move whether or not a button was drawn.

### `DetailScreen`

| Prop | Type | |
|---|---|---|
| `model` | `string` | **required** |
| `id` | `string` | **required** — usually `$id` from the route |
| `title` | `string` | optional |
| `backHref` | `string` | optional |

Renders the properties of the derived schema that are present in the row — so a field this actor may
not read is absent from both.

### `FormScreen` — `browseField`

| Key | | |
|---|---|---|
| `field` | **required** | the property chosen by browsing |
| `channel` | **required** | the channel whose listing is shown |
| `session` | **required** | the row that channel belongs to — `-` for a `$base` channel |
| `model`, `label` | optional | default the form's model, and the field name |

The field leaves the form body and becomes a value plus a **Choose…** button; the button opens a
`FileTree` over that channel, and picking sets the value. A path typed into a text box asks
someone to be a shell, and a typo comes back as a refusal from the server rather than as a folder
they can see is wrong.

`session: "-"` is for a channel rooted at `$base`, which reads no row. That is the only answer
that works when the row being created is the one that would have held the path.

### `FileTree`

| Prop | Type | |
|---|---|---|
| `session` | `string` | **required** — the row whose channel this is, usually `$id` |
| `channel` | `string` | optional — default `files` |
| `model` | `string` | optional — default `session` |
| `label` | `string` | optional — the header above the tree |
| `select` | `file` \| `directory` | optional — what a click announces (default `file`) |

Lists a project over a `files` or `browse` channel. **It knows no path and no root**: it asks the
channel to list `.`, and every path it shows afterwards came back from the server — so what can be
reached here is decided by the channel's containment, not by this component. Directories are
listed on first expand, not up front, because a tree that walks a whole project to draw its first
row is slow exactly where the project is large.

Selecting announces the path to the rest of the page; `FileEditor` listens. With
`select: directory` and a `browse` channel it becomes a project picker — the same component, with
the narrower channel supplying the narrower power.

### `FileEditor`

| Prop | Type | |
|---|---|---|
| `session` | `string` | **required** |
| `channel` | `string` | optional — default `files` |
| `model` | `string` | optional — default `session` |
| `rows` | `integer` | optional — visible rows, 4–200 (default 20) |

Reads and saves the file `FileTree` announced, over the same channel. It holds no path of its own.
A save outside the channel's root is refused by the server, and **that refusal is shown** — a save
that silently did nothing is worse than one that failed loudly.

### `Tabs`

| Prop | Type | |
|---|---|---|
| `tabs` | `array` of `{ id, label }` | **required** — `id` matches a child's `slot` |

Regions behind a tab strip. A child lands in one by declaring `slot:` — the mechanism views
already use, so a tab list and the children it labels cannot silently disagree; a region with no
child renders nothing. **A panel stays mounted once shown**, hidden rather than unmounted: behind
a tab may sit a terminal holding a live socket or an editor holding unsaved text, and switching
tabs is not a reason to drop either.

### `Drawer`

| Prop | Type | |
|---|---|---|
| `title` | `string` | **required** |
| `collapsed` | `boolean` | optional — start closed |
| `side` | `left` \| `right` | optional — default `right` |

A collapsible panel that holds declared children. `Disclosure` is the text version (a summary and
a body string); this is the container version, for a properties panel beside a workbench.
Collapsing hides and does not unmount, for the same reason as `Tabs`.

### `Terminal`

| Prop | Type | |
|---|---|---|
| `session` | `string` | **required** — the row whose channel this is, usually `$id` from the route |
| `channel` | `string` | optional — the channel's name on the model (default `terminal`) |
| `model` | `string` | optional — the model declaring it (default `session`) |
| `rows` | `integer` | optional — visible rows, 4–200 (default 24) |

Draws a declared `x-channels` channel and forwards keystrokes to it. **No command and no path appear
here**: the program comes from the row's provider field, resolved against the framework's own
provider list, and the working directory comes from the row's root field, contained against the
server's `--workspace-base` before anything starts. A denial closes the channel with a reason and
starts no process.

The component opens the socket in two steps — fetch a single-use token over the HTTP surface, then
present it on the upgrade — because a WebSocket upgrade is a GET and browsers do not apply
same-origin policy to `new WebSocket()`. A dropped socket rejoins the **same** live process and
replays the recent output, so a reconnect is not a restart.

It sets `customGlyphs`, without which box-drawing characters render as disconnected fragments in a
system webview — and a TUI is mostly box drawing.

**Keys.** `Ctrl+C` is never intercepted, on any platform: it reaches the program as the interrupt.
Copy is `⌘C` on macOS and **`Ctrl+Shift+C`** elsewhere; paste is `⌘V` / `Ctrl+Shift+V`, and pasted
text is sent as ordinary input. Some terminals copy with a bare `Ctrl+C` when a selection exists;
this one does not, because a forgotten selection would turn an interrupt into a silent copy — in
front of an agent that is the wrong trade.

### `TimelineScreen`

| Prop | Type | |
|---|---|---|
| `model` | `string` | **required** |
| `id` | `string` | **required** — usually `$id` from the route |
| `title` | `string` | optional |

What the framework recorded about one row: `_audits` says what was attempted and how it ended,
`_outbox` says what that caused afterwards. Both tables are `_`-prefixed and generic dispatch refuses
them, so this reads the **`history` operation** — a builtin, gated by the model's own
`x-access.read`, scoped, and phase-two'd on the row. A record this actor may not read has no timeline
either, and a row in another tenant is a `404`.

It renders names, ids and outcomes and never a field VALUE, which is the rule that keeps values out
of `_audits.fields` in the first place — so a timeline on a detail page raises no second policy
question. A scheduled run shows as `schedule:<model>.<name>` rather than as a person, because no
person did it.

### `ChartScreen`

| Prop | Type | |
|---|---|---|
| `model` | `string` | optional — source A: one model, counted by one of its fields |
| `groupBy` | `string` | optional — with `model` |
| `query` | `string` | optional — source B: a declared query |
| `params` | `Record<string, string \| number \| boolean>` | optional — for `query` |
| `labelKey` | `string` | optional — which column labels, when the default is wrong |
| `valueKey` | `string` | optional — which column is measured |
| `kind` | `'bar' \| 'line' \| 'pie'` | optional |
| `label` | `string` | optional — the label axis's heading |
| `measureLabel` | `string` | optional |
| `title` | `string` | optional |

Inline SVG over `aggregate` or a declared query, with an always-present table beside it — a chart
that cannot be read by a screen reader is not a chart.

### `ReportScreen`

| Prop | Type | |
|---|---|---|
| `query` | `string` | **required** — the `$id` of a query in `config/queries/` |
| `title` | `string` | optional |
| `description` | `string` | optional |
| `pageSize` | `number` | optional |
| `params` | `Record<string, string \| number \| boolean>` | optional — parameter values fixed by config; a reader's inputs merge over these |
| `filters` | `{ param: string; label: string; placeholder?: string }[]` | optional — parameters the reader may set |
| `exportable` | `boolean` | optional — offer the CSV of exactly this report |

The columns, their headings and their order come from the query's own `columns` metadata, so a
report is declared once and rendered from that declaration ([06-persistence.md](06-persistence.md)).

## Writing data

### `FormScreen`

| Prop | Type | |
|---|---|---|
| `select` | `string[]` | optional — enum fields to render as a native `<select>` |
| `requiredMarks` | `boolean` | optional — default `true` |
| `surface` | `boolean` | optional — default `true` |

`select` is for a list a reader picks from rather than searches; the filterable combobox earns its
keep on a long one. `requiredMarks: false` suits a panel that has already said "all fields are
required". `surface: false` renders the form bare, for a page that brings its own card.

| Prop | Type | |
|---|---|---|
| `model` | `string` | **required** |
| `op` | `string` | optional — the operation to derive the schema for |
| `id` | `string` | optional — with one, the form loads that row and submits `update` |
| `fields` | `string[]` | optional — which fields, in order |
| `layout` | `({ row: string[] } \| { group: string; fields: string[] } \| { field: string })[]` | optional — wins over `fields` |
| `multiline` | `string[]` | optional — render as a textarea |
| `rules` | `{ field, effect: 'SHOW'\|'HIDE'\|'ENABLE'\|'DISABLE', when: { field, equals?, oneOf?, exists? } }[]` | optional |
| `submitLabel` | `string` | optional |
| `title` | `string` | optional |
| `doneHref` | `string` | optional — where to go once the form saves, on create as well as edit; `:field` substituted from the response |
| `step` | `number` | optional — this form's position in a multi-page flow |
| `of` | `number` | optional — how many pages the flow has |

`doneHref` fires on a **create** as well as an edit, with `:field` substituted from the record the
server returned — `/payment/:id` lands on the row that was just made, which is the only moment its
id first exists. A placeholder the response does not answer does not navigate: a literal
`/payment/:id` in the address bar looks like a page and is not one.

`step` and `of` render the flow position as `of` segments with the first `step` filled by
`--gradient-rule`. Both or neither; each page states where it sits, because none of them knows about
the others.

Everything about how it builds itself is in [12-forms.md](12-forms.md).

### `WizardScreen`

| Prop | Type | |
|---|---|---|
| `model` | `string` | **required** |
| `steps` | `{ title: string; fields: string[] }[]` | **required** |
| `title` | `string` | optional |
| `submitLabel` | `string` | optional |

One `create`, split across steps by swapping the UI schema. A rejected submit returns to the step
carrying the field error — which is exactly the swap that exposed the index-keying defect in the
layout renderers (AUD-056, [12-forms.md](12-forms.md)).

### `BoardScreen`

| Prop | Type | |
|---|---|---|
| `model` | `string` | **required** — and it must declare `x-states`, or boot refuses the view |
| `title` | `string` | optional |
| `laneLimit` | `number` | optional |

**A board is the model's lifecycle, drawn.** The lanes are `x-states.values` in declaration order,
and the buttons on a card are the transitions legal from the state *that card is in* — both read
from the per-actor projection (`modelFacts(model).states`), which carries only the moves this actor
may perform. So an illegal move has nothing to render, and a move the gate would refuse is not
projected at all. One `list` per lane; a move is the transition's own operation, so the gates, the
hooks and the audit record apply exactly as they would to an API call, and the server's refusal —
wrong state, missing requirement, or policy — is shown in `[data-testid="board-error"]`.

It took `groupBy` and `moveOp` props until WP-06. That made every lane adjacent to every other one:
the arrows moved a card one column left or right whatever the model said, and a move the server
would refuse was offered anyway.

Keyboard-operable: every move is a focusable button naming its destination.

### `ConfirmAction`

| Prop | Type | |
|---|---|---|
| `model` | `string` | **required** |
| `op` | `string` | **required** |
| `id` | `string` | **required** |
| `label` | `string` | **required** |
| `title` | `string` | optional |
| `description` | `string` | optional |

Not in the registry — `DataGrid` builds one per row action. The dialog's fields come from the
action's `x-require` set in the projection, rendered with the form renderers.

## Layout primitives

**A layout is an arrangement of these.** Reach for a composite in *Content* below only when the same
thing repeats — a row of cards, a checklist — and never to obtain a shape. A page that needs a
two-column split with a sticky aside is `Row` and two `Stack`s, not a new component.

`Stack`, `Row` and `Box` take children; the rest are leaves.

Three conventions run through the whole set, so they are stated once here rather than in nine tables:

- **`offset`** is the space *above* an element. The reference these were built against spaces each
  element itself — `mt-5`, `mt-7`, `mt-8` — so a single uniform stack gap lands a column wrong.
- **`scale`** names a step on the type ramp and sets size **and** line-height together, because they
  are one decision. `scaleUp` is the step from 640px up, for `text-4xl sm:text-6xl`.
- **`measure` / `center`** cap a width and centre it in the space given.

### `Stack`

| Prop | Type | |
|---|---|---|
| `gap` | `string` | optional |
| `align` | `string` | optional |
| `justify` | `string` | optional |
| `pad` | `string` | optional |
| `measure` | `string` | optional |
| `center` | `boolean` | optional |
| `offset` | `string` | optional |
| `width` · `height` | `string` | optional |
| `radius` | `string` | optional |
| `background` · `gradient` · `shadow` | `string` | optional |
| `border` | `boolean \| 't' \| 'b' \| 'l' \| 'r' \| 'x' \| 'y'` | optional |
| `borderInk` | `string` | optional |
| `divide` | `boolean` | optional |
| `anchor` | `string` | optional |
| `column` · `place` | `string` | optional |

A column. `divide` draws a rule between each pair of children and never above the first. `anchor`
is the id a link scrolls to. `column` and `place` position it inside a parent `Row`'s tracks, and
apply only from `md` up — a `grid-column-start` on a one-column grid creates an implicit column and
pushes every sibling past the grid's width.

### `Row`

| Prop | Type | |
|---|---|---|
| `tracks` | `string \| { sm?: string; md?: string; lg?: string }` | optional |
| `gap` | `string` | optional |
| `align` · `justify` | `string` | optional |
| `pad` | `string` | optional |
| `wrap` | `boolean` | optional |
| `offset` | `string` | optional |
| `measure` | `string` | optional |
| `center` | `boolean` | optional |
| `background` · `radius` | `string` | optional |
| `border` | `boolean \| 't' \| 'b' \| 'l' \| 'r' \| 'x' \| 'y'` | optional |
| `borderInk` | `string` | optional |
| `clip` | `boolean` | optional |

**A row is a flex row until it declares `tracks`**, which make it a grid: one column stacked, the
split from the width named. A bare string means "from `md`"; a mapping names the breakpoint each
track list begins at, because one breakpoint for every grid puts columns on where the design is
still stacked.

A row paints. Hairlines between cards are 1px grid gaps showing the row's own ground through, not
borders on each card, which would double where they meet.

### `Box`

| Prop | Type | |
|---|---|---|
| `tone` | `'hero' \| 'plain' \| 'invert' \| 'band' \| 'gradient' \| 'card'` | optional |
| `pad` · `radius` · `measure` · `align` | `string` | optional |
| `offset` | `string` | optional |
| `width` · `height` | `string` | optional |
| `background` · `gradient` · `shadow` | `string` | optional |
| `border` | `boolean \| 't' \| 'b' \| 'l' \| 'r' \| 'x' \| 'y'` | optional |
| `borderInk` | `string` | optional |
| `blur` | `string` | optional |
| `clip` · `relative` · `center` · `lift` | `boolean` | optional |
| `bleed` | `boolean` | optional |
| `anchor` · `column` · `place` | `string` | optional |

A surface. `tone` takes a named surface from the theme; `background` and `gradient` take any value.
`bleed` spans the page — measured against the page's own width, not `100vw`, which includes the
scrollbar and centres the band on a different axis from every other section. `lift` is the hover a
card answers with.

### `Text`

| Prop | Type | |
|---|---|---|
| `text` | `string` | **required** |
| `scale` · `scaleUp` | `string` | optional |
| `size` · `weight` · `leading` · `tracking` | `string` | optional |
| `transform` · `align` · `measure` | `string` | optional |
| `offset` | `string` | optional |
| `center` · `mono` | `boolean` | optional |
| `ink` | `string` | optional |
| `strike` | `boolean` | optional |
| `strikeInk` · `strikeWidth` | `string` | optional |

A paragraph. `ink` is a colour outside the `tone` vocabulary, for copy a design tints itself. A
newline in `text` renders as a line break. `strikeInk` and `strikeWidth` exist because a struck
price is struck in a different colour and weight in different places.

### `Heading`

| Prop | Type | |
|---|---|---|
| `text` | `string` | **required** |
| `level` | `number` | optional |
| `display` | `'lg' \| 'md' \| 'plain' \| 'none'` | optional |
| `scale` · `scaleUp` | `string` | optional |
| `size` · `leading` · `weight` · `tracking` | `string` | optional |
| `align` · `measure` | `string` | optional |
| `center` | `boolean` | optional |
| `tone` | `'ink' \| 'canvas' \| 'muted'` | optional |
| `offset` | `string` | optional |

`display` takes a display step from the theme; `none` takes none, leaving `scale` or `size` to
govern. `[[marked]]` inside `text` fills those words with the text gradient and leaves the rest
plain — which is a different thing from filling the whole heading. A newline renders as a break.

### `Badge`

| Prop | Type | |
|---|---|---|
| `text` | `string` | **required** |
| `icon` | `string` | optional |
| `tone` | `'pill' \| 'plain'` | optional |
| `offset` | `string` | optional |

`pill` is a bordered chip; `plain` is the section eyebrow, taking its size, weight, tracking and ink
from the theme's eyebrow tokens.

### `Action`

| Prop | Type | |
|---|---|---|
| `label` · `href` | `string` | **required** |
| `emphasis` | `'primary' \| 'secondary' \| 'invert' \| 'outline'` | optional |
| `icon` | `string` | optional |
| `offset` | `string` | optional |

A link styled as a control. It does not decide its own alignment — whatever it is placed in does.

### `Media`

| Prop | Type | |
|---|---|---|
| `src` · `alt` | `string` | **required** |
| `bloom` | `boolean` | optional |
| `shadow` · `radius` · `measure` | `string` | optional |
| `offset` | `string` | optional |

An image, optionally over a blurred brand bloom.

### `Quote`

| Prop | Type | |
|---|---|---|
| `text` | `string` | **required** |
| `size` · `measure` | `string` | optional |
| `ruleInk` | `string` | optional |
| `offset` | `string` | optional |

A pull quote with a rule down its leading edge.

### `Icon`

| Prop | Type | |
|---|---|---|
| `name` | `string` | **required** |
| `size` · `color` | `string` | optional |
| `tone` | `'ink' \| 'muted' \| 'accent' \| 'canvas'` | optional |
| `weight` | `string` | optional |
| `animate` | `'bounce' \| 'pulse' \| 'spin'` | optional |
| `offset` | `string` | optional |

An icon a view places itself, rather than one a component draws. The vocabulary is the app's, in
`config/icons.yaml` — see [`01-configuration-and-boot.md`](01-configuration-and-boot.md#iconsyaml--the-icon-vocabulary). An icon
declares the **shapes** that draw it, not only path data, because a circle approximated as a path is
a different drawing.

### `Decor`

| Prop | Type | |
|---|---|---|
| `top` · `right` · `bottom` · `left` | `string` | optional |
| `width` · `height` · `radius` | `string` | optional |
| `ink` · `gradient` · `blur` · `opacity` | `string` | optional |

A decorative layer inside a `relative` box — a blurred corner disc, a gradient hairline. Inert by
construction: no text, no children, no pointer events, hidden from the accessibility tree.

### `Disclosure`

| Prop | Type | |
|---|---|---|
| `summary` · `body` | `string` | **required** |
| `measure` · `icon` | `string` | optional |
| `offset` | `string` | optional |

A native `<details>`: opens without script, keyboard-operable and announced as a disclosure, and
survives with JavaScript off.

## Content

The components a public page is built from ([11-projection-and-frontend.md](11-projection-and-frontend.md)).
Both **declare their props**, so a misspelled or malformed one fails at boot naming the node — see
"Typed props" below.

### `ContentSection`

| Prop | Type | |
|---|---|---|
| `eyebrow` | `string` | optional — small label above the heading |
| `heading` | `string` | optional |
| `standfirst` | `string` | optional — one line under the heading |
| `body` | `string` | optional — blank lines separate paragraphs; **nothing else is interpreted** |
| `actions` | `{ label: string; href: string; emphasis?: 'primary' \| 'secondary' }[]` | optional |
| `align` | `'start' \| 'center'` | optional |
| `tone` | `'hero' \| 'plain'` | optional |
| `badge` | `string` | optional — a pill above the heading, where `eyebrow` is bare text |
| `display` | `'lg' \| 'md'` | optional |
| `ratio` | `string` | optional — the split between the heading column and the body |
| `rule` | `boolean` | optional |
| `icon` · `iconColor` | `string` | optional |
| `pad` · `radius` · `background` | `string` | optional |
| `border` | `boolean \| string` | optional |
| `bleed` | `boolean` | optional |

`body` is plain text rendered as text nodes — deliberately not Markdown and deliberately not
`v-html`. Config is codebase-owned and as trusted as code, but the same component renders a field
off a row the moment anyone points it at one, and a row is data. Rich text needs a dependency or a
hand-written subset *plus* sanitisation on the model-fed path; that is a decision with a §18
argument attached, not something to slip in behind a `v-html`.

### `ContentCards`

| Prop | Type | |
|---|---|---|
| `items` | `Item[]` | **required** |
| `eyebrow` · `heading` · `standfirst` | `string` | optional |
| `variant` | `'number' \| 'hairline' \| 'icon' \| 'check' \| 'plain'` | optional |
| `columns` | `1 \| 2 \| 3 \| 4` | optional |
| `display` | `'lg' \| 'md'` | optional |
| `itemHeading` | `'h3' \| 'h4' \| 'none'` | optional |
| `ratio` · `pad` · `radius` · `background` · `tone` | `string` | optional |
| `border` | `boolean \| string` | optional |
| `bleed` | `boolean` | optional |
| `icon` · `iconColor` | `string` | optional |
| `cardPad` · `gap` · `itemRadius` · `markerStyle` · `itemBorder` | `string` | optional |

**The repeated small thing** — a card grid, a numbered process, a checklist. Use it when the same
shape repeats and the only difference between items is their content. A one-off arrangement is
`Row` and `Stack` from *Layout primitives*, not a `variant` added here.

### `ContentStats`

| Prop | Type | |
|---|---|---|
| `items` | `Item[]` | **required** |
| `eyebrow` · `heading` | `string` | optional |
| `columns` | `1 \| 2 \| 3 \| 4` | optional |
| `variant` | `'plain' \| 'card'` | optional |

A row of label/value tiles. A tile's value is either authored in config or read from a declared
query, which is the difference between a marketing strip and an operator's KPI row.

### `ContentMedia`

| Prop | Type | |
|---|---|---|
| `src` · `alt` | `string` | **required** |
| `eyebrow` · `heading` · `standfirst` | `string` | optional |
| `surface` | `'plain' \| 'panel' \| 'inset' \| 'bloom'` | optional |
| `size` | `'sm' \| 'md' \| 'lg' \| 'full'` | optional |
| `download` · `openLabel` | `string` | optional |

An image with a treatment and optional actions — `download` and `openLabel` matter for something a
reader has to save or open full size on a phone. The file comes from the app's own asset directory,
so a view references `/assets/…` and the app declares nothing but the file.

### `ContentList`

| Prop | Type | |
|---|---|---|
| `model` | `string` | **required** |
| `titleField` | `string` | **required** — the heading of each entry |
| `summaryField` | `string` | optional |
| `dateField` | `string` | optional |
| `hrefTemplate` | `string` | optional — `:field` substituted from the row, like the grid's `rowHref` |
| `limit` | `number` | optional |
| `sort`, `dir` | `string`, `'asc' \| 'desc'` | optional |
| `heading` | `string` | optional |
| `emptyText` | `string` | optional |

Rows of a model rendered as content rather than as a grid. `DataGrid` is the right component for an
operator — sorting, filtering, cursor paging, row actions, selection — and a public index wants none
of it. It reads through the same `dispatch`, so **there is no "public read" path**: a visitor sees
what `x-access.read` and `x-scope` say a visitor sees, and a refusal renders the empty state rather
than a stack trace.

## Typed props

A component may declare what its props must look like, and then they are validated **at boot**:

```ts
// packages/ui/src/component-names.ts
export const COMPONENT_PROPS = { ContentSection: { … }, ContentList: { … } };
```

The app hands that to `createApp` beside the names, so core validates views without importing the UI
package — the same seam that already carries `COMPONENT_NAMES`. A malformed prop fails naming the
node:

```text
view error in views/public-home.yaml: node/children/1 props: / must NOT have additional properties
view error in views/public-home.yaml: node/children/2 props: /limit must be integer
```

**Declaring is optional and partial on purpose.** A component with no entry is validated no further
than the view meta-schema, which is where all sixteen were until now — so this arrives one component
at a time rather than as a flag day. Node `props` are still copied to the browser wholesale
(AUD-065); what a schema adds is that the ones a component declares must be right.

## Administration

### `MembersScreen` · `OrgScreen`

| Prop | Type | |
|---|---|---|
| `title` | `string` | optional |
| `description` | `string` | optional |

The only screens that talk to `/v0/auth/*` rather than to generic dispatch, because members, invites
and org settings are framework system models and dispatch refuses those by design
([10-auth-and-sessions.md](10-auth-and-sessions.md)). They re-check nothing on trust; the server
refuses regardless, and the `adminRefusal` gate feature drives the API directly to prove it.

## Internal components

Not registered, so config cannot name them.

| Component | Props |
|---|---|
| `ConfigNode` | `node` — `{ type: string; props?: Record<string, unknown>; children?: any[] }` |
| `FieldShell` | `id` (string), `label` (string?), `required` (boolean?), `error` (string?) |
| `Combobox` | `id`, `modelValue`, `displayValue`, `options`, `disabled`, `invalid`, `describedBy`, `loading`, `placeholder`, `emptyText`, `note` |

`Combobox` is the one shared by `EnumControl` and `LookupControl` ([12-forms.md](12-forms.md)). It
takes props rather than `rendererProps()` because it is not a JSONForms renderer — it knows nothing
about schemas, and a caller wires it to one.

Every form control and layout under `packages/ui/src/forms/` takes JSONForms' own
`rendererProps()` instead of props of its own — see [12-forms.md](12-forms.md).

## How to verify this layer

That these tables are **complete** is checkable, and is the gate for this document:

```sh
bun run verify:docs                          # this gate and every other
bun docs/stack/checks/screen-props.ts
# 38 components, 318 props, 0 missing from the document.
```

It extracts every `defineProps<{…}>()` from every component in `packages/ui/src` and fails on any
prop name this document does not carry. A prop added to a screen and not to the table shows up as a
miss.

Then drive the screens, because most of the defects in these components were invisible in the source
and obvious in a browser:

```sh
bun run build:web
bun run verify:browser              # every feature
bun run verify:browser -- forms     # one
```

A full run drives **33 features, 266 checks, all passing** — measured 2026-09-17 on integrated
`master`, from a clean database.

WP-08 alone measured 27 features, 172 pass and **1 fail** — `actions` → "a required enum renders as
a select" read the dialog's options before `ConfirmAction` had finished fetching its schema, while
the two checks either side of it proved the control was there and the value reached the server. That
was a racing assertion rather than a defect in a screen, and the combobox change closed it by
replacing the read with one that waits for an *option* instead of for the dialog.

## Related

[12-forms.md](12-forms.md) · [11-projection-and-frontend.md](11-projection-and-frontend.md) ·
[04-dispatch-and-pipeline.md](04-dispatch-and-pipeline.md) · [14-verification.md](14-verification.md) ·
`ARCHITECTURE.md` §19

---

_Checked against the code 2026-09-16_ — every `.vue` file under `packages/ui/src`,
`packages/ui/src/registry.ts`, `component-names.ts`, `packages/core/src/projection.ts`,
`apps/showcase/config/views/`.
