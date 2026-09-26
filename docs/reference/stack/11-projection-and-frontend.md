# Projection and the frontend runtime

The browser never fetches an app **definition**. The server decides who the visitor is, builds
**that actor's** projection — facts, never rules — and injects it into the document it serves.

```text
GET /  ──▶ resolveActor(cookie) ──▶ projectApp(views, models, actor)
       ──▶ <script>window.__APP__={…}</script> spliced into </head>
       ──▶ Cache-Control: private, no-store · Vary: cookie
```

`GET /v0/app` answers with the same value, for the same actor, on the same two headers (WP-07
S-103). It exists for one reason: since navigation stopped being a document load, the page set has
to be refetched from the server that builds it, or it would freeze at first paint. It is not an app
definition — it is this actor's projection, the thing the document already carries.

The bundle is generic; the projection is not. Building it once at boot — which is what this did
until AUD-006 — handed every visitor, signed in or not, the whole app's page set.

## What crosses, and what cannot

The client receives **facts about this actor**, never the rules that produced them. Nothing
rule-shaped is sent, so nothing rule-shaped can be evaluated, tampered with, or read in DevTools.

```ts
interface AppProjection {
  title?: string;
  pages: { id; route; title?; nav?; navOrder?; node }[];
  models: Record<string, {
    ops: string[];                                        // what this actor may do
    required: Record<string, string[]>;                   // per op, for ops they have
    lookups: Record<string, { model; label }>;            // only targets they may READ
    uploads: Record<string, { accept; maxSize }>;         // only properties they may WRITE
    states?: {                                            // the lifecycle, if it declares one
      field; initial; values: string[];                   // the state field and its lanes
      transitions: Record<string, { from: string[]; to }>; // only moves they may PERFORM
    };
  }>;
}
```

Both copies are **whitelists**, not blacklists: `PAGE_KEYS` is `id`, `route`, `title`, `nav`,
`navOrder`; `NODE_KEYS` is `type`, `props`, `children`. A view's `requires` and `anonymous` are
deliberately absent — they are inputs to the projection, not facts about the actor.

Grepping the injected JSON for `x-access`, `x-scope`, `x-field-access`, `x-hooks`, `x-actions`,
`x-storage`, `x-encrypt`, `actor.roles` and `passwordHash` finds **zero** of each.

## Deny by default, in both directions

| Visitor | Page kept when |
|---|---|
| Anonymous | The view is `anonymous: true` **and** passes any `x-access.read` it carries |
| Signed in | `requires` names a model this actor may `list`, **and** any `x-access.read` passes |

A tile inside a page is filtered the same way and independently: a node with `requires` the actor
cannot read, or its own failing `x-access.read`, is **absent** — so there is nothing for a
client-side toggle to get wrong. If a page's root node is refused, the page goes with it.

One asymmetry, and it is deliberate. **A model with no `x-access` denies; a view with no `x-access`
does not.** A model is a resource, and silence about a resource must never grant. A view is a
projection of resources the server re-checks anyway, so silence there means "this page adds no
constraint of its own" — and making it deny would make every existing view disappear, which is a
migration, not a default.

Pages are sorted by `navOrder`, because directory order is filesystem-dependent and navigation order
must not be. A tie is a boot error ([01-configuration-and-boot.md](01-configuration-and-boot.md)).

### `when: { state: … }` — a node conditioned on a record

A node may also depend on where the record the page is about sits in its lifecycle:

```yaml
- type: ContentSection
  when:
    state: [payment_pending, needs_review]
```

One keyword, reading one thing: a state the model already declares in `x-states`. **Deliberately not
an expression** — a second expression dialect in view config is how the pre-reset codebase grew five
unfinished families. A name or a list of names, nothing else.

**It is cross-checked at boot.** An unknown state fails startup naming the states that exist, a
model with no `x-states` is refused rather than never matching, and a page naming no model is
refused because a condition needs a record. The failure this replaces is the one the rest of the
boot checks exist for: a condition that is evaluated, never holds, renders nothing, and leaves the
author believing the declaration works.

**It is evaluated here, in the projection.** The row is read through the engine as this actor, so
scope and field policy apply; a record the actor may not read resolves to nothing, and *a condition
that cannot be evaluated does not hold* — silence about a record must not render the branch that
assumes one. A node whose condition does not hold is **absent**, and the keyword is not in
`NODE_KEYS`, so nothing about the condition crosses to the browser. Reading the page source of a row
in one state finds no trace of the copy for the others.

This makes the projection a statement about one actor **and one URL**. `createAssets` is given the
request URL; `/v0/app` takes `?path=` because client routing has no document URL to read one from,
and the path only ever selects which declared route to resolve — the record behind it is read
through the gates. A page that declares no `when` costs no extra query.

**`when` is presentation and carries no authorization.** A node it hides is still refused by the
server when the actor asks the API directly: `x-access`, `x-scope`, `x-field-access` and a
transition's own `from` and `access` decide that, and none of them consult this. Using `when` as a
gate would be authorization written in the one place this document says never holds any. The app
gate proves it by calling `confirm` directly as a staff actor the page never offered it to, and
watching the server answer 403.

