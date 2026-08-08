// DEPRECATED — kept only for reference, not imported anywhere.
//
// This was the original localStorage-based prototype data service. As of
// the Supabase Auth + database integration, real submissions live in the
// `manuscripts` table and are accessed through
// `src/services/manuscriptService.js` instead. No page in the app imports
// this file anymore; nothing here runs, and no data written here is used
// by the live application. It is left in place only so the earlier
// prototype behavior remains readable for anyone comparing before/after.
//
// Field names deliberately mirror mockData.js / the Supabase schema:
//   categorySlug  -> manuscripts.category (FK-like slug, see migration)
//   articleType   -> manuscripts.article_type
//   submittedAt   -> manuscripts.submitted_at
//   status        -> manuscripts.status ('pending' | 'approved' | 'rejected')

const STORAGE_KEY = 'medpublish_submissions'

// ---- internal helpers -------------------------------------------------

function readAll() {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch (error) {
    console.error('MedPublish: failed to read submissions from localStorage', error)
    return []
  }
}

function writeAll(submissions) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(submissions))
    return true
  } catch (error) {
    console.error('MedPublish: failed to write submissions to localStorage', error)
    return false
  }
}

function generateId() {
  const random = Math.random().toString(36).slice(2, 8)
  return `sub-${Date.now()}-${random}`
}

// ---- public API ---------------------------------------------------------

/** Get every local submission, newest first. */
export function getSubmissions() {
  return [...readAll()].sort(
    (a, b) => new Date(b.submittedAt) - new Date(a.submittedAt),
  )
}

/** Get a single submission by id, or undefined if it doesn't exist. */
export function getSubmissionById(id) {
  return readAll().find((submission) => submission.id === id)
}

/**
 * Save a new manuscript submission.
 * `data` should contain the form fields; this function stamps on the id,
 * status, and submittedAt so callers can't accidentally set those.
 */
export function saveSubmission(data) {
  const submission = {
    id: generateId(),
    title: data.title?.trim() ?? '',
    abstract: data.abstract?.trim() ?? '',
    authors: data.authors?.trim() ?? '',
    categorySlug: data.categorySlug ?? '',
    articleType: data.articleType ?? '',
    content: data.content?.trim() ?? '',
    keywords: data.keywords?.trim() ?? '',
    institution: data.institution?.trim() ?? '',
    correspondingEmail: data.correspondingEmail?.trim() ?? '',
    references: data.references?.trim() ?? '',
    status: 'pending',
    submittedAt: new Date().toISOString(),
    reviewedAt: null,
  }

  const all = readAll()
  all.push(submission)
  writeAll(all)
  return submission
}

/** Merge a partial update into an existing submission. */
export function updateSubmission(id, changes) {
  const all = readAll()
  const index = all.findIndex((submission) => submission.id === id)
  if (index === -1) return null

  all[index] = { ...all[index], ...changes }
  writeAll(all)
  return all[index]
}

/** Mark a pending submission as approved. */
export function approveSubmission(id) {
  return updateSubmission(id, {
    status: 'approved',
    reviewedAt: new Date().toISOString(),
  })
}

/** Mark a pending submission as rejected. */
export function rejectSubmission(id) {
  return updateSubmission(id, {
    status: 'rejected',
    reviewedAt: new Date().toISOString(),
  })
}

/** All submissions with status 'approved' — these belong in the public library. */
export function getPublishedSubmissions() {
  return getSubmissions().filter((submission) => submission.status === 'approved')
}

/** All submissions with status 'pending' — awaiting editorial decision. */
export function getPendingSubmissions() {
  return getSubmissions().filter((submission) => submission.status === 'pending')
}

/** All submissions with status 'rejected'. */
export function getRejectedSubmissions() {
  return getSubmissions().filter((submission) => submission.status === 'rejected')
}

/** Basic counts for the admin dashboard's summary cards. */
export function getSubmissionStats() {
  const all = readAll()
  return {
    total: all.length,
    pending: all.filter((s) => s.status === 'pending').length,
    approved: all.filter((s) => s.status === 'approved').length,
    rejected: all.filter((s) => s.status === 'rejected').length,
  }
}
