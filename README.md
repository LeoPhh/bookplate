# 📚 Bookplate

A personal reading tracker with a bold editorial look. Books carry ratings,
reading dates, and their own notes pages, and can wear real cover photos —
searched from a catalogue, uploaded, or pasted straight from the clipboard. A
vocabulary registry keeps the words learned along the way.

Bookplate is **self-hosted**: you run it on your own machine or server with
Docker, and your library never leaves it. Everything can be exported at any
time as a zip of plain JSON, markdown and image files.

![The covers view](docs/covers.png)

## Features

### The look

Newsprint white, heavy black rules, one hot vermilion accent, Archivo Black
set in sentence case, and hard offset shadows with no blur. Books without a
cover photo get a generated cloth cover in one of twelve binding colours.

### Three views of the library

- **Covers** — a grid of front covers. Books without a photo wear a
  generated cloth cover in one of twelve binding colours; books with one
  show the real thing.
- **Ledger** — a sortable table of every volume with status badges, ratings,
  and dates, ending in a count row (respects the active search/filter).
- **Statistics** — stat tiles (books read, read this year, pages, average
  rating) plus charts: books finished per year, ratings distribution, genres,
  and sources. Everything drills down: click a year column for that year's
  books (with a highest-rated section), a genre/rating/source row for its
  books, or "see all genres" for the full breakdown — and any book in a
  drill-down opens its detail dialog.

![The statistics view](docs/statistics.png)

![Drilling into a year](docs/drill-down.png)

![The ledger view](docs/ledger.png)

### A notes page per book

Every book has its own page (`/books/<id>`), opened with the **Notes** button
in its detail dialog. Notes are written in a **Notion-style inline editor**:
markdown renders as you type (`## ` becomes a heading, `**bold**` turns
bold), and **images pasted or dropped into the text appear inline
immediately**. Large pastes are downscaled in the browser (long edge capped
at 1600 px, re-encoded as JPEG) so multi-megabyte screenshots don't bloat
storage. Notes are stored as markdown; Cancel discards the edits — and both
return to the library.

Nothing orphans: every save garbage-collects stored images the text no
longer references, Cancel bins images pasted during the session, and
deleting a book removes its notes, images, and cover together.

The detail dialog shows a text excerpt and thumbnail strip of the notes, and
a **Show notes** toggle in the toolbar drapes a bookmark ribbon over every
book that has notes — in every library view.

### Vocabulary

A second page (linked from the masthead) is a registry of words learned
while reading. Type a word and it's looked up in **Wiktionary** (keyless,
proxied): pick the sense to keep — with its part of speech and an example —
or write your own definition when the dictionary comes up empty.
Words can be tagged with the book they came from; each book's notes page
shows its own words, and the registry can be searched, sorted, and filtered
by book.

### Adding books

The add dialog searches the **Open Library catalogue** (no API key) — picking
a result autofills the title, author, and page count, fetches the cover, and
opens it in the crop dialog. Everything can also be entered fully by hand.

![Adding a book via catalogue search](docs/add-book.png)

Each book carries: title, author, genre, page count, source (book store /
Kindle / audiobook / borrowed / second hand / gifted / library), status
(read / reading / to read), whether a physical copy lives at home, a 1–5
star rating, the date finished (picked with a calendar), and its
notes page.

![The book detail dialog](docs/detail.png)

### Cover images

- Covers arrive three ways: fetched from the catalogue, uploaded as a file,
  or **pasted from the clipboard** (⌘V anywhere in the add/edit dialog).
- All of them pass through a **crop dialog** locked to book proportions
  (2 : 3), then are compressed in the browser to a JPEG capped at 600 × 900
  (~40–80 KB) before being stored.
- Cover downloads try Open Library first and fall back to iTunes ebook
  artwork — useful on networks where Open Library's image host (archive.org)
  is unreachable. All external fetches are proxied through the app's own API
  routes, so the browser never talks to third-party hosts.
- Books without an image keep their generated cover; nothing external is
  ever required.

### Search, filter, sort

Free-text search across titles, authors, genres, and notes; status filter
chips; a **Show notes** toggle marking every book with notes; sorting by
title, author, rating, date finished, or recently added.

## Install with Docker

You need Docker with the Compose plugin. Bookplate runs as two containers:
the app and a Postgres database.

```bash
mkdir bookplate && cd bookplate
curl -fsSLO https://raw.githubusercontent.com/LeoPhh/bookplate/main/docker-compose.yml
curl -fsSL https://raw.githubusercontent.com/LeoPhh/bookplate/main/.env.example -o .env
```

