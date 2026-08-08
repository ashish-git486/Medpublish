import { Link } from 'react-router-dom'
import {
  IconPulse,
  IconCell,
  IconBrain,
  IconGlobe,
  IconVirus,
  IconCap,
} from '../icons/Icons.jsx'

const iconMap = {
  pulse: IconPulse,
  cell: IconCell,
  brain: IconBrain,
  globe: IconGlobe,
  virus: IconVirus,
  cap: IconCap,
}

function SubjectCard({ category }) {
  const Icon = iconMap[category.icon] ?? IconGlobe

  return (
    <Link
      to="/library"
      className="group flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-5 transition-all hover:-translate-y-0.5 hover:border-teal-600 hover:shadow-md"
    >
      <span className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-teal-600/30 text-teal-700 transition-colors group-hover:bg-teal-50">
        <Icon className="h-5 w-5" />
      </span>
      <span className="font-serif text-base font-semibold text-ink">
        {category.name}
      </span>
      <span className="text-sm text-slate-500">{category.description}</span>
    </Link>
  )
}

export default SubjectCard
