import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import { 
  getMyProfile, 
  updateMyProfile, 
  getProfileCompleteness,
  getAuthorManuscriptSummary,
  getAuthorActionItems,
  getMyCoAuthorInvitations,
  getMyPublications,
  validateORCID,
  validateWebsiteUrl,
  formatProfileForDisplay
} from '../services/profileService.js'
import { statusBadgeClassName, statusLabel } from '../data/manuscriptStatus.js'
import { productionStatusBadgeClassName, productionStatusLabel } from '../data/productionStatus.js'
import { acceptCoAuthorInvitation } from '../services/authorshipService.js'

function formatDate(isoDate) {
  return new Date(isoDate).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

// =========================================================================
// PROFILE HEADER COMPONENT
// =========================================================================

function ProfileHeader({ profile, completeness, onEdit }) {
  return (
    <div className="mb-8 rounded-xl border border-slate-200 bg-white p-6">
      <div className="flex flex-col gap-6 sm:flex-row sm:items-start">
        {/* Avatar */}
        <div className="flex-shrink-0">
          {profile?.avatar_url ? (
            <img
              src={profile.avatar_url}
              alt={profile.full_name}
              className="h-24 w-24 rounded-full object-cover border-2 border-slate-200"
            />
          ) : (
            <div className="flex h-24 w-24 items-center justify-center rounded-full bg-slate-100 border-2 border-slate-200">
              <span className="text-3xl font-semibold text-slate-400">
                {profile?.full_name?.charAt(0) || profile?.email?.charAt(0)}
              </span>
            </div>
          )}
        </div>

        {/* Profile Info */}
        <div className="flex-1">
          <h1 className="font-serif text-2xl font-semibold text-ink">
            {profile?.full_name || 'Author Profile'}
          </h1>
          
          <div className="mt-2 space-y-1 text-sm text-slate-600">
            <p>{profile?.email}</p>
            {profile?.designation && <p>{profile.designation}</p>}
            {profile?.institution && <p>{profile.institution}</p>}
            {(profile?.city || profile?.country) && (
              <p>{[profile.city, profile.country].filter(Boolean).join(', ')}</p>
            )}
            {profile?.orcid && (
              <p>
                ORCID:{' '}
                <a
                  href={`https://orcid.org/${profile.orcid}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-teal-700 hover:text-teal-800"
                >
                  {profile.orcid}
                </a>
              </p>
            )}
          </div>

          {/* Profile Completeness */}
          {completeness && (
            <div className="mt-4">
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-600">Profile completeness</span>
                <span className="font-medium text-slate-900">{completeness.completeness_percentage}%</span>
              </div>
              <div className="mt-1 h-2 overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full bg-teal-600 transition-all"
                  style={{ width: `${completeness.completeness_percentage}%` }}
                />
              </div>
              {completeness.missing_fields?.length > 0 && (
                <p className="mt-2 text-xs text-slate-500">
                  Missing: {completeness.missing_fields.join(', ')}
                </p>
              )}
            </div>
          )}
        </div>

        {/* Edit Button */}
        <button
          onClick={onEdit}
          className="flex-shrink-0 rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
        >
          Edit Profile
        </button>
      </div>
    </div>
  )
}

// =========================================================================
// PROFILE EDIT FORM COMPONENT
// =========================================================================

function ProfileEditForm({ profile, onSave, onCancel }) {
  const [formData, setFormData] = useState({
    fullName: profile?.full_name || '',
    phone: profile?.phone || '',
    country: profile?.country || '',
    city: profile?.city || '',
    postalAddress: profile?.postal_address || '',
    designation: profile?.designation || '',
    department: profile?.department || '',
    institution: profile?.institution || '',
    orcid: profile?.orcid || '',
    bio: profile?.bio || '',
    websiteUrl: profile?.website_url || '',
  })
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
    // Clear error for this field
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: null }))
    }
  }

  const validateForm = () => {
    const newErrors = {}
    
    if (!formData.fullName.trim()) {
      newErrors.fullName = 'Full name is required'
    }

    if (formData.orcid) {
      const orcidValidation = validateORCID(formData.orcid)
      if (!orcidValidation.valid) {
        newErrors.orcid = orcidValidation.error
      }
    }

    if (formData.websiteUrl) {
      const urlValidation = validateWebsiteUrl(formData.websiteUrl)
      if (!urlValidation.valid) {
        newErrors.websiteUrl = urlValidation.error
      }
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    
    if (!validateForm()) {
      return
    }

    setSaving(true)
    const { error } = await updateMyProfile(formData)
    setSaving(false)

    if (error) {
      setErrors({ submit: error.message })
      return
    }

    onSave()
  }

  return (
    <div className="mb-8 rounded-xl border border-slate-200 bg-white p-6">
      <h2 className="font-serif text-xl font-semibold text-ink mb-6">Edit Profile</h2>
      
      {errors.submit && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {errors.submit}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Personal Information */}
        <div>
          <h3 className="text-sm font-medium text-slate-900 mb-3">Personal Information</h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Full Name *
              </label>
              <input
                type="text"
                name="fullName"
                value={formData.fullName}
                onChange={handleChange}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
                disabled={saving}
              />
              {errors.fullName && (
                <p className="mt-1 text-xs text-red-600">{errors.fullName}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Email (read-only)
              </label>
              <input
                type="email"
                value={profile?.email || ''}
                disabled
                className="w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-sm text-slate-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Phone
              </label>
              <input
                type="tel"
                name="phone"
                value={formData.phone}
                onChange={handleChange}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
                disabled={saving}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Country
              </label>
              <input
                type="text"
                name="country"
                value={formData.country}
                onChange={handleChange}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
                disabled={saving}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                City
              </label>
              <input
                type="text"
                name="city"
                value={formData.city}
                onChange={handleChange}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
                disabled={saving}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Postal Address
              </label>
              <input
                type="text"
                name="postalAddress"
                value={formData.postalAddress}
                onChange={handleChange}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
                disabled={saving}
              />
            </div>
          </div>
        </div>

        {/* Professional Information */}
        <div>
          <h3 className="text-sm font-medium text-slate-900 mb-3">Professional Information</h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Designation / Title
              </label>
              <input
                type="text"
                name="designation"
                value={formData.designation}
                onChange={handleChange}
                placeholder="e.g., Professor, MD, PhD"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
                disabled={saving}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Department
              </label>
              <input
                type="text"
                name="department"
                value={formData.department}
                onChange={handleChange}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
                disabled={saving}
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Institution
              </label>
              <input
                type="text"
                name="institution"
                value={formData.institution}
                onChange={handleChange}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
                disabled={saving}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                ORCID iD
              </label>
              <input
                type="text"
                name="orcid"
                value={formData.orcid}
                onChange={handleChange}
                placeholder="0000-0000-0000-0000"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
                disabled={saving}
              />
              {errors.orcid && (
                <p className="mt-1 text-xs text-red-600">{errors.orcid}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Website URL
              </label>
              <input
                type="url"
                name="websiteUrl"
                value={formData.websiteUrl}
                onChange={handleChange}
                placeholder="https://example.com"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
                disabled={saving}
              />
              {errors.websiteUrl && (
                <p className="mt-1 text-xs text-red-600">{errors.websiteUrl}</p>
              )}
            </div>

            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Professional Biography
              </label>
              <textarea
                name="bio"
                value={formData.bio}
                onChange={handleChange}
                rows={4}
                placeholder="Brief professional biography and research interests..."
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
                disabled={saving}
              />
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <button
            type="submit"
            disabled={saving}
            className="rounded-lg bg-ink px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-ink-light disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
          <button
            type="button"
            onClick={onCancel}
            disabled={saving}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-50"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  )
}

// =========================================================================
// ACTION REQUIRED COMPONENT
// =========================================================================

function ActionRequired({ actionItems, onAcceptInvitation }) {
  if (!actionItems) {
    return null
  }

  const hasActions =
    (actionItems?.revision_requests?.length > 0) ||
    (actionItems?.proof_reviews?.length > 0) ||
    (actionItems?.co_author_invitations?.length > 0) ||
    (actionItems?.pending_confirmations?.length > 0)

  if (!hasActions) {
    return null
  }

  return (
    <div className="mb-8 rounded-xl border border-orange-200 bg-orange-50 p-6">
      <h2 className="font-serif text-xl font-semibold text-orange-900 mb-4">Action Required</h2>

      <div className="space-y-4">
        {/* Revision Requests */}
        {actionItems?.revision_requests?.map(item => (
          <div key={item.revision_request_id} className="rounded-lg border border-orange-200 bg-white p-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="font-medium text-orange-900">
                  {item.revision_type === 'minor' ? 'Minor' : 'Major'} Revision Requested
                </p>
                <p className="mt-1 text-sm text-slate-700">{item.title}</p>
                {item.deadline && (
                  <p className="mt-1 text-xs text-slate-500">
                    Deadline: {formatDate(item.deadline)}
                  </p>
                )}
              </div>
              <Link
                to={`/my-submissions/${item.manuscript_id}/revise`}
                className="rounded-lg bg-orange-600 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-orange-700"
              >
                Submit Revision
              </Link>
            </div>
          </div>
        ))}

        {/* Proof Reviews */}
        {actionItems?.proof_reviews?.map(item => (
          <div key={item.manuscript_id} className="rounded-lg border border-purple-200 bg-white p-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="font-medium text-purple-900">
                  {item.production_status === 'author_proof' ? 'Proof Review Required' :
                   item.production_status === 'proof_corrections' ? 'Corrections Under Review' :
                   'Final Proof Approval'}
                </p>
                <p className="mt-1 text-sm text-slate-700">{item.title}</p>
                <p className="mt-1 text-xs text-slate-500">
                  Proof v{item.proof_version} · {formatDate(item.proof_uploaded_at)}
                </p>
              </div>
              <Link
                to={`/my-submissions/${item.manuscript_id}`}
                className="rounded-lg bg-purple-600 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-purple-700"
              >
                View Proof
              </Link>
            </div>
          </div>
        ))}

        {/* Co-author Invitations */}
        {actionItems?.co_author_invitations?.map(item => (
          <div key={item.author_id} className="rounded-lg border border-blue-200 bg-white p-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="font-medium text-blue-900">Co-author Invitation</p>
                <p className="mt-1 text-sm text-slate-700">{item.title}</p>
                <p className="mt-1 text-xs text-slate-500">
                  Invited {formatDate(item.invitation_sent_at)} · Expires {formatDate(item.invitation_expires_at)}
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => onAcceptInvitation(item.author_id)}
                  className="rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-blue-700"
                >
                  Accept
                </button>
                <button className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50">
                  Decline
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// =========================================================================
// MANUSCRIPT WORKSPACE COMPONENT
// =========================================================================

function ManuscriptWorkspace({ manuscriptSummary }) {
  const [filter, setFilter] = useState('all')

  if (!manuscriptSummary) {
    return (
      <div className="mb-8 rounded-xl border border-slate-200 bg-white p-6">
        <h2 className="font-serif text-xl font-semibold text-ink mb-4">My Manuscripts</h2>
        <div className="text-center py-8">
          <p className="text-slate-500">Loading manuscript workspace…</p>
        </div>
      </div>
    )
  }

  const allManuscripts = [
    ...(manuscriptSummary?.submitting_author_manuscripts || []).map(m => ({
      ...m,
      source: 'submitting_author'
    })),
    ...(manuscriptSummary?.co_author_manuscripts || []).map(m => ({
      ...m,
      source: 'co_author'
    }))
  ]

  const filteredManuscripts = filter === 'all' 
    ? allManuscripts 
    : allManuscripts.filter(m => m.status === filter)

  const statusCounts = {
    all: allManuscripts.length,
    draft: allManuscripts.filter(m => m.status === 'draft').length,
    submitted: allManuscripts.filter(m => m.status === 'submitted').length,
    editorial_review: allManuscripts.filter(m => m.status === 'editorial_review').length,
    under_peer_review: allManuscripts.filter(m => m.status === 'under_peer_review').length,
    revision_requested: allManuscripts.filter(m => m.status === 'revision_requested').length,
    minor_revision_requested: allManuscripts.filter(m => m.status === 'minor_revision_requested').length,
    major_revision_requested: allManuscripts.filter(m => m.status === 'major_revision_requested').length,
    revision_submitted: allManuscripts.filter(m => m.status === 'revision_submitted').length,
    accepted: allManuscripts.filter(m => m.status === 'accepted').length,
    rejected: allManuscripts.filter(m => m.status === 'rejected').length,
  }

  if (allManuscripts.length === 0) {
    return (
      <div className="mb-8 rounded-xl border border-slate-200 bg-white p-6">
        <h2 className="font-serif text-xl font-semibold text-ink mb-4">My Manuscripts</h2>
        <div className="text-center py-8">
          <p className="text-slate-500">You haven't submitted any manuscripts yet.</p>
          <Link
            to="/submit"
            className="mt-4 inline-flex items-center justify-center rounded-lg bg-ink px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-ink-light"
          >
            Submit a manuscript
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="mb-8 rounded-xl border border-slate-200 bg-white p-6">
      <h2 className="font-serif text-xl font-semibold text-ink mb-4">My Manuscripts</h2>
      
      {/* Filter Tabs */}
      <div className="flex flex-wrap gap-2 mb-6">
        {Object.entries(statusCounts).map(([key, count]) => (
          count > 0 && (
            <button
              key={key}
              onClick={() => setFilter(key)}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                filter === key
                  ? 'bg-teal-600 text-white'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              {key === 'all' ? 'All' : statusLabel(key)} ({count})
            </button>
          )
        ))}
      </div>

      {/* Manuscript List */}
      <div className="space-y-4">
        {filteredManuscripts.map(manuscript => (
          <div
            key={manuscript.manuscript_id}
            className="rounded-lg border border-slate-200 p-4 hover:border-slate-300 transition-colors"
          >
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500">
                  <span className="font-medium text-slate-700">
                    {manuscript.source === 'submitting_author' ? 'Submitting Author' : `Co-author #${manuscript.author_order}`}
                  </span>
                  {manuscript.is_corresponding_author && (
                    <span className="rounded-full bg-teal-100 px-2 py-0.5 text-teal-700">
                      Corresponding
                    </span>
                  )}
                  <span>·</span>
                  <span>{formatDate(manuscript.submitted_at)}</span>
                </div>
                <h3 className="mt-1 font-serif text-base font-semibold text-ink">
                  {manuscript.title}
                </h3>
                <p className="mt-1 text-sm text-slate-600">
                  {manuscript.article_type} · {manuscript.category}
                </p>
              </div>
              <span
                className={`inline-flex items-center rounded-full px-3 py-1 font-mono text-xs font-medium uppercase tracking-wide ${statusBadgeClassName(manuscript.status)}`}
              >
                {statusLabel(manuscript.status)}
              </span>
            </div>
            <div className="mt-3 flex justify-end">
              <Link
                to={`/my-submissions/${manuscript.manuscript_id}`}
                className="text-sm font-medium text-teal-700 hover:text-teal-800"
              >
                View details →
              </Link>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// =========================================================================
// PUBLICATIONS COMPONENT
// =========================================================================

function Publications({ publications }) {
  if (publications === null) {
    return (
      <div className="mb-8 rounded-xl border border-slate-200 bg-white p-6">
        <h2 className="font-serif text-xl font-semibold text-ink mb-4">My Publications</h2>
        <p className="text-slate-500">Loading publications…</p>
      </div>
    )
  }

  if (!publications || publications.length === 0) {
    return (
      <div className="mb-8 rounded-xl border border-slate-200 bg-white p-6">
        <h2 className="font-serif text-xl font-semibold text-ink mb-4">My Publications</h2>
        <p className="text-slate-500">No published articles yet.</p>
      </div>
    )
  }

  return (
    <div className="mb-8 rounded-xl border border-slate-200 bg-white p-6">
      <h2 className="font-serif text-xl font-semibold text-ink mb-4">My Publications</h2>
      
      <div className="space-y-4">
        {publications.map(publication => (
          <div
            key={publication.id}
            className="rounded-lg border border-slate-200 p-4 hover:border-slate-300 transition-colors"
          >
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500">
                  <span className="font-medium text-slate-700">
                    {publication.role === 'submitting_author' ? 'Submitting Author' : `Co-author #${publication.author_order}`}
                  </span>
                  {publication.is_corresponding_author && (
                    <span className="rounded-full bg-teal-100 px-2 py-0.5 text-teal-700">
                      Corresponding
                    </span>
                  )}
                  <span>·</span>
                  <span>{formatDate(publication.reviewed_at)}</span>
                </div>
                <h3 className="mt-1 font-serif text-base font-semibold text-ink">
                  {publication.title}
                </h3>
                <p className="mt-1 text-sm text-slate-600">
                  {publication.article_type} · {publication.category}
                </p>
              </div>
              <span
                className={`inline-flex items-center rounded-full px-3 py-1 font-mono text-xs font-medium uppercase tracking-wide ${statusBadgeClassName('published')}`}
              >
                Published
              </span>
            </div>
            <div className="mt-3 flex justify-end">
              <Link
                to={`/resources/${publication.id}`}
                className="text-sm font-medium text-teal-700 hover:text-teal-800"
              >
                View article →
              </Link>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// =========================================================================
// MAIN AUTHOR PROFILE PAGE
// =========================================================================

function AuthorProfilePage() {
  const { isAuthenticated, profile: authProfile } = useAuth()
  const [profile, setProfile] = useState(null)
  const [completeness, setCompleteness] = useState(null)
  const [manuscriptSummary, setManuscriptSummary] = useState(null)
  const [actionItems, setActionItems] = useState(null)
  const [publications, setPublications] = useState(null)
  const [loading, setLoading] = useState(true)
  const [editMode, setEditMode] = useState(false)
  const [error, setError] = useState(null)
  const [completenessError, setCompletenessError] = useState(null)
  const [manuscriptError, setManuscriptError] = useState(null)
  const [actionItemsError, setActionItemsError] = useState(null)
  const [publicationsError, setPublicationsError] = useState(null)

  useEffect(() => {
    if (!isAuthenticated) return

    async function loadData() {
      setLoading(true)
      setError(null)

      try {
        // Load profile data with graceful error handling for each section
        const profileResult = await getMyProfile()
        if (profileResult.error) throw profileResult.error
        setProfile(formatProfileForDisplay(profileResult.data))

        // Load completeness - non-critical, don't fail entire page if this fails
        const completenessResult = await getProfileCompleteness()
        if (!completenessResult.error) {
          setCompleteness(completenessResult.data)
        } else {
          console.warn('MedPublish: failed to load profile completeness', completenessResult.error)
          setCompletenessError(completenessResult.error.message)
        }

        // Load manuscript summary - important but don't fail entire page
        const manuscriptResult = await getAuthorManuscriptSummary()
        if (!manuscriptResult.error) {
          setManuscriptSummary(manuscriptResult.data)
        } else {
          console.warn('MedPublish: failed to load manuscript summary', manuscriptResult.error)
          setManuscriptError(manuscriptResult.error.message)
        }

        // Load action items - non-critical
        const actionResult = await getAuthorActionItems()
        if (!actionResult.error) {
          setActionItems(actionResult.data)
        } else {
          console.warn('MedPublish: failed to load action items', actionResult.error)
          setActionItemsError(actionResult.error.message)
        }

        // Load publications - non-critical
        const publicationsResult = await getMyPublications()
        if (!publicationsResult.error) {
          setPublications(publicationsResult.data)
        } else {
          console.warn('MedPublish: failed to load publications', publicationsResult.error)
          setPublicationsError(publicationsResult.error.message)
        }
      } catch (err) {
        console.error('MedPublish: failed to load author profile data', err)
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [isAuthenticated])

  const handleProfileSave = () => {
    setEditMode(false)
    // Reload the page to refresh data
    window.location.reload()
  }

  const handleProfileCancel = () => {
    setEditMode(false)
  }

  const handleAcceptInvitation = async (authorId) => {
    // This would open a modal to collect author details before accepting
    // For now, just log and show a placeholder message
    console.log('Accept invitation for author:', authorId)
    alert('Co-author invitation acceptance requires additional information. This feature will be implemented in a future update.')
  }

  if (!isAuthenticated) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-16">
        <div className="text-center">
          <h1 className="font-serif text-3xl font-semibold text-ink">Author Profile</h1>
          <p className="mt-4 text-slate-600">Please log in to view your author profile.</p>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-16">
        <p className="text-center text-slate-500">Loading your author profile…</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-16">
        <div className="rounded-xl border border-dashed border-red-200 bg-red-50 p-10 text-center">
          <p className="text-red-600">
            We couldn't load your profile right now. Please try again shortly.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-16">
      <div className="mb-8">
        <h1 className="font-serif text-3xl font-semibold text-ink">Author Profile</h1>
        <p className="mt-3 max-w-2xl text-slate-600">
          Your personal control center for managing your author identity, manuscripts, and publications.
        </p>
      </div>

      <ProfileHeader profile={profile} completeness={completeness} onEdit={() => setEditMode(true)} />

      {editMode ? (
        <ProfileEditForm 
          profile={profile} 
          onSave={handleProfileSave}
          onCancel={handleProfileCancel}
        />
      ) : (
        <>
          {completenessError && (
            <div className="mb-8 rounded-lg border border-orange-200 bg-orange-50 p-4 text-sm text-orange-700">
              <p>Unable to load profile completeness: {completenessError}</p>
            </div>
          )}

          <ActionRequired actionItems={actionItems} onAcceptInvitation={handleAcceptInvitation} />

          {actionItemsError && (
            <div className="mb-8 rounded-lg border border-orange-200 bg-orange-50 p-4 text-sm text-orange-700">
              <p>Unable to load action items: {actionItemsError}</p>
            </div>
          )}
          
          {manuscriptError ? (
            <div className="mb-8 rounded-lg border border-orange-200 bg-orange-50 p-4 text-sm text-orange-700">
              <p>Unable to load manuscript workspace: {manuscriptError}</p>
            </div>
          ) : (
            <ManuscriptWorkspace manuscriptSummary={manuscriptSummary} />
          )}
          
          {publicationsError ? (
            <div className="mb-8 rounded-lg border border-orange-200 bg-orange-50 p-4 text-sm text-orange-700">
              <p>Unable to load publications: {publicationsError}</p>
            </div>
          ) : (
            <Publications publications={publications} />
          )}
        </>
      )}
    </div>
  )
}

export default AuthorProfilePage