Edit `.env`:

| Setting | What to put there |
| --- | --- |
| `AUTH_SECRET` | a random string — `openssl rand -base64 32` |
| `DB_PASSWORD` | a random string — `openssl rand -hex 24` |
| `PUBLIC_URL` | the address you'll open it at, e.g. `http://192.168.1.20:3000` or `https://books.example.com` |

Then start it:

```bash
docker compose up -d
```

Open `PUBLIC_URL`. The first visit asks you to create your account — the
owner of this Bookplate. After that, sign-up is closed.

Images run on both `amd64` and `arm64` (Raspberry Pi, Apple Silicon, most
NAS boxes) and are published to Docker Hub (`leophh/bookplate`) and GitHub
Container Registry (`ghcr.io/leophh/bookplate`).

### Updating

```bash
docker compose pull && docker compose up -d
```

Database changes are applied automatically when the new version starts.
To stay on a particular release, set `BOOKPLATE_VERSION=0.1.0` in `.env`.

### Backups

The easy way: **Settings → Export library** downloads everything — books,
notes, pasted images, covers and vocabulary — as one zip. **Settings →
Import** reads it back into any Bookplate.

For full server backups, save both volumes:

```bash
docker compose exec postgres pg_dump -U bookplate bookplate > bookplate.sql
docker compose cp bookplate:/data/uploads ./uploads-backup
```

### HTTPS and reverse proxies

Bookplate speaks plain HTTP on port 3000. To put it on the internet, run it
behind a reverse proxy that handles HTTPS — for example with Caddy:

```
books.example.com {
    reverse_proxy localhost:3000
}
```

and set `PUBLIC_URL=https://books.example.com`. If you'd rather not expose it
publicly, a VPN such as Tailscale works well too.

### Coming from the original app

If you ran the earlier git-based version of Bookplate, zip its `data/`
folder and use **Settings → Import**. Books, covers, notes, pasted images
and vocabulary all come across.

## Configuration

