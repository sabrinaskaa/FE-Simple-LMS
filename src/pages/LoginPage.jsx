import React, { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import AlertError from '../components/AlertError'
import { useAuth } from '../context/AuthContext'
import { getErrorMessage } from '../api/axios'

export default function LoginPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { login } = useAuth()
  const [form, setForm] = useState({ username: '', password: '' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')
    setLoading(true)
    try {
      await login(form.username, form.password)
      navigate(location.state?.from?.pathname || '/dashboard', { replace: true })
    } catch (err) {
      setError(getErrorMessage(err, 'Login gagal. Periksa username dan password.'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <section className="auth-layout">
      <div className="auth-card">
        <div className="auth-brand">
          <span className="auth-brand-mark">L</span>
          <span style={{ fontWeight: 700, fontSize: '.95rem', color: 'var(--text-sub)' }}>Simple LMS</span>
        </div>

        <div className="auth-intro">
          <h1>Masuk ke akun Anda</h1>
          <p>Akses dashboard belajar, studio instruktur, atau panel admin.</p>
        </div>

        <AlertError message={error} onClose={() => setError('')} />

        <form onSubmit={handleSubmit} className="form-stack">
          <label>
            <span>Username</span>
            <div className="input-group-lms">
              <span className="input-icon">👤</span>
              <input
                className="form-control"
                value={form.username}
                onChange={(e) => setForm({ ...form, username: e.target.value })}
                required
                autoFocus
                autoComplete="username"
                placeholder="Masukkan username"
              />
            </div>
          </label>
          <label>
            <span>Password</span>
            <div className="input-group-lms">
              <span className="input-icon">🔒</span>
              <input
                className="form-control"
                type="password"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                required
                autoComplete="current-password"
                placeholder="Masukkan password"
              />
            </div>
          </label>
          <button
            className="btn btn-primary-lms w-100"
            type="submit"
            disabled={loading}
            style={{ minHeight: '42px' }}
          >
            {loading ? 'Memproses...' : 'Masuk'}
          </button>
        </form>

        <p className="auth-switch">
          Belum punya akun?{' '}
          <Link to="/register">Daftar sebagai Student</Link>
        </p>
      </div>
    </section>
  )
}
