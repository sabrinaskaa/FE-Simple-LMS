import React from 'react'

export default function StarRating({ value = 0, showValue = true }) {
  const rounded = Math.round(Number(value || 0) * 2) / 2
  return (
    <span className="star-rating" aria-label={`Rating ${rounded} dari 5`}>
      {[1, 2, 3, 4, 5].map((star) => (
        <span key={star} className={star <= rounded ? 'filled' : ''}>★</span>
      ))}
      {showValue && <small>{Number(value || 0).toFixed(1)}</small>}
    </span>
  )
}
