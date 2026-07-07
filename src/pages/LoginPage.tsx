import { useState } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import type { MemberId } from '../types'

const AVATARS: Record<MemberId, string> = {
  alex: '🧔',
  melissa: '👩',
  julian: '🧑',
  damian: '🧒',
}

export default function LoginPage() {
  const { currentMember, members, signIn, isDemoMode } = useAuth()
  const [selected, setSelected] = useState<MemberId | null>(null)
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  if (currentMember) return <Navigate to="/" replace />

  async function handlePinSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!selected || pin.length < 4) return
    setSubmitting(true)
    setError('')
    try {
      await signIn(selected, pin)
    } catch {
      setError('Incorrect PIN. Try again.')
      setPin('')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-8 px-4">
      <div className="text-center">
        <h1 className="text-2xl font-bold">Household Nutrition</h1>
        <p className="mt-1 text-slate-400">Who&apos;s eating?</p>
        {isDemoMode && (
          <p className="mx-auto mt-3 max-w-sm text-xs text-amber-400">
            Demo mode: pick your name and set any PIN the first time — it&apos;s remembered on this device.
          </p>
        )}
      </div>

      {!selected ? (
        <div className="grid grid-cols-2 gap-4">
          {members.map((m) => (
            <button
              key={m.id}
              onClick={() => setSelected(m.id)}
              className="flex flex-col items-center gap-2 rounded-xl border border-slate-800 bg-slate-900 px-8 py-6 transition hover:border-emerald-600 hover:bg-slate-800"
            >
              <span className="text-4xl">{AVATARS[m.id]}</span>
              <span className="font-medium">{m.displayName}</span>
            </button>
          ))}
        </div>
      ) : (
        <form onSubmit={handlePinSubmit} className="flex w-full max-w-xs flex-col items-center gap-4">
          <span className="text-4xl">{AVATARS[selected]}</span>
          <p className="font-medium">{members.find((m) => m.id === selected)?.displayName}</p>
          <input
            autoFocus
            type="password"
            inputMode="numeric"
            pattern="[0-9]*"
            minLength={4}
            maxLength={8}
            placeholder="PIN (4+ digits)"
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
            className="w-full rounded-lg border border-slate-700 bg-slate-900 px-4 py-3 text-center text-xl tracking-widest outline-none focus:border-emerald-600"
          />
          {error && <p className="text-sm text-red-400">{error}</p>}
          <div className="flex w-full gap-2">
            <button
              type="button"
              onClick={() => {
                setSelected(null)
                setPin('')
                setError('')
              }}
              className="flex-1 rounded-lg border border-slate-700 px-4 py-2 text-sm text-slate-300 hover:bg-slate-800"
            >
              Back
            </button>
            <button
              type="submit"
              disabled={pin.length < 4 || submitting}
              className="flex-1 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
            >
              {submitting ? 'Signing in…' : 'Continue'}
            </button>
          </div>
        </form>
      )}
    </div>
  )
}
