# Releasing Sarp

Sarp uses semantic versioning: `MAJOR.MINOR.PATCH`.

- **PATCH** (`1.1.1 → 1.1.2`): bug fixes and small safe improvements.
- **MINOR** (`1.1.1 → 1.2.0`): backward-compatible features.
- **MAJOR** (`1.1.1 → 2.0.0`): breaking changes or major redesigns.

## Prepare a release

1. Start from an up-to-date `main` branch.
2. Make sure the changes you intend to ship are merged and CI is green.
3. Update the package version (this updates both `package.json` and `package-lock.json`):

   ```bash
   npm version patch --no-git-tag-version
   # Use "minor" or "major" instead when appropriate.
   ```

4. Add a new section at the top of `CHANGELOG.md` with the version, date, and user-facing changes.
5. Update the version badge in `README.md` to match.
6. Run the checks locally:

   ```bash
   npm ci
   npm run typecheck
   npm run build
   ```

7. Commit and push the release preparation:

   ```bash
   git add package.json package-lock.json CHANGELOG.md README.md
   git commit -m "chore: prepare vX.Y.Z release"
   git push origin main
   ```

## Publish the release

After the release-preparation commit is on `main`, create and push the matching tag:

```bash
git tag vX.Y.Z
git push origin vX.Y.Z
```

Replace `X.Y.Z` with the exact version in `package.json` (for example, `v1.1.2`).

The `Release Sarp` GitHub Actions workflow runs on the tag. It verifies that the tag matches `package.json`, installs from the lockfile, runs TypeScript checks, builds the production bundle, and creates a GitHub Release with generated notes. If a check fails, no release is published.

## Where to download

- **GitHub Releases:** `https://github.com/hmmlavi/Sarp/releases`
- **Web game:** `https://sarp-kappa.vercel.app/`

Sarp is currently a web game; a GitHub Release publishes source/release notes, not a Windows installer. The deployed website is updated by the Vercel production deployment, independently of the GitHub Release tag.

## Preview deployments

Every pull request should receive its own Vercel preview URL once the repository is connected to Vercel through the Vercel GitHub App. Preview builds are for testing; merge to `main` for production. See the repository's deployment settings if a PR has no preview URL.
