import React, { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import api, { getErrorMessage } from '../api/axios'
import AlertError from '../components/AlertError'

export default function RegisterPage() {
  const navigate = useNavigate()
  const [form, setForm] = useState({ username: '', password: '', email: '', first_name: '', last_name: '' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  function handleChange(event) {
    setForm((prev) => ({ ...prev, [event.target.name]: event.target.value }))
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')
    setLoading(true)
    try {
      await api.post('/auth/register', form)
      navigate('/login', { replace: true })
    } catch (err) {
      setError(getErrorMessage(err, 'Registrasi gagal. Periksa kembali data Anda.'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <section className="auth-layout">
      <div className="auth-card wide">
        <div className="auth-brand">
          <span className="auth-brand-mark">L</span>
          <span style={{ fontWeight: 700, fontSize: '.95rem', color: 'var(--text-sub)' }}>Simple LMS</span>
        </div>

        <div className="auth-intro">
          <h1>Buat akun Student</h1>
          <p>Akun baru otomatis mendapatkan role Student dari backend.</p>
        </div>

        <AlertError message={error} onClose={() => setError('')} />

        <form onSubmit={handleSubmit} className="form-stack">
          <div className="grid-2">
            <label>
              <span>Nama Depan</span>
              <input
                className="form-control"
                name="first_name"
                value={form.first_name}
                onChange={handleChange}
                placeholder="Nama depan"
              />
            </label>
            <label>
              <span>Nama Belakang</span>
              <input
                className="form-control"
                name="last_name"
                value={form.last_name}
                onChange={handleChange}
                placeholder="Nama belakang"
              />
            </label>
          </div>
          <label>
            <span>Username</span>
            <div className="input-group-lms">
              <span className="input-icon">👤</span>
              <input
                className="form-control"
                name="username"
                value={form.username}
                onChange={handleChange}
                required
                placeholder="Buat username unik"
                autoComplete="username"
              />
            </div>
          </label>
          <label>
            <span>Email</span>
            <div className="input-group-lms">
              <span className="input-icon">✉</span>
              <input
                className="form-control"
                type="email"
                name="email"
                value={form.email}
                onChange={handleChange}
                required
                placeholder="email@contoh.com"
                autoComplete="email"
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
                name="password"
                value={form.password}
                onChange={handleChange}
                required
                placeholder="Buat password"
                autoComplete="new-password"
              />
            </div>
          </label>
          <button
            className="btn btn-primary-lms w-100"
            type="submit"
            disabled={loading}
            style={{ minHeight: '42px' }}
          >
            {loading ? 'Mendaftarkan...' : 'Daftar'}
          </button>
        </form>

        <p className="auth-switch">
          Sudah punya akun?{' '}
          <Link to="/login">Masuk</Link>
        </p>
      </div>
    </section>
  )
}
