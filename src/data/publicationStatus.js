// Publication status metadata, following the same pattern as
// manuscriptStatus.js, editorDecisionStatus.js, and productionStatus.js

/**
 * Human-readable label for a publication status.
 */
export function publicationStatusLabel(status) {
  const labels = {
    draft: 'Draft',
    under_review: 'Under Review',
    approved: 'Approved',
    published: 'Published',
    rejected: 'Rejected',
  }
  return labels[status] || status
}

/**
 * Tailwind CSS classes for status badges in the UI.
 */
export function publicationStatusBadgeClassName(status) {
  const classes = {
    draft: 'bg-slate-100 text-slate-700',
    under_review: 'bg-blue-100 text-blue-700',
    approved: 'bg-green-100 text-green-700',
    published: 'bg-teal-100 text-teal-700',
    rejected: 'bg-red-100 text-red-700',
  }
  return classes[status] || 'bg-slate-100 text-slate-700'
}

/**
 * Order of publication statuses for sorting/filtering.
 */
export const PUBLICATION_STATUS_ORDER = ['draft', 'under_review', 'approved', 'published', 'rejected']

/**
 * Filter options for admin dashboard publication list.
 */
export const PUBLICATION_STATUS_FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'draft', label: 'Draft' },
  { key: 'under_review', label: 'Under Review' },
  { key: 'approved', label: 'Approved' },
  { key: 'published', label: 'Published' },
  { key: 'rejected', label: 'Rejected' },
]