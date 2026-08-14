// Profile Service for MedPublish
//
// This service handles all author profile operations including:
// - Profile CRUD operations
// - Profile completeness calculation
// - Author manuscript summary
// - Author action items
// - Professional information management
//
// Every function returns { data, error } for proper error handling.

import { supabase } from '../lib/supabase.js'

// =========================================================================
// PROFILE OPERATIONS
// =========================================================================

/**
 * Get the current user's profile
 */
export async function getMyProfile() {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { data: null, error: new Error('User not authenticated') }
  }

  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .maybeSingle()

  if (error) {
    console.error('MedPublish: failed to get profile', error)
    return { data: null, error }
  }

  return { data, error: null }
}

/**
 * Update the current user's profile
 */
export async function updateMyProfile(profileData) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { data: null, error: new Error('User not authenticated') }
  }

  const { data, error } = await supabase
    .from('profiles')
    .upsert({
      id: user.id,
      full_name: profileData.fullName,
      email: user.email,
      phone: profileData.phone || null,
      country: profileData.country || null,
      city: profileData.city || null,
      postal_address: profileData.postalAddress || null,
      designation: profileData.designation || null,
      department: profileData.department || null,
      institution: profileData.institution || null,
      orcid: profileData.orcid || null,
      bio: profileData.bio || null,
      website_url: profileData.websiteUrl || null,
      avatar_url: profileData.avatarUrl || null,
    })
    .select()
    .single()

  if (error) {
    console.error('MedPublish: failed to update profile', error)
    return { data: null, error }
  }

  return { data, error: null }
}

/**
 * Get profile by user ID (for viewing other authors' profiles)
 */
export async function getProfileById(userId) {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, full_name, email, avatar_url, role, institution, designation, department, country, city, orcid, bio, website_url')
    .eq('id', userId)
    .maybeSingle()

  if (error) {
    console.error('MedPublish: failed to get profile by ID', error)
    return { data: null, error }
  }

  return { data, error: null }
}

// =========================================================================
// PROFILE COMPLETENESS
// =========================================================================

/**
 * Get profile completeness information for the current user
 */
export async function getProfileCompleteness() {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { data: null, error: new Error('User not authenticated') }
  }

  const { data, error } = await supabase.rpc('get_profile_completeness', {
    p_user_id: user.id
  })

  if (error) {
    console.error('MedPublish: failed to get profile completeness', error)
    return { data: null, error }
  }

  return { data, error: null }
}

// =========================================================================
// AUTHOR MANUSCRIPT SUMMARY
// =========================================================================

/**
 * Get comprehensive manuscript summary for the current user
 * Includes manuscripts where they are submitting author or co-author
 */
export async function getAuthorManuscriptSummary() {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { data: null, error: new Error('User not authenticated') }
  }

  const { data, error } = await supabase.rpc('get_author_manuscript_summary', {
    p_user_id: user.id
  })

  if (error) {
    console.error('MedPublish: failed to get author manuscript summary', error)
    return { data: null, error }
  }

  // The function returns a jsonb object with two arrays
  // Return it as-is for the component to use
  return { data, error: null }
}

/**
 * Get manuscripts where the user is the submitting author
 */
export async function getMyManuscripts() {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { data: null, error: new Error('User not authenticated') }
  }

  const { data, error } = await supabase
    .from('manuscripts')
    .select('id, title, status, article_type, category, submitted_at, updated_at')
    .eq('submitting_author_id', user.id)
    .order('updated_at', { ascending: false })

  if (error) {
    console.error('MedPublish: failed to get my manuscripts', error)
    return { data: null, error }
  }

  return { data, error: null }
}

/**
 * Get manuscripts where the user is a co-author
 */
export async function getCoAuthorManuscripts() {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { data: null, error: new Error('User not authenticated') }
  }

  const { data, error } = await supabase
    .from('manuscript_authors')
    .select(`
      manuscript_id,
      author_order,
      is_corresponding_author,
      manuscripts!inner (
        id, title, status, article_type, category, submitted_at, updated_at
      )
    `)
    .eq('profile_id', user.id)
    .eq('invitation_status', 'accepted')

  if (error) {
    console.error('MedPublish: failed to get co-author manuscripts', error)
    return { data: null, error }
  }

  return { data, error: null }
}

// =========================================================================
// AUTHOR ACTION ITEMS
// =========================================================================

/**
 * Get all action items requiring the author's attention
 * Includes revision requests, proof reviews, co-author invitations, etc.
 */
export async function getAuthorActionItems() {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { data: null, error: new Error('User not authenticated') }
  }

  const { data, error } = await supabase.rpc('get_author_action_items', {
    p_user_id: user.id
  })

  if (error) {
    console.error('MedPublish: failed to get author action items', error)
    return { data: null, error }
  }

  return { data, error: null }
}

/**
 * Get pending revision requests for the current user
 */
