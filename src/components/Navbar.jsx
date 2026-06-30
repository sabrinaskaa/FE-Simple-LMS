import React, { useEffect, useRef, useState } from 'react'
import { Link, NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { fullName } from '../utils/format'
import { isAdmin, isInstructor, primaryRole } from '../utils/roles'

export default function Navbar() {
  const { user, isAuthenticated, logout } = useAuth()
  const navigate = useNavigate()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef(null)
  const role = primaryRole(user)

  useEffect(() => {
    function closeOnOutside(event) {
      if (menuRef.current && !menuRef.current.contains(event.target)) setMenuOpen(false)
    }
    document.addEventListener('mousedown', closeOnOutside)
    return () => document.removeEventListener('mousedown', closeOnOutside)
  }, [])

  function handleLogout() {
    logout()
    setMenuOpen(false)
    navigate('/login')
  }

  const initials = isAuthenticated
    ? fullName(user).split(' ').map((part) => part[0]).slice(0, 2).join('').toUpperCase()
    : ''

  return (
    <header className="app-navbar">
      <div className="container app-navbar-inner">
        <Link className="brand" to="/courses" onClick={() => setMobileOpen(false)}>
          <span className="brand-mark">L</span>
          <span>Simple LMS</span>
        </Link>

        <button
          className="mobile-toggle"
          type="button"
          onClick={() => setMobileOpen((prev) => !prev)}
          aria-label="Buka menu"
        >
          {mobileOpen ? '✕' : '☰'}
        </button>

        <nav className={`main-nav ${mobileOpen ? 'open' : ''}`}>
          <NavLink to="/courses" onClick={() => setMobileOpen(false)}>Kursus</NavLink>
          {isAuthenticated && (
            <NavLink to="/dashboard" onClick={() => setMobileOpen(false)}>Dashboard</NavLink>
          )}
          {isAuthenticated && isInstructor(user) && (
            <NavLink to="/dashboard?tab=studio" onClick={() => setMobileOpen(false)}>Studio</NavLink>
          )}
          {isAuthenticated && (isAdmin(user) || isInstructor(user)) && (
            <NavLink to="/analytics" onClick={() => setMobileOpen(false)}>Analytics</NavLink>
          )}
        </nav>

        <div className="nav-actions">
          {isAuthenticated ? (
            <div className="user-menu" ref={menuRef}>
              <button
                className="user-trigger"
                type="button"
                onClick={() => setMenuOpen((prev) => !prev)}
              >
                <span className="avatar">{initials}</span>
                <span className="user-label">
                  <strong>{fullName(user)}</strong>
                  <span className={`role-chip ${role.toLowerCase()}`}>{role}</span>
                </span>
              </button>

              {menuOpen && (
                <div className="dropdown-panel">
                  <div className="dropdown-header">
                    <strong>{fullName(user)}</strong>
                    <small>{user?.email || user?.username}</small>
                  </div>
                  <Link to="/profile" onClick={() => setMenuOpen(false)}>Profil Saya</Link>
                  <Link to="/dashboard" onClick={() => setMenuOpen(false)}>Dashboard</Link>
                  <button type="button" onClick={handleLogout}>Keluar</button>
                </div>
              )}
            </div>
          ) : (
            <>
              <Link className="btn btn-soft" to="/login">Masuk</Link>
              <Link className="btn btn-primary-lms" to="/register">Daftar</Link>
            </>
          )}
        </div>
      </div>
    </header>
  )
}
