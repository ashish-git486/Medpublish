// Diagnostic script to check publication_files for specific publication
// Run with: node diagnostic_publication_check.js

import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

// Load environment variables
dotenv.config({ path: '.env.local' })

const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY in .env.local')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseAnonKey)

const publicationId = '7f093845-bab1-4e74-ba2a-e3d588f4d751'

async function runDiagnostics() {
  console.log('=== Publication File Diagnostics ===')
  console.log('Publication ID:', publicationId)
  console.log('Supabase URL:', supabaseUrl)
  console.log('Supabase Anon Key (first 20 chars):', supabaseAnonKey.substring(0, 20) + '...')
  console.log()

  // First, let's check the auth session
  console.log('0. Checking auth session...')
  const { data: { session }, error: sessionError } = await supabase.auth.getSession()
  if (sessionError) {
    console.log('   Error getting session:', sessionError)
  } else if (session) {
    console.log('   ✓ Authenticated as:', session.user.email)
    console.log('   User ID:', session.user.id)
  } else {
    console.log('   ✗ Not authenticated')
  }
  console.log()

  // 1. Check if publication exists
  console.log('1. Checking if publication exists...')
  const { data: publication, error: pubError } = await supabase
    .from('publications')
    .select('*')
    .eq('id', publicationId)
    .single()

  if (pubError) {
    console.log('   Error fetching publication:', pubError)
  } else if (publication) {
    console.log('   ✓ Publication found')
    console.log('   - Title:', publication.title?.substring(0, 50))
    console.log('   - Status:', publication.publication_status)
    console.log('   - Source:', publication.source_type)
    console.log('   - Created:', publication.created_at)
  } else {
    console.log('   ✗ Publication NOT found')
  }
  console.log()

  // 2. Check if publication_files row exists
  console.log('2. Checking if publication_files row exists...')
  const { data: file, error: fileError } = await supabase
    .from('publication_files')
    .select('*')
    .eq('publication_id', publicationId)
    .maybeSingle()

  if (fileError) {
    console.log('   Error fetching file:', fileError)
  } else if (file) {
    console.log('   ✓ publication_files row found')
    console.log('   - File ID:', file.id)
    console.log('   - File name:', file.file_name)
    console.log('   - Storage path:', file.storage_path)
    console.log('   - Uploaded:', file.uploaded_at)
  } else {
    console.log('   ✗ publication_files row NOT found (this is the problem!)')
  }
  console.log()

  // 3. Check publication events
  console.log('3. Checking publication events...')
  const { data: events, error: eventsError } = await supabase
    .from('publication_events')
    .select('*')
    .eq('publication_id', publicationId)
    .order('created_at', { ascending: true })

  if (eventsError) {
    console.log('   Error fetching events:', eventsError)
  } else {
    console.log(`   ✓ Found ${events.length} events:`)
    events.forEach(event => {
      console.log(`   - ${event.event_type}: ${event.note} (${event.created_at})`)
    })
  }
  console.log()

  // 4. Check total publication_files count
  console.log('4. Checking total publication_files count...')
  const { count, error: countError } = await supabase
    .from('publication_files')
    .select('*', { count: 'exact', head: true })

  if (countError) {
    console.log('   Error counting files:', countError)
  } else {
    console.log(`   Total publication_files rows: ${count}`)
  }
  console.log()

  // 5. Check recent publications and their file status using direct query
  console.log('5. Checking all publications (direct query)...')
  const { data: allPubs, error: allPubsError } = await supabase
    .from('publications')
    .select('*')
    .order('created_at', { ascending: false })

  if (allPubsError) {
    console.log('   Error fetching all publications:', allPubsError)
  } else {
    console.log(`   Total publications: ${allPubs.length}`)
    if (allPubs.length > 0) {
      console.log(`   All publications:`)
      allPubs.forEach(pub => {
        console.log(`   - ID: ${pub.id}`)
        console.log(`     Title: ${pub.title?.substring(0, 50)}`)
        console.log(`     Status: ${pub.publication_status}`)
        console.log(`     Created: ${pub.created_at}`)
      })
    }
  }
  console.log()

  // 6. Try to get publications using the admin RPC
  console.log('6. Checking using get_published_publications RPC...')
  const { data: publishedPubs, error: rpcError } = await supabase
    .rpc('get_published_publications')

  if (rpcError) {
    console.log('   Error calling RPC:', rpcError)
  } else {
    console.log(`   Published publications via RPC: ${publishedPubs.length}`)
    if (publishedPubs.length > 0) {
      publishedPubs.forEach(pub => {
        console.log(`   - ${pub.id.substring(0, 8)}...: ${pub.title?.substring(0, 30)}`)
      })
    }
  }
}

runDiagnostics().catch(console.error)
