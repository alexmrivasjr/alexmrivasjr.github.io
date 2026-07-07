import type {
  AddOn,
  DayPlan,
  DayType,
  Exclusion,
  MacroTargets,
  Member,
  MemberId,
  Occasion,
  Recipe,
  ScaledPortion,
} from '../types'
import { occasionTargetFor, withinTolerance } from './macros'
import { RECIPES, getRecipe, recipesForOccasion } from '../data/recipes'

const OCCASIONS: Occasion[] = ['breakfast', 'lunch', 'dinner', 'snack']
const MIN_MULTIPLIER = 0.5
const MAX_MULTIPLIER = 3
const MAX_ADD_ON_ROUNDS = 6

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n))
}

function recipeText(recipe: Recipe): string {
  return [recipe.name, recipe.protein.name, recipe.starch.name, recipe.vegetable.name].join(' ').toLowerCase()
}

export function isExcluded(recipe: Recipe, exclusions: Exclusion[], memberId: MemberId): boolean {
  const relevant = exclusions.filter((e) => e.scope === 'household' || e.scope === memberId)
  const text = recipeText(recipe)
  return relevant.some((e) => text.includes(e.label.toLowerCase()))
}

function totalsFor(recipe: Recipe, proteinMultiplier: number, starchMultiplier: number, addOns: AddOn[]): MacroTargets {
  const base = {
    calories: recipe.protein.kcal * proteinMultiplier + recipe.starch.kcal * starchMultiplier + recipe.vegetable.kcal,
    proteinG: recipe.protein.proteinG * proteinMultiplier + recipe.starch.proteinG * starchMultiplier + recipe.vegetable.proteinG,
    fatG: recipe.protein.fatG * proteinMultiplier + recipe.starch.fatG * starchMultiplier + recipe.vegetable.fatG,
    carbG: recipe.protein.carbG * proteinMultiplier + recipe.starch.carbG * starchMultiplier + recipe.vegetable.carbG,
  }
  for (const a of addOns) {
    base.calories += a.kcal
    base.proteinG += a.proteinG
    base.fatG += a.fatG
    base.carbG += a.carbG
  }
  return {
    calories: Math.round(base.calories),
    proteinG: Math.round(base.proteinG * 10) / 10,
    fatG: Math.round(base.fatG * 10) / 10,
    carbG: Math.round(base.carbG * 10) / 10,
  }
}

function gapScore(totals: MacroTargets, target: MacroTargets): number {
  return (
    Math.abs(totals.calories - target.calories) / Math.max(target.calories, 1) +
    Math.abs(totals.proteinG - target.proteinG) / Math.max(target.proteinG, 1) +
    Math.abs(totals.fatG - target.fatG) / Math.max(target.fatG, 1) +
    Math.abs(totals.carbG - target.carbG) / Math.max(target.carbG, 1)
  )
}

/**
 * Solves for the (proteinMultiplier, starchMultiplier) pair that best fits ALL FOUR macro
 * targets at once, weighted by relative error (1/target^2) so calories don't dominate
 * grams. A naive approach (multiplier = target / component, chosen independently per
 * macro) ignores that the starch component also contributes protein and vice versa,
 * which systematically overshoots — this weighted least-squares fit accounts for those
 * cross-contributions.
 */
