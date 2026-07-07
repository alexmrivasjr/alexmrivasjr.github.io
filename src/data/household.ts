import type { Member } from '../types'

/**
 * Targets transcribed from the PRD (Section 3 + Appendix). Mifflin-St Jeor maintenance
 * estimates, cross-checked against the family's prior tracking app, then adjusted per
 * person's stated goal. Kept here (not hardcoded in the UI) so every screen shows the
 * same auditable numbers per NFR "transparent/auditable" requirement.
 */
export const HOUSEHOLD_MEMBERS: Member[] = [
  {
    id: 'alex',
    displayName: 'Alex (Jr)',
    age: 38,
    heightIn: 73,
    weightLb: 238,
    activityLevel: 'Active',
    goal: 'Fat loss, preserve muscle (~2 lb/wk)',
    isMinor: false,
    isFloorOnly: false,
    privacyDelegates: ['alex'],
    targetsByDayType: {
      standard: { calories: 2700, proteinG: 200, fatG: 80, carbG: 295 },
    },
    formulaNote:
      'Mifflin-St Jeor maintenance, adjusted for fat-loss deficit. Protein raised from an original 135g (20%) to 200g (30%) to better preserve muscle during the cut.',
  },
  {
    id: 'melissa',
    displayName: 'Melissa',
    age: 38,
    heightIn: 65,
    weightLb: 246.9,
    activityLevel: 'Lightly Active',
    goal: 'Fat loss, preserve muscle (1 lb/wk) — 6 deficit days + 1 maintenance day/week',
    isMinor: false,
    isFloorOnly: false,
    privacyDelegates: ['melissa', 'alex'],
    targetsByDayType: {
      deficit: { calories: 1980, proteinG: 210, fatG: 70, carbG: 128 },
      maintenance: { calories: 2480, proteinG: 210, fatG: 80, carbG: 230 },
    },
    formulaNote:
      'Mifflin-St Jeor maintenance, adjusted to a sustainable 1 lb/wk loss rate (revised down from an original 1.5 lb/wk target). 6 deficit days (1,980 cal) + 1 weekly maintenance day (~2,480 cal), placed manually on her highest-training-demand day. Protein (210g) stays fixed on both day types.',
  },
  {
    id: 'julian',
    displayName: 'Julian',
    age: 17,
    heightIn: 70,
    weightLb: 190,
    activityLevel: 'Athlete (2x/day training days)',
    goal: 'Body recomposition — lean muscle gain, gradual fat loss',
    isMinor: true,
    isFloorOnly: false,
    privacyDelegates: ['julian', 'alex'],
    targetsByDayType: {
      standard: { calories: 2900, proteinG: 175, fatG: 80, carbG: 335 },
    },
    formulaNote:
      'Mifflin-St Jeor maintenance for an active 17-year-old athlete, adjusted for recomposition. High carb allocation (51%) supports 2x/day training days; carb timing shifts further via Section 6.2 once training-calendar integration ships.',
  },
  {
    id: 'damian',
    displayName: 'Damian',
    age: 12,
    heightIn: 64,
    weightLb: 120,
    activityLevel: 'Athlete',
    goal: 'Performance fueling & growth — NOT caloric restriction',
    isMinor: true,
    isFloorOnly: true,
    privacyDelegates: ['damian', 'alex'],
    targetsByDayType: {
      // No fixed adult-style target per PRD — "at/above maintenance", protein ~80-95g,
      // fat "sufficient for growth", carbs "priority". These are a FLOOR, never a ceiling:
      // the meal engine may add to this but must never scale it down as a deficit.
      standard: { calories: 2800, proteinG: 90, fatG: 85, carbG: 415 },
    },
    formulaNote:
      'Estimated maintenance via Mifflin-St Jeor for a 12-year-old athlete (~2,630 cal), rounded up to 2,800 cal as an at/above-maintenance floor. Protein set to the middle of the PRD\'s 80-95g range. This number is a floor, not a target to hit exactly — the app should never apply a deficit here. Consult a pediatrician or youth sports dietitian before any structured change to Damian\'s intake.',
  },
]

export function getMember(id: string): Member | undefined {
  return HOUSEHOLD_MEMBERS.find((m) => m.id === id)
}
