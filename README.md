# Household Nutrition & Meal Planning

A shared meal-planning app for the Rivas household, built from `Family_Nutrition_PRD.docx`
(Phases 1–3: profiles + macro targets, shared meal generator with per-person portion
scaling, and a persistent exclusion list — plus placeholder screens for the Phase 4
training-calendar integration and Phase 5 pantry photo recognition).

## How it works

- **One shared meal per occasion, scaled per person.** Each recipe is a protein + starch
  + fixed vegetable. The engine solves for how much protein/starch each person needs
  (weighted least-squares across calories/protein/fat/carbs, since one meal has to satisfy
  four different targets from two scaling knobs) and layers on simple add-ons — extra rice,
  a protein scoop, olive oil — to close the remaining gap. Anyone can reject a meal
  (swaps it for the whole household) or reject just their own portion (swaps only their
  serving, everyone else's is untouched).
- **Plans roll forward automatically** — there are always ~5 days planned ahead, and any
  day (or any single meal) can be regenerated on demand.
- **Exclusions are permanent** until removed — add one at the household or individual
  level and it's filtered out of all future meal generation immediately.
- **Privacy is enforced per the PRD**: body-fat %, exact weight, and weight-trend data are
  visible only to that person and to Alex (the admin). Damian's own profile never shows
  raw numbers — he sees qualitative, encouraging framing instead. Edits Damian makes to
  his own plan are logged to a digest only Alex can see; Damian is never shown it exists.

## Local development

```bash
npm install
npm run dev
```

Without any Firebase config, the app runs in **demo mode**: data persists to
`localStorage` in your browser only (not shared across devices) so you can try the whole
app immediately. A banner in the UI makes this obvious. Every data-access call goes
through the same interface (`src/lib/store.ts`) whether it's talking to `localStorage` or
Firestore, so turning on real sync later is a config change, not a rewrite.

## Turning on real household-wide sync (Firebase)

1. Create a free project at [console.firebase.google.com](https://console.firebase.google.com).
2. Enable **Authentication → Sign-in method → Email/Password**. (The app's login UI is a
   simple name + PIN picker, appropriate for a 12-year-old — under the hood it creates a
   real Firebase Auth account per person on their first PIN entry, so Firestore security
   rules can enforce the privacy rules above.)
3. Enable **Firestore Database** (production mode is fine — the rules below lock it down).
4. Deploy the included security rules, which encode the privacy model (private metrics
   visible to self + Alex only; Damian's digest visible to Alex only):
   ```bash
   npm install -g firebase-tools
   firebase login
   firebase deploy --only firestore:rules --project <your-project-id>
   ```
5. Copy `.env.example` to `.env.local` and fill in the values from Firebase console →
   Project settings → Your apps → SDK setup. Restart `npm run dev`.
6. For the deployed site, add the same values as **repository secrets** (Settings →
   Secrets and variables → Actions) with the same names as in `.env.example` — the deploy
   workflow reads them from there.

## Deploying

`.github/workflows/deploy.yml` builds and deploys to GitHub Pages on every push to `main`.
One-time setup: repo **Settings → Pages → Source → GitHub Actions**. The site serves at
the root of `alexmrivasjr.github.io`. It deploys fine with no Firebase secrets set (demo
mode); add the secrets above whenever you're ready for real cross-device sync.

## Known limitations (v1)

- **Nutrition data is placeholder.** The PRD calls for USDA FoodData Central as the
  source of record (Section 8); recipe macros here are reasonable hand-entered estimates
  so the scaling engine and UI could be built and tested end-to-end without an API key.
  Swapping in real FDC lookups is the natural next step.
- **The ±5% tolerance is a "Should," not a hard guarantee.** With one shared recipe and
  only two scaling knobs (protein portion, starch portion) plus a handful of add-ons,
  hitting four different macro targets simultaneously isn't always possible — especially
  for a very high-protein, low-carb target like Melissa's (42% protein). The app shows
  exactly which meals land outside tolerance and what add-ons it used, so nothing is
  hidden, but a wider recipe/add-on library would tighten this further.
- **Household is hardcoded to the four family members** in `src/data/household.ts` (per
  PRD Section 9, "Out of Scope v1: support for household members outside the immediate
  family of four").
- **Phase 4 (training calendar) and Phase 5 (pantry photo recognition)** are placeholder
  screens only — both explicitly depend on work that hasn't started yet (a separate
  companion workout app, and photo-recognition tooling).