`rowActions[].when` is the same grammar per row, judged in the grid rather than here, because the
subject is a row the server already sent — see [13-screens.md](13-screens.md).

Live, three actors against the same build:

| Actor | Pages | `models.customer.ops` |
|---|---|---|
| anonymous | `login` only; `models: {}` | — |
| admin | 12, `admin` among them | create get list update delete count aggregate |
| staff | 11, **`admin` absent** | get list count aggregate |

`admin` disappears for staff because that view carries its own policy —
`x-access.read: "'admin' in actor.roles || 'platform' in actor.roles"`. It has no `requires:`,
because the page is not about a model: membership, invites and the join code write the framework's
own system models, which generic dispatch refuses by design. The alternative considered and rejected
was a `requiresRole:` keyword — a second authorization mechanism that would drift from the gate it
imitated.

Both actors see nearly the same `note.ops`, because the showcase gives `admin` and `staff` the same
`x-access` on `note` and differs only on `customer` and on `adminOnlyNote`'s field policy. The one
place they part is the lifecycle: `restart` declares `access: "'admin' in actor.roles"`, so it is in
the admin's `ops` and `states.transitions` and in neither of staff's. `from` and `to` cross; the
`access` expression that decided this does not — facts, never the rules behind them.

## The first paint

`createAssets` serves static files as-is — they carry no projection and stay cacheable — and
rewrites only HTML documents. An unknown path gets the shell back, so a deep link resolves. Without
a built bundle it answers `503 UI bundle not built`.

The two headers on the document matter: `Cache-Control: private, no-store` and `Vary: cookie`. A
shared cache holding one actor's projection and serving it to another would undo the whole design.

## The client runtime

`createAppStack` (`packages/ui/src/createAppStack.ts`) does five things:

1. **Ask the server who this is** — `GET /v0/auth/me`. The client only asks; the server decides.
2. **Pick the page** whose `route` pattern matches `location.pathname`, or `/login` when anonymous.
   `matchRoute` handles `:param` segments; the fallback is the page at `/`, then the first page.
3. **Substitute `$param`** from the matched route into node props — recursively, so
   `filter: { customerId: $id }` on a master-detail page works. **Only a whole value** of the form
   `$name` is substituted; there is no interpolation inside a longer string, which keeps this a
   substitution rule rather than a template dialect.
4. **Inject two facts**: `session` into any `SessionBar` node, and the reachable pages into any
   `Navigation` node. Navigation is a projection of pages this actor can reach, not a client rule.
5. **Mount one `ConfigNode`**, and install the router below.

Steps 2–4 are one function, `resolvePage`, and it runs on every navigation as well as at first
paint — so a click and a reload of the same URL cannot disagree about what that URL is.

`ConfigNode.vue` is sixteen lines: look the node's `type` up in the registry, render it with
`v-bind="node.props"`, recurse over `children`. **There is no VNode engine** — Vue resolves the
components. An unknown type renders a visible red placeholder rather than nothing, so a
configuration mistake is loud in the page instead of silent.

The registry is checked against `component-names.ts` at module load and **throws** if the two
disagree: that file is what the server validates views against, so a drift would let a view pass
boot validation and then render nothing.

## Navigation routes in place, and refetches the projection

Every link is still a plain `<a href>` to a real path — no `<RouterLink>`, no `#/` fragment, nothing
for a view author to opt into. `router.ts` listens for clicks on the document, and takes one only
when **all** of these hold: an unmodified left click, no `target`, no `download`, no
`rel="external"`, this origin, not a bare in-page `#fragment`, and a path **this actor's projection
carries**. Everything else keeps the behaviour it has always had — a new tab, a file download, a
link out — because a router that swallows a click it did not understand is worse than no router.

A taken click is `history.pushState`, then re-resolve, then re-render in place; `popstate` does the
same for Back and Forward; `document.title` follows the page's `title`.

**The refetch is the reason this is safe.** The projection used to be correct *because* every
navigation was a document load: the server rebuilt it per actor, per request. So every navigation —
click, Back or Forward — refetches `GET /v0/app` and re-resolves against the answer, and
`window.__APP__` is reassigned with it so `modelFacts()` cannot drift from the page set. Driven, in
the gate: a member is promoted server-side between two clicks and the new page **appears**; the same
member is then deactivated and the next click lands them on the sign-in page — neither with a
document request. Without the refetch the client would still be rendering the page set it was handed
at first paint. Not a leak in either case, since every gate still refuses server-side, but it would
break the "absent, not hidden" property this document opens with.

If the refetch fails outright, the client falls back to `location.reload()` — the old behaviour, on
the URL it just pushed. If it succeeds but the fresh projection no longer carries the path, the same
fallback rule as first paint applies (`/login` for a visitor, then `/`), which is exactly what a
document load of that URL would have produced, because the server answers an unknown path with the
shell and this code then runs.

**No `vue-router`** — decision 31 and open decision F both named it; this is the amendment. The
server half already existed (`assets.ts` answers any unknown path with the shell), the matcher
already existed (`matchRoute`), and the route table is not the client's to own: routes come from the
projection and change under it, so a router holding its own registry would be a second source of
truth for what exists. What was missing is ~60 lines deciding whether a click is ours. Hash routing
was considered and rejected: a fragment is not a distinct URL to a crawler, and SEO for anonymous
pages is the next item in the same package.

