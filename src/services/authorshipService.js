// Authorship Service for MedPublish
//
// This service handles all manuscript authorship operations including:
// - Adding/updating/removing authors
// - Managing author affiliations
// - Handling co-author invitations
// - Tracking author contributions
// - Author order management
// - Corresponding author designation
//
// Every function returns { data, error } for proper error handling.

import { supabase } from '../lib/supabase.js'

// =========================================================================
// AUTHOR OPERATIONS
// =========================================================================

/**
 * Get all authors for a manuscript with their affiliations and contributions
 */
export async function getManuscriptAuthors(manuscriptId) {
  const { data, error } = await supabase.rpc('get_manuscript_authors', {
    p_manuscript_id: manuscriptId
  })

  if (error) {
    console.error('MedPublish: failed to get manuscript authors', error)
    return { data: null, error }
  }

  return { data, error: null }
}

/**
 * Add a new author to a manuscript
 */
export async function addManuscriptAuthor(manuscriptId, authorData) {
  const { data, error } = await supabase.rpc('add_manuscript_author', {
    p_manuscript_id: manuscriptId,
    p_first_name: authorData.firstName,
    p_middle_name: authorData.middleName || null,
    p_last_name: authorData.lastName,
    p_email: authorData.email,
    p_orcid: authorData.orcid || null,
    p_author_order: authorData.authorOrder,
    p_is_corresponding_author: authorData.isCorrespondingAuthor || false,
    p_is_submitting_author: authorData.isSubmittingAuthor || false,
    p_profile_id: authorData.profileId || null
  })

  if (error) {
    console.error('MedPublish: failed to add manuscript author', error)
    return { data: null, error }
  }

  return { data, error: null }
}

/**
 * Update an existing author's information
 */
export async function updateManuscriptAuthor(authorId, authorData) {
  const { data, error } = await supabase.rpc('update_manuscript_author', {
    p_author_id: authorId,
    p_first_name: authorData.firstName,
    p_middle_name: authorData.middleName || null,
    p_last_name: authorData.lastName,
    p_email: authorData.email,
    p_orcid: authorData.orcid || null,
    p_author_order: authorData.authorOrder,
    p_is_corresponding_author: authorData.isCorrespondingAuthor
  })

  if (error) {
    console.error('MedPublish: failed to update manuscript author', error)
    return { data: null, error }
  }

  return { data, error: null }
}

/**
 * Remove an author from a manuscript
 */
export async function removeManuscriptAuthor(authorId) {
  const { data, error } = await supabase.rpc('remove_manuscript_author', {
    p_author_id: authorId
  })

  if (error) {
    console.error('MedPublish: failed to remove manuscript author', error)
    return { data: null, error }
  }

  return { data, error: null }
}

/**
 * Reorder authors - updates author_order for multiple authors
 */
export async function reorderManuscriptAuthors(manuscriptId, authorOrders) {
  const updates = authorOrders.map(({ authorId, newOrder }) =>
    supabase.rpc('update_manuscript_author', {
      p_author_id: authorId,
      p_first_name: null, // Will be set by current values
      p_middle_name: null,
      p_last_name: null,
      p_email: null,
      p_orcid: null,
      p_author_order: newOrder,
      p_is_corresponding_author: null // Preserve current value
    })
  )

  const results = await Promise.all(updates)
  const errors = results.filter(r => r.error).map(r => r.error)

  if (errors.length > 0) {
    console.error('MedPublish: failed to reorder authors', errors)
    return { data: null, error: errors[0] }
  }

  return { data: true, error: null }
}

// =========================================================================
// AFFILIATION OPERATIONS
// =========================================================================

/**
 * Get all affiliations for a manuscript
 */
export async function getManuscriptAffiliations(manuscriptId) {
  const { data, error } = await supabase
    .from('manuscript_affiliations')
    .select('*')
    .eq('manuscript_id', manuscriptId)
    .order('created_at', { ascending: true })

  if (error) {
    console.error('MedPublish: failed to get manuscript affiliations', error)
    return { data: null, error }
  }

  return { data, error: null }
}

/**
 * Create a new affiliation for a manuscript
 */
