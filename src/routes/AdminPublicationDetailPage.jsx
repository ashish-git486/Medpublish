import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { getCategoryBySlug } from '../data/mockData.js'
import {
  publicationStatusLabel,
  publicationStatusBadgeClassName,
} from '../data/publicationStatus.js'
import {
  getPublicationById,
  getPublicationFile,
  getPublicationEvents,
  updatePublicationMetadata,
  publishPublication,
  uploadPublicationFile,
} from '../services/publicationService.js'

function formatDate(isoDate) {
  if (!isoDate) return null
  return new Date(isoDate).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

function formatDateTime(isoDate) {
  if (!isoDate) return null
  return new Date(isoDate).toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function StatusBadge({ status }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-3 py-1 font-mono text-xs font-medium uppercase tracking-wide ${publicationStatusBadgeClassName(status)}`}
    >
      {publicationStatusLabel(status)}
    </span>
  )
}

function AdminPublicationDetailPage() {
  const { id } = useParams()
  const [publication, setPublication] = useState(null)
  const [publicationFile, setPublicationFile] = useState(null)
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [publishing, setPublishing] = useState(false)
  const [reUploading, setReUploading] = useState(false)
  const [error, setError] = useState(null)

  // Edit form state
  const [editMetadata, setEditMetadata] = useState({})

  useEffect(() => {
    let isMounted = true

    async function load() {
      setLoading(true)
      setLoadError(false)
      try {
        const [pubResult, fileResult, eventsResult] = await Promise.all([
          getPublicationById(id),
          getPublicationFile(id),
          getPublicationEvents(id),
        ])

        if (!isMounted) return

        if (pubResult.error || fileResult.error || eventsResult.error) {
          console.error('MedPublish: failed to load publication details', pubResult.error ?? fileResult.error ?? eventsResult.error)
          setLoadError(true)
        } else {
          setPublication(pubResult.data)
          setPublicationFile(fileResult.data)
          setEvents(eventsResult.data)
          setEditMetadata({
            title: pubResult.data?.title || '',
            abstract: pubResult.data?.abstract || '',
            authors: pubResult.data?.authors || '',
            affiliations: pubResult.data?.affiliations || '',
            correspondingAuthorName: pubResult.data?.correspondingAuthorName || '',
            correspondingAuthorEmail: pubResult.data?.correspondingAuthorEmail || '',
            keywords: pubResult.data?.keywords || '',
            articleType: pubResult.data?.articleType || 'Article',
            category: pubResult.data?.category || 'General',
            doi: pubResult.data?.doi || '',
            journalName: pubResult.data?.journalName || '',
            volume: pubResult.data?.volume || '',
            issue: pubResult.data?.issue || '',
            pageRange: pubResult.data?.pageRange || '',
            publicationDate: pubResult.data?.publicationDate || '',
          })
        }
      } catch (error) {
        console.error('MedPublish: failed to load publication details', error)
        if (isMounted) setLoadError(true)
      } finally {
        if (isMounted) setLoading(false)
      }
    }

    load()
    return () => {
      isMounted = false
    }
  }, [id])

  const handleEdit = () => {
    setEditing(true)
    setError(null)
  }

  const handleCancelEdit = () => {
    setEditing(false)
    setError(null)
    // Reset form to current publication data
    if (publication) {
      setEditMetadata({
        title: publication.title || '',
        abstract: publication.abstract || '',
        authors: publication.authors || '',
        affiliations: publication.affiliations || '',
        correspondingAuthorName: publication.correspondingAuthorName || '',
        correspondingAuthorEmail: publication.correspondingAuthorEmail || '',
        keywords: publication.keywords || '',
        articleType: publication.articleType || 'Article',
        category: publication.category || 'General',
        doi: publication.doi || '',
        journalName: publication.journalName || '',
        volume: publication.volume || '',
        issue: publication.issue || '',
        pageRange: publication.pageRange || '',
        publicationDate: publication.publicationDate || '',
      })
    }
  }

  const handleSave = async () => {
    setSaving(true)
    setError(null)

    try {
      const { error: updateError } = await updatePublicationMetadata(id, editMetadata)
      
      if (updateError) throw updateError

      // Reload the publication data
      const [pubResult, eventsResult] = await Promise.all([
        getPublicationById(id),
        getPublicationEvents(id),
      ])

      setPublication(pubResult.data)
      setEvents(eventsResult.data)
      setEditing(false)
    } catch (error) {
      setError(error.message || 'Failed to update publication metadata')
    } finally {
      setSaving(false)
    }
  }

  const handlePublish = async () => {
    const confirmed = window.confirm('Are you sure you want to publish this article? It will become visible in the public Research Library.')
    if (!confirmed) return

    setPublishing(true)
    setError(null)

    try {
      const { error: publishError } = await publishPublication(id)
      
      if (publishError) throw publishError

      // Reload the publication data
      const [pubResult, eventsResult] = await Promise.all([
        getPublicationById(id),
        getPublicationEvents(id),
      ])

      setPublication(pubResult.data)
      setEvents(eventsResult.data)
    } catch (error) {
      setError(error.message || 'Failed to publish article')
    } finally {
      setPublishing(false)
    }
  }

  const handleReUpload = async () => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    
    input.onchange = async (e) => {
      const file = e.target.files[0]
      if (!file) return

      const confirmed = window.confirm(`Replace the current file with ${file.name}?`)
      if (!confirmed) return

      setReUploading(true)
      setError(null)

      try {
        const { error: uploadError } = await uploadPublicationFile(id, file)
        if (uploadError) throw uploadError

        // Reload the file data
        const fileResult = await getPublicationFile(id)
        if (fileResult.error) throw fileResult.error
        setPublicationFile(fileResult.data)

        alert('File uploaded successfully!')
      } catch (error) {
        setError(error.message || 'Failed to upload file')
      } finally {
        setReUploading(false)
      }
    }

    input.click()
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-20 text-center">
        <p className="text-slate-500">Loading publication details…</p>
      </div>
    )
  }

  if (loadError) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-20 text-center">
        <h1 className="font-serif text-2xl font-semibold text-ink">
          Something went wrong
        </h1>
        <p className="mt-3 text-slate-600">
          We couldn't load this publication right now. Please try again shortly.
        </p>
        <Link
          to="/admin/library"
          className="mt-6 inline-flex items-center justify-center rounded-lg bg-ink px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-ink-light"
        >
          Back to Research Library Management
        </Link>
      </div>
    )
  }

  if (!publication) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-20 text-center">
        <h1 className="font-serif text-2xl font-semibold text-ink">
          Publication not found
        </h1>
        <p className="mt-3 text-slate-600">
          We couldn't find a publication with id{' '}
          <span className="font-mono">{id}</span>.
        </p>
        <Link
          to="/admin/library"
          className="mt-6 inline-flex items-center justify-center rounded-lg bg-ink px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-ink-light"
        >
          Back to Research Library Management
        </Link>
      </div>
    )
  }

  const category = getCategoryBySlug(publication.category)

  return (
    <div className="mx-auto max-w-4xl px-4 py-16">
      <div className="mb-8">
        <Link
          to="/admin/library"
          className="text-sm font-semibold text-teal-700 hover:text-teal-800"
        >
          ← Back to Research Library Management
        </Link>
      </div>

      {/* Error display */}
      {error && (
        <div className="mb-6 rounded-xl border border-red-200 bg-red-50 p-4">
          <p className="text-red-600">{error}</p>
        </div>
      )}

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3">
            <StatusBadge status={publication.publicationStatus} />
            {publication.sourceType === 'imported' && (
              <span className="inline-flex items-center rounded-full bg-purple-100 px-2 py-0.5 text-xs font-medium text-purple-700">
                Imported
              </span>
            )}
          </div>
          <h1 className="mt-3 font-serif text-3xl font-semibold leading-snug text-ink">
            {publication.title}
          </h1>
          <p className="mt-2 text-sm text-slate-600">
            {publication.authors}
          </p>
        </div>
        <div className="flex gap-2">
          {publication.publicationStatus === 'draft' && (
            <button
              type="button"
              onClick={handlePublish}
              disabled={publishing}
              className="rounded-lg bg-teal-700 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {publishing ? 'Publishing…' : 'Publish Article'}
            </button>
          )}
          {!editing && (
            <button
              type="button"
              onClick={handleEdit}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50"
            >
              Edit Metadata
            </button>
          )}
        </div>
      </div>

      {/* File information */}
      <div className="mt-6 rounded-lg bg-slate-50 p-4">
        <div className="flex items-center justify-between">
          <h3 className="font-mono text-xs uppercase tracking-wide text-slate-500">
            Article File
          </h3>
          {publication.publicationStatus === 'draft' && (
            <button
              type="button"
              onClick={handleReUpload}
              disabled={reUploading}
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-100 disabled:opacity-50"
            >
              {reUploading ? 'Uploading...' : publicationFile ? 'Replace File' : 'Upload File'}
            </button>
          )}
        </div>
        {publicationFile ? (
          <div className="mt-2 text-sm">
            <p><span className="font-medium text-ink">File:</span> {publicationFile.fileName}</p>
            <p><span className="font-medium text-ink">Size:</span> {(publicationFile.fileSizeBytes / 1024 / 1024).toFixed(2)} MB</p>
            <p><span className="font-medium text-ink">Type:</span> {publicationFile.fileType}</p>
            <p><span className="font-medium text-ink">Uploaded:</span> {formatDate(publicationFile.uploadedAt)}</p>
          </div>
        ) : (
          <div className="mt-2 text-sm text-slate-500">
            No file uploaded. Please upload a file before publishing.
          </div>
        )}
      </div>

      {/* Metadata display or edit form */}
      <div className="mt-8 rounded-xl border border-slate-200 bg-white p-6">
        <h2 className="font-serif text-lg font-semibold text-ink">
          Publication Metadata
        </h2>

        {editing ? (
          <div className="mt-6 space-y-6">
            {/* Title */}
            <div>
              <label className="block font-mono text-xs uppercase tracking-wide text-slate-500">
                Title *
              </label>
              <input
                type="text"
                value={editMetadata.title}
                onChange={(e) => setEditMetadata(prev => ({ ...prev, title: e.target.value }))}
                className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-ink focus:border-teal-700 focus:outline-none focus:ring-1 focus:ring-teal-700"
              />
            </div>

            {/* Authors */}
            <div>
              <label className="block font-mono text-xs uppercase tracking-wide text-slate-500">
                Authors *
              </label>
              <textarea
                value={editMetadata.authors}
                onChange={(e) => setEditMetadata(prev => ({ ...prev, authors: e.target.value }))}
                rows={3}
                className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-ink focus:border-teal-700 focus:outline-none focus:ring-1 focus:ring-teal-700"
              />
            </div>

            {/* Abstract */}
            <div>
              <label className="block font-mono text-xs uppercase tracking-wide text-slate-500">
                Abstract *
              </label>
              <textarea
                value={editMetadata.abstract}
                onChange={(e) => setEditMetadata(prev => ({ ...prev, abstract: e.target.value }))}
                rows={6}
                className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-ink focus:border-teal-700 focus:outline-none focus:ring-1 focus:ring-teal-700"
              />
            </div>

            {/* Other metadata fields */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="block font-mono text-xs uppercase tracking-wide text-slate-500">
                  Article Type
                </label>
                <input
                  type="text"
                  value={editMetadata.articleType}
                  onChange={(e) => setEditMetadata(prev => ({ ...prev, articleType: e.target.value }))}
                  className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-ink focus:border-teal-700 focus:outline-none focus:ring-1 focus:ring-teal-700"
                />
              </div>
              <div>
                <label className="block font-mono text-xs uppercase tracking-wide text-slate-500">
                  Category
                </label>
                <input
                  type="text"
                  value={editMetadata.category}
                  onChange={(e) => setEditMetadata(prev => ({ ...prev, category: e.target.value }))}
                  className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-ink focus:border-teal-700 focus:outline-none focus:ring-1 focus:ring-teal-700"
                />
              </div>
            </div>

            {/* Optional fields */}
            <div className="border-t border-slate-200 pt-6">
              <h3 className="font-mono text-xs uppercase tracking-wide text-slate-500">
                Optional Fields
              </h3>
              <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="block font-mono text-xs uppercase tracking-wide text-slate-500">
                    DOI
                  </label>
                  <input
                    type="text"
                    value={editMetadata.doi}
                    onChange={(e) => setEditMetadata(prev => ({ ...prev, doi: e.target.value }))}
                    className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-ink focus:border-teal-700 focus:outline-none focus:ring-1 focus:ring-teal-700"
                  />
                </div>
                <div>
                  <label className="block font-mono text-xs uppercase tracking-wide text-slate-500">
                    Publication Date
                  </label>
                  <input
                    type="date"
                    value={editMetadata.publicationDate}
                    onChange={(e) => setEditMetadata(prev => ({ ...prev, publicationDate: e.target.value }))}
                    className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-ink focus:border-teal-700 focus:outline-none focus:ring-1 focus:ring-teal-700"
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={handleCancelEdit}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="rounded-lg bg-ink px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-ink-light disabled:cursor-not-allowed disabled:opacity-60"
              >
                {saving ? 'Saving…' : 'Save Changes'}
              </button>
            </div>
          </div>
        ) : (
          <div className="mt-6 space-y-4">
            <div>
              <h3 className="font-mono text-xs uppercase tracking-wide text-slate-500">
                Abstract
              </h3>
              <p className="mt-2 text-sm text-slate-700">{publication.abstract}</p>
            </div>

            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <h3 className="font-mono text-xs uppercase tracking-wide text-slate-500">
                  Category
                </h3>
                <p className="mt-2 text-slate-700">{category?.name || publication.category}</p>
              </div>
              <div>
                <h3 className="font-mono text-xs uppercase tracking-wide text-slate-500">
                  Article Type
                </h3>
                <p className="mt-2 text-slate-700">{publication.articleType}</p>
              </div>
            </div>

            {publication.keywords && (
              <div>
                <h3 className="font-mono text-xs uppercase tracking-wide text-slate-500">
                  Keywords
                </h3>
                <p className="mt-2 text-sm text-slate-700">{publication.keywords}</p>
              </div>
            )}

            {publication.doi && (
              <div>
                <h3 className="font-mono text-xs uppercase tracking-wide text-slate-500">
                  DOI
                </h3>
                <p className="mt-2 text-sm text-slate-700">{publication.doi}</p>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <h3 className="font-mono text-xs uppercase tracking-wide text-slate-500">
                  Created
                </h3>
                <p className="mt-2 text-slate-700">{formatDateTime(publication.createdAt)}</p>
              </div>
              <div>
                <h3 className="font-mono text-xs uppercase tracking-wide text-slate-500">
                  Created By
                </h3>
                <p className="mt-2 text-slate-700">{publication.createdByName || publication.createdBy}</p>
              </div>
            </div>

            {publication.publishedAt && (
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <h3 className="font-mono text-xs uppercase tracking-wide text-slate-500">
                    Published
                  </h3>
                  <p className="mt-2 text-slate-700">{formatDateTime(publication.publishedAt)}</p>
                </div>
                <div>
                  <h3 className="font-mono text-xs uppercase tracking-wide text-slate-500">
                    Published By
                  </h3>
                  <p className="mt-2 text-slate-700">{publication.publishedByName || publication.publishedBy}</p>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Event timeline */}
      <div className="mt-8 rounded-xl border border-slate-200 bg-white p-6">
        <h2 className="font-serif text-lg font-semibold text-ink">
          Publication History
        </h2>
        {events.length === 0 ? (
          <p className="mt-4 text-sm text-slate-500">No events recorded yet.</p>
        ) : (
          <div className="mt-4 space-y-4">
            {events.map((event) => (
              <div key={event.id} className="flex gap-4 text-sm">
                <div className="flex-shrink-0">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-slate-600">
                    {event.actorName ? event.actorName.charAt(0).toUpperCase() : '?'}
                  </div>
                </div>
                <div className="flex-1">
                  <p className="font-medium text-ink">
                    {event.actorName || 'Unknown'} · {event.eventType.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                  </p>
                  <p className="text-slate-600">{event.note}</p>
                  <p className="mt-1 text-xs text-slate-500">{formatDateTime(event.createdAt)}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default AdminPublicationDetailPage