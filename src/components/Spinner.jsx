import React from 'react'

export default function Spinner({ label = 'Memuat data...' }) {
  return (
    <div className="loading-state" role="status" aria-live="polite">
      <div className="lms-spinner" />
      <span>{label}</span>
    </div>
  )
}