export async function createAffiliation(manuscriptId, affiliationData) {
  const { data, error } = await supabase
    .from('manuscript_affiliations')
    .insert({
      manuscript_id: manuscriptId,
      institution_name: affiliationData.institutionName,
      department: affiliationData.department || null,
      division: affiliationData.division || null,
      city: affiliationData.city || null,
      state_province: affiliationData.stateProvince || null,
      country: affiliationData.country || null,
      postal_code: affiliationData.postalCode || null,
      address: affiliationData.address || null
    })
    .select()
    .single()

  if (error) {
    console.error('MedPublish: failed to create affiliation', error)
    return { data: null, error }
  }

  return { data, error: null }
}

/**
 * Update an existing affiliation
 */
export async function updateAffiliation(affiliationId, affiliationData) {
  const { data, error } = await supabase
    .from('manuscript_affiliations')
    .update({
      institution_name: affiliationData.institutionName,
      department: affiliationData.department || null,
      division: affiliationData.division || null,
      city: affiliationData.city || null,
      state_province: affiliationData.stateProvince || null,
      country: affiliationData.country || null,
      postal_code: affiliationData.postalCode || null,
      address: affiliationData.address || null
    })
    .eq('id', affiliationId)
    .select()
    .single()

  if (error) {
    console.error('MedPublish: failed to update affiliation', error)
    return { data: null, error }
  }

  return { data, error: null }
}

/**
 * Assign an affiliation to an author
 */
export async function assignAuthorAffiliation(authorId, affiliationId) {
  const { data, error } = await supabase
    .from('manuscript_author_affiliations')
    .insert({
      author_id: authorId,
      affiliation_id: affiliationId
    })
    .select()
    .single()

  if (error) {
    console.error('MedPublish: failed to assign author affiliation', error)
    return { data: null, error }
  }

  return { data, error: null }
}

/**
 * Remove an affiliation from an author
 */
export async function removeAuthorAffiliation(authorId, affiliationId) {
  const { data, error } = await supabase
    .from('manuscript_author_affiliations')
    .delete()
    .eq('author_id', authorId)
    .eq('affiliation_id', affiliationId)

  if (error) {
    console.error('MedPublish: failed to remove author affiliation', error)
    return { data: null, error }
  }

  return { data, error: null }
}

// =========================================================================
// CO-AUTHOR INVITATION OPERATIONS
// =========================================================================

/**
 * Invite a co-author to a manuscript
 */
export async function inviteCoAuthor(manuscriptId, email) {
  const { data, error } = await supabase.rpc('invite_co_author', {
    p_manuscript_id: manuscriptId,
    p_email: email
  })

  if (error) {
    console.error('MedPublish: failed to invite co-author', error)
    return { data: null, error }
  }

  return { data: { token: data }, error: null }
}

/**
 * Accept a co-author invitation
 */
export async function acceptCoAuthorInvitation(token, authorData) {
  const { data, error } = await supabase.rpc('accept_co_author_invitation', {
    p_invitation_token: token,
    p_first_name: authorData.firstName,
    p_middle_name: authorData.middleName || null,
    p_last_name: authorData.lastName,
    p_orcid: authorData.orcid || null
  })

  if (error) {
    console.error('MedPublish: failed to accept co-author invitation', error)
    return { data: null, error }
  }

  return { data: { authorId: data }, error: null }
}

/**
 * Get pending invitations for the current user
 */
export async function getMyPendingInvitations() {
  const { data, error } = await supabase
    .from('manuscript_authors')
    .select(`
      *,
      manuscripts (
        id,
        title,
        submitting_author_id
      )
    `)
    .eq('email', supabase.auth.user()?.email)
    .eq('invitation_status', 'invited')
    .gt('invitation_expires_at', new Date().toISOString())

  if (error) {
    console.error('MedPublish: failed to get pending invitations', error)
    return { data: null, error }
  }

  return { data, error: null }
}

// =========================================================================
// AUTHOR CONTRIBUTION OPERATIONS
// =========================================================================

/**
 * Set contribution types for an author
 */
export async function setAuthorContributions(authorId, contributionTypes) {
  const { data, error } = await supabase.rpc('set_author_contributions', {
    p_author_id: authorId,
    p_contribution_types: contributionTypes
  })

  if (error) {
    console.error('MedPublish: failed to set author contributions', error)
    return { data: null, error }
  }

  return { data, error: null }
}

