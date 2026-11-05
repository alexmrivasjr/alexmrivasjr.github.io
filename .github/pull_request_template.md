## What

<!-- One or two sentences: what changes for a user or operator. -->

## Why

<!-- The problem, and why this approach over the alternatives. Link an ADR if one applies. -->

## How it was verified

<!-- Commands run, screenshots, before/after. "CI passed" alone is not verification. -->

- [ ] `npm run check` passes
- [ ] Tested in a browser (if UI changed), including at phone width

## Risk & rollback

<!-- What could break (push subscriptions, scheduled jobs, secrets)? How do we undo it? -->

## Checklist

- [ ] Commits follow Conventional Commits, and each one builds on its own
- [ ] No secrets, tokens, or personal data in the diff
- [ ] Docs updated (README / ADR / case study) if behaviour or decisions changed
