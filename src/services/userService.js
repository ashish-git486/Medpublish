// Editor/admin-only user management: currently just reviewer-role grants.
//
// This is the ONLY module that should call the `set_user_role` RPC. It
// deliberately does not expose a general "update anyone's profile"
// function — only the narrow role-grant path the database function
// itself allows (see supabase/migrations/0003_peer_review.sql).

import { supabase } from '../lib/supabase.js'

/** Find a profile by email, for the "grant reviewer role" lookup. */
export async function findProfileByEmail(email) {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, full_name, email, role')
    .ilike('email', email.trim())
    .maybeSingle()

  return { data, error }
}

/**
 * Change a user's role via the `set_user_role` database function.
 * The function itself re-checks that the CALLER is an editor/admin
 * server-side, so this is safe even though it's called from the client.
 */
export async function setUserRole(targetUserId, newRole) {
  const { error } = await supabase.rpc('set_user_role', {
    target_user_id: targetUserId,
    new_role: newRole,
  })

  return { error }
}

/** Convenience wrapper used by the "Grant Reviewer Role" admin panel. */
export async function promoteToReviewer(email) {
  const { data: profile, error: lookupError } = await findProfileByEmail(email)

  if (lookupError) return { data: null, error: lookupError }
  if (!profile) {
    return { data: null, error: new Error(`No user found with email "${email}"`) }
  }
  if (profile.role === 'reviewer') {
    return { data: profile, error: new Error(`${profile.email} is already a reviewer.`) }
  }

  const { error } = await setUserRole(profile.id, 'reviewer')
  if (error) return { data: null, error }

  return { data: { ...profile, role: 'reviewer' }, error: null }
}
