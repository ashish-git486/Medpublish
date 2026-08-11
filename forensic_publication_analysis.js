// Forensic analysis script for publication lifecycle comparison
// Run with: node forensic_publication_analysis.js

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

async function runForensicAnalysis() {
  console.log('=== FORENSIC PUBLICATION ANALYSIS ===')
  console.log('Supabase URL:', supabaseUrl)
  console.log()

  // Check auth first
  console.log('0. Checking auth status...')
  const { data: { session }, error: sessionError } = await supabase.auth.getSession()
  if (sessionError) {
    console.log('   Error getting session:', sessionError)
  } else if (session) {
    console.log('   ✓ Authenticated as:', session.user.email)
    console.log('   User ID:', session.user.id)
  } else {
    console.log('   ✗ Not authenticated - attempting to continue with anon key...')
  }
  console.log()

  // Get ALL publications with their file associations
  console.log('1. Querying ALL publications with file associations...')
  const { data: allPubs, error: pubsError } = await supabase
    .from('publications')
    .select(`
      id,
      title,
      publication_status,
      source_type,
      created_at,
      publication_files (
        id,
        file_name,
        storage_path,
        uploaded_at
      )
    `)
    .order('created_at', { ascending: false })

  if (pubsError) {
    console.log('   Error querying publications:', pubsError)
    return
  }

  console.log(`   Found ${allPubs.length} publications total`)
  console.log()

  // Group by status
  const drafts = allPubs.filter(p => p.publication_status === 'draft')
  const published = allPubs.filter(p => p.publication_status === 'published')

  console.log('=== DRAFT PUBLICATIONS ===')
  if (drafts.length === 0) {
    console.log('   No draft publications found')
  } else {
    drafts.forEach((pub, i) => {
      console.log(`\n   DRAFT [${i + 1}/${drafts.length}]:`)
      console.log(`   ID: ${pub.id}`)
      console.log(`   Title: ${pub.title?.substring(0, 50)}...`)
      console.log(`   Source: ${pub.source_type}`)
      console.log(`   Created: ${pub.created_at}`)
      console.log(`   Has publication_files row: ${pub.publication_files && pub.publication_files.length > 0 ? 'YES' : 'NO'}`)
      if (pub.publication_files && pub.publication_files.length > 0) {
        pub.publication_files.forEach(pf => {
          console.log(`     - File ID: ${pf.id}`)
          console.log(`     - File name: ${pf.file_name}`)
          console.log(`     - Storage path: ${pf.storage_path}`)
          console.log(`     - Uploaded: ${pf.uploaded_at}`)
        })
      }
    })
  }

  console.log('\n=== PUBLISHED PUBLICATIONS ===')
  if (published.length === 0) {
    console.log('   No published publications found')
  } else {
    published.forEach((pub, i) => {
      console.log(`\n   PUBLISHED [${i + 1}/${published.length}]:`)
      console.log(`   ID: ${pub.id}`)
      console.log(`   Title: ${pub.title?.substring(0, 50)}...`)
      console.log(`   Source: ${pub.source_type}`)
      console.log(`   Created: ${pub.created_at}`)
      console.log(`   Has publication_files row: ${pub.publication_files && pub.publication_files.length > 0 ? 'YES' : 'NO'}`)
      if (pub.publication_files && pub.publication_files.length > 0) {
        pub.publication_files.forEach(pf => {
          console.log(`     - File ID: ${pf.id}`)
          console.log(`     - File name: ${pf.file_name}`)
          console.log(`     - Storage path: ${pf.storage_path}`)
          console.log(`     - Uploaded: ${pf.uploaded_at}`)
        })
      }
    })
  }

  console.log('\n=== ALL PUBLICATION_FILES ROWS ===')
  const { data: allFiles, error: filesError } = await supabase
    .from('publication_files')
    .select('*')
    .order('uploaded_at', { ascending: false })

  if (filesError) {
    console.log('   Error querying publication_files:', filesError)
  } else {
    console.log(`   Found ${allFiles.length} publication_files rows`)
    allFiles.forEach((file, i) => {
      console.log(`\n   FILE [${i + 1}/${allFiles.length}]:`)
      console.log(`   ID: ${file.id}`)
      console.log(`   Publication ID: ${file.publication_id}`)
      console.log(`   File name: ${file.file_name}`)
      console.log(`   Storage path: ${file.storage_path}`)
      console.log(`   Uploaded: ${file.uploaded_at}`)
    })
  }

  console.log('\n=== STORAGE OBJECTS IN PUBLICATIONS BUCKET ===')
  try {
    const { data: storageObjects, error: storageError } = await supabase
      .storage
      .from('publications')
      .list('', { limit: 100 })

    if (storageError) {
      console.log('   Error listing storage objects:', storageError)
    } else {
      console.log(`   Found ${storageObjects.length} objects/folders in publications bucket`)
      storageObjects.forEach((obj, i) => {
        console.log(`\n   STORAGE [${i + 1}/${storageObjects.length}]:`)
        console.log(`   Name: ${obj.name}`)
        console.log(`   Type: ${obj.metadata?.mimetype || 'unknown'}`)
        console.log(`   Size: ${obj.metadata?.size || 'unknown'}`)
      })
    }
  } catch (storageError) {
    console.log('   Error accessing storage:', storageError)
  }

  console.log('\n=== PUBLICATION EVENTS ===')
  const { data: allEvents, error: eventsError } = await supabase
    .from('publication_events')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(20)

  if (eventsError) {
    console.log('   Error querying publication_events:', eventsError)
  } else {
    console.log(`   Found ${allEvents.length} recent events`)
    allEvents.forEach((event, i) => {
      console.log(`\n   EVENT [${i + 1}/${allEvents.length}]:`)
      console.log(`   Publication ID: ${event.publication_id}`)
      console.log(`   Event type: ${event.event_type}`)
      console.log(`   Actor ID: ${event.actor_id}`)
      console.log(`   Note: ${event.note}`)
      console.log(`   Created: ${event.created_at}`)
    })
  }

  console.log('\n=== ANALYSIS COMPLETE ===')
  console.log('Key findings to investigate:')
  console.log('1. Draft publications without publication_files rows')
  console.log('2. Published publications without publication_files rows')
  console.log('3. publication_files rows with publication_id that dont match any publication')
  console.log('4. Storage objects without corresponding publication_files rows')
}

runForensicAnalysis().catch(console.error)
