interface Props {
  title: string
  phase: string
  description: string
}

export default function ComingSoonPage({ title, phase, description }: Props) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-slate-800 px-6 py-16 text-center">
      <span className="rounded-full bg-slate-800 px-3 py-1 text-xs font-medium text-slate-400">{phase} · Not built yet</span>
      <h1 className="text-xl font-bold">{title}</h1>
      <p className="max-w-md text-sm text-slate-400">{description}</p>
    </div>
  )
}
