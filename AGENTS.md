<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Data and auth

- Data lives in Postgres (Drizzle, `lib/db/schema.ts`); images go through
  `lib/storage/` — files on disk or an S3 bucket (`STORAGE`), never touched
  directly. Every row and every storage key belongs to a user.
- Route handlers start with `requireUser()` from `lib/auth.ts` and only call
  the user-scoped helpers in `lib/library.ts`. `proxy.ts` is only an
  optimistic redirect, never the real check.
- Schema change → `npm run db:generate` and commit the new `drizzle/` file.
- All configuration comes from environment variables (`lib/config.ts`).
- Anything that adds books, words or images checks the per-account limits
  first (`lib/limits.ts`). Requests to Open Library or iTunes wait their
  turn with `pace()` (`lib/outbound.ts`): one server shares one address.
- Log with `log` from `lib/log.ts` (one JSON line per event, request ID
  attached), not `console`. Name events `area.what_happened`; identify
  accounts by user ID or `account(email)`. Never log passwords, cookies,
  tokens, email links or addresses, book or note contents, or search terms —
  `test/api/logs.test.ts` checks. Swallowing an error? Log it first.
- A visitor's address comes from `clientIp()` (`lib/clientIp.ts`), never
  straight from `X-Forwarded-For`, whose leftmost entries anyone can fake.
- The privacy policy and terms are the operator's Markdown files
  (`LEGAL_DIR`, `lib/legal.ts`), never text in this repository; render them
  with raw HTML off. An operator can instead publish them on another site
  (`PRIVACY_URL`, `TERMS_URL`): links and `/privacy`, `/terms` then lead there.
- Every page has the app bar (`components/AppBar.tsx`, from `app/layout.tsx`):
  the mark (a link to the Library), and when signed in the sections
  (Library, Vocabulary, Statistics) and the account menu. On phones the
  sections become the bottom tab bar. It never links out of the app.
- Email is optional (`SMTP_*`, `lib/email.ts`). Code must work without it:
  check `config.email.enabled`. Emails that reveal whether an account exists
  (reset, verification) never report send errors to the visitor.
- Tests: `npm test` (unit, `test/unit/`) and `npm run test:api` (HTTP tests
  against `npm run build` + the dev Postgres, Mailpit and RustFS,
  `test/api/`; the setup starts a server without email and one with it;
  `npm run test:api:s3` runs it all with images in S3). Add a test with
  every behaviour change; CI blocks image builds on failures.

# Styling

There is one look (bold editorial: newsprint white, heavy black rules, one
vermilion accent, hard offset shadows with no blur), and all of it lives in
`app/globals.css`.

- Design tokens (`--ink`, `--accent`, `--hair`, `--hard`, …) are defined on
  `:root` at the top of `globals.css`; use them rather than raw colours.
- Chart colours come from `--chart-series`, `--chart-series-hover` and
  `--chart-grid`, so the SVG charts restyle without touching TSX.
- `lib/palette.ts` holds the twelve binding colours for generated covers. A
  book stores an index into it, so only ever append — reordering recolours
  existing books.
- Fonts load in `app/layout.tsx` (`--font-fraunces`, `--font-inter`);
  `globals.css` points `--font-display` / `--font-body` at them.
- Two selector lists near the top of `globals.css` set label type: tiny
  editorial labels (eyebrows, table heads, badges, field labels) are uppercase
  micro-type; interface text (buttons, chips, nav, links) is bold sentence
  case. Titles are never uppercased. Put any new label in the right list.
- Emails (`lib/email.ts`) share the look in email-safe form: tables and
  inline styles, the same colour values, no web fonts. The logo travels inside
  each email as an inline attachment (`cid:`) — never link remote images or
  CSS (tracking, blocked clients, self-hosted servers nobody can reach). Every
  email has a plain-text version and says why the reader got it.
- Switching branches can break the Turbopack Google-font cache
  (`Can't resolve '@vercel/turbopack-next/internal/font/google/font'`).
  `rm -rf .next/cache` and restart the dev server.

# Browser investigations: clean up after yourself

A Playwright MCP server is configured for this machine and can drive a
headless browser to verify UI changes (open a modal, read back element
bounding boxes, screenshot a component). When you
use it, the MCP writes snapshot YAML, console logs, and screenshots to a
`.playwright-mcp/` directory in the project root.

**Always clean up these artifacts at the end of an investigation.** Run
`rm -rf .playwright-mcp/` before reporting done. The directory is gitignored,
but leaving it around clutters the working tree and can confuse later
sessions. Treat it like scratchpad output, not a repo file.
