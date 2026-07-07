import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { Member, MemberId } from '../types'
import { HOUSEHOLD_MEMBERS, getMember } from '../data/household'
import { signInWithPin, signOutCurrent, subscribeAuth } from '../lib/auth'
import { store } from '../lib/store'
import { ensureDefaultExclusions } from '../lib/seed'
import { isFirebaseConfigured } from '../firebase'

const CURRENT_MEMBER_KEY = 'household-nutrition-current-member'
const ADMIN_ID: MemberId = 'alex'

interface AuthContextValue {
  currentMember: Member | null
  isAdmin: boolean
  loading: boolean
  isDemoMode: boolean
  members: Member[]
  signIn: (memberId: MemberId, pin: string) => Promise<void>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [currentMemberId, setCurrentMemberId] = useState<MemberId | null>(null)
  const [members, setMembers] = useState<Member[]>(HOUSEHOLD_MEMBERS)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const unsubscribe = subscribeAuth((uid) => {
      if (!uid) {
        setCurrentMemberId(null)
      } else {
        const remembered = localStorage.getItem(CURRENT_MEMBER_KEY) as MemberId | null
        setCurrentMemberId(remembered)
      }
      setLoading(false)
    })
    return unsubscribe
  }, [])

  useEffect(() => {
    if (!currentMemberId) return
    ensureDefaultExclusions()
    store.getMemberOverrides().then((overrides) => {
      setMembers(HOUSEHOLD_MEMBERS.map((m) => ({ ...m, ...overrides[m.id] })))
    })
  }, [currentMemberId])

  const value = useMemo<AuthContextValue>(
    () => ({
      currentMember: currentMemberId ? (getMember(currentMemberId) ? members.find((m) => m.id === currentMemberId)! : null) : null,
      isAdmin: currentMemberId === ADMIN_ID,
      loading,
      isDemoMode: !isFirebaseConfigured,
      members,
      async signIn(memberId, pin) {
        await signInWithPin(memberId, pin)
        localStorage.setItem(CURRENT_MEMBER_KEY, memberId)
        setCurrentMemberId(memberId)
      },
      async signOut() {
        await signOutCurrent()
        localStorage.removeItem(CURRENT_MEMBER_KEY)
        setCurrentMemberId(null)
      },
    }),
    [currentMemberId, loading, members],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
