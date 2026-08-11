// Test RLS policies with different query patterns
import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY

const supabase = createClient(supabaseUrl, supabaseAnonKey)

const publicationId = 'b765af99-e3db-4637-809b-01c977747465'

async function testRLSPatterns() {
  console.log('=== TESTING RLS QUERY PATTERNS ===')
  console.log('Publication ID:', publicationId)
  console.log()

  // Test 1: Direct query to publication_files
  console.log('TEST 1: Direct query to publication_files')
  const { data: directFile, error: directError } = await supabase
    .from('publication_files')
    .select('*')
    .eq('publication_id', publicationId)

  console.log('Result:', directError ? 'ERROR' : 'SUCCESS')
  if (directError) console.log('Error:', directError)
  else console.log('Rows returned:', directFile.length)
  console.log()

  // Test 2: Query publications first, then files
  console.log('TEST 2: Query publications, then files separately')
  const { data: pub, error: pubError } = await supabase
    .from('publications')
    .select('*')
    .eq('id', publicationId)
    .single()

  if (pubError) {
    console.log('Error getting publication:', pubError)
  } else {
    console.log('Publication found:', pub.id)
    
    const { data: files, error: filesError } = await supabase
      .from('publication_files')
      .select('*')
      .eq('publication_id', pub.id)

    console.log('Files query result:', filesError ? 'ERROR' : 'SUCCESS')
    if (filesError) console.log('Error:', filesError)
    else console.log('Files returned:', files.length)
  }
  console.log()

  // Test 3: Joined query with nested select
  console.log('TEST 3: Joined query with nested select')
  const { data: joined, error: joinedError } = await supabase
    .from('publications')
    .select(`
      id,
      title,
      publication_files (
        id,
        file_name,
        storage_path
      )
    `)
    .eq('id', publicationId)

  console.log('Result:', joinedError ? 'ERROR' : 'SUCCESS')
  if (joinedError) console.log('Error:', joinedError)
  else {
    console.log('Rows returned:', joined.length)
    if (joined.length > 0) {
      console.log('publication_files in result:', joined[0].publication_files ? 'YES' : 'NO')
      if (joined[0].publication_files) {
        console.log('Files count:', joined[0].publication_files.length)
      }
    }
  }
  console.log()

  // Test 4: Query with explicit foreign key relationship
  console.log('TEST 4: Query with explicit foreign key syntax')
  const { data: fkQuery, error: fkError } = await supabase
    .from('publications')
    .select('*, publication_files(*)')
    .eq('id', publicationId)

  console.log('Result:', fkError ? 'ERROR' : 'SUCCESS')
  if (fkError) console.log('Error:', fkError)
  else {
    console.log('Rows returned:', fkQuery.length)
    if (fkQuery.length > 0) {
      console.log('publication_files in result:', fkQuery[0].publication_files ? 'YES' : 'NO')
    }
  }
  console.log()

  // Test 5: Check if we can query publication_files by its ID directly
  console.log('TEST 5: Query publication_files by its ID directly')
  const fileId = 'accb4975-f6f5-414a-853b-63ae71b1b790'
  const { data: fileById, error: fileByIdError } = await supabase
    .from('publication_files')
    .select('*')
    .eq('id', fileId)

  console.log('Result:', fileByIdError ? 'ERROR' : 'SUCCESS')
  if (fileByIdError) console.log('Error:', fileByIdError)
  else console.log('Rows returned:', fileById.length)
  console.log()

  // Test 6: Try with RPC that bypasses RLS
  console.log('TEST 6: Try using RPC function')
  const { data: rpcResult, error: rpcError } = await supabase
    .rpc('get_publication_by_id', { p_publication_id: publicationId })

  console.log('Result:', rpcError ? 'ERROR' : 'SUCCESS')
  if (rpcError) console.log('Error:', rpcError)
  else console.log('Data returned:', rpcResult ? 'YES' : 'NO')
}

testRLSPatterns().catch(console.error)
