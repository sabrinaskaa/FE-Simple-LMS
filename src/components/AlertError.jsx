import React from 'react'

export default function AlertError({ message, onClose }) {
  if (!message) return null
  return (
    <div className="app-alert app-alert-danger" role="alert">
      <span className="app-alert-icon">⚠</span>
      <div style={{ flex: 1 }}>
        <strong>Terjadi Kesalahan</strong>
        <p>{message}</p>
      </div>
      {onClose && (
        <button type="button" className="icon-btn" onClick={onClose} aria-label="Tutup">
          ×
        </button>
      )}
    </div>
  )
}
