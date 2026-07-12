import type { DayPlan, DigestEntry, Exclusion, MemberId, MemberProfile, PrivateMetrics, PublicMemberInfo } from '../types'
import { db, isFirebaseConfigured, HOUSEHOLD_ID } from '../firebase'
import { MEMBER_SLOTS, DEMO_PROFILES } from '../data/household'

export interface DataStore {
  readonly mode: 'firestore' | 'local-demo'
  listExclusions(): Promise<Exclusion[]>
  addExclusion(scope: Exclusion['scope'], label: string, addedBy: MemberId): Promise<Exclusion>
  removeExclusion(id: string): Promise<void>

  getDayPlan(date: string): Promise<DayPlan | null>
  saveDayPlan(plan: DayPlan): Promise<void>
  recentRecipeIds(beforeDate: string, lookbackDays: number): Promise<string[]>

  /** Safe to call before authentication — id + chosen nickname only, nothing sensitive. */
  listPublicMemberInfo(): Promise<PublicMemberInfo[]>
  /** Full profile (biometrics, goals, macro targets). Requires household authentication. */
  getMemberProfile(memberId: MemberId): Promise<MemberProfile | null>
  updateMemberProfile(memberId: MemberId, patch: Partial<MemberProfile>): Promise<void>

  getPrivateMetrics(memberId: MemberId): Promise<PrivateMetrics | null>
  updatePrivateMetrics(memberId: MemberId, patch: Partial<PrivateMetrics>): Promise<void>

  listDigestEntries(): Promise<DigestEntry[]>
  addDigestEntry(entry: DigestEntry): Promise<void>
}

// ---------------------------------------------------------------------------
// Local (offline demo) backend — used until a Firebase project is configured.
// Persists to this browser only, so it is NOT shared across household devices.
// Seeded with generic placeholder profiles (never real household data — this
// file ships in the public JS bundle). Same interface as the Firestore
// backend so swapping in real config is a drop-in upgrade with no UI changes.
// ---------------------------------------------------------------------------

const LOCAL_KEY = 'household-nutrition-demo-v1'

interface LocalData {
  exclusions: Exclusion[]
  dayPlans: Record<string, DayPlan>
  profiles: Partial<Record<MemberId, MemberProfile>>
  privateMetrics: Partial<Record<MemberId, PrivateMetrics>>
  digestEntries: DigestEntry[]
}

function loadLocal(): LocalData {
  const raw = localStorage.getItem(LOCAL_KEY)
  if (!raw) {
    return { exclusions: [], dayPlans: {}, profiles: { ...DEMO_PROFILES }, privateMetrics: {}, digestEntries: [] }
  }
  try {
    return JSON.parse(raw) as LocalData
  } catch {
    return { exclusions: [], dayPlans: {}, profiles: { ...DEMO_PROFILES }, privateMetrics: {}, digestEntries: [] }
  }
}

function saveLocal(data: LocalData) {
  localStorage.setItem(LOCAL_KEY, JSON.stringify(data))
}

class LocalStore implements DataStore {
  readonly mode = 'local-demo' as const

  async listExclusions(): Promise<Exclusion[]> {
    return loadLocal().exclusions
  }

  async addExclusion(scope: Exclusion['scope'], label: string, addedBy: MemberId): Promise<Exclusion> {
    const data = loadLocal()
    const exclusion: Exclusion = { id: crypto.randomUUID(), scope, label, addedBy, addedAt: new Date().toISOString() }
    data.exclusions.push(exclusion)
    saveLocal(data)
    return exclusion
  }

  async removeExclusion(id: string): Promise<void> {
    const data = loadLocal()
    data.exclusions = data.exclusions.filter((e) => e.id !== id)
    saveLocal(data)
  }

  async getDayPlan(date: string): Promise<DayPlan | null> {
    return loadLocal().dayPlans[date] ?? null
  }

  async saveDayPlan(plan: DayPlan): Promise<void> {
    const data = loadLocal()
    data.dayPlans[plan.date] = plan
    saveLocal(data)
  }

