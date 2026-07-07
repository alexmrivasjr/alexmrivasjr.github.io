import { store } from './store'

/** Cottage cheese excluded as a standalone/main dish per PRD Section 4 (still fine as a minor ingredient, e.g. lasagna). */
const DEFAULT_HOUSEHOLD_EXCLUSIONS = ['Cottage cheese']

let seeded = false

export async function ensureDefaultExclusions(): Promise<void> {
  if (seeded) return
  seeded = true
  const existing = await store.listExclusions()
  if (existing.length > 0) return
  for (const label of DEFAULT_HOUSEHOLD_EXCLUSIONS) {
    await store.addExclusion('household', label, 'alex')
  }
}