function solveMultipliers(recipe: Recipe, target: MacroTargets, minMultiplier: number): { proteinMultiplier: number; starchMultiplier: number } {
  const proteinVec = [recipe.protein.kcal, recipe.protein.proteinG, recipe.protein.fatG, recipe.protein.carbG]
  const starchVec = [recipe.starch.kcal, recipe.starch.proteinG, recipe.starch.fatG, recipe.starch.carbG]
  const fixedVec = [recipe.vegetable.kcal, recipe.vegetable.proteinG, recipe.vegetable.fatG, recipe.vegetable.carbG]
  const targetVec = [target.calories, target.proteinG, target.fatG, target.carbG]
  const weights = targetVec.map((t) => (t > 0 ? 1 / (t * t) : 0))

  let s11 = 0, s12 = 0, s22 = 0, t1 = 0, t2 = 0
  for (let i = 0; i < 4; i++) {
    const w = weights[i]
    const residual = targetVec[i] - fixedVec[i]
    s11 += w * proteinVec[i] * proteinVec[i]
    s12 += w * proteinVec[i] * starchVec[i]
    s22 += w * starchVec[i] * starchVec[i]
    t1 += w * proteinVec[i] * residual
    t2 += w * starchVec[i] * residual
  }

  const det = s11 * s22 - s12 * s12
  let proteinMultiplier: number
  let starchMultiplier: number
  if (Math.abs(det) < 1e-9) {
    // Degenerate (protein/starch macro profiles proportional) — fall back to independent fit.
    proteinMultiplier = recipe.protein.proteinG > 0 ? target.proteinG / recipe.protein.proteinG : 1
    starchMultiplier = recipe.starch.carbG > 0 ? target.carbG / recipe.starch.carbG : 1
  } else {
    proteinMultiplier = (t1 * s22 - s12 * t2) / det
    starchMultiplier = (s11 * t2 - s12 * t1) / det
  }

  return {
    proteinMultiplier: clamp(proteinMultiplier, minMultiplier, MAX_MULTIPLIER),
    starchMultiplier: clamp(starchMultiplier, minMultiplier, MAX_MULTIPLIER),
  }
}

/**
 * Scales a shared base recipe's protein + starch components to hit an individual's macro
 * target for one eating occasion, then greedily layers on "simple add-ons" (PRD 6.1) to
 * close whatever gap remains. `isFloorOnly` (Damian) biases toward "eat enough" — the
 * multiplier never drops below 1x so his plan is never shrunk into a deficit.
 */
export function scalePortion(recipe: Recipe, target: MacroTargets, isFloorOnly = false): Omit<ScaledPortion, 'memberId'> {
  const minMultiplier = isFloorOnly ? 1 : MIN_MULTIPLIER
  const { proteinMultiplier, starchMultiplier } = solveMultipliers(recipe, target, minMultiplier)

  const chosenAddOns: AddOn[] = []
  let bestScore = gapScore(totalsFor(recipe, proteinMultiplier, starchMultiplier, chosenAddOns), target)

  const chosenIds = new Set<string>()
  for (let round = 0; round < MAX_ADD_ON_ROUNDS; round++) {
    let bestAddOn: AddOn | null = null
    let bestRoundScore = bestScore
    for (const addOn of recipe.addOns) {
      if (chosenIds.has(addOn.id)) continue // keep add-ons "simple" — each used at most once per portion
      const candidate = [...chosenAddOns, addOn]
      const score = gapScore(totalsFor(recipe, proteinMultiplier, starchMultiplier, candidate), target)
      if (score < bestRoundScore) {
        bestRoundScore = score
        bestAddOn = addOn
      }
    }
    if (!bestAddOn) break
    chosenAddOns.push(bestAddOn)
    chosenIds.add(bestAddOn.id)
    bestScore = bestRoundScore
  }

  const totals = totalsFor(recipe, proteinMultiplier, starchMultiplier, chosenAddOns)
  const withinAll =
    withinTolerance(totals.calories, target.calories) &&
    withinTolerance(totals.proteinG, target.proteinG) &&
    withinTolerance(totals.fatG, target.fatG) &&
    withinTolerance(totals.carbG, target.carbG)

  return {
    proteinMultiplier: Math.round(proteinMultiplier * 100) / 100,
    starchMultiplier: Math.round(starchMultiplier * 100) / 100,
    addOnIds: chosenAddOns.map((a) => a.id),
    totals,
    target,
    withinTolerance: withinAll,
  }
}

function eligibleRecipes(occasion: Occasion, exclusions: Exclusion[], members: Member[], recentRecipeIds: Set<string>): Recipe[] {
  const pool = recipesForOccasion(occasion)
  const notExcluded = pool.filter((r) => !members.some((m) => isExcluded(r, exclusions, m.id)))
  const fresh = notExcluded.filter((r) => !recentRecipeIds.has(r.id))
  return fresh.length > 0 ? fresh : notExcluded.length > 0 ? notExcluded : pool
}

