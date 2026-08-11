// RLS and relationship investigation
// Run with: node rls_investigation.js

import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY

const supabase = createClient(supabaseUrl, supabaseAnonKey)

const publicationId = 'b765af99-e3db-4637-809b-01c977747465'

async function investigateRLS() {
  console.log('=== RLS AND RELATIONSHIP INVESTIGATION ===')
  console.log('Publication ID:', publicationId)
  console.log()

  // 1. Direct publication query
  console.log('1. Direct publication query...')
  const { data: pub, error: pubError } = await supabase
    .from('publications')
    .select('*')
    .eq('id', publicationId)
    .single()

  if (pubError) {
    console.log('   Error:', pubError)
  } else {
    console.log('   ✓ Publication found')
    console.log('   - ID:', pub.id)
    console.log('   - Title:', pub.title?.substring(0, 50))
    console.log('   - Status:', pub.publication_status)
  }
  console.log()

  // 2. Direct publication_files query
  console.log('2. Direct publication_files query...')
  const { data: file, error: fileError } = await supabase
    .from('publication_files')
    .select('*')
    .eq('publication_id', publicationId)
    .single()

  if (fileError) {
    console.log('   Error:', fileError)
  } else {
    console.log('   ✓ publication_files found')
    console.log('   - ID:', file.id)
    console.log('   - Publication ID:', file.publication_id)
    console.log('   - File name:', file.file_name)
    console.log('   - Storage path:', file.storage_path)
  }
  console.log()

  // 3. Joined query (like Admin Library uses)
  console.log('3. Joined query (publications → publication_files)...')
  const { data: joined, error: joinedError } = await supabase
    .from('publications')
    .select(`
      id,
      title,
      publication_status,
      publication_files (
        id,
        file_name,
        storage_path
      )
    `)
    .eq('id', publicationId)
    .single()

  if (joinedError) {
    console.log('   Error:', joinedError)
  } else {
    console.log('   ✓ Joined query result')
    console.log('   - Publication ID:', joined.id)
    console.log('   - Has publication_files:', joined.publication_files && joined.publication_files.length > 0 ? 'YES' : 'NO')
    if (joined.publication_files && joined.publication_files.length > 0) {
      joined.publication_files.forEach(pf => {
        console.log('     - File ID:', pf.id)
        console.log('     - File name:', pf.file_name)
      })
    }
  }
  console.log()

  // 4. Check if there are ANY publication_files rows
  console.log('4. Total publication_files count...')
  const { count, error: countError } = await supabase
    .from('publication_files')
    .select('*', { count: 'exact', head: true })

  if (countError) {
    console.log('   Error:', countError)
  } else {
    console.log('   Total publication_files rows:', count)
  }
  console.log()

  // 5. Check the mysterious second storage folder
  console.log('5. Investigating second storage folder...')
  const mysteriousId = '4361527b-14f0-4cb4-888e-7c37c8c30602'
  
  // Check if this ID exists as a publication
  const { data: mysteriousPub, error: mysteriousPubError } = await supabase
    .from('publications')
    .select('*')
    .eq('id', mysteriousId)
    .maybeSingle()

  if (mysteriousPubError) {
    console.log('   Error checking mysterious publication:', mysteriousPubError)
  } else if (mysteriousPub) {
    console.log('   ✓ Found publication for mysterious storage folder')
    console.log('   - ID:', mysteriousPub.id)
    console.log('   - Title:', mysteriousPub.title?.substring(0, 50))
    console.log('   - Status:', mysteriousPub.publication_status)
  } else {
    console.log('   ✗ No publication found for mysterious storage folder')
  }

  // Check if this ID exists in publication_files
  const { data: mysteriousFile, error: mysteriousFileError } = await supabase
    .from('publication_files')
    .select('*')
    .eq('publication_id', mysteriousId)
    .maybeSingle()

  if (mysteriousFileError) {
    console.log('   Error checking mysterious publication_files:', mysteriousFileError)
  } else if (mysteriousFile) {
    console.log('   ✓ Found publication_files for mysterious ID')
    console.log('   - File ID:', mysteriousFile.id)
    console.log('   - File name:', mysteriousFile.file_name)
  } else {
    console.log('   ✗ No publication_files found for mysterious ID')
  }
  console.log()

  // 6. Check publication_events
  console.log('6. Checking publication_events for this publication...')
  const { data: events, error: eventsError } = await supabase
    .from('publication_events')
    .select('*')
    .eq('publication_id', publicationId)
    .order('created_at', { ascending: true })

  if (eventsError) {
    console.log('   Error:', eventsError)
  } else {
    console.log(`   Found ${events.length} events`)
    events.forEach(event => {
      console.log(`   - ${event.event_type}: ${event.note} (${event.created_at})`)
    })
  }
  console.log()

  // 7. Try to call publish_publication directly to see what happens
  console.log('7. Testing publish_publication RPC...')
  const { data: publishResult, error: publishError } = await supabase
    .rpc('publish_publication', { p_publication_id: publicationId })

  if (publishError) {
    console.log('   ✗ publish_publication failed:', publishError)
  } else {
    console.log('   ✓ publish_publication succeeded:', publishResult)
  }
}

investigateRLS().catch(console.error)
