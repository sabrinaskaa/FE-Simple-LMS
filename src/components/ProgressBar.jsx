import React from 'react'
import { clampPercent } from '../utils/format'

export default function ProgressBar({ value = 0, label }) {
  const percentage = clampPercent(value)
  return (
    <div>
      <div className="progress-meta">
        {label && <span>{label}</span>}
        <strong>{percentage}%</strong>
      </div>
      <div className="lms-progress" aria-label={`Progress ${percentage}%`}>
        <div className="lms-progress-bar" style={{ width: `${percentage}%` }} />
      </div>
    </div>
  )
}
