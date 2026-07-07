import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  type User,
} from 'firebase/auth'
import type { MemberId } from '../types'
import { auth, isFirebaseConfigured, db, HOUSEHOLD_ID } from '../firebase'

/**
 * Auth UX is a name + PIN picker (appropriate for a 12-year-old), but it's backed by real
 * Firebase Auth accounts so Firestore security rules can key privacy checks off
 * request.auth.uid. Each member's PIN becomes their password on a deterministic fake
 * email; the first PIN entry for a member creates their account.
 */
function emailFor(memberId: MemberId): string {
  return `${memberId}@household.local`
}

function passwordFor(pin: string): string {
  return `hh-${pin}` // guarantees Firebase's 6-char password minimum regardless of PIN length
}

export async function signInWithPin(memberId: MemberId, pin: string): Promise<void> {
  if (!isFirebaseConfigured) return localSignIn(memberId, pin)
  const email = emailFor(memberId)
  const password = passwordFor(pin)
  try {
    await signInWithEmailAndPassword(auth!, email, password)
  } catch (err) {
    const code = (err as { code?: string }).code
    if (code === 'auth/user-not-found' || code === 'auth/invalid-credential') {
      const credential = await createUserWithEmailAndPassword(auth!, email, password)
      await claimMemberId(credential.user.uid, memberId)
      return
    }
    throw err
  }
}

/**
 * Records which Firestore-auth uid corresponds to which of the four known household
 * members, so security rules can key privacy checks (e.g. Damian's digest, private body
 * metrics) off request.auth.uid without the client choosing its own uid.
 */
async function claimMemberId(uid: string, memberId: MemberId): Promise<void> {
  const { doc, setDoc } = await import('firebase/firestore')
  await setDoc(doc(db!, 'households', HOUSEHOLD_ID, 'uidMap', uid), { memberId })
}

export async function signOutCurrent(): Promise<void> {
  if (!isFirebaseConfigured) return localSignOut()
  await signOut(auth!)
}

export function subscribeAuth(callback: (uid: string | null) => void): () => void {
  if (!isFirebaseConfigured) return localSubscribe(callback)
  return onAuthStateChanged(auth!, (user: User | null) => callback(user?.uid ?? null))
}

// ---------------------------------------------------------------------------
// Local (offline demo) auth — active only when Firebase isn't configured.
// ---------------------------------------------------------------------------

const LOCAL_AUTH_KEY = 'household-nutrition-local-auth-v1'
const LOCAL_SESSION_KEY = 'household-nutrition-local-session-v1'
const listeners = new Set<(uid: string | null) => void>()

async function hashPin(memberId: MemberId, pin: string): Promise<string> {
  const data = new TextEncoder().encode(`${memberId}:${pin}`)
  const digest = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

async function localSignIn(memberId: MemberId, pin: string): Promise<void> {
  const store: Record<string, string> = JSON.parse(localStorage.getItem(LOCAL_AUTH_KEY) || '{}')
  const hashed = await hashPin(memberId, pin)
  if (store[memberId] && store[memberId] !== hashed) {
    throw new Error('Incorrect PIN')
  }
  if (!store[memberId]) {
    store[memberId] = hashed
    localStorage.setItem(LOCAL_AUTH_KEY, JSON.stringify(store))
  }
  localStorage.setItem(LOCAL_SESSION_KEY, memberId)
  listeners.forEach((cb) => cb(memberId))
}

function localSignOut(): void {
  localStorage.removeItem(LOCAL_SESSION_KEY)
  listeners.forEach((cb) => cb(null))
}

function localSubscribe(callback: (uid: string | null) => void): () => void {
  listeners.add(callback)
  callback(localStorage.getItem(LOCAL_SESSION_KEY))
  return () => listeners.delete(callback)
}
