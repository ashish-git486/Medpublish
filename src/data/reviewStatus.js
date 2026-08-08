// Shared display metadata for the review_assignments.status field.
// Kept in one place so the Reviewer Dashboard and the editor's Peer Review
// panel never disagree about labels or colors for the same status value.

export const ASSIGNMENT_STATUS_META = {
  assigned: {
    label: 'Awaiting Response',
    badgeClassName: 'bg-gold-500/10 text-gold-600',
  },
  accepted: {
    label: 'In Progress',
    badgeClassName: 'bg-teal-50 text-teal-700',
  },
  declined: {
    label: 'Declined',
    badgeClassName: 'bg-slate-100 text-slate-500',
  },
  submitted: {
    label: 'Review Submitted',
    badgeClassName: 'bg-teal-700 text-white',
  },
  expired: {
    label: 'Expired',
    badgeClassName: 'bg-red-50 text-red-600',
  },
}

export function assignmentStatusLabel(status) {
  return ASSIGNMENT_STATUS_META[status]?.label ?? status
}

export function assignmentStatusBadgeClassName(status) {
  return ASSIGNMENT_STATUS_META[status]?.badgeClassName ?? 'bg-slate-100 text-slate-600'
}

export const RECOMMENDATION_META = {
  accept: { label: 'Accept', badgeClassName: 'bg-teal-700 text-white' },
  minor_revision: { label: 'Minor Revision', badgeClassName: 'bg-teal-50 text-teal-700' },
  major_revision: { label: 'Major Revision', badgeClassName: 'border border-gold-500 bg-white text-gold-600' },
  reject: { label: 'Reject', badgeClassName: 'bg-red-50 text-red-600' },
}

export function recommendationLabel(value) {
  return RECOMMENDATION_META[value]?.label ?? value
}

export function recommendationBadgeClassName(value) {
  return RECOMMENDATION_META[value]?.badgeClassName ?? 'bg-slate-100 text-slate-600'
}
