# Contributing

Thanks for helping! Bug reports, ideas and pull requests are all welcome.

- See **Development** in the README to run it locally.
- Keep the look consistent: all styling lives in `app/globals.css` (see
  `AGENTS.md` for the design rules).
- Changing the database? Edit `lib/db/schema.ts`, run `npm run db:generate`,
  and commit the new file in `drizzle/`.
- Every query must be scoped to the signed-in user — use the helpers in
  `lib/library.ts` and `requireUser()` in route handlers.

By submitting a contribution you agree that it is licensed under the
project's [Apache License 2.0](LICENSE).
