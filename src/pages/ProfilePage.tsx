import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { store } from '../lib/store'
import { recordDamianEdit } from '../lib/digest'
import type { Member, MemberId, PrivateMetrics } from '../types'

const DAMIAN_ENCOURAGEMENT = [
  "You're on track to hit your performance goals! Keep fueling up around practice 💪",
  'Great consistency this week — your body is responding to the work you put in.',
  "Solid effort lately. Keep prioritizing protein and you'll keep making progress.",
]

export default function ProfilePage() {
  const { currentMember, members, isAdmin } = useAuth()
  const [viewingId, setViewingId] = useState<MemberId>(currentMember!.id)
  const viewing = members.find((m) => m.id === viewingId)!

  const [weightLb, setWeightLb] = useState(viewing.weightLb)
  const [activityLevel, setActivityLevel] = useState(viewing.activityLevel)
  const [goal, setGoal] = useState(viewing.goal)
  const [saved, setSaved] = useState(false)

  const [privateMetrics, setPrivateMetrics] = useState<PrivateMetrics | null>(null)
  const [bodyFatPct, setBodyFatPct] = useState<string>('')
  const [exactWeightLb, setExactWeightLb] = useState<string>('')

  useEffect(() => {
    setWeightLb(viewing.weightLb)
    setActivityLevel(viewing.activityLevel)
    setGoal(viewing.goal)
    setSaved(false)
    store.getPrivateMetrics(viewingId).then((m) => {
      setPrivateMetrics(m)
      setBodyFatPct(m?.bodyFatPct?.toString() ?? '')
      setExactWeightLb(m?.exactWeightLb?.toString() ?? '')
    })
  }, [viewingId, viewing])

  if (!currentMember) return null

  const canEditPublic = viewingId === currentMember.id || isAdmin
  const canSeePrivate = viewing.privacyDelegates.includes(currentMember.id)
  const isDamianViewingSelf = viewing.id === 'damian' && viewingId === currentMember.id

  async function handleSaveProfile(e: React.FormEvent) {
    e.preventDefault()
    await store.updateMemberProfile(viewingId, { weightLb, activityLevel, goal })
    if (viewing.id === 'damian' && currentMember!.id === 'damian') {
      await recordDamianEdit(`Damian updated his profile (weight: ${weightLb} lb, activity: "${activityLevel}").`)
    }
    setSaved(true)
  }

  async function handleSavePrivate(e: React.FormEvent) {
    e.preventDefault()
    await store.updatePrivateMetrics(viewingId, {
      bodyFatPct: bodyFatPct ? Number(bodyFatPct) : undefined,
      exactWeightLb: exactWeightLb ? Number(exactWeightLb) : undefined,
      weightTrend: [
        ...(privateMetrics?.weightTrend ?? []),
        ...(exactWeightLb ? [{ date: new Date().toISOString().slice(0, 10), weightLb: Number(exactWeightLb) }] : []),
      ],
    })
    const updated = await store.getPrivateMetrics(viewingId)
    setPrivateMetrics(updated)
  }

  const encouragement = DAMIAN_ENCOURAGEMENT[new Date().getDate() % DAMIAN_ENCOURAGEMENT.length]

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Profile</h1>
        {isAdmin && (
          <select
            value={viewingId}
            onChange={(e) => setViewingId(e.target.value as MemberId)}
            className="rounded-md border border-slate-700 bg-slate-900 px-3 py-1.5 text-sm"
          >
            {members.map((m) => (
              <option key={m.id} value={m.id}>
                {m.displayName}
              </option>
            ))}
          </select>
        )}
      </div>

      {isDamianViewingSelf ? (
        <section className="rounded-xl border border-slate-800 bg-slate-900 p-4">
          <h2 className="mb-2 font-semibold">How you&apos;re doing</h2>
          <p className="text-sm text-slate-300">{encouragement}</p>
        </section>
      ) : (
        <section className="rounded-xl border border-slate-800 bg-slate-900 p-4">
          <h2 className="mb-3 font-semibold">Macro targets</h2>
          <MacroTable member={viewing} />
          <p className="mt-3 text-xs text-slate-500">{viewing.formulaNote}</p>
          {viewing.isFloorOnly && (
            <p className="mt-2 text-xs text-amber-400">
              Floor, not a cap — never reduced as a deficit. Consult a pediatrician or youth sports dietitian before any structured
              change to this plan.
            </p>
          )}
        </section>
      )}

      <form onSubmit={handleSaveProfile} className="flex flex-col gap-3 rounded-xl border border-slate-800 bg-slate-900 p-4">
        <h2 className="font-semibold">Editable details</h2>
        <label className="text-sm text-slate-400">
          Weight (lb)
          <input
            type="number"
            step="0.1"
            disabled={!canEditPublic}
            value={weightLb}
            onChange={(e) => setWeightLb(Number(e.target.value))}
            className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 disabled:opacity-50"
          />
        </label>
        <label className="text-sm text-slate-400">
          Activity level
          <input
            disabled={!canEditPublic}
            value={activityLevel}
            onChange={(e) => setActivityLevel(e.target.value)}
            className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 disabled:opacity-50"
          />
        </label>
        <label className="text-sm text-slate-400">
          Goal
          <input
            disabled={!canEditPublic}
            value={goal}
            onChange={(e) => setGoal(e.target.value)}
            className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 disabled:opacity-50"
          />
        </label>
        {canEditPublic && (
          <button type="submit" className="self-start rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500">
            Save
          </button>
        )}
        {saved && <p className="text-xs text-emerald-400">Saved.</p>}
      </form>

      {!isDamianViewingSelf && canSeePrivate ? (
        <form onSubmit={handleSavePrivate} className="flex flex-col gap-3 rounded-xl border border-slate-800 bg-slate-900 p-4">
          <h2 className="font-semibold">
            Private body metrics <span className="text-xs font-normal text-slate-500">(visible only to {viewing.displayName} and Alex)</span>
          </h2>
          <label className="text-sm text-slate-400">
            Body fat %
            <input
              type="number"
              step="0.1"
              value={bodyFatPct}
              onChange={(e) => setBodyFatPct(e.target.value)}
              className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100"
            />
          </label>
          <label className="text-sm text-slate-400">
            Exact weight (lb) — logging adds a trend point
            <input
              type="number"
              step="0.1"
              value={exactWeightLb}
              onChange={(e) => setExactWeightLb(e.target.value)}
              className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100"
            />
          </label>
          {privateMetrics && privateMetrics.weightTrend.length > 0 && (
            <div className="text-xs text-slate-500">
              Trend: {privateMetrics.weightTrend.map((t) => `${t.date}: ${t.weightLb}lb`).join('  ·  ')}
            </div>
          )}
          <button type="submit" className="self-start rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500">
            Save
          </button>
        </form>
      ) : null}
    </div>
  )
}

function MacroTable({ member }: { member: Member }) {
  const entries = Object.entries(member.targetsByDayType)
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-slate-500">
            <th className="pr-4 font-normal">Day type</th>
            <th className="pr-4 font-normal">Calories</th>
            <th className="pr-4 font-normal">Protein</th>
            <th className="pr-4 font-normal">Fat</th>
            <th className="pr-4 font-normal">Carbs</th>
          </tr>
        </thead>
        <tbody>
          {entries.map(([dayType, t]) => (
            <tr key={dayType} className="border-t border-slate-800">
              <td className="py-1.5 pr-4 capitalize">{dayType}</td>
              <td className="py-1.5 pr-4">{t!.calories} cal</td>
              <td className="py-1.5 pr-4">{t!.proteinG}g</td>
              <td className="py-1.5 pr-4">{t!.fatG}g</td>
              <td className="py-1.5 pr-4">{t!.carbG}g</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
