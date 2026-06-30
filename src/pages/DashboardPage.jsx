import React, { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import api, { getErrorMessage } from '../api/axios'
import AlertError from '../components/AlertError'
import ProgressBar from '../components/ProgressBar'
import Spinner from '../components/Spinner'
import StarRating from '../components/StarRating'
import TaskPoller from '../components/TaskPoller'
import { useAuth } from '../context/AuthContext'
import { fullName, rupiah, statusLabel } from '../utils/format'
import { isAdmin, isInstructor } from '../utils/roles'
import ChatbotPopup from '../components/ChatbotPopup'

const EMPTY_COURSE = { name: '', description: '', price: 0, level: 'beginner', status: 'draft', category_id: '' }

export default function DashboardPage() {
  const { user } = useAuth()
  const [params] = useSearchParams()

  if (isAdmin(user)) return <AdminDashboard user={user} />
  if (isInstructor(user) || params.get('tab') === 'studio') return <InstructorDashboard user={user} />
  return <StudentDashboard user={user} />
}

function StatCard({ label, value, helper, icon, iconClass = 'stat-icon-blue' }) {
  return (
    <div className="stat-card">
      <div className={`stat-card-icon ${iconClass}`}>{icon}</div>
      <span>{label}</span>
      <strong>{value}</strong>
      {helper && <small>{helper}</small>}
    </div>
  )
}

function FlashSuccess({ message }) {
  if (!message) return null
  return (
    <div className="app-alert app-alert-success">
      <span className="app-alert-icon">✓</span>
      <div style={{ flex: 1 }}>
        <strong>Berhasil</strong>
        <p>{message}</p>
      </div>
    </div>
  )
}

function StudentDashboard({ user }) {
  const [dashboard, setDashboard] = useState(null)
  const [enrollments, setEnrollments] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    async function load() {
      setLoading(true)
      setError('')
      try {
        const [dashRes, enrollRes] = await Promise.all([
          api.get('/dashboard/student'),
          api.get('/enrollments/my-courses', { params: { page_size: 100 } }),
        ])
        setDashboard(dashRes.data)
        setEnrollments(enrollRes.data.data || [])
      } catch (err) {
        setError(getErrorMessage(err, 'Gagal memuat dashboard student.'))
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  if (loading) return <Spinner />
  if (!dashboard) return <div className="container py-4"><AlertError message={error} /></div>

  const enrollmentMap = new Map(enrollments.map((item) => [Number(item.course_id), item]))
  const activeCourses    = dashboard.active_courses    || []
  const completedCourses = dashboard.completed_courses || []

  return (
    <div className="page container py-4">
      <div className="page-heading">
        <span className="eyebrow">Student Dashboard</span>
        <h1>Halo, {fullName(user)} 👋</h1>
        <p>Pantau course aktif, progress, wishlist, dan rekomendasi belajar.</p>
      </div>
      <AlertError message={error} onClose={() => setError('')} />

      <div className="stats-grid mb-4">
        <StatCard label="Total Enrolled"  value={dashboard.total_enrolled  || 0} helper="course terdaftar" icon="📚" iconClass="stat-icon-blue"   />
        <StatCard label="Selesai"         value={dashboard.total_completed || 0} helper="course selesai"  icon="✅" iconClass="stat-icon-green"  />
        <StatCard label="Wishlist"        value={dashboard.wishlist_count  || 0} helper="course disimpan" icon="❤️" iconClass="stat-icon-red"    />
        <StatCard label="Rekomendasi"     value={(dashboard.recommended_courses || []).length} helper="untuk Anda" icon="💡" iconClass="stat-icon-yellow" />
      </div>

      <div className="content-grid two-col">
        <section className="lms-card p-4">
          <div className="section-heading">
            <div>
              <span className="eyebrow">Learning Progress</span>
              <h2>Course Aktif</h2>
            </div>
          </div>
          {activeCourses.length === 0 ? (
            <EmptyMini title="Belum ada course aktif" />
          ) : activeCourses.map((course) => {
            const enrollment = enrollmentMap.get(Number(course.course_id))
            return (
              <article className="dashboard-course" key={course.course_id}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <h3>{course.course_name}</h3>
                  <p>Instruktur: {course.instructor_name}</p>
                  <ProgressBar value={course.progress_percent} label={`${course.completed_lessons}/${course.total_lessons} lesson`} />
                </div>
                <div className="action-row">
                  <Link className="btn btn-soft btn-sm" to={`/courses/${course.course_id}`}>Detail</Link>
                  {enrollment && <Link className="btn btn-primary-lms btn-sm" to={`/progress/${enrollment.id}`}>Lanjutkan</Link>}
                </div>
              </article>
            )
          })}
        </section>

        <aside className="side-stack">
          <section className="lms-card p-4">
            <div className="section-heading">
              <div>
                <span className="eyebrow">Completed</span>
                <h2>Course Selesai</h2>
              </div>
            </div>
            {completedCourses.length === 0 ? (
              <EmptyMini title="Belum ada course selesai" />
            ) : completedCourses.map((course) => (
              <article className="mini-list-item" key={course.course_id}>
                <div>
                  <strong style={{ display: 'block', fontWeight: 600, fontSize: '.9rem' }}>{course.course_name}</strong>
                  <small style={{ color: 'var(--muted)', fontSize: '.8rem' }}>{course.completed_lessons}/{course.total_lessons} lesson</small>
                </div>
                <Link to={`/courses/${course.course_id}`} className="btn btn-soft btn-sm">Lihat</Link>
              </article>
            ))}
          </section>

          <section className="lms-card p-4">
            <div className="section-heading">
              <div>
                <span className="eyebrow">Wishlist</span>
                <h2>Disimpan</h2>
              </div>
            </div>
            {(dashboard.wishlist || []).length === 0 ? (
              <EmptyMini title="Wishlist kosong" />
            ) : dashboard.wishlist.map((course) => (
              <article className="mini-list-item" key={course.course_id}>
                <div>
                  <strong style={{ display: 'block', fontWeight: 600, fontSize: '.9rem' }}>{course.course_name}</strong>
                  <small style={{ color: 'var(--muted)', fontSize: '.8rem' }}>{rupiah(course.price)} · {course.instructor_name}</small>
                </div>
                <Link to={`/courses/${course.course_id}`} className="btn btn-soft btn-sm">Detail</Link>
              </article>
            ))}
          </section>
        </aside>
      </div>

      <section className="lms-card p-4 mt-4">
        <div className="section-heading">
          <div>
            <span className="eyebrow">Recommended</span>
            <h2>Rekomendasi Course</h2>
          </div>
        </div>
        <div className="recommend-grid">
          {(dashboard.recommended_courses || []).length === 0 ? (
            <EmptyMini title="Belum ada rekomendasi" />
          ) : dashboard.recommended_courses.map((course) => (
            <article className="recommend-card" key={course.id}>
              <span>{course.reason}</span>
              <h3>{course.name}</h3>
              <p>{course.instructor_name}</p>
              <StarRating value={course.rating_avg} />
              <div className="course-footer">
                <strong>{rupiah(course.price)}</strong>
                <Link className="btn btn-soft btn-sm" to={`/courses/${course.id}`}>Detail</Link>
              </div>
            </article>
          ))}
        </div>
      </section>
      <ChatbotPopup />
    </div>
  )
}

function InstructorDashboard({ user }) {
  const [courses, setCourses]     = useState([])
  const [categories, setCategories] = useState([])
  const [newCourse, setNewCourse] = useState(EMPTY_COURSE)
  const [loading, setLoading]     = useState(true)
  const [saving, setSaving]       = useState(false)
  const [error, setError]         = useState('')
  const [flash, setFlash]         = useState('')

  async function load() {
    setLoading(true)
    setError('')
    try {
      const [courseRes, catRes] = await Promise.all([
        api.get('/courses', { params: { instructor_id: user.id, page_size: 100, ordering: '-created_at' } }),
        api.get('/categories', { params: { page_size: 100 } }),
      ])
      setCourses(courseRes.data.data || [])
      setCategories(catRes.data.data || [])
    } catch (err) {
      setError(getErrorMessage(err, 'Gagal memuat dashboard instructor.'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  async function createCourse(event) {
    event.preventDefault()
    setSaving(true)
    setError('')
    try {
      await api.post('/courses', {
        ...newCourse,
        price: Number(newCourse.price || 0),
        category_id: newCourse.category_id ? Number(newCourse.category_id) : null,
      })
      setNewCourse(EMPTY_COURSE)
      setFlash('Kursus berhasil dibuat.')
      load()
    } catch (err) {
      setError(getErrorMessage(err, 'Gagal membuat kursus.'))
    } finally {
      setSaving(false)
    }
  }

  async function submitForReview(courseId) {
    if (!window.confirm('Ajukan kursus ini untuk direview admin sebelum dipublikasikan?')) return
    try {
      await api.post(`/courses/${courseId}/submit-for-review`)
      setFlash('Kursus berhasil diajukan untuk review. Tunggu persetujuan admin.')
      load()
    } catch (err) {
      setError(getErrorMessage(err, 'Gagal mengajukan review.'))
    }
  }

  async function updateStatus(courseId, status) {
    try {
      await api.patch(`/courses/${courseId}`, { status })
      setFlash(`Status kursus diubah menjadi ${statusLabel(status)}.`)
      load()
    } catch (err) {
      setError(getErrorMessage(err, 'Gagal mengubah status kursus.'))
    }
  }

  const stats = useMemo(() => ({
    total:          courses.length,
    published:      courses.filter((c) => c.status === 'published').length,
    pending_review: courses.filter((c) => c.status === 'pending_review').length,
    draft:          courses.filter((c) => c.status === 'draft').length,
    archived:       courses.filter((c) => c.status === 'archived').length,
  }), [courses])

  if (loading) return <Spinner />

  return (
    <div className="page container py-4">
      <div className="page-heading">
        <span className="eyebrow">Instructor Studio</span>
        <h1>Kelola Kursus &amp; Curriculum</h1>
        <p>Buat, edit, dan atur status publikasi kursus Anda.</p>
      </div>
      <FlashSuccess message={flash} />
      <AlertError message={error} onClose={() => setError('')} />

      <div className="stats-grid mb-4">
        <StatCard label="Total Kursus"     value={stats.total}          icon="📖" iconClass="stat-icon-blue"   />
        <StatCard label="Published"        value={stats.published}      icon="✅" iconClass="stat-icon-green"  />
        <StatCard label="Menunggu Review"  value={stats.pending_review} icon="⏳" iconClass="stat-icon-yellow" helper={stats.pending_review > 0 ? 'Menunggu admin' : undefined} />
        <StatCard label="Draft"            value={stats.draft}          icon="📝" iconClass="stat-icon-gray"   />
      </div>

      <div className="content-grid two-col wide-right">
        <section className="lms-card p-4">
          <div className="section-heading">
            <div>
              <span className="eyebrow">Create</span>
              <h2>Buat Kursus Baru</h2>
            </div>
          </div>
          <CourseForm form={newCourse} setForm={setNewCourse} categories={categories} onSubmit={createCourse} saving={saving} submitLabel="Buat Kursus" />
        </section>

        <section className="lms-card p-4">
          <div className="section-heading">
            <div>
              <span className="eyebrow">My Courses</span>
              <h2>Kursus Saya</h2>
            </div>
          </div>
          {courses.length === 0 ? <EmptyMini title="Belum punya kursus" /> : courses.map((course) => (
            <article className="course-row" key={course.id}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <span className={`status-badge ${course.status}`}>{statusLabel(course.status)}</span>
                <h3>{course.name}</h3>
                <p>{course.category?.name || 'Tanpa kategori'} · {rupiah(course.price)}</p>
                {course.status === 'pending_review' && (
                  <small style={{ color: 'var(--warning, #f59e0b)', display: 'block', marginTop: '2px' }}>
                    ⏳ Sedang menunggu review dari admin
                  </small>
                )}
              </div>
              <div className="action-row">
                <Link className="btn btn-soft btn-sm" to={`/courses/${course.id}`}>Kelola</Link>
                {/* Instructor hanya bisa set draft/archived langsung. Publish butuh review. */}
                {course.status === 'draft' && (
                  <button className="btn btn-success-soft btn-sm" onClick={() => submitForReview(course.id)}>
                    Ajukan Publish
                  </button>
                )}
                {course.status === 'pending_review' && (
                  <button className="btn btn-soft btn-sm" disabled title="Menunggu keputusan admin">
                    ⏳ Pending Review
                  </button>
                )}
                {course.status === 'published' && (
                  <button className="btn btn-soft btn-sm" onClick={() => updateStatus(course.id, 'draft')}>
                    Tarik ke Draft
                  </button>
                )}
                {course.status !== 'archived' && (
                  <button className="btn btn-warning-soft btn-sm" onClick={() => updateStatus(course.id, 'archived')}>Archive</button>
                )}
                {course.status === 'archived' && (
                  <button className="btn btn-soft btn-sm" onClick={() => updateStatus(course.id, 'draft')}>Restore ke Draft</button>
                )}
              </div>
            </article>
          ))}
        </section>
      </div>
    </div>
  )
}

function AdminDashboard({ user }) {
  const [courses, setCourses]           = useState([])
  const [categories, setCategories]     = useState([])
  const [categoryForm, setCategoryForm] = useState({ name: '', description: '' })
  const [editingCategory, setEditingCategory] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving]   = useState(false)
  const [error, setError]     = useState('')
  const [flash, setFlash]     = useState('')
  const [taskId, setTaskId]   = useState('')

  async function load() {
    setLoading(true)
    setError('')
    try {
      const [courseRes, catRes] = await Promise.all([
        api.get('/courses', { params: { page_size: 100, ordering: '-created_at' } }),
        api.get('/categories', { params: { page_size: 100 } }),
      ])
      setCourses(courseRes.data.data || [])
      setCategories(catRes.data.data || [])
    } catch (err) {
      setError(getErrorMessage(err, 'Gagal memuat panel admin.'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  async function addCategory(event) {
    event.preventDefault()
    setSaving(true)
    try {
      await api.post('/categories', categoryForm)
      setCategoryForm({ name: '', description: '' })
      setFlash('Kategori berhasil ditambahkan.')
      load()
    } catch (err) {
      setError(getErrorMessage(err, 'Gagal menambahkan kategori.'))
    } finally {
      setSaving(false)
    }
  }

  async function saveCategory(event) {
    event.preventDefault()
    if (!editingCategory) return
    try {
      await api.patch(`/categories/${editingCategory.id}`, {
        name: editingCategory.name,
        description: editingCategory.description || '-',
      })
      setEditingCategory(null)
      setFlash('Kategori diperbarui.')
      load()
    } catch (err) {
      setError(getErrorMessage(err, 'Gagal memperbarui kategori.'))
    }
  }

  async function deleteCategory(id) {
    if (!window.confirm('Hapus kategori ini? Course terkait akan menjadi tanpa kategori.')) return
    try {
      await api.delete(`/categories/${id}`)
      setFlash('Kategori dihapus.')
      load()
    } catch (err) {
      setError(getErrorMessage(err, 'Gagal menghapus kategori.'))
    }
  }

  async function updateCourseStatus(courseId, status) {
    try {
      await api.patch(`/courses/${courseId}`, { status })
      setFlash(`Status course diubah menjadi ${statusLabel(status)}.`)
      load()
    } catch (err) {
      setError(getErrorMessage(err, 'Gagal mengubah status course.'))
    }
  }

  async function approveCourse(courseId) {
    try {
      await api.post(`/courses/${courseId}/approve`)
      setFlash('Course disetujui dan dipublikasikan.')
      load()
    } catch (err) {
      setError(getErrorMessage(err, 'Gagal menyetujui course.'))
    }
  }

  async function rejectCourse(courseId) {
    const reason = window.prompt('Alasan penolakan (opsional):', '')
    if (reason === null) return
    try {
      await api.post(`/courses/${courseId}/reject`, { reason })
      setFlash('Course ditolak dan dikembalikan ke draft.')
      load()
    } catch (err) {
      setError(getErrorMessage(err, 'Gagal menolak course.'))
    }
  }

  async function updateStatsTask() {
    try {
      const { data } = await api.post('/tasks/update-course-statistics')
      setTaskId(data.task_id)
      setFlash(data.message || 'Task update statistik berjalan.')
    } catch (err) {
      setError(getErrorMessage(err, 'Gagal menjalankan task statistik.'))
    }
  }

  const stats = useMemo(() => ({
    courses:        courses.length,
    categories:     categories.length,
    pending_review: courses.filter((c) => c.status === 'pending_review').length,
    draft:          courses.filter((c) => c.status === 'draft').length,
    published:      courses.filter((c) => c.status === 'published').length,
  }), [courses, categories])

  if (loading) return <Spinner />

  return (
    <div className="page container py-4">
      <div className="page-heading">
        <span className="eyebrow">Admin Dashboard</span>
        <h1>Panel Operasional LMS</h1>
        <p>Kelola kategori, workflow status course, dan background task.</p>
      </div>
      <FlashSuccess message={flash} />
      <AlertError message={error} onClose={() => setError('')} />
      <TaskPoller taskId={taskId} />

      <div className="stats-grid mb-4">
        <StatCard label="Total Course"     value={stats.courses}        icon="📚" iconClass="stat-icon-blue"   />
        <StatCard label="Kategori"         value={stats.categories}     icon="🗂️" iconClass="stat-icon-purple" />
        <StatCard
          label="Pending Review"
          value={stats.pending_review}
          icon="⏳"
          iconClass={stats.pending_review > 0 ? 'stat-icon-yellow' : 'stat-icon-gray'}
          helper={stats.pending_review > 0 ? 'Butuh persetujuan' : 'Tidak ada antrian'}
        />
        <StatCard label="Published"        value={stats.published}      icon="✅" iconClass="stat-icon-green"  />
      </div>

      <div className="content-grid two-col wide-right">
        <section className="lms-card p-4">
          <div className="section-heading">
            <div>
              <span className="eyebrow">Categories</span>
              <h2>Manajemen Kategori</h2>
            </div>
          </div>
          <form className="create-panel compact" onSubmit={addCategory}>
            <input
              className="form-control"
              placeholder="Nama kategori baru"
              value={categoryForm.name}
              onChange={(e) => setCategoryForm({ ...categoryForm, name: e.target.value })}
              required
            />
            <textarea
              className="form-control"
              rows="2"
              placeholder="Deskripsi (opsional)"
              value={categoryForm.description}
              onChange={(e) => setCategoryForm({ ...categoryForm, description: e.target.value })}
            />
            <button className="btn btn-primary-lms" disabled={saving}>Tambah Kategori</button>
          </form>
          <div className="table-shell mt-3">
            <table className="table align-middle mb-0">
              <thead><tr><th>Nama</th><th>Slug</th><th>Aksi</th></tr></thead>
              <tbody>
                {categories.map((category) => (
                  <tr key={category.id}>
                    <td>
                      {editingCategory?.id === category.id
                        ? <input className="form-control" value={editingCategory.name} onChange={(e) => setEditingCategory({ ...editingCategory, name: e.target.value })} />
                        : category.name}
                    </td>
                    <td style={{ color: 'var(--muted)', fontSize: '.85rem' }}>{category.slug}</td>
                    <td>
                      {editingCategory?.id === category.id ? (
                        <form className="action-row" onSubmit={saveCategory}>
                          <button className="btn btn-primary-lms btn-sm">Simpan</button>
                          <button className="btn btn-soft btn-sm" type="button" onClick={() => setEditingCategory(null)}>Batal</button>
                        </form>
                      ) : (
                        <div className="action-row">
                          <button className="btn btn-soft btn-sm" onClick={() => setEditingCategory(category)}>Edit</button>
                          <button className="btn btn-danger-soft btn-sm" onClick={() => deleteCategory(category.id)}>Hapus</button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="lms-card p-4">
          <div className="section-heading">
            <div>
              <span className="eyebrow">Publishing Workflow</span>
              <h2>Status Course</h2>
              <p>Kelola status semua course di platform. Course berstatus <span className="status-badge pending_review" style={{ fontSize: '.75rem' }}>Menunggu Review</span> membutuhkan tindakan Anda.</p>
            </div>
            <button className="btn btn-soft" onClick={updateStatsTask}>Update Statistik</button>
          </div>
          <div className="table-shell">
            <table className="table align-middle mb-0">
              <thead><tr><th>Course</th><th>Instructor</th><th>Status</th><th>Aksi</th></tr></thead>
              <tbody>
                {courses.map((course) => (
                  <tr key={course.id} style={course.status === 'pending_review' ? { background: 'rgba(245, 158, 11, 0.06)' } : {}}>
                    <td>
                      <Link to={`/courses/${course.id}`} style={{ fontWeight: 600, color: 'var(--primary)' }}>{course.name}</Link>
                      <small className="d-block" style={{ color: 'var(--muted)' }}>{course.category?.name || 'Tanpa kategori'}</small>
                    </td>
                    <td style={{ fontSize: '.875rem' }}>{fullName(course.teacher)}</td>
                    <td><span className={`status-badge ${course.status}`}>{statusLabel(course.status)}</span></td>
                    <td>
                      <div className="action-row">
                        {/* Admin Approve/Reject untuk course pending_review */}
                        {course.status === 'pending_review' ? (
                          <>
                            <button className="btn btn-success-soft btn-sm" onClick={() => approveCourse(course.id)}>✓ Approve</button>
                            <button className="btn btn-danger-soft btn-sm" onClick={() => rejectCourse(course.id)}>✗ Reject</button>
                          </>
                        ) : (
                          <>
                            <button className="btn btn-soft btn-sm"          onClick={() => updateCourseStatus(course.id, 'draft')}>Draft</button>
                            <button className="btn btn-success-soft btn-sm"  onClick={() => updateCourseStatus(course.id, 'published')}>Publish</button>
                            <button className="btn btn-warning-soft btn-sm"  onClick={() => updateCourseStatus(course.id, 'archived')}>Archive</button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  )
}

function CourseForm({ form, setForm, categories, onSubmit, saving, submitLabel }) {
  return (
    <form className="form-stack" onSubmit={onSubmit}>
      <label>
        <span>Nama Kursus</span>
        <input className="form-control" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required placeholder="Judul kursus" />
      </label>
      <label>
        <span>Deskripsi</span>
        <textarea className="form-control" rows="3" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Deskripsi singkat kursus" />
      </label>
      <div className="grid-2">
        <label>
          <span>Kategori</span>
          <select className="form-select" value={form.category_id} onChange={(e) => setForm({ ...form, category_id: e.target.value })}>
            <option value="">Tanpa kategori</option>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </label>
        <label>
          <span>Harga (Rp)</span>
          <input className="form-control" type="number" min="0" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} required />
        </label>
      </div>
      <div className="grid-2">
        <label>
          <span>Level</span>
          <select className="form-select" value={form.level} onChange={(e) => setForm({ ...form, level: e.target.value })}>
            <option value="beginner">Beginner</option>
            <option value="intermediate">Intermediate</option>
            <option value="advanced">Advanced</option>
          </select>
        </label>
        <label>
          <span>Status Awal</span>
          {/* Instructor tidak bisa langsung publish — harus ajukan review dulu */}
          <select className="form-select" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
            <option value="draft">Draft (default)</option>
            <option value="archived">Archived</option>
          </select>
          <small style={{ display: 'block', marginTop: '3px', opacity: 0.6 }}>Course baru dimulai sebagai Draft. Gunakan "Ajukan Publish" setelah siap.</small>
        </label>
      </div>
      <button className="btn btn-primary-lms" disabled={saving}>{saving ? 'Menyimpan...' : submitLabel}</button>
    </form>
  )
}

function EmptyMini({ title }) {
  return <div className="empty-mini">{title}</div>
}
