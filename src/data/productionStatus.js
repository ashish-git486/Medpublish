// Shared display metadata for the production workflow status field
// (manuscript_production.production_status). Mirrors the pattern in
// manuscriptStatus.js / editorDecisionStatus.js so the production
// dashboard and the production detail page never disagree about labels,
// colors, or workflow order for the same status value.

export const PRODUCTION_STATUS_META = {
  accepted: {
    label: 'Accepted',
    badgeClassName: 'bg-teal-100 text-teal-700',
  },
  copyediting: {
    label: 'Copyediting',
    badgeClassName: 'bg-gold-500/10 text-gold-600',
  },
  metadata_verification: {
    label: 'Metadata Verification',
    badgeClassName: 'border border-gold-500 bg-white text-gold-600',
  },
  ready_for_typesetting: {
    label: 'Ready For Typesetting',
    badgeClassName: 'bg-teal-700 text-white',
  },
  typesetting: {
    label: 'Typesetting',
    badgeClassName: 'bg-indigo-100 text-indigo-700',
  },
  author_proof: {
    label: 'Author Proof',
    badgeClassName: 'bg-purple-100 text-purple-700',
  },
  proof_corrections: {
    label: 'Proof Corrections',
    badgeClassName: 'bg-orange-100 text-orange-700',
  },
  final_proof_approval: {
    label: 'Final Proof Approval',
    badgeClassName: 'bg-pink-100 text-pink-700',
  },
  publication_ready: {
    label: 'Publication Ready',
    badgeClassName: 'bg-green-600 text-white',
  },
}

// Fixed forward-only sequence enforced by advance_production_status() in
// the database. Also used to render the workflow order in the UI and to
// compute "what's the next stage" without duplicating the rule client-side.
export const PRODUCTION_STATUS_ORDER = [
  'accepted',
  'copyediting',
  'metadata_verification',
  'ready_for_typesetting',
  'typesetting',
  'author_proof',
  'final_proof_approval',
  'publication_ready',
]

export function productionStatusLabel(status) {
  return PRODUCTION_STATUS_META[status]?.label ?? status
}

export function productionStatusBadgeClassName(status) {
  return PRODUCTION_STATUS_META[status]?.badgeClassName ?? 'bg-slate-100 text-slate-600'
}

/** The next status in the fixed sequence, or null if already at the final stage. */
export function nextProductionStatus(status) {
  const index = PRODUCTION_STATUS_ORDER.indexOf(status)
  if (index === -1 || index === PRODUCTION_STATUS_ORDER.length - 1) return null
  return PRODUCTION_STATUS_ORDER[index + 1]
}

// Human label for the action that advances OUT of a given status, e.g.
// shown on the "Quick Actions" button in the dashboard/detail page.
export const ADVANCE_ACTION_LABEL = {
  accepted: 'Start Copyediting',
  copyediting: 'Complete Copyediting',
  metadata_verification: 'Mark Ready For Typesetting',
  ready_for_typesetting: 'Start Typesetting',
  typesetting: 'Issue Author Proof',
  author_proof: 'Approve Final Proof',
  final_proof_approval: 'Mark Publication Ready',
}

// Dashboard filter chips, in workflow order.
export const PRODUCTION_STATUS_FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'accepted', label: 'Accepted' },
  { key: 'copyediting', label: 'Copyediting' },
  { key: 'metadata_verification', label: 'Metadata Verification' },
  { key: 'ready_for_typesetting', label: 'Ready For Typesetting' },
  { key: 'typesetting', label: 'Typesetting' },
  { key: 'author_proof', label: 'Author Proof' },
  { key: 'proof_corrections', label: 'Proof Corrections' },
  { key: 'final_proof_approval', label: 'Final Proof Approval' },
  { key: 'publication_ready', label: 'Publication Ready' },
]

// production_events.event_type -> human-readable timeline label.
export const PRODUCTION_EVENT_LABELS = {
  entered_production: 'Entered Production',
  staff_assigned: 'Production Staff Assigned',
  copyediting_started: 'Copyediting Started',
  copyediting_completed: 'Copyediting Completed',
  metadata_updated: 'Metadata Updated',
  metadata_verified: 'Metadata Verified',
  metadata_unverified: 'Metadata Verification Reset',
  ready_for_typesetting: 'Ready For Typesetting',
  typesetting_started: 'Typesetting Started',
  proof_created: 'Proof Version Created',
  author_proof_issued: 'Author Proof Issued',
  proof_corrections_requested: 'Proof Corrections Requested',
  final_proof_approved: 'Final Proof Approved',
  publication_ready: 'Publication Ready',
  returned_to_typesetting: 'Returned to Typesetting',
}

export function productionEventLabel(eventType) {
  return PRODUCTION_EVENT_LABELS[eventType] ?? eventType
}
