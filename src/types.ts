export type MemberId = 'alex' | 'melissa' | 'julian' | 'damian'

export type Occasion = 'breakfast' | 'lunch' | 'dinner' | 'snack'

export type MealTag = 'familiar' | 'adventurous'

export interface MacroTargets {
  calories: number
  proteinG: number
  fatG: number
  carbG: number
}

/** Melissa alternates deficit/maintenance days; everyone else has one day type. */
export type DayType = 'standard' | 'deficit' | 'maintenance' | 'training-2x'

/**
 * Structural config for a household member slot — safe to ship in the public JS bundle
 * (it's just role flags, not identifying data). Defined in src/data/household.ts.
 */
export interface MemberSlot {
  id: MemberId
  isMinor: boolean
  /** true for members whose targets must never be reduced below this (Damian). */
  isFloorOnly: boolean
  /** Members allowed to see this person's private body-composition metrics, in addition to themselves. */
  privacyDelegates: MemberId[]
}

/**
 * Just enough to render the pre-login profile picker. Publicly readable (no auth) by
 * design — everything more sensitive than a chosen nickname lives in MemberProfile
 * instead, which requires authentication to read.
 */
export interface PublicMemberInfo {
  id: MemberId
  displayName: string
}

/**
 * The actual personal data (name, biometrics, goals, macro targets). Never committed to
 * git or bundled in client JS — lives only in Firestore behind auth, entered once by the
 * household through the Profile screen. Local demo mode uses generic placeholder values
 * instead of real data for exactly this reason.
 */
export interface MemberProfile {
  displayName: string
  age: number
  heightIn: number
  weightLb: number
  activityLevel: string
  goal: string
  /** Targets keyed by day type. Most members only have 'standard'. */
  targetsByDayType: Partial<Record<DayType, MacroTargets>>
  formulaNote: string
}

/** MemberSlot + MemberProfile assembled at runtime — the shape the rest of the app works with. */
export type Member = MemberSlot & MemberProfile

export interface PrivateMetrics {
  memberId: MemberId
  bodyFatPct?: number
  exactWeightLb?: number
  weightTrend: { date: string; weightLb: number }[]
  updatedAt: string
}

export interface FoodComponent {
  name: string
  /** macros for one scalable "unit" of this component, e.g. 4oz cooked chicken or 1/2 cup rice */
  kcal: number
  proteinG: number
  fatG: number
  carbG: number
}

export interface FixedComponent {
  name: string
  kcal: number
  proteinG: number
  fatG: number
  carbG: number
}

export interface AddOn {
  id: string
  name: string
  kcal: number
  proteinG: number
  fatG: number
  carbG: number
}

export interface Recipe {
  id: string
  name: string
  occasion: Occasion
  tags: MealTag[]
  /** Familiar formats (taco/bowl/wrap) that make protein/sauce swaps easy for picky eaters. */
  kidFriendlyFormat?: string
  protein: FoodComponent
  starch: FoodComponent
  vegetable: FixedComponent
  addOns: AddOn[]
}

export interface ScaledPortion {
  memberId: MemberId
  proteinMultiplier: number
  starchMultiplier: number
  addOnIds: string[]
  totals: MacroTargets
  target: MacroTargets
  withinTolerance: boolean
}

export interface MealSlot {
  occasion: Occasion
  recipeId: string
  /** memberId -> alternate recipeId, used when that member rejected the shared meal */
  overrides: Partial<Record<MemberId, string>>
  portions: Partial<Record<MemberId, ScaledPortion>>
}

export interface DayPlan {
  date: string // YYYY-MM-DD
  dayTypes: Partial<Record<MemberId, DayType>>
  meals: MealSlot[]
}

export interface Exclusion {
  id: string
  scope: 'household' | MemberId
  label: string
  addedBy: MemberId
  addedAt: string
}

export interface DigestEntry {
  weekId: string // e.g. 2026-W27
  /** Whichever member has isFloorOnly=true (Damian's role in this household's slot config). */
  memberId: MemberId
  summary: string
  trending: 'toward-goals' | 'away-from-goals' | 'neutral'
  createdAt: string
}
