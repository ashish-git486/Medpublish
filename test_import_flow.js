// Test script to simulate the import flow and check file association
// This will help us understand if the file association is being lost

import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY

const supabase = createClient(supabaseUrl, supabaseAnonKey)

async function testImportFlow() {
  console.log('=== TESTING IMPORT FLOW ===')
  console.log()

  // 1. Check if there are any DRAFT publications
  console.log('1. Checking for DRAFT publications...')
  const { data: drafts, error: draftsError } = await supabase
    .from('publications')
    .select('*')
    .eq('publication_status', 'draft')

  if (draftsError) {
    console.log('   Error:', draftsError)
  } else {
    console.log(`   Found ${drafts.length} draft publications`)
    drafts.forEach((draft, i) => {
      console.log(`   Draft [${i + 1}]:`)
      console.log(`   - ID: ${draft.id}`)
      console.log(`   - Title: ${draft.title?.substring(0, 40)}...`)
      console.log(`   - Created: ${draft.created_at}`)
    })
  }
  console.log()

  // 2. For each draft, check if it has publication_files
  if (drafts && drafts.length > 0) {
    console.log('2. Checking publication_files for each draft...')
    for (const draft of drafts) {
      const { data: file, error: fileError } = await supabase
        .from('publication_files')
        .select('*')
        .eq('publication_id', draft.id)
        .maybeSingle()

      console.log(`   Draft ${draft.id.substring(0, 8)}...:`)
      if (fileError) {
        console.log(`   - Error checking file: ${fileError.message}`)
      } else if (file) {
        console.log(`   - ✓ Has publication_files row`)
        console.log(`   - File name: ${file.file_name}`)
        console.log(`   - Storage path: ${file.storage_path}`)
      } else {
        console.log(`   - ✗ NO publication_files row (THIS IS THE BUG)`)
      }
    }
    console.log()
  }

  // 3. Check all publication_files and see which publications they belong to
  console.log('3. Checking all publication_files and their publication status...')
  const { data: allFiles, error: allFilesError } = await supabase
    .from('publication_files')
    .select('*')

  if (allFilesError) {
    console.log('   Error:', allFilesError)
  } else {
    console.log(`   Found ${allFiles.length} publication_files rows`)
    for (const file of allFiles) {
      const { data: pub, error: pubError } = await supabase
        .from('publications')
        .select('id, title, publication_status')
        .eq('id', file.publication_id)
        .maybeSingle()

      console.log(`   File: ${file.file_name}`)
      console.log(`   - Publication ID: ${file.publication_id}`)
      if (pubError) {
        console.log(`   - ✗ Publication NOT FOUND (orphaned file)`)
      } else {
        console.log(`   - Publication status: ${pub.publication_status}`)
        console.log(`   - Publication title: ${pub.title?.substring(0, 30)}...`)
      }
    }
  }
  console.log()

  // 4. Check storage objects
  console.log('4. Checking storage objects...')
  try {
    const { data: storageObjects, error: storageError } = await supabase
      .storage
      .from('publications')
      .list('', { limit: 100 })

    if (storageError) {
      console.log('   Error:', storageError)
    } else {
      console.log(`   Found ${storageObjects.length} storage objects/folders`)
      for (const obj of storageObjects) {
        console.log(`   - ${obj.name}`)
      }
    }
  } catch (e) {
    console.log('   Error accessing storage:', e)
  }
  console.log()

  // 5. Check recent publication_events
  console.log('5. Checking recent publication_events...')
  const { data: events, error: eventsError } = await supabase
    .from('publication_events')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(10)

  if (eventsError) {
    console.log('   Error:', eventsError)
  } else {
    console.log(`   Found ${events.length} recent events`)
    events.forEach(event => {
      console.log(`   - ${event.event_type}: ${event.note} (${event.created_at})`)
    })
  }
}

testImportFlow().catch(console.error)