  async recentRecipeIds(beforeDate: string, lookbackDays: number): Promise<string[]> {
    const data = loadLocal()
    const cutoff = new Date(beforeDate)
    cutoff.setDate(cutoff.getDate() - lookbackDays)
    const ids: string[] = []
    for (const plan of Object.values(data.dayPlans)) {
      const d = new Date(plan.date)
      if (d >= cutoff && d < new Date(beforeDate)) {
        for (const meal of plan.meals) ids.push(meal.recipeId)
      }
    }
    return ids
  }

  async listPublicMemberInfo(): Promise<PublicMemberInfo[]> {
    const data = loadLocal()
    return MEMBER_SLOTS.map((slot) => ({ id: slot.id, displayName: data.profiles[slot.id]?.displayName ?? `(${slot.id})` }))
  }

  async getMemberProfile(memberId: MemberId): Promise<MemberProfile | null> {
    return loadLocal().profiles[memberId] ?? null
  }

  async updateMemberProfile(memberId: MemberId, patch: Partial<MemberProfile>): Promise<void> {
    const data = loadLocal()
    data.profiles[memberId] = { ...data.profiles[memberId], ...patch } as MemberProfile
    saveLocal(data)
  }

  async getPrivateMetrics(memberId: MemberId): Promise<PrivateMetrics | null> {
    return loadLocal().privateMetrics[memberId] ?? null
  }

  async updatePrivateMetrics(memberId: MemberId, patch: Partial<PrivateMetrics>): Promise<void> {
    const data = loadLocal()
    const existing = data.privateMetrics[memberId] ?? { memberId, weightTrend: [], updatedAt: new Date().toISOString() }
    data.privateMetrics[memberId] = { ...existing, ...patch, updatedAt: new Date().toISOString() }
    saveLocal(data)
  }

  async listDigestEntries(): Promise<DigestEntry[]> {
    return loadLocal().digestEntries
  }

  async addDigestEntry(entry: DigestEntry): Promise<void> {
    const data = loadLocal()
    data.digestEntries.push(entry)
    saveLocal(data)
  }
}

// ---------------------------------------------------------------------------
// Firestore backend — active once VITE_FIREBASE_* env vars are set. Layout
// matches firestore.rules at the repo root; keep the two in sync.
//
// households/{id}/members/{memberId}                    -> PublicMemberInfo (public read)
// households/{id}/members/{memberId}/private/profile     -> MemberProfile (household-auth read)
// households/{id}/members/{memberId}/private/metrics     -> PrivateMetrics (self+admin read)
// ---------------------------------------------------------------------------

class FirestoreStore implements DataStore {
  readonly mode = 'firestore' as const

  private async fs() {
    const mod = await import('firebase/firestore')
    if (!db) throw new Error('Firestore is not configured')
    return { fs: mod, db }
  }

  async listExclusions(): Promise<Exclusion[]> {
    const { fs, db } = await this.fs()
    const snap = await fs.getDocs(fs.collection(db, 'households', HOUSEHOLD_ID, 'exclusions'))
    return snap.docs.map((d) => d.data() as Exclusion)
  }

  async addExclusion(scope: Exclusion['scope'], label: string, addedBy: MemberId): Promise<Exclusion> {
    const { fs, db } = await this.fs()
    const exclusion: Exclusion = { id: crypto.randomUUID(), scope, label, addedBy, addedAt: new Date().toISOString() }
    await fs.setDoc(fs.doc(db, 'households', HOUSEHOLD_ID, 'exclusions', exclusion.id), exclusion)
    return exclusion
  }

  async removeExclusion(id: string): Promise<void> {
    const { fs, db } = await this.fs()
    await fs.deleteDoc(fs.doc(db, 'households', HOUSEHOLD_ID, 'exclusions', id))
  }

  async getDayPlan(date: string): Promise<DayPlan | null> {
    const { fs, db } = await this.fs()
    const snap = await fs.getDoc(fs.doc(db, 'households', HOUSEHOLD_ID, 'mealPlan', date))
    return snap.exists() ? (snap.data() as DayPlan) : null
  }

