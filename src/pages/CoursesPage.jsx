import React, { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import api, { getErrorMessage } from '../api/axios'
import AlertError from '../components/AlertError'
import Spinner from '../components/Spinner'
import StarRating from '../components/StarRating'
import { useAuth } from '../context/AuthContext'
import useDebounce from '../hooks/useDebounce'
import { fullName, levelLabel, rupiah, statusLabel } from '../utils/format'
import { canManageCourse, isAdmin, isInstructor, isStudent } from '../utils/roles'

const EMPTY_COURSE = {
  name: '', description: '', price: 0, image: '',
  category_id: '', level: 'beginner', status: 'draft',
}

export default function CoursesPage() {
  const { user, isAuthenticated } = useAuth()
  const canSeeStatus = isAdmin(user) || isInstructor(user)
  const canUseWishlist = isAuthenticated && !isAdmin(user)

  const [courses, setCourses]           = useState([])
  const [categories, setCategories]     = useState([])
  const [wishlistIds, setWishlistIds]   = useState(new Set())
  const [loading, setLoading]           = useState(true)
  const [saving, setSaving]             = useState(false)
  const [error, setError]               = useState('')
  const [flash, setFlash]               = useState('')
  const [showCreate, setShowCreate]     = useState(false)
  const [newCourse, setNewCourse]       = useState(EMPTY_COURSE)

  const [search, setSearch]       = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [level, setLevel]         = useState('')
  const [status, setStatus]       = useState('')
  const [minPrice, setMinPrice]   = useState('')
  const [maxPrice, setMaxPrice]   = useState('')
  const [ordering, setOrdering]   = useState('-created_at')
  const [page, setPage]           = useState(1)
  const pageSize = 12
  const [total, setTotal] = useState(0)

  const debouncedSearch = useDebounce(search, 450)
  const totalPages      = Math.max(1, Math.ceil(total / pageSize))
  const activeFilters   = Boolean(search || categoryId || level || status || minPrice || maxPrice || ordering !== '-created_at')

  async function loadCategories() {
    const { data } = await api.get('/categories', { params: { page_size: 100 } })
    const list = data?.data || data
    setCategories(Array.isArray(list) ? list : [])
  }

  async function loadWishlist() {
    if (!isAuthenticated) { setWishlistIds(new Set()); return }
    try {
      const { data } = await api.get('/wishlist', { params: { page_size: 100 } })
      setWishlistIds(new Set((data.data || []).map((item) => Number(item.course_id))))
    } catch {
      setWishlistIds(new Set())
    }
  }

  async function loadCourses() {
    setLoading(true)
    setError('')
    try {
      const params = { page, page_size: pageSize, ordering }
      if (debouncedSearch) params.search    = debouncedSearch
      if (categoryId)      params.category_id = categoryId
      if (level)           params.level     = level
      if (minPrice)        params.min_price = minPrice
      if (maxPrice)        params.max_price = maxPrice
      if (status)          params.status    = status
      if (!canSeeStatus && !status) params.status = 'published'
      const { data } = await api.get('/courses', { params })
      setCourses(data.data || [])
      setTotal(data.total || 0)
    } catch (err) {
      setError(getErrorMessage(err, 'Gagal memuat daftar kursus.'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadCategories().catch(() => {}) }, [])
  useEffect(() => { loadWishlist()                   }, [isAuthenticated])
  useEffect(() => { loadCourses()                    }, [debouncedSearch, categoryId, level, status, minPrice, maxPrice, ordering, page, canSeeStatus])

  function resetFilters() {
    setSearch(''); setCategoryId(''); setLevel(''); setStatus('')
    setMinPrice(''); setMaxPrice(''); setOrdering('-created_at'); setPage(1)
  }

  async function handleCreate(event) {
    event.preventDefault()
    setSaving(true)
    setError('')
    setFlash('')
    try {
      const payload = {
        ...newCourse,
        price: Number(newCourse.price || 0),
        category_id: newCourse.category_id ? Number(newCourse.category_id) : null,
      }
      const { data } = await api.post('/courses', payload)
      setNewCourse(EMPTY_COURSE)
      setShowCreate(false)
      setFlash(`Kursus "${data.name}" berhasil dibuat.`)
      loadCourses()
    } catch (err) {
      setError(getErrorMessage(err, 'Gagal membuat kursus.'))
    } finally {
      setSaving(false)
    }
  }

  async function toggleWishlist(courseId) {
    if (!isAuthenticated) return
    const id = Number(courseId)
    const next = new Set(wishlistIds)
    const wasWishlisted = next.has(id)
    if (wasWishlisted) next.delete(id); else next.add(id)
    setWishlistIds(next)
    try {
      if (wasWishlisted) await api.delete(`/wishlist/${id}`)
      else await api.post('/wishlist', { course_id: id })
    } catch (err) {
      setWishlistIds(wishlistIds)
      setError(getErrorMessage(err, 'Gagal memperbarui wishlist.'))
    }
  }

  const publishedCount = useMemo(() => courses.filter((c) => c.status === 'published').length, [courses])

  return (
    <div className="page">
      {/* Hero */}
      <section className="hero">
        <div className="container hero-content">
          <span className="eyebrow light">Course &amp; Learning Experience</span>
          <h1>Temukan kursus yang sesuai dengan target belajar Anda</h1>
          <p>Search, filter, sorting, rating, wishlist, dan enrollment tersedia lengkap.</p>
          <div className="hero-actions">
            <span>{total} kursus ditemukan</span>
            <span>{publishedCount} published di halaman ini</span>
          </div>
        </div>
      </section>

      <div className="container py-4">
        {flash && (
          <div className="app-alert app-alert-success">
            <span className="app-alert-icon">✓</span>
            <div style={{ flex: 1 }}><strong>Berhasil</strong><p>{flash}</p></div>
          </div>
        )}
        <AlertError message={error} onClose={() => setError('')} />

        {/* Toolbar */}
        <section className="toolbar-card">
          <div className="toolbar-top">
            <div>
              <h2>Daftar Kursus</h2>
              <p>{canSeeStatus ? 'Anda dapat melihat semua status kursus.' : 'Hanya menampilkan kursus yang published.'}</p>
            </div>
            {isInstructor(user) && (
              <button className="btn btn-primary-lms" type="button" onClick={() => setShowCreate((prev) => !prev)}>
                {showCreate ? 'Tutup Form' : '+ Buat Kursus'}
              </button>
            )}
          </div>

          {showCreate && (
            <form className="create-panel" onSubmit={handleCreate}>
              <div className="grid-2">
                <label>
                  <span>Nama Kursus</span>
                  <input className="form-control" value={newCourse.name} onChange={(e) => setNewCourse({ ...newCourse, name: e.target.value })} required placeholder="Judul kursus" />
                </label>
                <label>
                  <span>Kategori</span>
                  <select className="form-select" value={newCourse.category_id} onChange={(e) => setNewCourse({ ...newCourse, category_id: e.target.value })}>
                    <option value="">Tanpa kategori</option>
                    {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </label>
              </div>
              <label>
                <span>Deskripsi</span>
                <textarea className="form-control" rows="3" value={newCourse.description} onChange={(e) => setNewCourse({ ...newCourse, description: e.target.value })} placeholder="Deskripsi singkat" />
              </label>
              <div className="grid-3">
                <label>
                  <span>Harga (Rp)</span>
                  <input className="form-control" type="number" min="0" value={newCourse.price} onChange={(e) => setNewCourse({ ...newCourse, price: e.target.value })} required />
                </label>
                <label>
                  <span>Level</span>
                  <select className="form-select" value={newCourse.level} onChange={(e) => setNewCourse({ ...newCourse, level: e.target.value })}>
                    <option value="beginner">Beginner</option>
                    <option value="intermediate">Intermediate</option>
                    <option value="advanced">Advanced</option>
                  </select>
                </label>
                <label>
                  <span>Status</span>
                  <select className="form-select" value={newCourse.status} onChange={(e) => setNewCourse({ ...newCourse, status: e.target.value })}>
                    <option value="draft">Draft</option>
                    <option value="published">Published</option>
                    <option value="archived">Archived</option>
                  </select>
                </label>
              </div>
              <button className="btn btn-primary-lms" type="submit" disabled={saving}>
                {saving ? 'Menyimpan...' : 'Simpan Kursus'}
              </button>
            </form>
          )}

          {/* Filters */}
          <div className="filter-grid">
            <label>
              <span>Cari</span>
              <input className="form-control" placeholder="Cari nama atau deskripsi..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(1) }} />
            </label>
            <label>
              <span>Kategori</span>
              <select className="form-select" value={categoryId} onChange={(e) => { setCategoryId(e.target.value); setPage(1) }}>
                <option value="">Semua kategori</option>
                {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </label>
            <label>
              <span>Level</span>
              <select className="form-select" value={level} onChange={(e) => { setLevel(e.target.value); setPage(1) }}>
                <option value="">Semua level</option>
                <option value="beginner">Beginner</option>
                <option value="intermediate">Intermediate</option>
                <option value="advanced">Advanced</option>
              </select>
            </label>
            {canSeeStatus && (
              <label>
                <span>Status</span>
                <select className="form-select" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1) }}>
                  <option value="">Semua status</option>
                  <option value="published">Published</option>
                  <option value="draft">Draft</option>
                  <option value="archived">Archived</option>
                </select>
              </label>
            )}
            <label>
              <span>Min Harga</span>
              <input className="form-control" type="number" min="0" value={minPrice} onChange={(e) => { setMinPrice(e.target.value); setPage(1) }} placeholder="0" />
            </label>
            <label>
              <span>Max Harga</span>
              <input className="form-control" type="number" min="0" value={maxPrice} onChange={(e) => { setMaxPrice(e.target.value); setPage(1) }} placeholder="∞" />
            </label>
            <label>
              <span>Urutkan</span>
              <select className="form-select" value={ordering} onChange={(e) => { setOrdering(e.target.value); setPage(1) }}>
                <option value="-created_at">Terbaru</option>
                <option value="created_at">Terlama</option>
                <option value="name">Nama A–Z</option>
                <option value="-name">Nama Z–A</option>
                <option value="price">Harga terendah</option>
                <option value="-price">Harga tertinggi</option>
                <option value="-rating_avg">Rating tertinggi</option>
                <option value="rating_avg">Rating terendah</option>
              </select>
            </label>
            {activeFilters && (
              <button className="btn btn-soft align-self-end" type="button" onClick={resetFilters}>Reset</button>
            )}
          </div>
        </section>

        {/* Course list */}
        {loading ? (
          <Spinner />
        ) : courses.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">⌕</div>
            <h2>Kursus tidak ditemukan</h2>
            <p>Coba ubah filter pencarian atau tekan Reset.</p>
            {activeFilters && (
              <button className="btn btn-soft mt-3" onClick={resetFilters}>Reset Filter</button>
            )}
          </div>
        ) : (
          <div className="course-grid">
            {courses.map((course) => (
              <article className="course-card" key={course.id}>
                <div className="course-thumb">
                  {course.image
                    ? <img src={course.image} alt={course.name} />
                    : <span>{course.name?.slice(0, 1) || 'L'}</span>}
                  {canSeeStatus && (
                    <span className={`status-badge ${course.status}`}>{statusLabel(course.status)}</span>
                  )}
                </div>
                <div className="course-body">
                  <div className="course-tags">
                    <span>{course.category?.name || 'Tanpa kategori'}</span>
                    <span>{levelLabel(course.level)}</span>
                  </div>
                  <h3>{course.name}</h3>
                  <p>{course.description || '—'}</p>
                  <div className="course-meta">
                    <span style={{ fontWeight: 500 }}>{fullName(course.teacher)}</span>
                    <StarRating value={course.rating_avg} />
                  </div>
                  <div className="course-footer">
                    <strong>{rupiah(course.price)}</strong>
                    <div className="d-flex gap-2">
                      {canUseWishlist && (
                        <button
                          className={`icon-toggle ${wishlistIds.has(Number(course.id)) ? 'active' : ''}`}
                          type="button"
                          onClick={() => toggleWishlist(course.id)}
                          aria-label="Wishlist"
                        >
                          ♥
                        </button>
                      )}
                      <Link className="btn btn-primary-lms btn-sm" to={`/courses/${course.id}`}>Detail</Link>
                    </div>
                  </div>
                  {canManageCourse(user, course) && (
                    <div className="owner-note">Anda dapat mengelola kursus ini di halaman detail.</div>
                  )}
                </div>
              </article>
            ))}
          </div>
        )}

        {/* Pagination */}
        {!loading && totalPages > 1 && (
          <div className="pagination-row">
            <button className="btn btn-soft" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>← Sebelumnya</button>
            <span>Halaman <strong>{page}</strong> dari {totalPages}</span>
            <button className="btn btn-soft" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>Berikutnya →</button>
          </div>
        )}
      </div>
    </div>
  )
}
