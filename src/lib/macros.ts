import type { DayType, MacroTargets, Member, Occasion } from '../types'

/** Share of daily macros allocated to each eating occasion. */
export const OCCASION_SPLIT: Record<Occasion, number> = {
  breakfast: 0.25,
  lunch: 0.3,
  dinner: 0.35,
  snack: 0.1,
}

export function resolveDayType(member: Member, requested?: DayType): DayType {
  if (requested && member.targetsByDayType[requested]) return requested
  const available = Object.keys(member.targetsByDayType) as DayType[]
  return available.includes('standard') ? 'standard' : available[0]
}

export function dailyTargetFor(member: Member, dayType?: DayType): MacroTargets {
  const resolved = resolveDayType(member, dayType)
  const target = member.targetsByDayType[resolved]
  if (!target) {
    throw new Error(`No macro target defined for ${member.id} on day type ${resolved}`)
  }
  return target
}

/** Rest-day carb adjustment (Should-have 6.2): keep protein constant, trim carbs ~15%. */
export function applyRestDayAdjustment(target: MacroTargets, isRestDay: boolean): MacroTargets {
  if (!isRestDay) return target
  const carbG = Math.round(target.carbG * 0.85)
  const carbDeltaKcal = (target.carbG - carbG) * 4
  return {
    ...target,
    carbG,
    calories: Math.round(target.calories - carbDeltaKcal),
  }
}

export function occasionTargetFor(member: Member, occasion: Occasion, dayType?: DayType, isRestDay = false): MacroTargets {
  const daily = applyRestDayAdjustment(dailyTargetFor(member, dayType), isRestDay)
  const share = OCCASION_SPLIT[occasion]
  return {
    calories: Math.round(daily.calories * share),
    proteinG: Math.round(daily.proteinG * share),
    fatG: Math.round(daily.fatG * share),
    carbG: Math.round(daily.carbG * share),
  }
}

export function withinTolerance(actual: number, target: number, tolerancePct = 0.05): boolean {
  if (target === 0) return actual === 0
  return Math.abs(actual - target) / target <= tolerancePct
}
