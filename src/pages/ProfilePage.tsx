import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { store } from '../lib/store'
import { recordMonitoredEdit } from '../lib/digest'
import type { DayType, MacroTargets, MemberId, PrivateMetrics } from '../types'

const MONITORED_MEMBER_ENCOURAGEMENT = [
  "You're on track to hit your performance goals! Keep fueling up around practice 💪",
  'Great consistency this week — your body is responding to the work you put in.',
  "Solid effort lately. Keep prioritizing protein and you'll keep making progress.",
]

const DAY_TYPES: DayType[] = ['standard', 'deficit', 'maintenance', 'training-2x']
const EMPTY_TARGET: MacroTargets = { calories: 0, proteinG: 0, fatG: 0, carbG: 0 }

export default function ProfilePage() {
  const { currentMember, members, isAdmin, refreshMembers } = useAuth()
  const [viewingId, setViewingId] = useState<MemberId>(currentMember!.id)
  const viewing = members.find((m) => m.id === viewingId)!

  const [displayName, setDisplayName] = useState(viewing.displayName)
  const [age, setAge] = useState(viewing.age)
  const [heightIn, setHeightIn] = useState(viewing.heightIn)
  const [weightLb, setWeightLb] = useState(viewing.weightLb)
  const [activityLevel, setActivityLevel] = useState(viewing.activityLevel)
  const [goal, setGoal] = useState(viewing.goal)
  const [saved, setSaved] = useState(false)

  const [targets, setTargets] = useState(viewing.targetsByDayType)
  const [formulaNote, setFormulaNote] = useState(viewing.formulaNote)
  const [newDayType, setNewDayType] = useState<DayType>('deficit')
  const [macrosSaved, setMacrosSaved] = useState(false)

  const [privateMetrics, setPrivateMetrics] = useState<PrivateMetrics | null>(null)
  const [bodyFatPct, setBodyFatPct] = useState<string>('')
  const [exactWeightLb, setExactWeightLb] = useState<string>('')

  useEffect(() => {
    setDisplayName(viewing.displayName)
    setAge(viewing.age)
    setHeightIn(viewing.heightIn)
    setWeightLb(viewing.weightLb)
    setActivityLevel(viewing.activityLevel)
    setGoal(viewing.goal)
    setTargets(viewing.targetsByDayType)
    setFormulaNote(viewing.formulaNote)
    setSaved(false)
    setMacrosSaved(false)
    store.getPrivateMetrics(viewingId).then((m) => {
      setPrivateMetrics(m)
      setBodyFatPct(m?.bodyFatPct?.toString() ?? '')
      setExactWeightLb(m?.exactWeightLb?.toString() ?? '')
    })
  }, [viewingId, viewing])

  if (!currentMember) return null

  const canEditPublic = viewingId === currentMember.id || isAdmin
  const canSeePrivate = viewing.privacyDelegates.includes(currentMember.id)
  const isMonitoredMemberViewingSelf = viewing.isFloorOnly && viewingId === currentMember.id
  const availableDayTypes = DAY_TYPES.filter((dt) => !targets[dt])
  const adminName = members.find((m) => m.id === 'alex')?.displayName || 'the admin'

  async function handleSaveProfile(e: React.FormEvent) {
    e.preventDefault()
    await store.updateMemberProfile(viewingId, { displayName, age, heightIn, weightLb, activityLevel, goal })
    if (viewing.isFloorOnly && viewingId === currentMember!.id) {
      await recordMonitoredEdit(currentMember!.id, `${displayName} updated their profile (weight: ${weightLb} lb, activity: "${activityLevel}").`)
    }
    await refreshMembers()
    setSaved(true)
  }

  async function handleSaveMacros(e: React.FormEvent) {
    e.preventDefault()
    await store.updateMemberProfile(viewingId, { targetsByDayType: targets, formulaNote })
    await refreshMembers()
    setMacrosSaved(true)
  }

  function updateTarget(dayType: DayType, field: keyof MacroTargets, value: number) {
    setTargets((prev) => ({ ...prev, [dayType]: { ...(prev[dayType] ?? EMPTY_TARGET), [field]: value } }))
  }

  function removeDayType(dayType: DayType) {
    setTargets((prev) => {
      const next = { ...prev }
      delete next[dayType]
      return next
    })
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

  const encouragement = MONITORED_MEMBER_ENCOURAGEMENT[new Date().getDate() % MONITORED_MEMBER_ENCOURAGEMENT.length]

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

      {isMonitoredMemberViewingSelf ? (
        <section className="rounded-xl border border-slate-800 bg-slate-900 p-4">
          <h2 className="mb-2 font-semibold">How you&apos;re doing</h2>
          <p className="text-sm text-slate-300">{encouragement}</p>
        </section>
      ) : (
        <section className="rounded-xl border border-slate-800 bg-slate-900 p-4">
          <h2 className="mb-3 font-semibold">Macro targets</h2>
          {Object.keys(targets).length === 0 ? (
            <p className="text-sm text-amber-400">Not set up yet.{isAdmin ? ' Add targets below.' : ` Ask ${adminName} to set this up.`}</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-slate-500">
                    <th className="pr-4 font-normal">Day type</th>
                    <th className="pr-4 font-normal">Calories</th>
                    <th className="pr-4 font-normal">Protein</th>
                    <th className="pr-4 font-normal">Fat</th>
                    <th className="pr-4 font-normal">Carbs</th>
                    {isAdmin && <th />}
                  </tr>
                </thead>
                <tbody>
                  {(Object.entries(targets) as [DayType, MacroTargets][]).map(([dayType, t]) =>
                    isAdmin ? (
                      <tr key={dayType} className="border-t border-slate-800">
                        <td className="py-1.5 pr-4 capitalize">{dayType}</td>
                        {(['calories', 'proteinG', 'fatG', 'carbG'] as const).map((field) => (
                          <td key={field} className="py-1.5 pr-4">
                            <input
                              type="number"
                              value={t[field]}
                              onChange={(e) => updateTarget(dayType, field, Number(e.target.value))}
                              className="w-20 rounded border border-slate-700 bg-slate-950 px-2 py-1 text-sm"
                            />
                          </td>
                        ))}
                        <td>
                          <button type="button" onClick={() => removeDayType(dayType)} className="text-xs text-slate-500 hover:text-red-400">
                            Remove
                          </button>
                        </td>
                      </tr>
                    ) : (
                      <tr key={dayType} className="border-t border-slate-800">
                        <td className="py-1.5 pr-4 capitalize">{dayType}</td>
                        <td className="py-1.5 pr-4">{t.calories} cal</td>
                        <td className="py-1.5 pr-4">{t.proteinG}g</td>
                        <td className="py-1.5 pr-4">{t.fatG}g</td>
                        <td className="py-1.5 pr-4">{t.carbG}g</td>
                      </tr>
                    ),
                  )}
                </tbody>
              </table>
            </div>
          )}

          {isAdmin ? (
            <form onSubmit={handleSaveMacros} className="mt-4 flex flex-col gap-2">
              {availableDayTypes.length > 0 && (
                <div className="flex items-center gap-2">
                  <select
                    value={newDayType}
                    onChange={(e) => setNewDayType(e.target.value as DayType)}
                    className="rounded-md border border-slate-700 bg-slate-950 px-2 py-1 text-sm"
                  >
                    {availableDayTypes.map((dt) => (
                      <option key={dt} value={dt}>
                        {dt}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => setTargets((prev) => ({ ...prev, [newDayType]: EMPTY_TARGET }))}
                    className="rounded-md border border-slate-700 px-3 py-1 text-xs text-slate-300 hover:bg-slate-800"
                  >
                    + Add day type
                  </button>
                </div>
              )}
              <label className="text-sm text-slate-400">
                Formula / source note <span className="text-xs text-slate-500">(shown to whoever can view this profile — keep it auditable)</span>
                <textarea
                  value={formulaNote}
                  onChange={(e) => setFormulaNote(e.target.value)}
                  rows={2}
                  className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100"
                />
              </label>
              <button type="submit" className="self-start rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500">
                Save macro targets
              </button>
              {macrosSaved && <p className="text-xs text-emerald-400">Saved.</p>}
            </form>
          ) : (
            <p className="mt-3 text-xs text-slate-500">{formulaNote}</p>
          )}

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
          Name / nickname <span className="text-xs text-slate-500">(shown on the login screen — doesn&apos;t have to be a real name)</span>
          <input
            disabled={!canEditPublic}
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 disabled:opacity-50"
          />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="text-sm text-slate-400">
            Age
            <input
              type="number"
              disabled={!canEditPublic}
              value={age}
              onChange={(e) => setAge(Number(e.target.value))}
              className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 disabled:opacity-50"
            />
          </label>
          <label className="text-sm text-slate-400">
            Height (in)
            <input
              type="number"
              disabled={!canEditPublic}
              value={heightIn}
              onChange={(e) => setHeightIn(Number(e.target.value))}
              className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 disabled:opacity-50"
            />
          </label>
        </div>
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

      {!isMonitoredMemberViewingSelf && canSeePrivate ? (
        <form onSubmit={handleSavePrivate} className="flex flex-col gap-3 rounded-xl border border-slate-800 bg-slate-900 p-4">
          <h2 className="font-semibold">
            Private body metrics <span className="text-xs font-normal text-slate-500">(visible only to {viewing.displayName} and {adminName})</span>
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
