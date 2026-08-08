// Shared display metadata for the manuscript workflow status field.
// Kept in one place so the admin dashboard, the screening detail view, and
// the author-facing "My Submissions" page never disagree about labels or
// colors for the same status value.

export const STATUS_META = {
  submitted: {
    label: 'Submitted',
    badgeClassName: 'bg-gold-500/10 text-gold-600',
  },
  editorial_review: {
    label: 'Editorial Screening',
    badgeClassName: 'bg-gold-500/10 text-gold-600',
  },
  revision_requested: {
    label: 'Revision Requested',
    badgeClassName: 'border border-gold-500 bg-white text-gold-600',
  },
  under_peer_review: {
    label: 'Under Peer Review',
    badgeClassName: 'bg-teal-50 text-teal-700',
  },
  minor_revision_requested: {
    label: 'Minor Revision Requested',
    badgeClassName: 'border border-gold-500 bg-white text-gold-600',
  },
  major_revision_requested: {
    label: 'Major Revision Requested',
    badgeClassName: 'border border-gold-500 bg-white text-gold-600',
  },
  revision_submitted: {
    label: 'Revision Submitted',
    badgeClassName: 'bg-teal-50 text-teal-700',
  },
  accepted: {
    label: 'Accepted',
    badgeClassName: 'bg-teal-100 text-teal-700',
  },
  published: {
    label: 'Published',
    badgeClassName: 'bg-teal-700 text-white',
  },
  rejected: {
    label: 'Rejected',
    badgeClassName: 'bg-red-50 text-red-600',
  },
}

// Statuses where the AUTHOR has an outstanding revision to submit.
export const REVISION_OWED_BY_AUTHOR_STATUSES = ['minor_revision_requested', 'major_revision_requested']

// Statuses where an EDITOR can record a post-peer-review decision
// (Accept / Minor Revision / Major Revision / Reject).
export const AWAITING_EDITOR_DECISION_STATUSES = ['under_peer_review', 'revision_submitted']

export function statusLabel(status) {
  return STATUS_META[status]?.label ?? status
}

export function statusBadgeClassName(status) {
  return STATUS_META[status]?.badgeClassName ?? 'bg-slate-100 text-slate-600'
}

// Dashboard filter chips, in workflow order.
export const DASHBOARD_STATUS_FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'awaiting_screening', label: 'Awaiting Screening' },
  { key: 'revision_requested', label: 'Revision Requested (Screening)' },
  { key: 'under_peer_review', label: 'Under Peer Review' },
  { key: 'minor_revision_requested', label: 'Minor Revision Requested' },
  { key: 'major_revision_requested', label: 'Major Revision Requested' },
  { key: 'revision_submitted', label: 'Revision Submitted' },
  { key: 'accepted', label: 'Accepted' },
  { key: 'published', label: 'Published' },
  { key: 'rejected', label: 'Rejected' },
]
