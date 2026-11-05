# Engineering standards

These are the standards I hold my own projects to. Each one links to where
it's actually practiced in this repo or the case studies, so none of it is
aspirational. Where I'm not meeting a standard yet, it's listed under
[Known gaps](#known-gaps).

## 1. Version control

**Short-lived branches, PRs into `main`.** `main` is always deployable,
because GitHub Pages serves it directly. Work happens on a branch and lands
through a pull request that passes [CI](../.github/workflows/ci.yml).

**Conventional Commits.** `type(scope): summary` in the imperative mood,
under ~72 characters.

| Type | Use for |
|---|---|
| `feat` | A user-visible capability |
| `fix` | A bug fix |
| `refactor` | A behaviour-preserving restructure |
| `docs` | Docs only |
| `test` | Tests only |
| `ci` / `build` | Pipelines and tooling |
| `chore` | Maintenance with no runtime effect |

**The commit body explains *why*.** The diff already shows *what*. The body
covers the reason, the alternatives that were rejected, and how the change
was verified. Example:
[`feat(site): serve portfolio at root…`](https://github.com/alexmrivasjr/alexmrivasjr.github.io/commit/2d3d733).

**One logical change per commit.** Every commit should build and deploy on
its own, so `git bisect` and `git revert` stay useful. A security fix found
in the middle of a refactor gets its own commit
([`fix(deals): stop interpolating…`](https://github.com/alexmrivasjr/alexmrivasjr.github.io/commit/392f9a6)).

**Temporary code is labelled and removed.** Diagnostics and experiments go
in with a commit that says "temporary", and come out in a commit that says
what was learned.

## 2. Documentation

| Doc | Purpose |
|---|---|
| `README.md` | What it is, how to run it, how to operate it when it breaks |
| [`docs/adr/`](adr/) | One Architecture Decision Record per significant, hard-to-reverse decision |
| [`docs/case-studies/`](case-studies/) | Problem → constraints → architecture → decisions → verification → next steps |
| Code comments | *Why* something non-obvious is done, never a restatement of *what* |

Assumptions that haven't been verified get labelled as unverified in config
and docs. They're never silently treated as facts.

## 3. Testing and verification

- **Tests run offline and deterministically.** LLMs, retailers, and county
  sites sit behind mocks or fixtures, so CI needs no secrets and costs
  nothing. (Support pipeline: a mock LLM mode. Lead pipeline: fixtures.)
- **Measure what matters.** Redaction is scored against a planted PII
  answer key instead of being eyeballed.
- **Negative-test the checks.** A CI check that has never failed hasn't
  been shown to work. Make it fail once on purpose.
- **Quote only numbers you've reproduced.** Test counts in the case
  studies were re-run, and the date is recorded next to them.

## 4. Security and privacy

- **Secrets live only in GitHub Actions secrets**, are never committed, and
  get rotated when exposure is possible.
- **Treat scraped and third-party data as untrusted.** Render it with
  `textContent`, and only allow `http(s)` URLs.
- **Workflows get least-privilege `permissions:`.** `contents: read` unless
  the job has to write.
- **No personal data in repos.** Use synthetic data with answer keys
  instead. If personal data does land in a repo, the fix is to move it
  behind authentication, not just to delete it from the latest commit.
- **Enforce access server-side.** For example, with Firestore security
  rules rather than UI checks.

## 5. Operating automation responsibly

- **Exact targets, low frequency.** Track specific SKUs or records, not
  broad crawls.
- **Honor `robots.txt`.** Never scrape search forms and never bypass
  paywalls. When a source can't be automated legitimately, produce a
  precise manual task instead.
- **Partial failure beats total failure.** Record per-source errors and
  keep going.
- **Watch cost.** Measure API usage before expanding scope, and turn off
  duplicate schedules.

## Known gaps

Honest current debt, roughly in priority order:

1. **The deal tracker has no unit tests.** The next step is fixture-based
   tests for JSON-LD parsing, threshold logic, and de-duplication.
2. **Bot data commits on `main`.** The scheduled `Update deals data`
   commits bury the human history. The plan is to write scraped data to a
   dedicated `data` branch, or publish it as a Pages artifact, and get an
   ADR for it.
3. **Unmerged feature branches.** The lead pipeline and lottery research
   live on long-lived `claude/*` branches. They should either merge through
   a PR or be archived with a note.
4. **`scrape-lottery.yml` lives on `main`** while its scripts live on a
   branch. That's intentional (`workflow_dispatch` workflows only appear in
   the Actions UI if they exist on the default branch, and it's dispatched
   against the branch), but it fails if dispatched against `main`. The fix
   is to merge the lottery tooling, minus the scraped personal data.
5. **Actions are pinned by tag, not SHA**, in this repo. The recruiting
   site already pins by SHA.
