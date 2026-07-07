import { useAuth } from '../context/AuthContext'
import { useRollingPlan } from '../hooks/useRollingPlan'
import MealCard from '../components/MealCard'

function formatDate(dateStr: string): string {
  const d = new Date(`${dateStr}T00:00:00`)
  return d.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })
}

export default function PlanPage() {
  const { currentMember, members } = useAuth()
  const { plans, loading, regenerateDay, rejectMeal } = useRollingPlan()

  if (loading || !currentMember) {
    return <p className="text-slate-400">Loading plan…</p>
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-bold">Rolling Plan</h1>
        <p className="text-sm text-slate-400">Always a few days planned ahead — regenerate any day, or swap a single meal any time.</p>
      </div>

      {plans.map((plan) => (
        <section key={plan.date} className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-slate-200">{formatDate(plan.date)}</h2>
            <button
              onClick={() => regenerateDay(plan.date)}
              className="rounded-md border border-slate-700 px-3 py-1 text-xs text-slate-300 hover:bg-slate-800"
            >
              ↻ Regenerate day
            </button>
          </div>
          {plan.meals.map((slot) => (
            <MealCard
              key={slot.occasion}
              slot={slot}
              members={members}
              currentMemberId={currentMember.id}
              onRejectHousehold={() => rejectMeal(plan.date, slot.occasion)}
              onRejectForMember={(memberId) => rejectMeal(plan.date, slot.occasion, memberId)}
            />
          ))}
        </section>
      ))}
    </div>
  )
}
