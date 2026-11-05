# Contributing

This is a personal repo, but changes follow the same workflow I'd use on a
team. The full standards are in [`docs/ENGINEERING.md`](docs/ENGINEERING.md).

## Workflow

```bash
git switch -c feat/short-description   # or fix/…, docs/…, ci/…
# make changes
npm run check                           # links, JSON, JS syntax
python3 -m http.server 8000             # preview at http://localhost:8000
git commit                              # Conventional Commits, body explains why
git push -u origin HEAD                 # open a PR; CI must pass before merge
```

## Commit messages

```
type(scope): imperative summary under ~72 chars

Why the change is needed, what alternatives were rejected, and how it
was verified. Wrap at ~72 columns.
```

Types: `feat`, `fix`, `refactor`, `docs`, `test`, `ci`, `build`, `chore`.

## When to write an ADR

Write one when a decision is hard to reverse, affects users or other
systems, or would make a future reader ask "why on earth is it like this?".
Copy [`docs/adr/template.md`](docs/adr/template.md).

## Things not to break

- **`/sw.js` must stay at the site root.** Moving it unregisters the
  service worker and kills live push subscriptions. See
  [ADR 0001](docs/adr/0001-portfolio-at-root-tracker-at-deals.md).
- **Scraping scope stays narrow:** exact SKUs, the existing schedule, and
  no category or keyword crawling.
