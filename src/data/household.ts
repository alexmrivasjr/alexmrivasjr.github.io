import type { MemberId, MemberProfile, MemberSlot } from '../types'

/**
 * Structural role config only — no names, ages, weights, or goals. This file is
 * committed to a public repo and ships in the public JS bundle, so nothing identifying
 * belongs here. Real profile data lives only in Firestore, entered once by the household
 * through the Profile screen (see src/pages/ProfilePage.tsx + src/lib/store.ts).
 */
export const MEMBER_SLOTS: MemberSlot[] = [
  { id: 'alex', isMinor: false, isFloorOnly: false, privacyDelegates: ['alex'] },
  { id: 'melissa', isMinor: false, isFloorOnly: false, privacyDelegates: ['melissa', 'alex'] },
  { id: 'julian', isMinor: true, isFloorOnly: false, privacyDelegates: ['julian', 'alex'] },
  // Damian's isFloorOnly=true is a structural PRD rule (his targets are a floor, never a
  // deficit) — not identifying on its own, so it's fine as static config.
  { id: 'damian', isMinor: true, isFloorOnly: true, privacyDelegates: ['damian', 'alex'] },
]

export function getMemberSlot(id: string): MemberSlot | undefined {
  return MEMBER_SLOTS.find((m) => m.id === id)
}

/**
 * Generic, non-identifying placeholder profiles used only in local-demo mode (no Firebase
 * configured), so the mechanics can be tried out without ever shipping real household data.
 * Deliberately round numbers and role labels instead of real names.
 */
export const DEMO_PROFILES: Record<MemberId, MemberProfile> = {
  alex: {
    displayName: 'Guardian 1 (demo)',
    age: 40,
    heightIn: 70,
    weightLb: 200,
    activityLevel: 'Active',
    goal: 'Example goal: fat loss, preserve muscle',
    targetsByDayType: { standard: { calories: 2600, proteinG: 190, fatG: 80, carbG: 280 } },
    formulaNote: 'Example data for demo mode. Replace with your own household data once Firebase is configured.',
  },
  melissa: {
    displayName: 'Guardian 2 (demo)',
    age: 40,
    heightIn: 65,
    weightLb: 170,
    activityLevel: 'Lightly Active',
    goal: 'Example goal: fat loss, preserve muscle',
    targetsByDayType: {
      deficit: { calories: 1900, proteinG: 180, fatG: 65, carbG: 140 },
      maintenance: { calories: 2300, proteinG: 180, fatG: 75, carbG: 220 },
    },
    formulaNote: 'Example data for demo mode. Replace with your own household data once Firebase is configured.',
  },
  julian: {
    displayName: 'Teen (demo)',
    age: 16,
    heightIn: 68,
    weightLb: 160,
    activityLevel: 'Athlete',
    goal: 'Example goal: body recomposition',
    targetsByDayType: { standard: { calories: 2700, proteinG: 165, fatG: 75, carbG: 310 } },
    formulaNote: 'Example data for demo mode. Replace with your own household data once Firebase is configured.',
  },
  damian: {
    displayName: 'Kid (demo)',
    age: 11,
    heightIn: 58,
    weightLb: 90,
    activityLevel: 'Athlete',
    goal: 'Example goal: performance fueling & growth — not caloric restriction',
    targetsByDayType: { standard: { calories: 2200, proteinG: 75, fatG: 70, carbG: 320 } },
    formulaNote: 'Example data for demo mode — this is a floor, never a deficit. Consult a pediatrician before any real structured change to a child\'s intake.',
  },
}
