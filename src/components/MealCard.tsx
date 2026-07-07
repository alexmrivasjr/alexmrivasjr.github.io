import type { MealSlot, Member, MemberId } from '../types'
import { getRecipe } from '../lib/mealEngine'

const OCCASION_LABEL: Record<MealSlot['occasion'], string> = {
  breakfast: 'Breakfast',
  lunch: 'Lunch',
  dinner: 'Dinner',
  snack: 'Snack',
}

function portionDescription(proteinMultiplier: number, starchMultiplier: number): string {
  const fmt = (n: number) => (Number.isInteger(n) ? n : n.toFixed(1))
  return `${fmt(proteinMultiplier)}x protein · ${fmt(starchMultiplier)}x starch`
}

interface Props {
  slot: MealSlot
  members: Member[]
  currentMemberId: MemberId
  onRejectHousehold: () => void
  onRejectForMember: (memberId: MemberId) => void
}

export default function MealCard({ slot, members, currentMemberId, onRejectHousehold, onRejectForMember }: Props) {
  const baseRecipe = getRecipe(slot.recipeId)
  if (!baseRecipe) return null

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs uppercase tracking-wide text-slate-500">{OCCASION_LABEL[slot.occasion]}</p>
          <h3 className="font-semibold">{baseRecipe.name}</h3>
          <p className="text-xs text-slate-400">
            {baseRecipe.tags.join(' · ')}
            {baseRecipe.kidFriendlyFormat ? ` · ${baseRecipe.kidFriendlyFormat} format` : ''}
          </p>
        </div>
        <button
          onClick={onRejectHousehold}
          className="rounded-md border border-slate-700 px-2 py-1 text-xs text-slate-300 hover:border-red-500 hover:text-red-400"
          title="Replace this meal for the whole household"
        >
          🔄 Swap meal
        </button>
      </div>

      <div className="mt-3 divide-y divide-slate-800">
        {members.map((member) => {
          const portion = slot.portions[member.id]
          if (!portion) return null
          const overrideRecipe = slot.overrides[member.id] ? getRecipe(slot.overrides[member.id]!) : null
          const recipe = overrideRecipe ?? baseRecipe
          const isSelf = member.id === currentMemberId
          const hideNumbers = member.id === 'damian' && isSelf

          return (
            <div key={member.id} className="flex items-center justify-between gap-3 py-2">
              <div>
                <p className="text-sm font-medium">
                  {member.displayName}
                  {overrideRecipe && <span className="ml-1 text-xs text-emerald-400">(swapped: {overrideRecipe.name})</span>}
                </p>
                {hideNumbers ? (
                  <p className="text-xs text-slate-400">Your plate: {recipe.protein.name} + {recipe.starch.name} + {recipe.vegetable.name}. Fuel up! 💪</p>
                ) : (
                  <>
                    <p className="text-xs text-slate-400">{portionDescription(portion.proteinMultiplier, portion.starchMultiplier)}</p>
                    <p className="text-xs text-slate-500">
                      {portion.totals.calories} cal · {portion.totals.proteinG}p / {portion.totals.fatG}f / {portion.totals.carbG}c
                      {!portion.withinTolerance && <span className="ml-1 text-amber-400">(outside ±5%)</span>}
                    </p>
                    {portion.addOnIds.length > 0 && (
                      <p className="text-xs text-slate-500">
                        + {portion.addOnIds.map((id) => recipe.addOns.find((a) => a.id === id)?.name ?? id).join(', ')}
                      </p>
                    )}
                  </>
                )}
              </div>
              <button
                onClick={() => onRejectForMember(member.id)}
                className="shrink-0 rounded-md border border-slate-700 px-2 py-1 text-xs text-slate-300 hover:border-red-500 hover:text-red-400"
                title={`Not this for ${member.displayName}`}
              >
                No thanks
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}