/** Deterministic-but-varied pick so the same date+occasion always regenerates the same way until history changes. */
function seededPick<T>(items: T[], seed: string): T {
  let hash = 0
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0
  return items[hash % items.length]
}

function buildPortions(
  recipe: Recipe,
  occasion: Occasion,
  members: Member[],
  dayTypes: Partial<Record<MemberId, DayType>>,
  restDays: Partial<Record<MemberId, boolean>>,
): Partial<Record<MemberId, ScaledPortion>> {
  const portions: Partial<Record<MemberId, ScaledPortion>> = {}
  for (const member of members) {
    const target = occasionTargetFor(member, occasion, dayTypes[member.id], restDays[member.id] ?? false)
    portions[member.id] = { memberId: member.id, ...scalePortion(recipe, target, member.isFloorOnly) }
  }
  return portions
}

export interface GeneratePlanOptions {
  date: string
  members: Member[]
  exclusions: Exclusion[]
  recentRecipeIds: string[]
  dayTypes?: Partial<Record<MemberId, DayType>>
  restDays?: Partial<Record<MemberId, boolean>>
}

export function generateDayPlan(opts: GeneratePlanOptions): DayPlan {
  const recent = new Set(opts.recentRecipeIds)
  const dayTypes = opts.dayTypes ?? {}
  const restDays = opts.restDays ?? {}

  const meals = OCCASIONS.map((occasion) => {
    const pool = eligibleRecipes(occasion, opts.exclusions, opts.members, recent)
    const recipe = seededPick(pool, `${opts.date}:${occasion}`)
    return {
      occasion,
      recipeId: recipe.id,
      overrides: {},
      portions: buildPortions(recipe, occasion, opts.members, dayTypes, restDays),
    }
  })

  return { date: opts.date, dayTypes, meals }
}

/**
 * Rejects a meal (PRD 6.1 "no to this" -> instant replacement). If `forMemberId` is set,
 * only that person's portion is swapped to an alternate recipe — the shared household meal
 * is untouched. Otherwise the whole household's shared base meal is replaced.
 */
export function replaceMeal(
  plan: DayPlan,
  occasion: Occasion,
  members: Member[],
  exclusions: Exclusion[],
  recentRecipeIds: string[],
  forMemberId?: MemberId,
): DayPlan {
  const slot = plan.meals.find((m) => m.occasion === occasion)
  if (!slot) return plan

  const currentRecipeId = forMemberId ? (slot.overrides[forMemberId] ?? slot.recipeId) : slot.recipeId
  const recent = new Set([...recentRecipeIds, currentRecipeId])
  const pool = eligibleRecipes(occasion, exclusions, forMemberId ? members.filter((m) => m.id === forMemberId) : members, recent)
  const newRecipe = seededPick(pool, `${plan.date}:${occasion}:reject:${Date.now()}`)

  const meals = plan.meals.map((m) => {
    if (m.occasion !== occasion) return m

    if (forMemberId) {
      const member = members.find((mm) => mm.id === forMemberId)!
      const target = occasionTargetFor(member, occasion, plan.dayTypes[forMemberId], false)
      return {
        ...m,
        overrides: { ...m.overrides, [forMemberId]: newRecipe.id },
        portions: {
          ...m.portions,
          [forMemberId]: { memberId: forMemberId, ...scalePortion(newRecipe, target, member.isFloorOnly) },
        },
      }
    }

    const membersWithoutOverride = members.filter((mm) => !m.overrides[mm.id])
    const refreshedPortions = buildPortions(newRecipe, occasion, membersWithoutOverride, plan.dayTypes, {})
    return {
      ...m,
      recipeId: newRecipe.id,
      portions: { ...m.portions, ...refreshedPortions },
    }
  })

  return { ...plan, meals }
}

export function recipeIdForMember(occasion: Occasion, plan: DayPlan, memberId: MemberId): string {
  const slot = plan.meals.find((m) => m.occasion === occasion)
  if (!slot) return ''
  return slot.overrides[memberId] ?? slot.recipeId
}

export { getRecipe, RECIPES }
