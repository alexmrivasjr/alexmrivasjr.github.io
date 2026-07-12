import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { store } from '../lib/store'
import { recordMonitoredEdit } from '../lib/digest'
import type { Exclusion } from '../types'

export default function ExclusionsPage() {
  const { currentMember, members } = useAuth()
  const [exclusions, setExclusions] = useState<Exclusion[]>([])
  const [loading, setLoading] = useState(true)
  const [newLabel, setNewLabel] = useState('')
  const [scope, setScope] = useState<'household' | string>('household')

  async function load() {
    setLoading(true)
    setExclusions(await store.listExclusions())
    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [])

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    if (!newLabel.trim() || !currentMember) return
    await store.addExclusion(scope as Exclusion['scope'], newLabel.trim(), currentMember.id)
    if (currentMember.isFloorOnly) {
      await recordMonitoredEdit(currentMember.id, `${currentMember.displayName} added an exclusion: "${newLabel.trim()}".`)
    }
    setNewLabel('')
    await load()
  }

  async function handleRemove(id: string) {
    await store.removeExclusion(id)
    await load()
  }

  if (loading || !currentMember) return <p className="text-slate-400">Loading…</p>

  const householdExclusions = exclusions.filter((e) => e.scope === 'household')
  const individualExclusions = exclusions.filter((e) => e.scope !== 'household')

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-bold">Exclusions</h1>
        <p className="text-sm text-slate-400">
          Say &quot;we don&apos;t like X&quot; once and it&apos;s never suggested again. Applies to future meal generation immediately.
        </p>
      </div>

      <form onSubmit={handleAdd} className="flex flex-col gap-2 rounded-xl border border-slate-800 bg-slate-900 p-4">
        <label className="text-sm font-medium">Add exclusion</label>
        <input
          value={newLabel}
          onChange={(e) => setNewLabel(e.target.value)}
          placeholder="e.g. mushrooms, cilantro, salmon…"
          className="rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm outline-none focus:border-emerald-600"
        />
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={scope}
            onChange={(e) => setScope(e.target.value)}
            className="rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
          >
            <option value="household">Whole household</option>
            {members.map((m) => (
              <option key={m.id} value={m.id}>
                Just {m.displayName}
              </option>
            ))}
          </select>
          <button type="submit" className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500">
            Add
          </button>
        </div>
      </form>

      <section>
        <h2 className="mb-2 font-semibold text-slate-200">Household-wide</h2>
        <ExclusionList items={householdExclusions} members={members} onRemove={handleRemove} />
      </section>

      <section>
        <h2 className="mb-2 font-semibold text-slate-200">Individual</h2>
        <ExclusionList items={individualExclusions} members={members} onRemove={handleRemove} />
      </section>
    </div>
  )
}

function ExclusionList({
  items,
  members,
  onRemove,
}: {
  items: Exclusion[]
  members: ReturnType<typeof useAuth>['members']
  onRemove: (id: string) => void
}) {
  if (items.length === 0) return <p className="text-sm text-slate-500">None yet.</p>
  return (
    <ul className="flex flex-col gap-2">
      {items.map((e) => (
        <li key={e.id} className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-sm">
          <span>
            {e.label}
            {e.scope !== 'household' && (
              <span className="ml-2 text-xs text-slate-500">({members.find((m) => m.id === e.scope)?.displayName})</span>
            )}
          </span>
          <button onClick={() => onRemove(e.id)} className="text-xs text-slate-500 hover:text-red-400">
            Remove
          </button>
        </li>
      ))}
    </ul>
  )
}
