# Supabase Storage Setup for Publication Import System

⚠️ **CRITICAL**: The storage bucket must be created manually in the Supabase dashboard before the publication import feature will work. The database migration cannot create storage buckets automatically.

## Storage Bucket Setup

The publication import system requires a dedicated storage bucket to store uploaded article files (PDF/DOCX).

### 1. Create Storage Bucket (Manual Step Required)

In the Supabase dashboard:

1. Go to **Storage** → **Buckets**
2. Click **Create a new bucket**
3. Name it: `publications`
4. Make it **Public** (we'll control access via RLS policies)
5. Click **Create bucket**

**Without this step, the Article Import feature will fail because files cannot be uploaded to storage.**

### 2. Apply Storage Bucket Policies (Migration)

After creating the bucket, apply the RLS policies by running migration 0011:

```bash
# If using Supabase CLI
supabase db push

# Or manually run the SQL in Supabase SQL Editor:
# supabase/migrations/0011_storage_bucket_setup.sql
```

The migration applies the following policies to the `publications` bucket:

- **Public can read publication files**: Allows anonymous users to read files (database RLS enforces only published publication files are accessible)
- **Authenticated can read publication files**: Allows authenticated users to read files (database RLS enforces only published publication files are accessible)
- **Editors and admins can upload publication files**: Only editors/admins can upload files to the bucket
- **Editors and admins can delete publication files**: Only editors/admins can delete files from the bucket

### 3. File Storage Path Structure

Files should be stored using the following path structure:

```
publications/
  ├── {publication_id}/
  │   └── original.{extension}
```

For example:
- `publications/abc-123-def/original.pdf`
- `publications/xyz-789-uvw/original.docx`

This structure:
- Groups files by publication ID
- Keeps the original uploaded file with a clear name
- Allows for future versioning (e.g., `v1/`, `v2/`)

### 4. File Upload Process

When a file is uploaded:

1. Generate a unique publication ID (UUID)
2. Upload the file to `publications/{publication_id}/original.{extension}`
3. Store the file metadata in the `publication_files` table:
   - `storage_path`: `{publication_id}/original.{extension}`
   - `file_hash`: SHA-256 hash of the file content (for duplicate detection)
   - `file_size_bytes`: Size in bytes
   - `file_type`: MIME type
   - `file_name`: Original filename

### 5. Alternative: Using Service Role Key

If you prefer to handle file uploads server-side (recommended for production):

1. Use the Supabase service role key (never expose this in frontend)
2. Upload files using the Supabase Storage API with the service role client
3. This bypasses storage bucket policies and gives full control

For the current implementation, we'll use the anon key with proper RLS policies since the upload happens through the database functions which enforce editor/admin checks.

## Verification

After setup, verify:

1. Bucket `publications` exists in Storage
2. Policies are correctly applied (check in Storage → Policies)
3. Editors/admins can upload files through the application
4. Anonymous users can only access files from published publications

## Migration Reference

The storage setup complements the database migration in:
`supabase/migrations/0006_publication_import_system.sql`

The database stores the metadata and enforces access control, while Storage stores the actual file content.