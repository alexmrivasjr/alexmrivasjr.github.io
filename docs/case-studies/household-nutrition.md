# Case study: Household Nutrition & Meal Planner

> One shared meal per occasion for a household with four different macro
> targets, with portions scaled per person and **privacy rules enforced by
> the database, not the UI**.

| | |
|---|---|
| **Stack** | React 18 · TypeScript · Vite · Tailwind · Firebase Auth + Firestore security rules · GitHub Actions deploy |
| **Status** | PRD phases 1–3 shipped (profiles + macro targets, meal generator with per-person scaling, exclusions); phases 4–5 stubbed |
| **Repo** | Private (household app). Architecture shown here; no household data. |

## Problem

Four people with different calorie and macro goals, one of them a minor, eat
the same dinner. The plan had to come from a written PRD, and it had to
respect who can see whose body metrics.

## Key decisions

**Portion solving as a small optimization problem.** Each recipe is a
protein, a starch, and a fixed vegetable. For each person the engine solves
for protein and starch multipliers (clamped to 0.5–3×) that minimize a
normalized error across calories, protein, fat, and carbs. That's four
targets with only two knobs, so it can't hit all of them exactly. It then
adds simple add-ons (extra rice, a protein scoop, oil) for a bounded number
of rounds to close the remaining gap. Anyone can reject the whole meal (it
swaps for everyone) or reject only their own portion.

**Privacy is in `firestore.rules`, not in React.**

| Data | Who can read it |
|---|---|
| Display nickname | Unauthenticated (needed for the login picker) |
| Profile and macro targets | Any household member (needed for planning) |
| Body fat %, exact weight, trend | **Only that person and the admin** |
| Edit digest for the minor | **Admin only** |

The UI goes further for the minor's own view: qualitative, encouraging
framing instead of raw numbers.

**No real data in source control or the JS bundle.** An early version had
household data in a source file. Fixing that was a deliberate commit: all
personal data moved behind authenticated Firestore, and the code now holds
only structural role config. Demo mode uses obviously fake placeholder
people.

**One storage interface, two backends.** `store.ts` has the same API over
`localStorage` (demo mode, which works with zero setup) and Firestore (real
sync). Turning on sync is a config change, not a rewrite.

## What I'd do next

- Firestore rules unit tests with the emulator. Rules are code and should
  have tests like code.
- Property-based tests for the portion solver: totals should never go
  negative, and multipliers should always stay within the clamp.
