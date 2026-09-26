# Production backlog — deferred, with why and what unblocks it

Re-evaluate at each phase close; nothing here is forgotten, only not now.

| Item | Source | Why deferred | Unblocks when |
|---|---|---|---|
| Daily email of today's tasks | G2.8, G5.6 | The owner deferred it (2026-09-26); Today covers the need | The owner asks. It needs `notifications.yaml` with SMTP host/port/account through `{ env: … }` and a password through `secretRef`, plus a daily code action |
| An invite or join-code field on the sign-up screen | G5.1 | Framework change: `LoginScreen` sends email and password only, and `.app-stack/` must not be edited | A new App-Stack release adds it; then replace the temporary sign-up page |
| Lot codes and traceability records (e.g. FSMA 204) | G1.7 | Unconfirmed that any rule applies to this farm or its buyers | The owner confirms a buyer or regulatory requirement |
| More crops and a `variety` pick-list | G1.1 | Lettuce only for now; `batch.crop` keeps room for it | A second crop is grown; its cycle days may differ, which moves the day offsets out of code and into data |
| Remote Railway deploys from this cloud environment | G5.4 | The network policy blocks `railway.com`/`backboard.railway.com` and there is no token here | The owner allows those hosts and adds a `RAILWAY_TOKEN` environment variable; otherwise deploy from the Railway dashboard |