  async saveDayPlan(plan: DayPlan): Promise<void> {
    const { fs, db } = await this.fs()
    await fs.setDoc(fs.doc(db, 'households', HOUSEHOLD_ID, 'mealPlan', plan.date), plan)
  }

  async recentRecipeIds(beforeDate: string, lookbackDays: number): Promise<string[]> {
    const { fs, db } = await this.fs()
    const cutoff = new Date(beforeDate)
    cutoff.setDate(cutoff.getDate() - lookbackDays)
    const cutoffStr = cutoff.toISOString().slice(0, 10)
    const q = fs.query(
      fs.collection(db, 'households', HOUSEHOLD_ID, 'mealPlan'),
      fs.where('date', '>=', cutoffStr),
      fs.where('date', '<', beforeDate),
    )
    const snap = await fs.getDocs(q)
    const ids: string[] = []
    snap.forEach((d) => {
      const plan = d.data() as DayPlan
      for (const meal of plan.meals) ids.push(meal.recipeId)
    })
    return ids
  }

  async listPublicMemberInfo(): Promise<PublicMemberInfo[]> {
    const { fs, db } = await this.fs()
    const snap = await fs.getDocs(fs.collection(db, 'households', HOUSEHOLD_ID, 'members'))
    const byId = new Map(snap.docs.map((d) => [d.id, d.data() as PublicMemberInfo]))
    // Always return all four slots so the login picker never renders empty for an
    // unclaimed member — falls back to a generic label until someone sets it.
    return MEMBER_SLOTS.map((slot) => byId.get(slot.id) ?? { id: slot.id, displayName: `(${slot.id})` })
  }

  async getMemberProfile(memberId: MemberId): Promise<MemberProfile | null> {
    const { fs, db } = await this.fs()
    const snap = await fs.getDoc(fs.doc(db, 'households', HOUSEHOLD_ID, 'members', memberId, 'private', 'profile'))
    return snap.exists() ? (snap.data() as MemberProfile) : null
  }

  async updateMemberProfile(memberId: MemberId, patch: Partial<MemberProfile>): Promise<void> {
    const { fs, db } = await this.fs()
    await fs.setDoc(fs.doc(db, 'households', HOUSEHOLD_ID, 'members', memberId, 'private', 'profile'), patch, { merge: true })
    if (patch.displayName) {
      // Public doc mirrors ONLY the nickname -- never biometrics/goals/macros.
      await fs.setDoc(fs.doc(db, 'households', HOUSEHOLD_ID, 'members', memberId), { id: memberId, displayName: patch.displayName }, { merge: true })
    }
  }

  async getPrivateMetrics(memberId: MemberId): Promise<PrivateMetrics | null> {
    const { fs, db } = await this.fs()
    const snap = await fs.getDoc(fs.doc(db, 'households', HOUSEHOLD_ID, 'members', memberId, 'private', 'metrics'))
    return snap.exists() ? (snap.data() as PrivateMetrics) : null
  }

  async updatePrivateMetrics(memberId: MemberId, patch: Partial<PrivateMetrics>): Promise<void> {
    const { fs, db } = await this.fs()
    await fs.setDoc(
      fs.doc(db, 'households', HOUSEHOLD_ID, 'members', memberId, 'private', 'metrics'),
      { memberId, ...patch, updatedAt: new Date().toISOString() },
      { merge: true },
    )
  }

  async listDigestEntries(): Promise<DigestEntry[]> {
    const { fs, db } = await this.fs()
    const snap = await fs.getDocs(fs.collection(db, 'households', HOUSEHOLD_ID, 'digests'))
    return snap.docs.map((d) => d.data() as DigestEntry)
  }

  async addDigestEntry(entry: DigestEntry): Promise<void> {
    const { fs, db } = await this.fs()
    await fs.setDoc(fs.doc(db, 'households', HOUSEHOLD_ID, 'digests', `${entry.weekId}-${entry.memberId}`), entry)
  }
}

export const store: DataStore = isFirebaseConfigured ? new FirestoreStore() : new LocalStore()
