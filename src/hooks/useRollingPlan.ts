import { useCallback, useEffect, useState } from 'react'
import type { DayPlan, Exclusion, MemberId, Occasion } from '../types'
import { store } from '../lib/store'
import { generateDayPlan, replaceMeal } from '../lib/mealEngine'
import { useAuth } from '../context/AuthContext'

const ROLLING_DAYS = 5
const ROTATION_LOOKBACK_DAYS = 7

function dateStr(offsetDays: number): string {
  const d = new Date()
  d.setDate(d.getDate() + offsetDays)
  return d.toISOString().slice(0, 10)
}

/**
 * Keeps a rolling window of day plans populated (PRD 6.1: "always a few days planned
 * ahead, refreshing continuously"), and exposes on-demand regenerate + reject-and-replace.
 */
export function useRollingPlan() {
  const { members } = useAuth()
  const [plans, setPlans] = useState<DayPlan[]>([])
  const [exclusions, setExclusions] = useState<Exclusion[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    const currentExclusions = await store.listExclusions()
    setExclusions(currentExclusions)

    const dates = Array.from({ length: ROLLING_DAYS }, (_, i) => dateStr(i))
    const loaded: DayPlan[] = []
    for (const date of dates) {
      let plan = await store.getDayPlan(date)
      if (!plan) {
        const recentRecipeIds = await store.recentRecipeIds(date, ROTATION_LOOKBACK_DAYS)
        plan = generateDayPlan({ date, members, exclusions: currentExclusions, recentRecipeIds })
        await store.saveDayPlan(plan)
      }
      loaded.push(plan)
    }
    setPlans(loaded)
    setLoading(false)
  }, [members])

  useEffect(() => {
    load()
  }, [load])

  const regenerateDay = useCallback(
    async (date: string) => {
      const recentRecipeIds = await store.recentRecipeIds(date, ROTATION_LOOKBACK_DAYS)
      const plan = generateDayPlan({ date, members, exclusions, recentRecipeIds })
      await store.saveDayPlan(plan)
      setPlans((prev) => prev.map((p) => (p.date === date ? plan : p)))
    },
    [members, exclusions],
  )

  const rejectMeal = useCallback(
    async (date: string, occasion: Occasion, forMemberId?: MemberId) => {
      const plan = plans.find((p) => p.date === date)
      if (!plan) return
      const recentRecipeIds = await store.recentRecipeIds(date, ROTATION_LOOKBACK_DAYS)
      const updated = replaceMeal(plan, occasion, members, exclusions, recentRecipeIds, forMemberId)
      await store.saveDayPlan(updated)
      setPlans((prev) => prev.map((p) => (p.date === date ? updated : p)))
    },
    [plans, members, exclusions],
  )

  return { plans, loading, regenerateDay, rejectMeal, reload: load }
}
