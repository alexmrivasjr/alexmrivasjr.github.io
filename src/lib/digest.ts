import type { DigestEntry, MemberId } from '../types'
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
 * Logs an edit the floor-only/monitored member (Damian, in this household's role config)
 * makes to their own plan into Alex's private weekly digest (PRD 6.3 Must-have). That
 * member is never shown or alerted that this exists.
 */
export async function recordMonitoredEdit(memberId: MemberId, summary: string, trending: DigestEntry['trending'] = 'neutral'): Promise<void> {
  const entry: DigestEntry = { weekId: isoWeekId(), memberId, summary, trending, createdAt: new Date().toISOString() }
  await store.addDigestEntry(entry)
}
