# Contributing

Thanks for helping! Bug reports, ideas and pull requests are all welcome.

- See **Development** in the README to run it locally.
- Run the tests before opening a pull request — CI runs the same ones:

  ```bash
  npm test                          # unit tests, no setup needed
  npm run db:up && npm run build    # once, for the API tests
  npm run test:api                  # the API, against a real server and Postgres
  ```

  New behaviour comes with a test: logic in `test/unit/`, anything reachable
  over HTTP in `test/api/`.
- Keep the look consistent: all styling lives in `app/globals.css` (see
  `AGENTS.md` for the design rules).
- Changing the database? Edit `lib/db/schema.ts`, run `npm run db:generate`,
  and commit the new file in `drizzle/`.
- Every query must be scoped to the signed-in user — use the helpers in
  `lib/library.ts` and `requireUser()` in route handlers.
- Releases and Docker image tags are covered in [RELEASING.md](RELEASING.md).

By submitting a contribution you agree that it is licensed under the
project's [Apache License 2.0](LICENSE).
