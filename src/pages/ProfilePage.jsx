import React, { useEffect, useState } from 'react'
import api, { getErrorMessage } from '../api/axios'
import AlertError from '../components/AlertError'
import Spinner from '../components/Spinner'
import { useAuth } from '../context/AuthContext'
import { fullName } from '../utils/format'
import { primaryRole } from '../utils/roles'

export default function ProfilePage() {
  const { user, setUser, refreshUser } = useAuth()
  const [form, setForm] = useState({ email: '', first_name: '', last_name: '' })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving]   = useState(false)
  const [error, setError]     = useState('')
  const [flash, setFlash]     = useState('')

  useEffect(() => {
    async function init() {
      const profile = user || await refreshUser()
      setForm({
        email:      profile?.email      || '',
        first_name: profile?.first_name || '',
        last_name:  profile?.last_name  || '',
      })
      setLoading(false)
    }
    init()
  }, [])

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')
    setFlash('')
    setSaving(true)
    try {
      const { data } = await api.put('/auth/me', form)
      setUser(data)
      setFlash('Profil berhasil diperbarui.')
    } catch (err) {
      setError(getErrorMessage(err, 'Gagal memperbarui profil.'))
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <Spinner />

  const role     = primaryRole(user)
  const initials = fullName(user).slice(0, 2).toUpperCase()

  return (
    <div className="page container py-4">
      <div className="page-heading compact">
        <span className="eyebrow">Akun</span>
        <h1>Profil Saya</h1>
        <p>Kelola identitas yang digunakan untuk autentikasi dan akses role.</p>
      </div>

      <div className="content-grid two-col">
        <aside className="lms-card profile-summary">
          <div className="avatar xl">{initials}</div>
          <h2>{fullName(user)}</h2>
          <p>@{user?.username}</p>
          {user?.email && (
            <p style={{ color: 'var(--muted)', fontSize: '.875rem', marginTop: '-.5rem' }}>
              {user.email}
            </p>
          )}
          <span className={`role-chip ${role.toLowerCase()}`}>{role}</span>
        </aside>

        <section className="lms-card p-4">
          {flash && (
            <div className="app-alert app-alert-success">
              <span className="app-alert-icon">✓</span>
              <div style={{ flex: 1 }}>
                <strong>Berhasil</strong>
                <p>{flash}</p>
              </div>
            </div>
          )}
          <AlertError message={error} onClose={() => setError('')} />

          <div className="section-heading">
            <div>
              <span className="eyebrow">Edit</span>
              <h2>Ubah Informasi</h2>
            </div>
          </div>

          <form className="form-stack" onSubmit={handleSubmit}>
            <label>
              <span>Email</span>
              <input
                className="form-control"
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="email@contoh.com"
              />
            </label>
            <div className="grid-2">
              <label>
                <span>Nama Depan</span>
                <input
                  className="form-control"
                  value={form.first_name}
                  onChange={(e) => setForm({ ...form, first_name: e.target.value })}
                  placeholder="Nama depan"
                />
              </label>
              <label>
                <span>Nama Belakang</span>
                <input
                  className="form-control"
                  value={form.last_name}
                  onChange={(e) => setForm({ ...form, last_name: e.target.value })}
                  placeholder="Nama belakang"
                />
              </label>
            </div>
            <button className="btn btn-primary-lms" type="submit" disabled={saving}>
              {saving ? 'Menyimpan...' : 'Simpan Perubahan'}
            </button>
          </form>
        </section>
      </div>
    </div>
  )
}
