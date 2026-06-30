import React from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { getRoles, isAdmin } from '../utils/roles'
import Spinner from './Spinner'

export default function ProtectedRoute({ children, roles = [] }) {
  const { isAuthenticated, user, loading } = useAuth()
  const location = useLocation()

  if (loading) return <Spinner />
  if (!isAuthenticated) return <Navigate to="/login" state={{ from: location }} replace />

  if (roles.length > 0 && !isAdmin(user)) {
    const userRoles = getRoles(user)
    const allowed = roles.some((role) => userRoles.includes(String(role).toLowerCase()))
    if (!allowed) return <Navigate to="/dashboard" replace />
  }

  return children
}
