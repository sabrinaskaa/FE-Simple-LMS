import React, { useEffect, useState } from 'react'
import api from '../api/axios'

export default function TaskPoller({ taskId, endpoint = '/tasks', onDone }) {
  const [status, setStatus] = useState('PENDING')
  const [result, setResult] = useState(null)

  useEffect(() => {
    if (!taskId) return undefined
    let active = true
    const timer = setInterval(async () => {
      try {
        const url = endpoint.endsWith('/') ? `${endpoint}${taskId}/` : `${endpoint}/${taskId}`
        const { data } = await api.get(url)
        if (!active) return
        setStatus(data.status)
        setResult(data.result || null)
        if (['SUCCESS', 'FAILURE', 'REVOKED'].includes(data.status)) {
          clearInterval(timer)
          if (onDone) onDone(data)
        }
      } catch {
        if (active) setStatus('ERROR')
        clearInterval(timer)
      }
    }, 2500)
    return () => {
      active = false
      clearInterval(timer)
    }
  }, [taskId, endpoint, onDone])

  if (!taskId) return null
  return (
    <div className="task-poller">
      <span className="spinner-grow spinner-grow-sm" />
      <span>Task {taskId}</span>
      <strong>{status}</strong>
      {result?.output && <small>{result.output}</small>}
    </div>
  )
}
