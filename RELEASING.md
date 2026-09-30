# Releasing Bookplate

## How versions fit together

| You push…               | GitHub Actions publishes…                                        |
| ----------------------- | ---------------------------------------------------------------- |
| a commit to `main`      | `:edge` — overwritten every push; nobody gets it unless they opt in |
| a tag `v1.2.3`          | `:1.2.3` (never changes), and moves `:1.2`, `:1` and `:latest` to it |
| a pull request          | a test build only, nothing published                             |

Images go to both registries:

- Docker Hub — `leophh/bookplate`
- GitHub Container Registry — `ghcr.io/leophh/bookplate`

`latest` only moves when you tag a release. Self-hosters on the default
compose file get the new version on their next
`docker compose pull && docker compose up -d`. Anyone who pinned
`BOOKPLATE_VERSION=1.2` gets bug fixes (`1.2.x`) but not `1.3.0`. Database
migrations run automatically when the new version starts.

The version in `package.json` shows up on the Settings page and in
`/api/health`. `npm version` keeps it in step with the git tag.

## Everyday work

- Commit and push to `main` as usual; each push builds `:edge`.
- Changed `lib/db/schema.ts`? Run `npm run db:generate` and commit the new
  file in `drizzle/` before releasing.

## Releasing a new version

1. Make sure `main` is committed, pushed, and the latest Actions run is green.
2. Pick the bump:
   - **patch**: bug fixes (`0.1.0 → 0.1.1`)
   - **minor**: new features (`0.1.1 → 0.2.0`)
   - **major**: upgrades that need people to change something, like a
     renamed setting (`0.x → 1.0.0`)
3. Bump `package.json`, commit, and tag in one go:

   ```bash
   npm version patch        # or: minor / major
   ```

4. Push the commit and the tag:

   ```bash
   git push --follow-tags
   ```

5. Wait about 10 minutes for the **Actions** run to publish the images.
6. Optional: on GitHub, go to **Releases → Draft a new release**, pick the
   tag, click **Generate release notes**, then **Publish**.

## Rules

- Never move or reuse a published tag. Made a mistake? Release a new patch.
- Test the image locally before tagging anything risky:

  ```bash
  docker build -t leophh/bookplate:test .
  ```

## When a build fails

- **Actions** tab → open the red run → read the failing step.
- Docker Hub login errors: check **Settings → Secrets and variables →
  Actions** → Repository secrets `DOCKERHUB_USERNAME` (`leophh`) and
  `DOCKERHUB_TOKEN` (a Read & Write access token from Docker Hub).
- `npm ci` errors about the lock file: run `npm install` locally and commit
  the updated `package-lock.json`.
