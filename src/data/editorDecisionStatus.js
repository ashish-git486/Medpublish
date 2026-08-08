// Shared display metadata for post-peer-review editorial decisions
// (editor_decisions.decision). Mirrors the pattern in reviewStatus.js so the
// editor's decision panel, the decision history list, and the author-facing
// revision request page never disagree about labels or colors.

export const DECISION_META = {
  accept: {
    label: 'Accept',
    badgeClassName: 'bg-teal-100 text-teal-700',
    buttonClassName: 'bg-teal-700 text-white hover:bg-teal-800',
    confirmCopy: 'Accept this manuscript for publication?',
  },
  minor_revision: {
    label: 'Minor Revision',
    badgeClassName: 'border border-gold-500 bg-white text-gold-600',
    buttonClassName: 'border border-gold-500 text-gold-600 hover:bg-gold-500/10',
    confirmCopy: 'Request a minor revision from the author?',
  },
  major_revision: {
    label: 'Major Revision',
    badgeClassName: 'border border-gold-500 bg-white text-gold-600',
    buttonClassName: 'border border-gold-500 text-gold-600 hover:bg-gold-500/10',
    confirmCopy: 'Request a major revision from the author?',
  },
  reject: {
    label: 'Reject',
    badgeClassName: 'bg-red-50 text-red-600',
    buttonClassName: 'border border-red-300 text-red-600 hover:bg-red-50',
    confirmCopy: 'Reject this manuscript? This decision is final.',
  },
}

export function decisionLabel(decision) {
  return DECISION_META[decision]?.label ?? decision
}

export function decisionBadgeClassName(decision) {
  return DECISION_META[decision]?.badgeClassName ?? 'bg-slate-100 text-slate-600'
}

// Revision type ('minor' | 'major' on revision_requests.revision_type) uses
// the same labels/colors as the matching decision.
export function revisionTypeLabel(revisionType) {
  return revisionType === 'minor' ? 'Minor Revision' : 'Major Revision'
}

export function revisionTypeBadgeClassName() {
  return DECISION_META.minor_revision.badgeClassName
}
