export function rupiah(value) {
  const number = Number(value || 0)
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(number)
}

export function shortDate(value) {
  if (!value) return '-'
  try {
    return new Intl.DateTimeFormat('id-ID', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    }).format(new Date(value))
  } catch {
    return '-'
  }
}

export function fullName(user) {
  const name = [user?.first_name, user?.last_name].filter(Boolean).join(' ').trim()
  return name || user?.username || '-'
}

export function statusLabel(status) {
  const labels = {
    draft: 'Draft',
    pending_review: 'Menunggu Review',
    published: 'Published',
    archived: 'Archived',
  }
  return labels[status] || status || '-'
}

export function levelLabel(level) {
  const labels = { beginner: 'Beginner', intermediate: 'Intermediate', advanced: 'Advanced' }
  return labels[level] || level || '-'
}

export function clampPercent(value) {
  const number = Number(value || 0)
  return Math.max(0, Math.min(100, Math.round(number)))
}
