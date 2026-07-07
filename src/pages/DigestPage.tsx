import { useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { store } from '../lib/store'
import type { DigestEntry } from '../types'

const TREND_LABEL: Record<DigestEntry['trending'], string> = {
  'toward-goals': '📈 Toward goals',
  'away-from-goals': '📉 Away from goals',
  neutral: '➖ Informational',
}

export default function DigestPage() {
  const { isAdmin } = useAuth()
  const [entries, setEntries] = useState<DigestEntry[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    store.listDigestEntries().then((e) => {
      setEntries(e.sort((a, b) => b.createdAt.localeCompare(a.createdAt)))
      setLoading(false)
    })
  }, [])

  if (!isAdmin) return <Navigate to="/" replace />
  if (loading) return <p className="text-slate-400">Loading…</p>

  const byWeek = entries.reduce<Record<string, DigestEntry[]>>((acc, e) => {
    ;(acc[e.weekId] ??= []).push(e)
    return acc
  }, {})

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-bold">Damian&apos;s Weekly Digest</h1>
        <p className="text-sm text-slate-400">
          Private to you. Summarizes edits Damian makes to his own plan so you can spot-check they trend toward his performance and
          growth goals. Damian is not shown or alerted that this exists.
        </p>
      </div>

      {Object.keys(byWeek).length === 0 ? (
        <p className="text-sm text-slate-500">No edits logged yet.</p>
      ) : (
        Object.entries(byWeek).map(([weekId, weekEntries]) => (
          <section key={weekId}>
            <h2 className="mb-2 font-semibold text-slate-200">{weekId}</h2>
            <ul className="flex flex-col gap-2">
              {weekEntries.map((e, i) => (
                <li key={i} className="rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-sm">
                  <p>{e.summary}</p>
                  <p className="mt-1 text-xs text-slate-500">
                    {TREND_LABEL[e.trending]} · {new Date(e.createdAt).toLocaleString()}
                  </p>
                </li>
              ))}
            </ul>
          </section>
        ))
      )}
    </div>
  )
}
