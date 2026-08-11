// Test script to check Supabase Storage access
// Run with: node storage_test.js

import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import { readFileSync } from 'fs'

// Load environment variables
dotenv.config({ path: '.env.local' })

const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY in .env.local')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseAnonKey)

async function testStorageAccess() {
  console.log('=== Supabase Storage Access Test ===')
  console.log('Supabase URL:', supabaseUrl)
  console.log()

  // 1. Try to list buckets
  console.log('1. Attempting to list storage buckets...')
  const { data: buckets, error: bucketsError } = await supabase.storage.listBuckets()
  if (bucketsError) {
    console.log('   Error listing buckets:', bucketsError)
  } else {
    console.log('   ✓ Buckets found:', buckets.map(b => b.name).join(', '))
  }
  console.log()

  // 2. Check if 'publications' bucket exists
  console.log('2. Checking if "publications" bucket exists...')
  const { data: { buckets: allBuckets }, error: listError } = await supabase.storage.listBuckets()
  if (listError) {
    console.log('   Error:', listError)
  } else {
    const publicationsBucket = allBuckets?.find(b => b.name === 'publications')
    if (publicationsBucket) {
      console.log('   ✓ "publications" bucket exists')
      console.log('   - ID:', publicationsBucket.id)
      console.log('   - Public:', publicationsBucket.public)
    } else {
      console.log('   ✗ "publications" bucket NOT found')
      console.log('   Available buckets:', allBuckets?.map(b => b.name).join(', '))
    }
  }
  console.log()

  // 3. Try to list files in publications bucket
  console.log('3. Attempting to list files in "publications" bucket...')
  const { data: files, error: filesError } = await supabase
    .storage
    .from('publications')
    .list('', { limit: 100 })

  if (filesError) {
    console.log('   Error listing files:', filesError)
  } else {
    console.log(`   ✓ Found ${files.length} files/folders in root of publications bucket`)
    if (files.length > 0) {
      files.forEach(f => {
        console.log(`   - ${f.name} (${f.metadata?.mimetype || 'unknown type'}, ${f.metadata?.size || 'unknown size'})`)
      })
    }
  }
  console.log()

  // 4. Try to upload a test file
  console.log('4. Attempting to upload a test file...')
  const testContent = 'This is a test file for MedPublish storage access check.'
  const testPath = 'test-upload/test-file.txt'
  
  const { data: uploadData, error: uploadError } = await supabase
    .storage
    .from('publications')
    .upload(testPath, new Blob([testContent], { type: 'text/plain' }))

  if (uploadError) {
    console.log('   ✗ Upload failed:', uploadError)
  } else {
    console.log('   ✓ Upload succeeded')
    console.log('   - Path:', uploadData.path)
    
    // Clean up test file
    console.log('   Cleaning up test file...')
    await supabase.storage.from('publications').remove([testPath])
    console.log('   ✓ Test file removed')
  }
  console.log()

  // 5. Check auth status
  console.log('5. Checking auth status...')
  const { data: { session }, error: sessionError } = await supabase.auth.getSession()
  if (sessionError) {
    console.log('   Error getting session:', sessionError)
  } else if (session) {
    console.log('   ✓ Authenticated as:', session.user.email)
    console.log('   User ID:', session.user.id)
  } else {
    console.log('   ✗ Not authenticated')
  }
}

testStorageAccess().catch(console.error)
