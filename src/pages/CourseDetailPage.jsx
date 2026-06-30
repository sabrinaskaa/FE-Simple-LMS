import React, { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import api, { getErrorMessage } from '../api/axios'
import AlertError from '../components/AlertError'
import Spinner from '../components/Spinner'
import StarRating from '../components/StarRating'
import TaskPoller from '../components/TaskPoller'
import { useAuth } from '../context/AuthContext'
import { canManageCourse, isAdmin, isInstructor } from '../utils/roles'
import { fullName, levelLabel, rupiah, shortDate, statusLabel } from '../utils/format'

const EMPTY_LESSON = { name: '', description: '', video_url: '', section_id: '', order: 0, duration_minutes: '' }
const EMPTY_SECTION = { title: '', order: 0 }

function lessonTitle(lesson) {
  return lesson?.name || lesson?.title || 'Untitled lesson'
}

function filenameFromPath(path, fallback = 'materi') {
  if (!path) return fallback
  return String(path).split('/').filter(Boolean).pop() || fallback
}

function withProtocol(rawUrl) {
  const value = String(rawUrl || '').trim()
  if (!value) return ''
  if (/^https?:\/\//i.test(value)) return value
  if (/^(www\.)?(youtube\.com|youtu\.be)\//i.test(value)) return `https://${value}`
  return value
}

function cleanVideoId(value) {
  return String(value || '').split(/[?&#/]/)[0].trim()
}

function parseYoutubeTime(value) {
  if (!value) return 0
  const raw = String(value).trim().toLowerCase()
  if (/^\d+$/.test(raw)) return Number(raw)
  const hours = raw.match(/(\d+)h/)?.[1] || 0
  const minutes = raw.match(/(\d+)m/)?.[1] || 0
  const seconds = raw.match(/(\d+)s/)?.[1] || 0
  return Number(hours) * 3600 + Number(minutes) * 60 + Number(seconds)
}

function getYoutubeMeta(rawUrl) {
  const normalized = withProtocol(rawUrl)
  if (!normalized) return null

  const directId = cleanVideoId(normalized)
  if (/^[a-zA-Z0-9_-]{11}$/.test(directId)) {
    return {
      type: 'youtube',
      id: directId,
      embedUrl: `https://www.youtube-nocookie.com/embed/${directId}?rel=0&modestbranding=1`,
      watchUrl: `https://www.youtube.com/watch?v=${directId}`,
    }
  }

  try {
    const url = new URL(normalized)
    const host = url.hostname.replace(/^www\./, '').replace(/^m\./, '')

    if (host === 'youtube.com' || host === 'youtube-nocookie.com') {
      const attributionUrl = url.searchParams.get('u')
      if (url.pathname.includes('attribution_link') && attributionUrl) {
        return getYoutubeMeta(decodeURIComponent(attributionUrl))
      }

      const parts = url.pathname.split('/').filter(Boolean)
      const knownPathVideoId = ['embed', 'shorts', 'live', 'v'].includes(parts[0]) ? cleanVideoId(parts[1]) : ''
      const videoId = cleanVideoId(url.searchParams.get('v')) || knownPathVideoId

      if (videoId) {
        const start = parseYoutubeTime(url.searchParams.get('start') || url.searchParams.get('t'))
        const params = new URLSearchParams({ rel: '0', modestbranding: '1' })
        if (start > 0) params.set('start', String(start))
        return {
          type: 'youtube',
          id: videoId,
          embedUrl: `https://www.youtube-nocookie.com/embed/${videoId}?${params.toString()}`,
          watchUrl: `https://www.youtube.com/watch?v=${videoId}`,
        }
      }
    }

    if (host === 'youtu.be') {
      const videoId = cleanVideoId(url.pathname.replace(/^\//, ''))
      if (videoId) {
        const start = parseYoutubeTime(url.searchParams.get('start') || url.searchParams.get('t'))
        const params = new URLSearchParams({ rel: '0', modestbranding: '1' })
        if (start > 0) params.set('start', String(start))
        return {
          type: 'youtube',
          id: videoId,
          embedUrl: `https://www.youtube-nocookie.com/embed/${videoId}?${params.toString()}`,
          watchUrl: `https://www.youtube.com/watch?v=${videoId}`,
        }
      }
    }
  } catch {
    return null
  }

  return null
}

function getVideoMeta(rawUrl) {
  const normalized = withProtocol(rawUrl)
  if (!normalized) return null

  const youtube = getYoutubeMeta(normalized)
  if (youtube) return youtube

  try {
    const url = new URL(normalized)
    const isDirectVideo = /\.(mp4|webm|ogg)(\?.*)?$/i.test(url.pathname)
    if (isDirectVideo) return { type: 'native', src: normalized, watchUrl: normalized }
    return { type: 'external', watchUrl: normalized }
  } catch {
    return { type: 'external', watchUrl: normalized }
  }
}

export default function CourseDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user, isAuthenticated } = useAuth()
  const [course, setCourse] = useState(null)
  const [sections, setSections] = useState([])
  const [contents, setContents] = useState([])
  const [categories, setCategories] = useState([])
  const [reviews, setReviews] = useState([])
  const [ratingAvg, setRatingAvg] = useState(0)
  const [enrollment, setEnrollment] = useState(null)
  const [progressDetail, setProgressDetail] = useState(null)
  const [completedLessonIds, setCompletedLessonIds] = useState(new Set())
  const [selectedLessonId, setSelectedLessonId] = useState(null)
  const [selectedLesson, setSelectedLesson] = useState(null)
  const [lessonDetailLoading, setLessonDetailLoading] = useState(false)
  const [wishlisted, setWishlisted] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [flash, setFlash] = useState('')
  const [editOpen, setEditOpen] = useState(false)
  const [editCourse, setEditCourse] = useState({})
  const [newSection, setNewSection] = useState(EMPTY_SECTION)
  const [lessonForm, setLessonForm] = useState(EMPTY_LESSON)
  const [editingSection, setEditingSection] = useState(null)
  const [editingLesson, setEditingLesson] = useState(null)
  const [uploadingId, setUploadingId] = useState(null)
  const [reviewForm, setReviewForm] = useState({ rating: 5, review: '' })
  const [taskId, setTaskId] = useState('')
  // Publishing workflow
  const [publishHistory, setPublishHistory] = useState([])
  // Prerequisites
  const [prerequisites, setPrerequisites] = useState([])
  const [allCourses, setAllCourses] = useState([])
  const [newPrereqId, setNewPrereqId] = useState('')

  const canManage = canManageCourse(user, course)
  const isAdminUser = isAdmin(user)
  const isInstructorUser = isInstructor(user)
  const isStudent = isAuthenticated && !isAdminUser && !isInstructorUser
  const contentById = useMemo(() => new Map(contents.map((item) => [Number(item.id), item])), [contents])

  const curriculumSections = useMemo(() => {
    const normalized = sections.map((section) => ({
      ...section,
      isVirtual: false,
      lessons: (section.lessons || [])
        .map((lesson) => contentById.get(Number(lesson.id)) || lesson)
        .sort((a, b) => Number(a.order || 0) - Number(b.order || 0) || Number(a.id) - Number(b.id)),
    }))

    const sectionLessonIds = new Set(normalized.flatMap((section) => (section.lessons || []).map((lesson) => Number(lesson.id))))
    const unsectioned = contents
      .filter((lesson) => !lesson.section_id && !lesson.parent_id && !sectionLessonIds.has(Number(lesson.id)))
      .sort((a, b) => Number(a.order || 0) - Number(b.order || 0) || Number(a.id) - Number(b.id))

    if (unsectioned.length > 0) {
      normalized.push({
        id: 'unsectioned',
        course_id: Number(id),
        title: 'Tanpa Section',
        order: 9999,
        total_lessons: unsectioned.length,
        lessons: unsectioned,
        isVirtual: true,
      })
    }

    return normalized.sort((a, b) => Number(a.order || 0) - Number(b.order || 0))
  }, [sections, contents, contentById, id])

  const firstLessonId = useMemo(() => {
    for (const section of curriculumSections) {
      if ((section.lessons || []).length > 0) return section.lessons[0].id
    }
    return null
  }, [curriculumSections])

  async function loadProgressDetail(enrollmentId) {
    if (!enrollmentId) {
      setProgressDetail(null)
      setCompletedLessonIds(new Set())
      return
    }
    try {
      const { data } = await api.get(`/enrollments/${enrollmentId}/progress`)
      setProgressDetail(data)
      const completed = new Set()
      ;(data.sections || []).forEach((section) => {
        ;(section.lessons || []).forEach((lesson) => {
          if (lesson.is_completed) completed.add(Number(lesson.lesson_id))
        })
      })
      setCompletedLessonIds(completed)
    } catch {
      setProgressDetail(null)
      setCompletedLessonIds(new Set())
    }
  }

  async function loadCourse() {
    const baseCalls = [
      api.get(`/courses/${id}`),
      api.get(`/courses/${id}/sections`),
      api.get(`/courses/${id}/contents`, { params: { page_size: 100 } }),
      api.get(`/courses/${id}/reviews`),
      api.get('/categories', { params: { page_size: 100 } }),
      api.get(`/courses/${id}/prerequisites`),
    ]
    const [courseRes, sectionRes, contentRes, reviewRes, categoryRes, prereqRes] = await Promise.all(baseCalls)
    const courseData = courseRes.data
    const contentData = contentRes.data.data || []
    setCourse(courseData)
    setSections(sectionRes.data || [])
    setContents(contentData)
    setReviews(reviewRes.data.data || [])
    setRatingAvg(reviewRes.data.rating_avg || courseData.rating_avg || 0)
    const categoryList = categoryRes.data.data || categoryRes.data
    setCategories(Array.isArray(categoryList) ? categoryList : [])
    setPrerequisites(prereqRes.data || [])
    setEditCourse({
      name: courseData.name || '',
      description: courseData.description || '',
      price: courseData.price || 0,
      image: courseData.image || '',
      category_id: courseData.category?.id || '',
      level: courseData.level || 'beginner',
      status: courseData.status || 'draft',
    })
    // Load publish history hanya untuk owner/admin
    try {
      const histRes = await api.get(`/courses/${id}/publish-history`)
      setPublishHistory(histRes.data || [])
    } catch {
      setPublishHistory([])
    }
    // Load semua courses untuk dropdown prerequisite
    try {
      const allRes = await api.get('/courses', { params: { page_size: 200 } })
      setAllCourses((allRes.data.data || []).filter((c) => Number(c.id) !== Number(id)))
    } catch {
      setAllCourses([])
    }
  }

  async function loadMemberState() {
    if (!isAuthenticated) {
      setEnrollment(null)
      setWishlisted(false)
      setProgressDetail(null)
      setCompletedLessonIds(new Set())
      return
    }
    const [enrollRes, wishlistRes] = await Promise.allSettled([
      api.get('/enrollments/my-courses', { params: { page_size: 100 } }),
      api.get('/wishlist', { params: { page_size: 100 } }),
    ])
    if (enrollRes.status === 'fulfilled') {
      const found = (enrollRes.value.data.data || []).find((item) => Number(item.course_id) === Number(id))
      setEnrollment(found || null)
      await loadProgressDetail(found?.id)
    }
    if (wishlistRes.status === 'fulfilled') {
      setWishlisted((wishlistRes.value.data.data || []).some((item) => Number(item.course_id) === Number(id)))
    }
  }

  async function reloadAll() {
    setLoading(true)
    setError('')
    try {
      await Promise.all([loadCourse(), loadMemberState()])
    } catch (err) {
      setError(getErrorMessage(err, 'Gagal memuat detail kursus.'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    reloadAll()
  }, [id, isAuthenticated])

  useEffect(() => {
    if (!firstLessonId) {
      setSelectedLessonId(null)
      setSelectedLesson(null)
      return
    }
    const allIds = new Set(curriculumSections.flatMap((section) => (section.lessons || []).map((lesson) => Number(lesson.id))))
    if (!selectedLessonId || !allIds.has(Number(selectedLessonId))) {
      setSelectedLessonId(firstLessonId)
    }
  }, [firstLessonId, curriculumSections, selectedLessonId])

  useEffect(() => {
    let active = true
    async function loadLessonDetail() {
      if (!selectedLessonId) return
      setLessonDetailLoading(true)
      try {
        const { data } = await api.get(`/courses/${id}/contents/${selectedLessonId}`)
        if (active) setSelectedLesson(data)
      } catch (err) {
        if (active) {
          const fallback = contentById.get(Number(selectedLessonId))
          setSelectedLesson(fallback || null)
          setError(getErrorMessage(err, 'Gagal memuat detail lesson.'))
        }
      } finally {
        if (active) setLessonDetailLoading(false)
      }
    }
    loadLessonDetail()
    return () => { active = false }
  }, [id, selectedLessonId, contentById])

  function showFlash(message) {
    setFlash(message)
    window.setTimeout(() => setFlash(''), 3500)
  }

  function normalizeCoursePayload(data) {
    return {
      ...data,
      price: Number(data.price || 0),
      category_id: data.category_id ? Number(data.category_id) : null,
    }
  }

  async function saveCourse(event) {
    event.preventDefault()
    setSaving(true)
    setError('')
    try {
      const { data } = await api.patch(`/courses/${id}`, normalizeCoursePayload(editCourse))
      setCourse(data)
      setEditOpen(false)
      showFlash('Kursus berhasil diperbarui.')
      loadCourse()
    } catch (err) {
      setError(getErrorMessage(err, 'Gagal menyimpan kursus.'))
    } finally {
      setSaving(false)
    }
  }

  async function updateStatus(status) {
    setSaving(true)
    try {
      await api.patch(`/courses/${id}`, { status })
      showFlash(`Status kursus diubah menjadi ${statusLabel(status)}.`)
      loadCourse()
    } catch (err) {
      setError(getErrorMessage(err, 'Gagal mengubah status.'))
    } finally {
      setSaving(false)
    }
  }

  async function submitForReview() {
    if (!window.confirm('Ajukan course ini untuk direview oleh admin?')) return
    setSaving(true)
    setError('')
    try {
      await api.post(`/courses/${id}/submit-for-review`)
      showFlash('Course berhasil diajukan untuk review. Tunggu persetujuan admin.')
      loadCourse()
    } catch (err) {
      setError(getErrorMessage(err, 'Gagal mengajukan review.'))
    } finally {
      setSaving(false)
    }
  }

  async function approveCourse() {
    if (!window.confirm('Setujui dan publikasikan course ini?')) return
    setSaving(true)
    setError('')
    try {
      await api.post(`/courses/${id}/approve`)
      showFlash('Course berhasil dipublikasikan.')
      loadCourse()
    } catch (err) {
      setError(getErrorMessage(err, 'Gagal menyetujui course.'))
    } finally {
      setSaving(false)
    }
  }

  async function rejectCourse() {
    const reason = window.prompt('Alasan penolakan (opsional):', '')
    if (reason === null) return // user cancel
    setSaving(true)
    setError('')
    try {
      await api.post(`/courses/${id}/reject`, { reason })
      showFlash('Course ditolak dan dikembalikan ke status draft.')
      loadCourse()
    } catch (err) {
      setError(getErrorMessage(err, 'Gagal menolak course.'))
    } finally {
      setSaving(false)
    }
  }

  async function addPrerequisite(event) {
    event.preventDefault()
    if (!newPrereqId) return
    setSaving(true)
    setError('')
    try {
      await api.post(`/courses/${id}/prerequisites`, { required_course_id: Number(newPrereqId) })
      setNewPrereqId('')
      showFlash('Prerequisite berhasil ditambahkan.')
      loadCourse()
    } catch (err) {
      setError(getErrorMessage(err, 'Gagal menambahkan prerequisite.'))
    } finally {
      setSaving(false)
    }
  }

  async function removePrerequisite(prereqId, courseName) {
    if (!window.confirm(`Hapus '${courseName}' dari prerequisite?`)) return
    try {
      await api.delete(`/courses/${id}/prerequisites/${prereqId}`)
      showFlash('Prerequisite dihapus.')
      loadCourse()
    } catch (err) {
      setError(getErrorMessage(err, 'Gagal menghapus prerequisite.'))
    }
  }

  async function deleteCourse() {
    if (!window.confirm('Hapus kursus ini beserta struktur kontennya?')) return
    setSaving(true)
    try {
      await api.delete(`/courses/${id}`)
      navigate('/courses', { replace: true })
    } catch (err) {
      setError(getErrorMessage(err, 'Gagal menghapus kursus.'))
    } finally {
      setSaving(false)
    }
  }

  async function enroll() {
    if (!isAuthenticated) {
      navigate('/login')
      return
    }
    setSaving(true)
    setError('')
    try {
      await api.post('/enrollments', { course_id: Number(id) })
      await loadMemberState()
      showFlash('Enrollment berhasil. Anda bisa mulai belajar.')
    } catch (err) {
      setError(getErrorMessage(err, 'Gagal melakukan enrollment.'))
    } finally {
      setSaving(false)
    }
  }

  async function toggleWishlist() {
    if (!isAuthenticated) {
      navigate('/login')
      return
    }
    const current = wishlisted
    setWishlisted(!current)
    try {
      if (current) await api.delete(`/wishlist/${id}`)
      else await api.post('/wishlist', { course_id: Number(id) })
    } catch (err) {
      setWishlisted(current)
      setError(getErrorMessage(err, 'Gagal memperbarui wishlist.'))
    }
  }

  async function addSection(event) {
    event.preventDefault()
    setSaving(true)
    try {
      await api.post(`/courses/${id}/sections`, { ...newSection, order: Number(newSection.order || 0) })
      setNewSection(EMPTY_SECTION)
      showFlash('Section berhasil ditambahkan.')
      loadCourse()
    } catch (err) {
      setError(getErrorMessage(err, 'Gagal menambahkan section.'))
    } finally {
      setSaving(false)
    }
  }

  async function saveSection(event) {
    event.preventDefault()
    if (!editingSection) return
    try {
      await api.patch(`/courses/${id}/sections/${editingSection.id}`, {
        title: editingSection.title,
        order: Number(editingSection.order || 0),
      })
      setEditingSection(null)
      showFlash('Section diperbarui.')
      loadCourse()
    } catch (err) {
      setError(getErrorMessage(err, 'Gagal memperbarui section.'))
    }
  }

  async function deleteSection(sectionId) {
    if (!window.confirm('Hapus section ini? Lesson di dalamnya tidak ikut dihapus, namun section akan dilepas.')) return
    try {
      await api.delete(`/courses/${id}/sections/${sectionId}`)
      showFlash('Section dihapus.')
      loadCourse()
    } catch (err) {
      setError(getErrorMessage(err, 'Gagal menghapus section.'))
    }
  }

  function lessonPayload(form) {
    return {
      name: form.name || lessonTitle(form),
      description: form.description || '-',
      video_url: form.video_url || null,
      section_id: form.section_id ? Number(form.section_id) : null,
      order: Number(form.order || 0),
      duration_minutes: form.duration_minutes === '' ? null : Number(form.duration_minutes),
    }
  }

  async function addLesson(event) {
    event.preventDefault()
    setSaving(true)
    try {
      const { data } = await api.post(`/courses/${id}/contents`, lessonPayload(lessonForm))
      setLessonForm(EMPTY_LESSON)
      setSelectedLessonId(data.id)
      showFlash('Lesson berhasil ditambahkan.')
      loadCourse()
    } catch (err) {
      setError(getErrorMessage(err, 'Gagal menambahkan lesson.'))
    } finally {
      setSaving(false)
    }
  }

  async function saveLesson(event) {
    event.preventDefault()
    if (!editingLesson) return
    try {
      await api.patch(`/courses/${id}/contents/${editingLesson.id}`, lessonPayload(editingLesson))
      setEditingLesson(null)
      showFlash('Lesson berhasil diperbarui.')
      await loadCourse()
      setSelectedLessonId(editingLesson.id)
    } catch (err) {
      setError(getErrorMessage(err, 'Gagal memperbarui lesson.'))
    }
  }

  async function deleteLesson(contentId) {
    if (!window.confirm('Hapus lesson ini?')) return
    try {
      await api.delete(`/courses/${id}/contents/${contentId}`)
      if (Number(selectedLessonId) === Number(contentId)) {
        setSelectedLessonId(null)
        setSelectedLesson(null)
      }
      showFlash('Lesson dihapus.')
      loadCourse()
    } catch (err) {
      setError(getErrorMessage(err, 'Gagal menghapus lesson.'))
    }
  }

  async function uploadFile(contentId, file) {
    if (!file) return
    setUploadingId(contentId)
    setError('')
    try {
      const formData = new FormData()
      formData.append('file', file)
      await api.post(`/courses/${id}/content/${contentId}/upload`, formData, { headers: { 'Content-Type': 'multipart/form-data' } })
      showFlash('File materi berhasil diunggah.')
      await loadCourse()
      setSelectedLessonId(contentId)
    } catch (err) {
      setError(getErrorMessage(err, 'Gagal mengunggah file materi.'))
    } finally {
      setUploadingId(null)
    }
  }

  async function downloadFile(contentId, filename = 'materi') {
    setError('')
    try {
      const response = await api.get(`/courses/${id}/content/${contentId}/download`, { responseType: 'blob' })
      const blobUrl = window.URL.createObjectURL(new Blob([response.data]))
      const link = document.createElement('a')
      link.href = blobUrl
      link.download = filename
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(blobUrl)
    } catch (err) {
      setError(getErrorMessage(err, 'Gagal mengunduh file materi. Pastikan Anda sudah enroll.'))
    }
  }

  async function markComplete(contentId = selectedLesson?.id) {
    if (!isAuthenticated) {
      navigate('/login')
      return
    }
    if (!enrollment) {
      setError('Enroll ke course ini terlebih dahulu untuk menandai progress lesson.')
      return
    }
    if (!contentId) return
    setSaving(true)
    try {
      await api.post(`/enrollments/${enrollment.id}/progress`, { content_id: Number(contentId) })
      await loadProgressDetail(enrollment.id)
      showFlash('Lesson ditandai selesai.')
    } catch (err) {
      setError(getErrorMessage(err, 'Gagal menyimpan progress lesson.'))
    } finally {
      setSaving(false)
    }
  }

  async function submitReview(event) {
    event.preventDefault()
    setSaving(true)
    try {
      await api.post(`/courses/${id}/reviews`, { rating: Number(reviewForm.rating), review: reviewForm.review })
      setReviewForm({ rating: 5, review: '' })
      showFlash('Review berhasil disimpan.')
      loadCourse()
    } catch (err) {
      setError(getErrorMessage(err, 'Gagal menyimpan review.'))
    } finally {
      setSaving(false)
    }
  }

  async function deleteReview(reviewId) {
    if (!window.confirm('Hapus review ini?')) return
    try {
      await api.delete(`/courses/${id}/reviews/${reviewId}`)
      showFlash('Review dihapus.')
      loadCourse()
    } catch (err) {
      setError(getErrorMessage(err, 'Gagal menghapus review.'))
    }
  }

  async function generateReport() {
    setSaving(true)
    try {
      const { data } = await api.post(`/reports/generate/${id}/`)
      setTaskId(data.task_id)
      showFlash(data.message || 'Report sedang diproses.')
    } catch (err) {
      setError(getErrorMessage(err, 'Gagal menjalankan report.'))
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <Spinner />
  if (!course) return <div className="container py-5"><AlertError message={error || 'Kursus tidak ditemukan.'} /></div>

  const totalLessons = contents.length
  const totalMinutes = contents.reduce((sum, item) => sum + Number(item.duration_minutes || 0), 0)
  const selectedIsCompleted = selectedLesson?.id ? completedLessonIds.has(Number(selectedLesson.id)) : false
  const videoMeta = getVideoMeta(selectedLesson?.video_url)

  return (
    <div className="page course-detail-page">
      <section className="detail-hero">
        <div className="container detail-hero-grid">
          <div>
            <div className="course-tags mb-3">
              <span>{course.category?.name || 'Tanpa kategori'}</span>
              <span>{levelLabel(course.level)}</span>
              <span className={`status-badge ${course.status}`}>{statusLabel(course.status)}</span>
            </div>
            <h1>{course.name}</h1>
            <p>{course.description}</p>
            <div className="detail-meta">
              <span>Instruktur: <strong>{fullName(course.teacher)}</strong></span>
              <span><StarRating value={ratingAvg} /> dari {course.total_reviews || reviews.length} review</span>
              <span>{totalLessons} lesson</span>
              <span>{totalMinutes || 0} menit</span>
            </div>
          </div>
          {/* Enroll panel — hanya untuk student/publik, bukan admin/instructor */}
          {!isAdminUser && !isInstructorUser && (
            <aside className="enroll-panel">
              <strong className="price-text">{rupiah(course.price)}</strong>
              <button
                className="btn btn-primary-lms w-100"
                type="button"
                onClick={enrollment ? () => navigate(`/progress/${enrollment.id}`) : enroll}
                disabled={saving}
              >
                {enrollment ? 'Lihat Progress Belajar' : isAuthenticated ? 'Enroll Sekarang' : 'Masuk untuk Enroll'}
              </button>
              <button
                className={`btn w-100 ${wishlisted ? 'btn-danger-soft' : 'btn-soft'}`}
                type="button"
                onClick={toggleWishlist}
              >
                {wishlisted ? 'Hapus dari Wishlist' : 'Tambah ke Wishlist'}
              </button>
              {enrollment && <small style={{ color: 'var(--muted)' }}>Anda sudah terdaftar di kursus ini.</small>}
            </aside>
          )}
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
        <TaskPoller taskId={taskId} endpoint="/reports/status/" />

        {canManage && (
          <section className="lms-card management-panel">
            <div className="section-heading">
              <div>
                <span className="eyebrow">Management</span>
                <h2>Kontrol Course</h2>
                <p>Button ini hanya muncul untuk owner course atau Admin.</p>
              </div>
              <div className="action-row">
                <button className="btn btn-soft" onClick={() => setEditOpen((prev) => !prev)}>{editOpen ? 'Tutup Edit' : 'Edit Course'}</button>
                <button className="btn btn-soft" onClick={() => updateStatus('draft')} disabled={saving}>Set Draft</button>
                {/* Publish: instructor submit for review, admin bisa langsung approve */}
                {isAdminUser ? (
                  <>
                    {course.status === 'pending_review' && (
                      <>
                        <button className="btn btn-success-soft" onClick={approveCourse} disabled={saving}>✓ Approve & Publish</button>
                        <button className="btn btn-danger-soft" onClick={rejectCourse} disabled={saving}>✗ Reject</button>
                      </>
                    )}
                    {course.status !== 'pending_review' && (
                      <button className="btn btn-success-soft" onClick={() => updateStatus('published')} disabled={saving}>Set Published</button>
                    )}
                  </>
                ) : (
                  <button
                    className="btn btn-success-soft"
                    onClick={submitForReview}
                    disabled={saving || course.status === 'pending_review' || course.status === 'published'}
                  >
                    {course.status === 'pending_review' ? '⏳ Menunggu Review' : course.status === 'published' ? '✓ Published' : 'Ajukan Publish'}
                  </button>
                )}
                <button className="btn btn-warning-soft" onClick={() => updateStatus('archived')} disabled={saving}>Archive</button>
                <button className="btn btn-danger-soft" onClick={deleteCourse} disabled={saving}>Hapus</button>
                <button className="btn btn-soft" onClick={generateReport} disabled={saving}>Generate Report</button>
              </div>
            </div>

            {/* Publish history */}
            {publishHistory.length > 0 && (
              <div style={{ marginTop: '1rem', padding: '0.75rem 1rem', background: 'var(--surface-alt, rgba(255,255,255,0.04))', borderRadius: '8px' }}>
                <strong style={{ fontSize: '0.85rem', opacity: 0.7 }}>Riwayat Publish Request</strong>
                <ul style={{ listStyle: 'none', padding: 0, margin: '0.5rem 0 0' }}>
                  {publishHistory.slice(0, 3).map((pr) => (
                    <li key={pr.id} style={{ fontSize: '0.82rem', opacity: 0.8, marginBottom: '0.25rem' }}>
                      <span className={`status-badge ${pr.status}`} style={{ fontSize: '0.75rem', marginRight: '0.5rem' }}>{pr.status}</span>
                      {pr.requester_username} → {pr.reviewed_at ? `diproses oleh ${pr.reviewer_username}` : 'belum diproses'}
                      {pr.rejection_reason && <em style={{ marginLeft: '0.5rem', color: 'var(--danger, #e74c3c)' }}>({pr.rejection_reason})</em>}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {editOpen && (
              <form className="create-panel" onSubmit={saveCourse}>
                <div className="grid-2">
                  <label><span>Nama</span><input className="form-control" value={editCourse.name} onChange={(e) => setEditCourse({ ...editCourse, name: e.target.value })} required /></label>
                  <label><span>Kategori</span><select className="form-select" value={editCourse.category_id} onChange={(e) => setEditCourse({ ...editCourse, category_id: e.target.value })}><option value="">Tanpa kategori</option>{categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
                </div>
                <label><span>Deskripsi</span><textarea className="form-control" rows="3" value={editCourse.description} onChange={(e) => setEditCourse({ ...editCourse, description: e.target.value })} /></label>
                <div className="grid-3">
                  <label><span>Harga</span><input className="form-control" type="number" min="0" value={editCourse.price} onChange={(e) => setEditCourse({ ...editCourse, price: e.target.value })} /></label>
                  <label><span>Level</span><select className="form-select" value={editCourse.level} onChange={(e) => setEditCourse({ ...editCourse, level: e.target.value })}><option value="beginner">Beginner</option><option value="intermediate">Intermediate</option><option value="advanced">Advanced</option></select></label>
                  <label>
                    <span>Status</span>
                    <select className="form-select" value={editCourse.status} onChange={(e) => setEditCourse({ ...editCourse, status: e.target.value })}>
                      <option value="draft">Draft</option>
                      {isAdminUser && <option value="pending_review">Pending Review</option>}
                      {isAdminUser && <option value="published">Published</option>}
                      <option value="archived">Archived</option>
                    </select>
                    {!isAdminUser && <small style={{ opacity: 0.6, display: 'block', marginTop: '2px' }}>Gunakan tombol "Ajukan Publish" untuk publish.</small>}
                  </label>
                </div>
                <button className="btn btn-primary-lms" disabled={saving}>Simpan Course</button>
              </form>
            )}
          </section>
        )}

        <div className="content-grid two-col wide-left lesson-layout">
          <section className="lms-card p-4">
            <div className="section-heading">
              <div>
                <span className="eyebrow">Curriculum</span>
                <h2>Section dan Lesson</h2>
                <p>Klik lesson untuk membuka detail materi, video, file, dan progress.</p>
              </div>
            </div>

            {canManage && (
              <div className="curriculum-tools">
                <form onSubmit={addSection} className="inline-form">
                  <input className="form-control" placeholder="Judul section baru" value={newSection.title} onChange={(e) => setNewSection({ ...newSection, title: e.target.value })} required />
                  <input className="form-control order-input" type="number" min="0" placeholder="No. urut" value={newSection.order || ''} onChange={(e) => setNewSection({ ...newSection, order: e.target.value })} />
                  <button className="btn btn-primary-lms" disabled={saving}>Tambah Section</button>
                </form>
                <form onSubmit={addLesson} className="create-panel compact">
                  <div className="grid-2">
                    <input className="form-control" placeholder="Judul lesson" value={lessonForm.name} onChange={(e) => setLessonForm({ ...lessonForm, name: e.target.value })} required />
                    <select className="form-select" value={lessonForm.section_id} onChange={(e) => setLessonForm({ ...lessonForm, section_id: e.target.value })}>
                      <option value="">Tanpa section</option>
                      {sections.map((section) => <option key={section.id} value={section.id}>{section.title}</option>)}
                    </select>
                  </div>
                  <textarea className="form-control" rows="2" placeholder="Deskripsi lesson" value={lessonForm.description} onChange={(e) => setLessonForm({ ...lessonForm, description: e.target.value })} />
                  <div className="grid-3">
                    <input className="form-control" placeholder="YouTube URL / Video URL" value={lessonForm.video_url} onChange={(e) => setLessonForm({ ...lessonForm, video_url: e.target.value })} />
                    <input className="form-control" type="number" min="0" placeholder="No. urut" value={lessonForm.order || ''} onChange={(e) => setLessonForm({ ...lessonForm, order: e.target.value })} />
                    <input className="form-control" type="number" min="0" placeholder="Durasi (menit)" value={lessonForm.duration_minutes} onChange={(e) => setLessonForm({ ...lessonForm, duration_minutes: e.target.value })} />
                  </div>
                  <button className="btn btn-soft" disabled={saving}>Tambah Lesson</button>
                </form>
              </div>
            )}

            {curriculumSections.length === 0 ? (
              <div className="empty-state compact"><h3>Belum ada materi</h3><p>Instruktur belum menambahkan section atau lesson.</p></div>
            ) : (
              <div className="curriculum-list">
                {curriculumSections.map((section, index) => (
                  <div className="section-card" key={section.id}>
                    <div className="section-title-row">
                      <div>
                        <span className="section-number">{index + 1}</span>
                        <strong>{section.title}</strong>
                        <small>{(section.lessons || []).length} lesson</small>
                      </div>
                      {canManage && !section.isVirtual && <div className="action-row"><button className="btn btn-soft btn-sm" onClick={() => setEditingSection(section)}>Edit</button><button className="btn btn-danger-soft btn-sm" onClick={() => deleteSection(section.id)}>Hapus</button></div>}
                    </div>
                    {editingSection?.id === section.id && (
                      <form className="inline-form my-3 px-3" onSubmit={saveSection}>
                        <input className="form-control" value={editingSection.title} onChange={(e) => setEditingSection({ ...editingSection, title: e.target.value })} />
                        <input className="form-control order-input" type="number" value={editingSection.order} onChange={(e) => setEditingSection({ ...editingSection, order: e.target.value })} />
                        <button className="btn btn-primary-lms">Simpan</button>
                        <button className="btn btn-soft" type="button" onClick={() => setEditingSection(null)}>Batal</button>
                      </form>
                    )}
                    {(section.lessons || []).length === 0 ? <p className="muted-row">Belum ada lesson di section ini.</p> : (section.lessons || []).map((lesson) => {
                      const content = contentById.get(Number(lesson.id)) || lesson
                      const isEditing = editingLesson?.id === lesson.id
                      const isActive = Number(selectedLessonId) === Number(lesson.id)
                      const done = completedLessonIds.has(Number(lesson.id))
                      return (
                        <div className={`lesson-row ${isActive ? 'active' : ''}`} key={lesson.id}>
                          {isEditing ? (
                            <form className="lesson-edit" onSubmit={saveLesson}>
                              <input className="form-control" value={editingLesson.name || lessonTitle(editingLesson)} onChange={(e) => setEditingLesson({ ...editingLesson, name: e.target.value })} />
                              <textarea className="form-control" rows="2" value={editingLesson.description || ''} onChange={(e) => setEditingLesson({ ...editingLesson, description: e.target.value })} />
                              <div className="grid-3">
                                <select className="form-select" value={editingLesson.section_id || ''} onChange={(e) => setEditingLesson({ ...editingLesson, section_id: e.target.value })}>
                                  <option value="">Tanpa section</option>
                                  {sections.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}
                                </select>
                                <input className="form-control" type="number" value={editingLesson.order || 0} onChange={(e) => setEditingLesson({ ...editingLesson, order: e.target.value })} />
                                <input className="form-control" type="number" value={editingLesson.duration_minutes || ''} onChange={(e) => setEditingLesson({ ...editingLesson, duration_minutes: e.target.value })} />
                              </div>
                              <input className="form-control" placeholder="YouTube URL / Video URL" value={editingLesson.video_url || ''} onChange={(e) => setEditingLesson({ ...editingLesson, video_url: e.target.value })} />
                              <div className="action-row"><button className="btn btn-primary-lms btn-sm">Simpan</button><button className="btn btn-soft btn-sm" type="button" onClick={() => setEditingLesson(null)}>Batal</button></div>
                            </form>
                          ) : (
                            <>
                              <button className="lesson-main lesson-selector" type="button" onClick={() => setSelectedLessonId(lesson.id)}>
                                <span className={`lesson-icon ${done ? 'done' : ''}`}>{done ? '✓' : '▶'}</span>
                                <div>
                                  <strong>{lessonTitle(lesson)}</strong>
                                  <p>{content.description || '-'}</p>
                                  <div className="lesson-meta">
                                    {content.duration_minutes ? <span>{content.duration_minutes} menit</span> : null}
                                    {content.video_url ? <span>Video</span> : null}
                                    {content.file_attachment ? <span>File materi</span> : null}
                                    {done ? <span className="complete-chip">Selesai</span> : null}
                                  </div>
                                </div>
                              </button>
                              <div className="lesson-actions">
                                {enrollment && !done && !isAdminUser && <button className="btn btn-success-soft btn-sm" type="button" onClick={() => markComplete(lesson.id)} disabled={saving}>Selesai</button>}
                                {content.file_attachment && <button className="btn btn-soft btn-sm" type="button" onClick={() => downloadFile(lesson.id, filenameFromPath(content.file_attachment, lessonTitle(lesson)))}>Download</button>}
                                {canManage && (
                                  <>
                                    <label className="btn btn-soft btn-sm mb-0">
                                      {uploadingId === lesson.id ? 'Uploading...' : 'Upload'}
                                      <input type="file" hidden onChange={(e) => uploadFile(lesson.id, e.target.files?.[0])} />
                                    </label>
                                    <button className="btn btn-soft btn-sm" onClick={() => setEditingLesson({ ...content, name: lessonTitle(content), section_id: content.section_id || '' })}>Edit</button>
                                    <button className="btn btn-danger-soft btn-sm" onClick={() => deleteLesson(lesson.id)}>Hapus</button>
                                  </>
                                )}
                              </div>
                            </>
                          )}
                        </div>
                      )
                    })}
                  </div>
                ))}
              </div>
            )}
          </section>

          <aside className="side-stack lesson-side">
            <section className="lms-card p-4 lesson-detail-card">
              <div className="section-heading compact-heading">
                <div>
                  <span className="eyebrow">Lesson Detail</span>
                  <h2>{selectedLesson ? lessonTitle(selectedLesson) : 'Pilih lesson'}</h2>
                </div>
                {selectedIsCompleted && <span className="complete-chip large">Selesai</span>}
              </div>

              {lessonDetailLoading ? (
                <div className="mini-loader">Memuat detail lesson...</div>
              ) : selectedLesson ? (
                <div className="lesson-detail-body">
                  <p>{selectedLesson.description || '-'}</p>

                  <div className="lesson-detail-meta">
                    <span>Urutan: <strong>{selectedLesson.order ?? '-'}</strong></span>
                    <span>Durasi: <strong>{selectedLesson.duration_minutes ? `${selectedLesson.duration_minutes} menit` : '-'}</strong></span>
                  </div>

                  {selectedLesson.video_url && (
                    <div className="video-panel">
                      <div className="video-panel-head">
                        <strong>Video Materi</strong>
                        {videoMeta?.watchUrl && <a href={videoMeta.watchUrl} target="_blank" rel="noreferrer">Buka di YouTube/tab baru</a>}
                      </div>

                      {videoMeta?.type === 'youtube' ? (
                        <div className="video-box">
                          <iframe
                            title={lessonTitle(selectedLesson)}
                            src={videoMeta.embedUrl}
                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                            allowFullScreen
                            loading="lazy"
                            referrerPolicy="strict-origin-when-cross-origin"
                          />
                        </div>
                      ) : videoMeta?.type === 'native' ? (
                        <div className="video-box">
                          <video controls src={videoMeta.src}>Browser Anda belum mendukung pemutar video.</video>
                        </div>
                      ) : (
                        <div className="video-fallback">
                          <p>URL video tidak dikenali sebagai embed YouTube, jadi dibuka sebagai link eksternal.</p>
                          <a className="btn btn-soft w-100" href={videoMeta?.watchUrl || selectedLesson.video_url} target="_blank" rel="noreferrer">Buka Video Materi</a>
                        </div>
                      )}
                    </div>
                  )}

                  {selectedLesson.file_attachment ? (
                    <button className="btn btn-soft w-100" type="button" onClick={() => downloadFile(selectedLesson.id, filenameFromPath(selectedLesson.file_attachment, lessonTitle(selectedLesson)))}>
                      Download File Materi
                    </button>
                  ) : (
                    <p className="support-note">Belum ada file attachment untuk lesson ini.</p>
                  )}

                  {/* Tombol progress/enroll hanya untuk student/publik, bukan admin/instructor */}
                  {!isAdminUser && !isInstructorUser && (
                    enrollment ? (
                      <button className="btn btn-primary-lms w-100" type="button" onClick={() => markComplete(selectedLesson.id)} disabled={saving || selectedIsCompleted}>
                        {selectedIsCompleted ? 'Lesson Sudah Selesai' : 'Tandai Lesson Selesai'}
                      </button>
                    ) : (
                      <button className="btn btn-primary-lms w-100" type="button" onClick={isAuthenticated ? enroll : () => navigate('/login')} disabled={saving}>
                        {isAuthenticated ? 'Enroll untuk Simpan Progress' : 'Login untuk Belajar'}
                      </button>
                    )
                  )}

                  {canManage && (
                    <div className="manager-mini-actions">
                      <label className="btn btn-soft w-100 mb-0">
                        {uploadingId === selectedLesson.id ? 'Uploading...' : 'Upload / Ganti File'}
                        <input type="file" hidden onChange={(e) => uploadFile(selectedLesson.id, e.target.files?.[0])} />
                      </label>
                      <button className="btn btn-soft w-100" type="button" onClick={() => setEditingLesson({ ...selectedLesson, name: lessonTitle(selectedLesson), section_id: selectedLesson.section_id || '' })}>Edit Lesson Ini</button>
                    </div>
                  )}
                </div>
              ) : (
                <div className="empty-state compact"><h3>Belum ada lesson</h3><p>Tambahkan lesson agar detail materi bisa tampil di sini.</p></div>
              )}
            </section>

            <section className="lms-card p-4">
              <span className="eyebrow">Learning Path</span>
              <h2>Ringkasan Jalur Belajar</h2>
              <div className="mini-stats">
                <div><strong>{sections.length}</strong><span>Section</span></div>
                <div><strong>{totalLessons}</strong><span>Lesson</span></div>
                <div><strong>{totalMinutes}</strong><span>Menit</span></div>
              </div>
              {progressDetail && !isAdminUser && !isInstructorUser && <p className="support-note">Progress Anda: {progressDetail.completed_lessons}/{progressDetail.total_lessons} lesson selesai ({progressDetail.progress_percent}%).</p>}
              {!progressDetail && !isAdminUser && !isInstructorUser && <p className="support-note">Enroll kursus ini untuk melacak progress belajar Anda.</p>}

              {/* Prerequisites */}
              {prerequisites.length > 0 && (
                <div style={{ marginTop: '1rem' }}>
                  <strong style={{ fontSize: '0.85rem', display: 'block', marginBottom: '0.5rem' }}>🔒 Prasyarat Course</strong>
                  <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                    {prerequisites.map((p) => (
                      <li key={p.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.35rem', fontSize: '0.85rem' }}>
                        <Link to={`/courses/${p.required_course_id}`} style={{ color: 'var(--accent)' }}>
                          {p.required_course_name}
                        </Link>
                        {canManage && (
                          <button className="btn btn-danger-soft btn-sm" style={{ fontSize: '0.7rem', padding: '2px 8px' }} onClick={() => removePrerequisite(p.id, p.required_course_name)}>Hapus</button>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Form tambah prerequisite (hanya owner/admin) */}
              {canManage && (
                <form onSubmit={addPrerequisite} style={{ marginTop: '1rem', display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                  <select
                    className="form-select"
                    style={{ flex: 1, fontSize: '0.82rem' }}
                    value={newPrereqId}
                    onChange={(e) => setNewPrereqId(e.target.value)}
                  >
                    <option value="">+ Tambah prasyarat...</option>
                    {allCourses
                      .filter((c) => !prerequisites.some((p) => p.required_course_id === c.id))
                      .map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                  <button className="btn btn-soft" style={{ fontSize: '0.82rem', whiteSpace: 'nowrap' }} disabled={!newPrereqId || saving}>Tambah</button>
                </form>
              )}
            </section>

            <section className="lms-card p-4">
              <span className="eyebrow">Rating & Review</span>
              <h2>{Number(ratingAvg || 0).toFixed(1)} / 5.0</h2>
              <StarRating value={ratingAvg} />
              <p className="text-muted mt-2">{reviews.length} review dari peserta.</p>
            </section>
          </aside>
        </div>

        <section className="lms-card p-4 mt-4">
          <div className="section-heading">
            <div>
              <span className="eyebrow">Review</span>
              <h2>Ulasan Peserta</h2>
            </div>
          </div>

          {/* Form review hanya untuk student yang sudah enroll */}
          {enrollment && !isAdminUser && (
            <form className="review-form" onSubmit={submitReview}>
              <select className="form-select" value={reviewForm.rating} onChange={(e) => setReviewForm({ ...reviewForm, rating: e.target.value })}>
                {[5, 4, 3, 2, 1].map((value) => <option key={value} value={value}>{value} bintang</option>)}
              </select>
              <input className="form-control" placeholder="Bagikan pengalaman belajar Anda..." value={reviewForm.review} onChange={(e) => setReviewForm({ ...reviewForm, review: e.target.value })} />
              <button className="btn btn-primary-lms" disabled={saving}>Kirim Review</button>
            </form>
          )}

          {!enrollment && !isAdminUser && !isInstructorUser && <p className="support-note">Enroll ke kursus ini terlebih dahulu untuk memberikan review.</p>}

          <div className="review-list">
            {reviews.length === 0 ? <p className="muted-row">Belum ada review.</p> : reviews.map((review) => (
              <article className="review-card" key={review.id}>
                <div>
                  <strong>{review.username}</strong>
                  <StarRating value={review.rating} showValue={false} />
                  <p>{review.review || '-'}</p>
                  <small>{shortDate(review.created_at)}</small>
                </div>
                {(Number(review.user_id) === Number(user?.id) || isAdmin(user)) && <button className="btn btn-danger-soft btn-sm" onClick={() => deleteReview(review.id)}>Hapus</button>}
              </article>
            ))}
          </div>
        </section>
      </div>
    </div>
  )
}
