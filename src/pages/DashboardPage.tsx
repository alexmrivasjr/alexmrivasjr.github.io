import { useAuth } from '../context/AuthContext'
import { useRollingPlan } from '../hooks/useRollingPlan'
import MealCard from '../components/MealCard'

function todayStr(): string {
  return new Date().toISOString().slice(0, 10)
}

export default function DashboardPage() {
  const { currentMember, members } = useAuth()
  const { plans, loading, regenerateDay, rejectMeal } = useRollingPlan()
  const today = plans.find((p) => p.date === todayStr())

  if (loading || !currentMember) {
    return <p className="text-slate-400">Loading today&apos;s plan…</p>
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">Today</h1>
          <p className="text-sm text-slate-400">{today?.date}</p>
        </div>
        <button
          onClick={() => today && regenerateDay(today.date)}
          className="rounded-md border border-slate-700 px-3 py-1.5 text-sm text-slate-300 hover:bg-slate-800"
        >
          ↻ Regenerate day
        </button>
      </div>

      {!today ? (
        <p className="text-slate-400">No plan yet.</p>
      ) : (
        <div className="flex flex-col gap-3">
          {today.meals.map((slot) => (
            <MealCard
              key={slot.occasion}
              slot={slot}
              members={members}
              currentMemberId={currentMember.id}
              onRejectHousehold={() => rejectMeal(today.date, slot.occasion)}
              onRejectForMember={(memberId) => rejectMeal(today.date, slot.occasion, memberId)}
            />
          ))}
        </div>
      )}
    </div>
  )
}
