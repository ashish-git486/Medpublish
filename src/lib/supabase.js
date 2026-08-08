// Single shared Supabase client for the whole app.
//
// Every module that needs to talk to Supabase (auth, profiles, manuscripts)
// should import `supabase` from here rather than creating its own client.
//
// Configuration comes from Vite environment variables so no secrets are
// ever hardcoded in source. See .env.example for the variable names and
// SUPABASE_SETUP.md for how to obtain them from the Supabase dashboard.
//
// IMPORTANT: only the public "anon" key belongs here. The service-role key
// must never be used in frontend code — it bypasses Row Level Security.

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  // Fail loudly in development rather than silently falling back to any
  // other storage mechanism. See PROJECT_CONTEXT / SUPABASE_SETUP.md.
  console.error(
    'MedPublish: missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY. ' +
      'Copy .env.example to .env.local and fill in your Supabase project values.',
  )
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
})