/**
 * Get contributions for a specific author
 */
export async function getAuthorContributions(authorId) {
  const { data, error } = await supabase
    .from('author_contributions')
    .select('contribution_type')
    .eq('author_id', authorId)

  if (error) {
    console.error('MedPublish: failed to get author contributions', error)
    return { data: null, error }
  }

  const contributionTypes = data?.map(c => c.contribution_type) || []
  return { data: contributionTypes, error: null }
}

// =========================================================================
// AUTHORSHIP CHANGE LOG
// =========================================================================

/**
 * Get authorship change history for a manuscript
 */
export async function getAuthorshipChangeLog(manuscriptId) {
  const { data, error } = await supabase
    .from('authorship_change_log')
    .select('*')
    .eq('manuscript_id', manuscriptId)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('MedPublish: failed to get authorship change log', error)
    return { data: null, error }
  }

  return { data, error: null }
}

// =========================================================================
// UTILITY FUNCTIONS
// =========================================================================

/**
 * Backfill existing manuscripts with structured authorship data
 * (Uses the database function to parse existing text fields)
 */
export async function backfillManuscriptAuthorship(manuscriptId) {
  const { data, error } = await supabase.rpc('backfill_manuscript_authorship', {
    p_manuscript_id: manuscriptId
  })

  if (error) {
    console.error('MedPublish: failed to backfill manuscript authorship', error)
    return { data: null, error }
  }

  return { data, true, error: null }
}

/**
 * Validate author order uniqueness before submission
 */
export async function validateAuthorOrder(manuscriptId, authorOrders) {
  const orders = authorOrders.map(a => a.authorOrder)
  const uniqueOrders = new Set(orders)
  
  if (orders.length !== uniqueOrders.size) {
    return {
      valid: false,
      error: 'Author orders must be unique'
    }
  }

  // Check against existing authors
  const { data: existingAuthors } = await getManuscriptAuthors(manuscriptId)
  if (existingAuthors) {
    const existingOrders = existingAuthors.map(a => a.author_order)
    const conflict = orders.find(order => existingOrders.includes(order))
    if (conflict !== undefined) {
      return {
        valid: false,
        error: `Author order ${conflict} is already in use`
      }
    }
  }

  return { valid: true, error: null }
}

/**
 * Ensure exactly one corresponding author exists
 */
export async function validateCorrespondingAuthor(manuscriptId) {
  const { data: authors } = await getManuscriptAuthors(manuscriptId)
  if (!authors) {
    return { valid: false, error: 'Failed to fetch authors' }
  }

  const correspondingCount = authors.filter(a => a.is_corresponding_author).length
  
  if (correspondingCount === 0) {
    return { valid: false, error: 'At least one corresponding author is required' }
  }
  
  if (correspondingCount > 1) {
    return { valid: false, error: 'Only one corresponding author is allowed' }
  }

  return { valid: true, error: null }
}

/**
 * Safely change the corresponding author for a manuscript
 */
export async function setCorrespondingAuthor(manuscriptId, authorId) {
  const { data, error } = await supabase.rpc('set_corresponding_author', {
    p_manuscript_id: manuscriptId,
    p_new_author_id: authorId
  })

  if (error) {
    console.error('MedPublish: failed to set corresponding author', error)
    return { data: null, error }
  }

  return { data, error: null }
}

/**
 * Check if all authors have confirmed their participation
 */
export async function checkAuthorConfirmationStatus(manuscriptId) {
  const { data: authors } = await getManuscriptAuthors(manuscriptId)
  if (!authors) {
    return { data: null, error: 'Failed to fetch authors' }
  }

  const allConfirmed = authors.every(a => 
    a.invitation_status === 'confirmed' || a.invitation_status === 'accepted'
  )

  const pendingAuthors = authors.filter(a => 
    a.invitation_status === 'pending' || a.invitation_status === 'invited'
  )

  return {
    data: {
      allConfirmed,
      pendingAuthors: pendingAuthors.map(a => ({
        id: a.id,
        firstName: a.first_name,
        lastName: a.last_name,
        email: a.email,
        status: a.invitation_status
      }))
    },
    error: null
  }
}