| Variable | Default | |
| --- | --- | --- |
| `DATABASE_URL` | — | Postgres connection string (set for you by the compose file) |
| `AUTH_SECRET` | — | signs session cookies; required |
| `PUBLIC_URL` | `http://localhost:3000` | the address Bookplate is reached at |
| `REGISTRATION` | `closed` | `open` lets anyone who can reach the server create their own separate library |
| `STORAGE` | `local` | `s3` keeps images in an S3-compatible bucket instead of on disk (see below) |
| `UPLOADS_DIR` | `/data/uploads` in Docker | where images are stored with `STORAGE=local` |
| `S3_ENDPOINT` | — (AWS) | your provider's S3 address, e.g. `https://s3.fr-par.scw.cloud` |
| `S3_REGION` | `us-east-1` | the bucket's region, e.g. `fr-par` |
| `S3_BUCKET` | — | the bucket's name (create it first) |
| `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY` | — | an access key allowed to read and write the bucket |
| `S3_FORCE_PATH_STYLE` | `false` | `true` for most self-hosted S3 servers (Garage, RustFS, SeaweedFS) |
| `S3_PREFIX` | — | a folder inside the bucket, to share it with other apps |
| `SMTP_HOST` | — | your mail server; setting it switches on email (password reset by email, and confirming new accounts' addresses when registration is open) |
| `SMTP_PORT` | `587` | `465` for a direct encrypted connection |
| `SMTP_SECURE` | follows the port | `true` / `false` to override |
| `SMTP_USER`, `SMTP_PASSWORD` | — | the mail server's login, if it needs one |
| `SMTP_FROM` | `Bookplate <bookplate@localhost>` | who emails come from, e.g. `Bookplate <books@example.com>` |
| `SMTP_REPLY_TO` | — | where replies to Bookplate's emails go, e.g. a support inbox when `SMTP_FROM` is a no-reply address |
| `EMAIL_LIMIT_PER_DAY` | no cap | the most emails the server sends in a day (UTC), all kinds together; beyond it, sending pauses until midnight and each refused email is logged as an error |
| `SIGNUP_BOT_CHECK` | `true` | with open registration, sign-ups solve an invisible puzzle first (see below); `false` turns it off |
| `TRUSTED_PROXIES` | `1` | how many reverse proxies stand in front of Bookplate; `2` for e.g. Cloudflare in front of Caddy |
| `LIMIT_BOOKS`, `LIMIT_WORDS` | no limit | the most books / vocabulary words one account may have |
| `LIMIT_STORAGE_MB` | no limit | the most image space one account may use (covers, pasted images, profile photo) |
| `LIMIT_UPLOAD_MB` | `8` | the largest single image |
| `LIMIT_IMPORT_MB` | `1024` | the largest export zip or CSV that can be imported |
| `LOG_LEVEL` | `info` | `debug` for more detail while chasing a problem; `warn` or `error` for less |
| `METRICS_TOKEN` | — | switches on `/api/metrics`, read with this token (see below) |
| `METRICS_REFRESH_MINUTES` | `480` | how often those totals are recounted from the database |
| `CONTACT_FORM_TO` | — | switches on a contact form's back end at `/api/contact` (see below); messages are emailed here, with the sender as Reply-To. Needs `SMTP_HOST` |
| `LEGAL_DIR` | — | a folder holding your `privacy.md` and/or `terms.md` (Markdown); each one becomes a page (`/privacy`, `/terms`) that anyone can read, linked from sign-in and sign-up. With Docker, mount the folder too (see `docker-compose.yml`) |
| `CONTACT_EMAIL` | — | your address, sent to Open Library with searches; they allow busier servers more requests with one |

### Open registration

With `REGISTRATION=open`, anyone who can reach Bookplate can make an account,
so it guards the door:

- **An invisible check.** The sign-up page has the browser solve a small
  puzzle (an [ALTCHA](https://altcha.org) proof of work) while the person types:
  a moment's computing for them, but slow and costly for a script making
  accounts in bulk. No picture puzzles, and nothing is sent anywhere else.
- **Five new accounts an hour per address.** Bookplate finds the address the
  way your reverse proxy reports it; set `TRUSTED_PROXIES` if there's more
  than one in front of it. Reached directly, without a proxy, the address can
  be faked and this limit doesn't hold.
- **Confirmed email addresses**, when email is set up — and accounts that
  never confirm (and so never stored anything) are removed after 7 days.
- **Limits per account** with the `LIMIT_*` settings, so one account can't
  fill your disk or bucket.

### Image storage

Covers, pasted note images and profile photos live on disk, in the `uploads`
volume, unless you set `STORAGE=s3`. Then they go to an S3-compatible bucket:
Scaleway Object Storage, Cloudflare R2, Backblaze B2, AWS S3, or a NAS running
Garage or RustFS. The bucket stays private — Bookplate fetches images itself
and only shows them to their owner. With wrong `S3_*` settings, Bookplate
won't start, and `docker compose logs bookplate` says what's wrong.

Pick your storage before adding images. To switch later: **Settings → Export
library**, change the setting and restart, then **Settings → Import** the same
zip (each account does this for its own library; profile photos need re-adding).

### Logs

```bash
docker compose logs bookplate --since 1h
```

Bookplate writes one JSON line per event: errors with their stack traces,
failed calls to Open Library and other services, imports, sign-ins and
sign-ups, limits reached, and errors from people's browsers. Every request
gets an ID (sent back as `X-Request-Id`, or kept from a reverse proxy that
sets one), and the lines a request causes carry it as `req`, so one failure
can be followed end to end. When a save fails, the app shows the first part
of that ID as a reference.

Logs never contain passwords, cookies, tokens, email links, email addresses
(accounts appear as user IDs or a short hash), book or note contents, or
search terms. Docker keeps the last 50 MB per container. Any log shipper that
reads Docker logs (Grafana Alloy, Vector, Promtail…) can forward them.

### Metrics

With `METRICS_TOKEN` set, `/api/metrics` serves totals in Prometheus's text
format — accounts (confirmed or not, new, active in the last day/week/month),
books by status, books per account, notes, words, progress updates — plus the
server's memory use and version. Point Grafana Alloy or Prometheus at it with
`Authorization: Bearer <METRICS_TOKEN>`. Only totals: nothing about any one
person. The database is counted at startup and then every
`METRICS_REFRESH_MINUTES` (8 hours by default), so reading the endpoint often
costs nothing. Behind a reverse proxy, keep `/api/metrics` off
the internet and let the collector reach it directly.

### Contact form

A website of your own, such as a landing page, can have a contact form
without a server of its own. With `CONTACT_FORM_TO` set (and email working),
Bookplate takes the messages at `/api/contact` and emails them there, with the
sender as Reply-To. Serve the website on the same domain and send
`/api/contact` to Bookplate from your reverse proxy, so the form posts to its
own site. The form:

1. `GET /api/contact` for a puzzle, and solve it in the browser with
   [altcha-lib](https://github.com/altcha-org/altcha-lib) (`solveChallenge`,
   PBKDF2), as Bookplate's sign-up page does;
2. `POST /api/contact` with JSON `{ name, email, message, check }`, where
   `check` is base64 of `JSON.stringify({ challenge, solution })`.

It answers `200 { ok: true }`, or an error status with `{ error }` to show.
Each address can send 5 messages an hour, and they count towards
`EMAIL_LIMIT_PER_DAY`. Nothing of a message is logged.

### Forgotten passwords

With email set up, use **Forgot password?** on the sign-in page. Without it,
whoever runs the server resets it with one command:

```bash
docker compose exec bookplate reset-password you@example.com
```

It asks for the new password twice and signs out every device. Settings →
**Send a test email** checks that your email settings work.

Bookplate sends no telemetry. The only outside services it talks to are Open
Library and iTunes (book search and covers) and Wiktionary (word lookups),
and only when you use those features. It paces its requests to stay within
their limits, so on a busy server, finding covers after a big import can
take a little longer.

## Development

```bash
npm install
npm run db:up        # Postgres (5433), Mailpit — a fake mail server — and RustFS, for S3 storage
cp .env.example .env.local
# set DATABASE_URL=postgres://bookplate:bookplate@localhost:5433/bookplate
# plus AUTH_SECRET and PUBLIC_URL=http://localhost:3000
npm run dev
```

To try email locally, add `SMTP_HOST=localhost` and `SMTP_PORT=1025` to
`.env.local`; every email Bookplate sends then shows up at
http://localhost:8025. `npm run reset-password -- you@example.com` resets a
password from the terminal.

Changing `lib/db/schema.ts`? Run `npm run db:generate` to write a new
migration into `drizzle/`, and commit it.

### Tests

```bash
npm test            # unit tests (no database needed)
npm run build       # the API tests run against the production build…
npm run test:api    # …and throwaway databases on the dev Postgres, plus Mailpit
npm run test:api:s3 # the same, with images in a throwaway RustFS bucket
```

The API tests start the real server on a free port with a fresh database,
then drop it afterwards. GitHub Actions runs all of them on every push and
pull request, and only builds the Docker image when they pass.

## Tech notes

- **Next.js 16** (App Router, TypeScript), built as a standalone server for
  the Docker image.
- **Postgres** through **Drizzle ORM**. Every record belongs to a user, and
  every query is scoped to the signed-in user.
- **Better Auth** for accounts and sessions, stored in the same database.
- Images live behind a small storage interface (`lib/storage/`); the local
  disk driver writes to `UPLOADS_DIR`.
- **No UI framework**: hand-written CSS, all in `app/globals.css`. Covers,
  charts, the calendar, and the dialogs are all plain CSS.
- Runtime dependencies beyond React/Next: `react-easy-crop` for the cover
  crop gesture, **TipTap** (`@tiptap/react` + `tiptap-markdown`) for the
  inline notes editor — content is stored as markdown, not editor JSON — and
  `fflate` for export zips.

## Project structure

```
app/
  page.tsx              # the library UI state lives here
  vocabulary/           # the word registry page
  books/[id]/           # per-book notes page (TipTap inline editor)
  settings/             # export, import, sign out
  login/, setup/        # sign-in and first-run account creation
  api/books/            # list books; PUT/DELETE one book
  api/covers/           # store, serve, delete cropped covers
  api/booksearch/       # Open Library search + cover proxy w/ iTunes fallback
  api/notes/            # notes markdown + pasted images (+ orphan GC on save)
  api/vocabulary/       # list words; PUT/DELETE one word
  api/define/           # Wiktionary definition proxy
  api/export/, import/  # library zip out and in
  api/health/           # used by the Docker healthcheck
components/             # CoverGrid, ListView, StatsView, SiteNav, BookDetail, …
lib/
  db/                   # Drizzle schema, connection, migration runner
  storage/              # image storage interface + local disk driver
  auth.ts               # Better Auth setup, requireUser()
  library.ts            # all reads and writes, scoped per user
  archive.ts            # export / import format
drizzle/                # SQL migrations (generated — don't edit by hand)
proxy.ts                # sends signed-out visitors to /login
```

## License

Bookplate is licensed under the [Apache License 2.0](LICENSE). The name and
logo are not covered by the license — see [TRADEMARK.md](TRADEMARK.md).
