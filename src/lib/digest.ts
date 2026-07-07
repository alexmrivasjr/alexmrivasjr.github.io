import type { DigestEntry } from '../types'
import { store } from './store'

function isoWeekId(date = new Date()): string {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const dayNum = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  const weekNo = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7)
  return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`
}

/**
 * Logs an edit Damian makes to his own plan into Alex's private weekly digest (PRD 6.3
 * Must-have). Damian is never shown or alerted that this exists.
 */
export async function recordDamianEdit(summary: string, trending: DigestEntry['trending'] = 'neutral'): Promise<void> {
  const entry: DigestEntry = { weekId: isoWeekId(), memberId: 'damian', summary, trending, createdAt: new Date().toISOString() }
  await store.addDigestEntry(entry)
}