Login, logout and a form's `doneHref` still call `location.reload()` / `location.assign()` — an
identity change is exactly the moment to let the server rebuild the document, and the form case is
an unconverted leftover rather than a decision.

## The network surface

`client.ts` is the only module that talks to the server:

| Export | Does |
|---|---|
| `dispatch(op, model, opts)` | Any generic operation |
| `fetchSchema(model, op)` | The derived schema |
| `fetchProjection(path?)` | `GET /v0/app?path=…` — this actor's projection of that page, per navigation |
| `resolveLookups(...)` | Label resolution, **coalesced** into one `where=id:in:…` per lookup column per page |
| `currentSession` / `login` / `logout` | The auth routes |
| `modelFacts(model)` | Reads `window.__APP__.models` |
| `announceChange` / `onChanged` | A window event telling sibling screens to reload after a write |

`announceChange` is why creating a note in the form on `/notes` refreshes the grid below it without
a reload, and without the two components knowing about each other.

**A known reuse gap:** five screens call `fetch` directly for POSTs instead of going through
`dispatch` — `BoardScreen`, `ChartScreen`, `ConfirmAction`, `DataGrid`, `FormScreen`. They hit the
same routes with the same cookies, so nothing is unsafe; it is duplication, and it is in the backlog.

## Limits worth knowing

- **Node `props` are copied wholesale.** The whitelist is at the key level above them
  (`NODE_KEYS`), so anything an author writes inside a node's `props` reaches the browser. That is
  correct for view config — props *are* the UI — but it means view config must not be treated as a
  place to hide anything (AUD-065).
- **A page with neither `requires` nor `x-access` is visible to every signed-in actor.** The
  showcase's `platform` page is one: it renders for staff, and its cross-tenant report is then
  refused by the server at request time, so the reader sees an error rather than an absent page.
  That is the config's choice, not the framework's — `admin` shows the other option — and it is
  filed in `PRODUCTION-BACKLOG.md`.
- **A navigation costs two requests** — `/v0/app` and `/v0/auth/me` — before the new page renders,
  and the old page stays on screen until they answer. That is the price of never being stale; it is
  still two small JSON reads against a document, a stylesheet and a 450 kB bundle.
- **The URL changes before the content does.** `pushState` happens on the click so Back works
  immediately; if the fresh projection then refuses the path, the reader lands on the fallback page
  with the requested URL still in the address bar — which is exactly what a document load of that
  URL does today, and is why it was left that way rather than rewritten.
- **A screen holding unsaved state loses it on an in-app navigation**, because a page change
  remounts the whole subtree (the render is keyed by page id and route params). That is deliberate:
  patching one page's `DataGrid` into another's would show the previous page's rows until the new
  fetch returned.

## How to verify this layer

The projection is visible in the document, which is the point:

```sh
curl -s -b admin.txt localhost:3000/ | grep -o 'window.__APP__=.*</script>' | head -c 400
curl -s -D- -o /dev/null -b admin.txt localhost:3000/ | grep -iE 'cache-control|vary'

# The same value on an endpoint, with the same headers — what a navigation refetches.
curl -s -b admin.txt localhost:3000/v0/app | head -c 200
curl -s -D- -o /dev/null -b admin.txt localhost:3000/v0/app | grep -iE 'cache-control|vary'
curl -s localhost:3000/v0/app | python3 -c 'import json,sys; print([p["id"] for p in json.load(sys.stdin)["pages"]])'
```

Routing itself is a browser behaviour, so the gate is where it is proven:
`bun run verify:browser -- routing` counts document and script requests across a click, drives Back
and Forward, pastes a deep link, and changes a member's role and then deactivates them between two
clicks to show the client re-reading the projection rather than its first paint.

Then compare two actors, and grep the injected JSON for anything rule-shaped:

```sh
for who in admin staff; do
  curl -s -b $who.txt localhost:3000/ > /tmp/$who.html
  python3 - <<'PY'
import re, json
d = json.loads(re.search(r'window\.__APP__=(\{.*?\})</script>', open('/tmp/admin.html').read(), re.S).group(1))
print([p['id'] for p in d['pages']], {k: v['ops'] for k, v in d['models'].items()})
PY
done
grep -c 'x-access\|x-scope\|x-field-access' /tmp/admin.html    # 0
```

## Related

[12-forms.md](12-forms.md) · [13-screens.md](13-screens.md) · [05-gates.md](05-gates.md) ·
[10-auth-and-sessions.md](10-auth-and-sessions.md) · `ARCHITECTURE.md` §19

---

_Checked against the code 2026-09-16_ — `packages/core/src/projection.ts`, `assets.ts`,
`packages/ui/src/createAppStack.ts`, `ConfigNode.vue`, `registry.ts`, `component-names.ts`,
`client.ts`, `apps/showcase/config/views/`. The three-actor table, the headers and the grep results
were produced against `bun run dev` on port 3000 with a freshly built bundle.