export async function getPendingRevisionRequests() {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { data: null, error: new Error('User not authenticated') }
  }

  const { data, error } = await supabase
    .from('revision_requests')
    .select(`
      id,
      revision_type,
      deadline,
      status,
      manuscripts (
        id, title
      ),
      editor_decisions (
        decision_letter
      )
    `)
    .eq('status', 'pending')
    .in('manuscript_id', 
      supabase.from('manuscripts').select('id').eq('submitting_author_id', user.id)
    )

  if (error) {
    console.error('MedPublish: failed to get pending revision requests', error)
    return { data: null, error }
  }

  return { data, error: null }
}

/**
 * Get manuscripts requiring proof review
 */
export async function getProofReviewManuscripts() {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { data: null, error: new Error('User not authenticated') }
  }

  const { data, error } = await supabase
    .from('manuscript_production')
    .select(`
      manuscript_id,
      production_status,
      current_proof_version_id,
      manuscripts!inner (
        id, title
      ),
      proof_versions (
        version_number, uploaded_at
      )
    `)
    .eq('manuscripts.submitting_author_id', user.id)
    .in('production_status', ['author_proof', 'proof_corrections', 'final_proof_approval'])

  if (error) {
    console.error('MedPublish: failed to get proof review manuscripts', error)
    return { data: null, error }
  }

  return { data, error: null }
}

// =========================================================================
// CO-AUTHOR INVITATIONS
// =========================================================================

/**
 * Get pending co-author invitations for the current user
 */
export async function getMyCoAuthorInvitations() {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { data: null, error: new Error('User not authenticated') }
  }

  const { data, error } = await supabase
    .from('manuscript_authors')
    .select(`
      id,
      manuscript_id,
      invitation_sent_at,
      invitation_expires_at,
      manuscripts (
        id, title, submitting_author_id
      )
    `)
    .eq('email', user.email)
    .eq('invitation_status', 'invited')
    .gt('invitation_expires_at', new Date().toISOString())

  if (error) {
    console.error('MedPublish: failed to get co-author invitations', error)
    return { data: null, error }
  }

  return { data, error: null }
}

// =========================================================================
// PUBLICATIONS
// =========================================================================

/**
 * Get published manuscripts where the user is an author
 */
export async function getMyPublications() {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { data: null, error: new Error('User not authenticated') }
  }

  // Get manuscripts where user is submitting author and published
  const { data: submittingAuthorData, error: submittingError } = await supabase
    .from('manuscripts')
    .select('id, title, category, article_type, reviewed_at, updated_at')
    .eq('submitting_author_id', user.id)
    .eq('status', 'published')
    .order('reviewed_at', { ascending: false })

  if (submittingError) {
    console.error('MedPublish: failed to get my publications (submitting author)', submittingError)
    return { data: null, error: submittingError }
  }

  // Get manuscripts where user is co-author and published
  const { data: coAuthorData, error: coAuthorError } = await supabase
    .from('manuscript_authors')
    .select(`
      author_order,
      is_corresponding_author,
      manuscripts!inner (
        id, title, category, article_type, reviewed_at, updated_at
      )
    `)
    .eq('profile_id', user.id)
    .eq('invitation_status', 'accepted')
    .eq('manuscripts.status', 'published')

  if (coAuthorError) {
    console.error('MedPublish: failed to get my publications (co-author)', coAuthorError)
    return { data: null, error: coAuthorError }
  }

  // Combine results
  const publications = [
    ...(submittingAuthorData || []).map(m => ({
      ...m,
      role: 'submitting_author',
      is_corresponding_author: true,
      author_order: 1
    })),
    ...(coAuthorData || []).map(m => ({
      ...m.manuscripts,
      role: 'co_author',
      is_corresponding_author: m.is_corresponding_author,
      author_order: m.author_order
    }))
  ]

  return { data: publications, error: null }
}

// =========================================================================
// UTILITY FUNCTIONS
// =========================================================================

/**
 * Validate ORCID format (basic check)
 */
export function validateORCID(orcid) {
  if (!orcid) return { valid: true, error: null }
  
  const orcidPattern = /^\d{4}-\d{4}-\d{4}-\d{4}$/
  if (!orcidPattern.test(orcid)) {
    return { 
      valid: false, 
      error: 'ORCID must be in format: 0000-0000-0000-0000' 
    }
  }
  
  return { valid: true, error: null }
}

/**
 * Validate website URL format
 */
export function validateWebsiteUrl(url) {
  if (!url) return { valid: true, error: null }
  
  try {
    new URL(url)
    return { valid: true, error: null }
  } catch {
    return { 
      valid: false, 
      error: 'Website URL must be a valid URL (e.g., https://example.com)' 
    }
  }
}

/**
 * Format profile data for display
 */
export function formatProfileForDisplay(profile) {
  if (!profile) return null

  return {
    id: profile.id,
    fullName: profile.full_name,
    email: profile.email,
    avatarUrl: profile.avatar_url,
    role: profile.role,
    institution: profile.institution,
    phone: profile.phone,
    country: profile.country,
    city: profile.city,
    postalAddress: profile.postal_address,
    designation: profile.designation,
    department: profile.department,
    orcid: profile.orcid,
    bio: profile.bio,
    websiteUrl: profile.website_url,
    createdAt: profile.created_at,
    updatedAt: profile.updated_at,
  }
}