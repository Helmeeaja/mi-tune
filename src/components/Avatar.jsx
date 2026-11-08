import { useState } from 'react'

export default function Avatar({ person, className = '' }) {
  const [failed, setFailed] = useState('')
  const image = person?.avatar && person.avatar !== failed
  return <span aria-hidden="true" className={`clay-surface inline-grid size-11 shrink-0 place-items-center !rounded-[15px] bg-sage text-sm font-extrabold text-ink ${className}`}>
    {image ? <img src={person.avatar} alt="" className="size-full rounded-[inherit] object-cover" onError={() => setFailed(person.avatar)} /> : person?.displayName?.slice(0, 1).toUpperCase() || 'M'}
  </span>
}
