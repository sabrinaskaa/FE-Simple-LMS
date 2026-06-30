import React, { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import api, { getErrorMessage } from '../api/axios'
import AlertError from '../components/AlertError'
import ProgressBar from '../components/ProgressBar'
import Spinner from '../components/Spinner'

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

function sectionKey(section, index) {
  return section.section_id === null || section.section_id === undefined
    ? `unsectioned-${index}`
    : `section-${section.section_id}`
}

export default function ProgressPage() {
  const { id } = useParams()
  const [progress, setProgress] = useState(null)
  const [enrollment, setEnrollment] = useState(null)
  const [courseContents, setCourseContents] = useState([])
  const [selectedLessonId, setSelectedLessonId] = useState(null)
  const [selectedLesson, setSelectedLesson] = useState(null)
  const [expandedSections, setExpandedSections] = useState(new Set())
  const [lessonDetailLoading, setLessonDetailLoading] = useState(false)
  const [loading, setLoading] = useState(true)
  const [savingId, setSavingId] = useState(null)
  const [error, setError] = useState('')
  const [flash, setFlash] = useState('')

  const contentById = useMemo(
    () => new Map(courseContents.map((item) => [Number(item.id), item])),
    [courseContents],
  )

  const completedLessonIds = useMemo(() => {
    const completed = new Set()
    ;(progress?.sections || []).forEach((section) => {
      ;(section.lessons || []).forEach((lesson) => {
        if (lesson.is_completed) completed.add(Number(lesson.lesson_id))
      })
    })
    return completed
  }, [progress])

  async function load() {
    setLoading(true)
    setError('')
    try {
      const [progressRes, enrollRes] = await Promise.allSettled([
        api.get(`/enrollments/${id}/progress`),
        api.get('/enrollments/my-courses', { params: { page_size: 100 } }),
      ])

      if (progressRes.status === 'rejected') throw progressRes.reason
      const progressData = progressRes.value.data
      setProgress(progressData)

      const nextSectionKeys = (progressData.sections || []).map((section, index) => sectionKey(section, index))
      setExpandedSections((previous) => {
        if (previous.size === 0) return new Set(nextSectionKeys)
        return new Set([...previous].filter((key) => nextSectionKeys.includes(key)))
      })

      let foundEnrollment = null
      if (enrollRes.status === 'fulfilled') {
        foundEnrollment = (enrollRes.value.data.data || []).find((item) => Number(item.id) === Number(id)) || null
        setEnrollment(foundEnrollment)
      }

      if (foundEnrollment?.course_id) {
        try {
          const { data } = await api.get(`/courses/${foundEnrollment.course_id}/contents`, { params: { page_size: 100 } })
          setCourseContents(data.data || [])
        } catch {
          setCourseContents([])
        }
      } else {
        setCourseContents([])
      }
    } catch (err) {
      setError(getErrorMessage(err, 'Gagal memuat progress belajar.'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [id])

  function toggleSection(key) {
    setExpandedSections((previous) => {
      const next = new Set(previous)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  async function openLesson(lesson) {
    const lessonId = Number(lesson.lesson_id || lesson.id)
    const fallback = contentById.get(lessonId) || {
      id: lessonId,
      name: lesson.title,
      title: lesson.title,
      description: '',
    }

    if (selectedLessonId === lessonId) {
      setSelectedLessonId(null)
      setSelectedLesson(null)
      return
    }

    setSelectedLessonId(lessonId)
    setSelectedLesson(fallback)

    if (!enrollment?.course_id) return

    setLessonDetailLoading(true)
    setError('')
    try {
      const { data } = await api.get(`/courses/${enrollment.course_id}/contents/${lessonId}`)
      setSelectedLesson(data)
    } catch (err) {
      setSelectedLesson(fallback)
      setError(getErrorMessage(err, 'Detail lesson belum bisa dimuat. Data ringkas tetap ditampilkan.'))
    } finally {
      setLessonDetailLoading(false)
    }
  }

  async function markComplete(lessonId) {
    setSavingId(lessonId)
    setError('')
    try {
      await api.post(`/enrollments/${id}/progress`, { content_id: Number(lessonId) })
      setFlash('Lesson ditandai selesai.')
      await load()
    } catch (err) {
      setError(getErrorMessage(err, 'Gagal memperbarui progress.'))
    } finally {
      setSavingId(null)
    }
  }

  async function downloadFile(contentId, filename = 'materi') {
    if (!enrollment?.course_id) return
    setError('')
    try {
      const response = await api.get(`/courses/${enrollment.course_id}/content/${contentId}/download`, { responseType: 'blob' })
      const blobUrl = window.URL.createObjectURL(new Blob([response.data]))
      const link = document.createElement('a')
      link.href = blobUrl
      link.download = filename
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(blobUrl)
    } catch (err) {
      setError(getErrorMessage(err, 'Gagal mengunduh file materi.'))
    }
  }

  if (loading) return <Spinner />

  return (
    <div className="page container py-4">
      <div className="page-heading compact">
        <span className="eyebrow">Learning Progress</span>
        <h1>{enrollment?.course_name || 'Progress Belajar'}</h1>
        <p>Buka section untuk melihat lesson. Klik lesson untuk membuka detail materi, video YouTube, file, dan aksi progress.</p>
        {enrollment && <Link className="btn btn-soft" to={`/courses/${enrollment.course_id}`}>Kembali ke Course</Link>}
      </div>

      {flash && (
        <div className="app-alert app-alert-success">
          <span className="app-alert-icon">✓</span>
          <div style={{ flex: 1 }}><strong>Berhasil</strong><p>{flash}</p></div>
        </div>
      )}
      <AlertError message={error} onClose={() => setError('')} />

      {!progress ? (
        <div className="empty-state"><h2>Progress tidak tersedia</h2><p>Pastikan enrollment masih valid.</p></div>
      ) : (
        <>
          <section className="lms-card p-4 mb-4">
            <div className="progress-hero-row">
              <div>
                <span className="eyebrow">Overall</span>
                <h2>{progress.completed_lessons}/{progress.total_lessons} lesson selesai</h2>
              </div>
              <strong>{Math.round(progress.progress_percent || 0)}%</strong>
            </div>
            <ProgressBar value={progress.progress_percent} />
          </section>

          <div className="progress-section-list">
            {(progress.sections || []).map((section, sectionIndex) => {
              const key = sectionKey(section, sectionIndex)
              const isExpanded = expandedSections.has(key)
              return (
                <section className={`lms-card p-0 progress-accordion-card ${isExpanded ? 'open' : ''}`} key={key}>
                  <button className="progress-section-toggle" type="button" onClick={() => toggleSection(key)} aria-expanded={isExpanded}>
                    <div className="section-heading progress-section-heading">
                      <div>
                        <span className="eyebrow">Section</span>
                        <h2>{section.section_title}</h2>
                        <p>{section.completed_lessons}/{section.total_lessons} lesson selesai</p>
                      </div>
                      <div className="progress-section-actions">
                        <strong>{Math.round(section.progress_percent || 0)}%</strong>
                        <span className="section-caret" aria-hidden="true">{isExpanded ? '⌃' : '⌄'}</span>
                      </div>
                    </div>
                    <ProgressBar value={section.progress_percent} />
                  </button>

                  {isExpanded && (
                    <div className="lesson-progress-list expandable">
                      {(section.lessons || []).map((lesson) => {
                        const lessonId = Number(lesson.lesson_id)
                        const content = contentById.get(lessonId) || {}
                        const detail = selectedLessonId === lessonId ? selectedLesson : null
                        const videoMeta = getVideoMeta(detail?.video_url)
                        const done = lesson.is_completed || completedLessonIds.has(lessonId)
                        const hasDetail = Boolean(detail)

                        return (
                          <article className={`lesson-progress-row ${done ? 'done' : ''} ${hasDetail ? 'active' : ''}`} key={lesson.lesson_id}>
                            <div className="lesson-progress-main">
                              <button className="lesson-expand-trigger" type="button" onClick={() => openLesson(lesson)} aria-expanded={hasDetail}>
                                <span className="lesson-progress-icon">{done ? '✓' : '○'}</span>
                                <div>
                                  <strong>{lesson.title}</strong>
                                  <p>{content.description || (hasDetail ? detail?.description : '') || 'Klik untuk melihat detail materi.'}</p>
                                  <div className="lesson-meta">
                                    {content.duration_minutes ? <small>{content.duration_minutes} menit</small> : null}
                                    {content.video_url ? <small>Video</small> : null}
                                    {content.file_attachment ? <small>File materi</small> : null}
                                  </div>
                                </div>
                              </button>
                              <div className="lesson-progress-actions">
                                <button className="btn btn-soft btn-sm" type="button" onClick={() => openLesson(lesson)}>
                                  {hasDetail ? 'Tutup Detail' : 'Buka Materi'}
                                </button>
                                <button className="btn btn-sm btn-primary-lms" type="button" disabled={done || savingId === lesson.lesson_id} onClick={() => markComplete(lesson.lesson_id)}>
                                  {savingId === lesson.lesson_id ? 'Menyimpan...' : done ? 'Selesai' : 'Tandai Selesai'}
                                </button>
                              </div>
                            </div>

                            {hasDetail && (
                              <div className="progress-lesson-detail">
                                {lessonDetailLoading ? (
                                  <div className="mini-loader">Memuat detail lesson...</div>
                                ) : (
                                  <>
                                    <p>{detail.description || 'Belum ada deskripsi detail untuk lesson ini.'}</p>
                                    <div className="lesson-detail-meta">
                                      <span>Urutan: <strong>{detail.order ?? '-'}</strong></span>
                                      <span>Durasi: <strong>{detail.duration_minutes ? `${detail.duration_minutes} menit` : '-'}</strong></span>
                                    </div>

                                    {detail.video_url ? (
                                      <div className="video-panel">
                                        <div className="video-panel-head">
                                          <strong>Video Materi</strong>
                                          {videoMeta?.watchUrl && <a href={videoMeta.watchUrl} target="_blank" rel="noreferrer">Buka di YouTube/tab baru</a>}
                                        </div>

                                        {videoMeta?.type === 'youtube' ? (
                                          <div className="video-box">
                                            <iframe
                                              title={lessonTitle(detail)}
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
                                            <a className="btn btn-soft w-100" href={videoMeta?.watchUrl || detail.video_url} target="_blank" rel="noreferrer">Buka Video Materi</a>
                                          </div>
                                        )}
                                      </div>
                                    ) : (
                                      <p className="support-note">Lesson ini belum memiliki video URL.</p>
                                    )}

                                    {detail.file_attachment ? (
                                      <button className="btn btn-soft w-100" type="button" onClick={() => downloadFile(detail.id, filenameFromPath(detail.file_attachment, lessonTitle(detail)))}>
                                        Download File Materi
                                      </button>
                                    ) : (
                                      <p className="support-note">Belum ada file attachment untuk lesson ini.</p>
                                    )}
                                  </>
                                )}
                              </div>
                            )}
                          </article>
                        )
                      })}
                    </div>
                  )}
                </section>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}
