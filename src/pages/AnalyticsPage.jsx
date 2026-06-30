import React, { useEffect, useState } from 'react'
import api, { getErrorMessage } from '../api/axios'
import AlertError from '../components/AlertError'
import Spinner from '../components/Spinner'
import { useAuth } from '../context/AuthContext'
import { isAdmin } from '../utils/roles'
import { shortDate } from '../utils/format'

function isoDate(offsetDays) {
  const date = new Date()
  date.setDate(date.getDate() + offsetDays)
  return date.toISOString().slice(0, 10)
}

export default function AnalyticsPage() {
  const { user } = useAuth()
  const admin = isAdmin(user)
  const [popular, setPopular]               = useState([])
  const [daily, setDaily]                   = useState([])
  const [summary, setSummary]               = useState([])
  const [activityReport, setActivityReport] = useState([])
  const [learningReport, setLearningReport] = useState([])
  const [loading, setLoading]               = useState(true)
  const [error, setError]                   = useState('')

  useEffect(() => {
    async function load() {
      setLoading(true)
      setError('')
      try {
        const calls = [
          api.get('/analytics/popular-courses/', { params: { limit: 10 } }),
          api.get('/analytics/daily-summary/', { params: { start_date: isoDate(-7), end_date: isoDate(0) } }),
          api.get(`/analytics/user/${user.id}/summary/`),
        ]
        if (admin) {
          calls.push(api.get('/reports/activity', { params: { limit: 20 } }))
          calls.push(api.get('/reports/learning', { params: { limit: 20 } }))
        }
        const results = await Promise.allSettled(calls)
        if (results[0].status === 'fulfilled') setPopular(results[0].value.data || [])
        if (results[1].status === 'fulfilled') setDaily(results[1].value.data || [])
        if (results[2].status === 'fulfilled') setSummary(results[2].value.data || [])
        if (admin && results[3]?.status === 'fulfilled') setActivityReport(results[3].value.data || [])
        if (admin && results[4]?.status === 'fulfilled') setLearningReport(results[4].value.data || [])
        const rejected = results.find((r) => r.status === 'rejected')
        if (rejected && !popular.length && !daily.length) throw rejected.reason
      } catch (err) {
        setError(getErrorMessage(err, 'Gagal memuat analytics. Pastikan MongoDB analytics service berjalan.'))
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [user?.id, admin])

  if (loading) return <Spinner />

  return (
    <div className="page container py-4">
      <div className="page-heading">
        <span className="eyebrow">Analytics</span>
        <h1>Aktivitas &amp; Popularitas Course</h1>
        <p>Data dari endpoint analytics MongoDB dan report admin backend.</p>
      </div>
      <AlertError message={error} onClose={() => setError('')} />

      <div className="content-grid two-col mt-4">
        <section className="lms-card p-4">
          <div className="section-heading">
            <div>
              <span className="eyebrow">Popular</span>
              <h2>Kursus Terpopuler</h2>
            </div>
          </div>
          <SimpleTable
            columns={['Kursus', 'Total Views']}
            rows={popular.map((item) => [item.course_name || '-', item.total_views])}
            empty="Belum ada data popular course."
          />
        </section>

        <section className="lms-card p-4">
          <div className="section-heading">
            <div>
              <span className="eyebrow">Daily</span>
              <h2>Aktivitas 7 Hari</h2>
            </div>
          </div>
          <SimpleTable
            columns={['Tanggal', 'Aktivitas', 'User Unik']}
            rows={daily.map((item) => [item.date, item.total_activities, item.unique_users_count])}
            empty="Belum ada aktivitas harian."
          />
        </section>
      </div>

      <section className="lms-card p-4 mt-4">
        <div className="section-heading">
          <div>
            <span className="eyebrow">My Activity</span>
            <h2>Ringkasan Aktivitas Saya</h2>
          </div>
        </div>
        <SimpleTable
          columns={['Aksi', 'Jumlah', 'Terakhir']}
          rows={summary.map((item) => [item.action, item.count, shortDate(item.last_activity)])}
          empty="Belum ada aktivitas user."
        />
      </section>

      {admin && (
        <div className="content-grid two-col mt-4">
          <section className="lms-card p-4">
            <div className="section-heading">
              <div>
                <span className="eyebrow">Admin Report</span>
                <h2>Activity Log</h2>
              </div>
            </div>
            <JsonPreview data={activityReport} empty="Belum ada activity report." />
          </section>
          <section className="lms-card p-4">
            <div className="section-heading">
              <div>
                <span className="eyebrow">Admin Report</span>
                <h2>Learning Log</h2>
              </div>
            </div>
            <JsonPreview data={learningReport} empty="Belum ada learning report." />
          </section>
        </div>
      )}
    </div>
  )
}

function SimpleTable({ columns, rows, empty }) {
  if (!rows.length) return <div className="empty-mini">{empty}</div>
  return (
    <div className="table-shell">
      <table className="table align-middle mb-0">
        <thead>
          <tr>{columns.map((col) => <th key={col}>{col}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((row, idx) => (
            <tr key={idx}>
              {row.map((cell, cellIdx) => <td key={cellIdx}>{cell}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function JsonPreview({ data, empty }) {
  if (!data || data.length === 0) return <div className="empty-mini">{empty}</div>
  return <pre className="json-preview">{JSON.stringify(data, null, 2)}</pre>
}
