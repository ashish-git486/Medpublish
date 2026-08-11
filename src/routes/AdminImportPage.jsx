import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { categories } from '../data/mockData.js'
import { createImportedPublication, uploadPublicationFile, extractMetadataFromFile, updatePublicationMetadata, publishPublication } from '../services/publicationService.js'

function AdminImportPage() {
  const navigate = useNavigate()
  const [step, setStep] = useState(1) // 1: Upload, 2: Metadata Review, 3: Publication Review
  const [file, setFile] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState(null)
  const [processing, setProcessing] = useState(false)
  const [extractedMetadata, setExtractedMetadata] = useState(null)
  const [publicationId, setPublicationId] = useState(null)
  const [saving, setSaving] = useState(false)
  const [publishing, setPublishing] = useState(false)
  const [error, setError] = useState(null)
  
  // Form state for metadata editing
  const [metadata, setMetadata] = useState({
    title: '',
    abstract: '',
    authors: '',
    affiliations: '',
    correspondingAuthorName: '',
    correspondingAuthorEmail: '',
    keywords: '',
    articleType: '',
    category: 'General',
    doi: '',
    journalName: '',
    volume: '',
    issue: '',
    pageRange: '',
    publicationDate: '',
    extractedText: '',
    references: '',
  })

  const handleFileSelect = (event) => {
    const selectedFile = event.target.files[0]
    if (!selectedFile) return

    // Validate file type
    const validTypes = [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ]
    
    if (!validTypes.includes(selectedFile.type)) {
      setUploadError('Please upload a PDF or DOCX file')
      return
    }

    // Validate file size (max 50MB)
    const maxSize = 50 * 1024 * 1024
    if (selectedFile.size > maxSize) {
      setUploadError('File size must be less than 50MB')
      return
    }

    setFile(selectedFile)
    setUploadError(null)
  }

  const handleUpload = async () => {
    if (!file) return

    setUploading(true)
    setUploadError(null)

    try {
      console.log('[MedPublish DEBUG] handleUpload called with file:', file.name)
      
      // Extract metadata from file
      setProcessing(true)
      const extractionResult = await extractMetadataFromFile(file)
      setProcessing(false)

      console.log('[MedPublish DEBUG] Extraction result:', extractionResult.success ? 'SUCCESS' : 'FAILED')

      if (extractionResult.success) {
        setExtractedMetadata(extractionResult.metadata)
        setMetadata(extractionResult.metadata)
        
        console.log('[MedPublish DEBUG] Creating publication with title:', extractionResult.metadata.title?.substring(0, 30))
        
        // Create publication record immediately to get publication ID
        const { data: newPublicationId, error: createError } = await createImportedPublication({
          title: extractionResult.metadata.title || 'Untitled',
          abstract: extractionResult.metadata.abstract || '',
          authors: extractionResult.metadata.authors || '',
          affiliations: extractionResult.metadata.affiliations || null,
          correspondingAuthorName: extractionResult.metadata.correspondingAuthorName || null,
          correspondingAuthorEmail: extractionResult.metadata.correspondingAuthorEmail || null,
          keywords: extractionResult.metadata.keywords || null,
          articleType: extractionResult.metadata.articleType || 'Article',
          category: extractionResult.metadata.category || 'General',
          doi: extractionResult.metadata.doi || null,
          journalName: extractionResult.metadata.journalName || null,
          volume: extractionResult.metadata.volume || null,
          issue: extractionResult.metadata.issue || null,
          pageRange: extractionResult.metadata.pageRange || null,
          publicationDate: extractionResult.metadata.publicationDate || null,
          extractedText: extractionResult.metadata.extractedText || '',
        })
        
        console.log('[MedPublish DEBUG] createImportedPublication returned ID:', newPublicationId)
        console.log('[MedPublish DEBUG] createImportedPublication error:', createError)
        
        if (createError) throw createError
        
        setPublicationId(newPublicationId)
        
        console.log('[MedPublish DEBUG] Uploading file for publication:', newPublicationId)
        
        // Upload file immediately after publication creation
        const { error: uploadError } = await uploadPublicationFile(newPublicationId, file)
        if (uploadError) {
          console.log('[MedPublish DEBUG] File upload error:', uploadError)
          throw new Error(`Failed to upload file: ${uploadError.message}`)
        }
        
        console.log('[MedPublish DEBUG] File upload successful, moving to step 2')
        setStep(2)
      } else {
        setUploadError(extractionResult.message || 'Failed to process file')
      }
    } catch (error) {
      console.log('[MedPublish DEBUG] handleUpload error:', error)
      setProcessing(false)
      setUploadError(error.message || 'Failed to process file')
    } finally {
      setUploading(false)
    }
  }

  const handleMetadataChange = (field, value) => {
    setMetadata(prev => ({ ...prev, [field]: value }))
  }

  const handleCreateDraft = async () => {
    setSaving(true)
    setError(null)

    try {
      // Validate only essential fields for draft saving
      if (!metadata.title || metadata.title.trim() === '') {
        throw new Error('Title is required to save draft')
      }

      // Publication should already exist from handleUpload, just update metadata
      if (!publicationId) {
        throw new Error('Publication ID not found. Please upload the file again.')
      }

      // Update publication metadata
      const { error: updateError } = await updatePublicationMetadata(publicationId, {
        title: metadata.title,
        abstract: metadata.abstract || '',
        authors: metadata.authors || '',
        affiliations: metadata.affiliations || null,
        correspondingAuthorName: metadata.correspondingAuthorName || null,
        correspondingAuthorEmail: metadata.correspondingAuthorEmail || null,
        keywords: metadata.keywords || null,
        articleType: metadata.articleType || 'Article',
        category: metadata.category || 'General',
        doi: metadata.doi || null,
        journalName: metadata.journalName || null,
        volume: metadata.volume || null,
        issue: metadata.issue || null,
        pageRange: metadata.pageRange || null,
        publicationDate: metadata.publicationDate || null,
        extractedText: metadata.extractedText || '',
      })
      
      if (updateError) throw updateError

      setStep(3)
    } catch (error) {
      setError(error.message || 'Failed to create publication draft')
    } finally {
      setSaving(false)
    }
  }

  const handlePublish = async () => {
    setPublishing(true)
    setError(null)

    try {
      // Validate required fields before publishing
      if (!metadata.title || metadata.title.trim() === '') {
        throw new Error('Title is required to publish')
      }
      if (!metadata.authors || metadata.authors.trim() === '') {
        throw new Error('Authors are required to publish')
      }
      if (!metadata.articleType || metadata.articleType.trim() === '') {
        throw new Error('Article type is required to publish')
      }
      if (!metadata.category || metadata.category.trim() === '') {
        throw new Error('Category is required to publish')
      }

      // Ensure we have a publication ID
      if (!publicationId) {
        throw new Error('No publication ID found. Please save as draft first.')
      }

      // Update metadata one final time before publishing
      const { error: updateError } = await updatePublicationMetadata(publicationId, {
        title: metadata.title,
        abstract: metadata.abstract || '',
        authors: metadata.authors || '',
        affiliations: metadata.affiliations || null,
        correspondingAuthorName: metadata.correspondingAuthorName || null,
        correspondingAuthorEmail: metadata.correspondingAuthorEmail || null,
        keywords: metadata.keywords || null,
        articleType: metadata.articleType || 'Article',
        category: metadata.category || 'General',
        doi: metadata.doi || null,
        journalName: metadata.journalName || null,
        volume: metadata.volume || null,
        issue: metadata.issue || null,
        pageRange: metadata.pageRange || null,
        publicationDate: metadata.publicationDate || null,
        extractedText: metadata.extractedText || '',
      })
      
      if (updateError) throw updateError

      // Publish the publication
      const { error: publishError } = await publishPublication(publicationId)
      
      if (publishError) throw publishError

      // Show success message
      alert('Article published successfully!')

      // Navigate to the publication detail or library
      navigate('/admin/library')
    } catch (error) {
      setError(error.message || 'Failed to publish article')
    } finally {
      setPublishing(false)
    }
  }

  const handleSaveDraftOnly = async () => {
    setSaving(true)
    setError(null)

    try {
      // Validate only essential fields for draft saving
      if (!metadata.title || metadata.title.trim() === '') {
        throw new Error('Title is required to save draft')
      }

      // Publication should already exist from handleUpload, just update metadata
      if (!publicationId) {
        throw new Error('Publication ID not found. Please upload the file again.')
      }

      // Update publication metadata
      const { error: updateError } = await updatePublicationMetadata(publicationId, {
        title: metadata.title,
        abstract: metadata.abstract || '',
        authors: metadata.authors || '',
        affiliations: metadata.affiliations || null,
        correspondingAuthorName: metadata.correspondingAuthorName || null,
        correspondingAuthorEmail: metadata.correspondingAuthorEmail || null,
        keywords: metadata.keywords || null,
        articleType: metadata.articleType || 'Article',
        category: metadata.category || 'General',
        doi: metadata.doi || null,
        journalName: metadata.journalName || null,
        volume: metadata.volume || null,
        issue: metadata.issue || null,
        pageRange: metadata.pageRange || null,
        publicationDate: metadata.publicationDate || null,
        extractedText: metadata.extractedText || '',
      })
      
      if (updateError) throw updateError

      // Show success message
      alert('Draft saved successfully!')

      // Navigate to the admin library
      navigate('/admin/library')
    } catch (error) {
      setError(error.message || 'Failed to save publication draft')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-16">
      <div className="mb-8">
        <Link
          to="/admin/library"
          className="text-sm font-semibold text-teal-700 hover:text-teal-800"
        >
          ← Back to Research Library Management
        </Link>
      </div>

      <h1 className="font-serif text-3xl font-semibold text-ink">
        Import Article
      </h1>
      <p className="mt-3 max-w-2xl text-slate-600">
        Import an external scholarly article (PDF/DOCX) into the MedPublish Research Library.
        The article will go through a review process before publication.
      </p>

      {/* Step indicator */}
      <div className="mt-8 flex items-center gap-4">
        <div className={`flex items-center gap-2 ${step >= 1 ? 'text-teal-700' : 'text-slate-400'}`}>
          <div className={`flex h-8 w-8 items-center justify-center rounded-full border-2 ${step >= 1 ? 'border-teal-700 bg-teal-700 text-white' : 'border-slate-300'}`}>
            1
          </div>
          <span className="font-medium">Upload</span>
        </div>
        <div className="h-0.5 w-12 bg-slate-300" />
        <div className={`flex items-center gap-2 ${step >= 2 ? 'text-teal-700' : 'text-slate-400'}`}>
          <div className={`flex h-8 w-8 items-center justify-center rounded-full border-2 ${step >= 2 ? 'border-teal-700 bg-teal-700 text-white' : 'border-slate-300'}`}>
            2
          </div>
          <span className="font-medium">Review Metadata</span>
        </div>
        <div className="h-0.5 w-12 bg-slate-300" />
        <div className={`flex items-center gap-2 ${step >= 3 ? 'text-teal-700' : 'text-slate-400'}`}>
          <div className={`flex h-8 w-8 items-center justify-center rounded-full border-2 ${step >= 3 ? 'border-teal-700 bg-teal-700 text-white' : 'border-slate-300'}`}>
            3
          </div>
          <span className="font-medium">Publish</span>
        </div>
      </div>

      {/* Error display */}
      {error && (
        <div className="mt-6 rounded-xl border border-red-200 bg-red-50 p-4">
          <p className="text-red-600">{error}</p>
        </div>
      )}

      {/* Step 1: Upload */}
      {step === 1 && (
        <div className="mt-8 rounded-xl border border-slate-200 bg-white p-6">
          <h2 className="font-serif text-lg font-semibold text-ink">
            Upload Article File
          </h2>
          <p className="mt-2 text-sm text-slate-600">
            Upload a PDF or DOCX file. The system will attempt to extract metadata for review.
          </p>

          <div className="mt-6">
            <label className="block font-mono text-xs uppercase tracking-wide text-slate-500">
              Article File
            </label>
            <input
              type="file"
              accept=".pdf,.docx"
              onChange={handleFileSelect}
              className="mt-2 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-ink focus:border-teal-700 focus:outline-none focus:ring-1 focus:ring-teal-700"
            />
            <p className="mt-2 text-xs text-slate-500">
              Accepted formats: PDF, DOCX. Maximum file size: 50MB.
            </p>
          </div>

          {uploadError && (
            <p className="mt-3 text-sm text-red-600">{uploadError}</p>
          )}

          {file && (
            <div className="mt-4 rounded-lg bg-slate-50 p-4">
              <p className="text-sm font-medium text-ink">{file.name}</p>
              <p className="text-xs text-slate-500">
                {(file.size / 1024 / 1024).toFixed(2)} MB · {file.type}
              </p>
            </div>
          )}

          <div className="mt-6 flex justify-end">
            <button
              type="button"
              onClick={handleUpload}
              disabled={!file || uploading || processing}
              className="rounded-lg bg-ink px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-ink-light disabled:cursor-not-allowed disabled:opacity-60"
            >
              {uploading ? 'Uploading…' : processing ? 'Processing…' : 'Continue to Metadata Review'}
            </button>
          </div>
        </div>
      )}

      {/* Step 2: Metadata Review */}
      {step === 2 && (
        <div className="mt-8 rounded-xl border border-slate-200 bg-white p-6">
          <h2 className="font-serif text-lg font-semibold text-ink">
            Review and Edit Metadata
          </h2>
          <p className="mt-2 text-sm text-slate-600">
            Review the extracted metadata and make corrections as needed. All fields can be edited.
          </p>

          {extractedMetadata?.extractionMessage && (
            <div className={`mt-4 rounded-lg p-3 ${extractedMetadata.extractionStatus === 'completed' ? 'bg-green-50' : 'bg-amber-50'}`}>
              <p className={`text-sm ${extractedMetadata.extractionStatus === 'completed' ? 'text-green-700' : 'text-amber-700'}`}>
                <strong>{extractedMetadata.extractionStatus === 'completed' ? '✓' : '⚠'} Extraction Status:</strong> {extractedMetadata.extractionMessage}
              </p>
            </div>
          )}

          <div className="mt-4 rounded-lg bg-blue-50 p-3">
            <p className="text-sm text-blue-700">
              <strong>⚠ Important:</strong> Metadata was extracted from the uploaded document. Please verify all fields before publication. Blank fields require manual entry.
            </p>
          </div>

          {extractedMetadata?.confidence && extractedMetadata.extractionStatus === 'completed' && (
            <div className="mt-4 rounded-lg bg-slate-50 p-4">
              <h3 className="font-mono text-xs uppercase tracking-wide text-slate-500 mb-3">
                Extraction Confidence
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
                <div className="flex items-center gap-2">
                  <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold ${
                    extractedMetadata.confidence.title === 'high' ? 'bg-green-100 text-green-700' :
                    extractedMetadata.confidence.title === 'medium' ? 'bg-yellow-100 text-yellow-700' :
                    'bg-red-100 text-red-700'
                  }`}>
                    {extractedMetadata.confidence.title === 'high' ? '✓' : extractedMetadata.confidence.title === 'medium' ? '~' : '?'}
                  </span>
                  <span className="text-slate-600">Title</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold ${
                    extractedMetadata.confidence.authors === 'high' ? 'bg-green-100 text-green-700' :
                    extractedMetadata.confidence.authors === 'medium' ? 'bg-yellow-100 text-yellow-700' :
                    'bg-red-100 text-red-700'
                  }`}>
                    {extractedMetadata.confidence.authors === 'high' ? '✓' : extractedMetadata.confidence.authors === 'medium' ? '~' : '?'}
                  </span>
                  <span className="text-slate-600">Authors</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold ${
                    extractedMetadata.confidence.affiliations === 'high' ? 'bg-green-100 text-green-700' :
                    extractedMetadata.confidence.affiliations === 'medium' ? 'bg-yellow-100 text-yellow-700' :
                    'bg-red-100 text-red-700'
                  }`}>
                    {extractedMetadata.confidence.affiliations === 'high' ? '✓' : extractedMetadata.confidence.affiliations === 'medium' ? '~' : '?'}
                  </span>
                  <span className="text-slate-600">Affiliations</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold ${
                    extractedMetadata.confidence.abstract === 'high' ? 'bg-green-100 text-green-700' :
                    extractedMetadata.confidence.abstract === 'medium' ? 'bg-yellow-100 text-yellow-700' :
                    'bg-red-100 text-red-700'
                  }`}>
                    {extractedMetadata.confidence.abstract === 'high' ? '✓' : extractedMetadata.confidence.abstract === 'medium' ? '~' : '?'}
                  </span>
                  <span className="text-slate-600">Abstract</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold ${
                    extractedMetadata.confidence.keywords === 'high' ? 'bg-green-100 text-green-700' :
                    extractedMetadata.confidence.keywords === 'medium' ? 'bg-yellow-100 text-yellow-700' :
                    'bg-red-100 text-red-700'
                  }`}>
                    {extractedMetadata.confidence.keywords === 'high' ? '✓' : extractedMetadata.confidence.keywords === 'medium' ? '~' : '?'}
                  </span>
                  <span className="text-slate-600">Keywords</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold ${
                    extractedMetadata.confidence.doi === 'high' ? 'bg-green-100 text-green-700' :
                    extractedMetadata.confidence.doi === 'medium' ? 'bg-yellow-100 text-yellow-700' :
                    'bg-red-100 text-red-700'
                  }`}>
                    {extractedMetadata.confidence.doi === 'high' ? '✓' : extractedMetadata.confidence.doi === 'medium' ? '~' : '?'}
                  </span>
                  <span className="text-slate-600">DOI</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold ${
                    extractedMetadata.confidence.references === 'high' ? 'bg-green-100 text-green-700' :
                    extractedMetadata.confidence.references === 'medium' ? 'bg-yellow-100 text-yellow-700' :
                    'bg-red-100 text-red-700'
                  }`}>
                    {extractedMetadata.confidence.references === 'high' ? '✓' : extractedMetadata.confidence.references === 'medium' ? '~' : '?'}
                  </span>
                  <span className="text-slate-600">References</span>
                </div>
              </div>
              <p className="mt-2 text-xs text-slate-500">
                ✓ = High confidence | ~ = Medium confidence | ? = Low confidence - Please verify before publishing
              </p>
            </div>
          )}

          {extractedMetadata?.extractedText && extractedMetadata.extractionStatus === 'completed' && (
            <div className="mt-4 rounded-lg bg-slate-50 p-4">
              <details className="group">
                <summary className="cursor-pointer font-mono text-xs uppercase tracking-wide text-slate-500 flex items-center justify-between">
                  <span>Extracted Document Preview</span>
                  <span className="text-slate-400 group-open:rotate-180 transition-transform">▼</span>
                </summary>
                <div className="mt-3 max-h-64 overflow-y-auto bg-white rounded border border-slate-200 p-3">
                  <pre className="text-xs text-slate-700 whitespace-pre-wrap font-sans">
                    {extractedMetadata.extractedText.substring(0, 3000)}
                    {extractedMetadata.extractedText.length > 3000 && '...'}
                  </pre>
                </div>
                <p className="mt-2 text-xs text-slate-500">
                  Showing first 3,000 characters of {extractedMetadata.extractedText.length.toLocaleString()} total characters extracted
                </p>
              </details>
            </div>
          )}

          <div className="mt-6 space-y-6">
            {/* Title */}
            <div>
              <label className="block font-mono text-xs uppercase tracking-wide text-slate-500">
                Title *
              </label>
              <input
                type="text"
                value={metadata.title}
                onChange={(e) => handleMetadataChange('title', e.target.value)}
                className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-ink focus:border-teal-700 focus:outline-none focus:ring-1 focus:ring-teal-700"
                required
              />
            </div>

            {/* Authors */}
            <div>
              <label className="block font-mono text-xs uppercase tracking-wide text-slate-500">
                Authors *
              </label>
              <textarea
                value={metadata.authors}
                onChange={(e) => handleMetadataChange('authors', e.target.value)}
                rows={3}
                className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-ink focus:border-teal-700 focus:outline-none focus:ring-1 focus:ring-teal-700"
                required
              />
              <p className="mt-1 text-xs text-slate-500">
                List all authors, separated by commas or newlines.
              </p>
            </div>

            {/* Abstract */}
            <div>
              <label className="block font-mono text-xs uppercase tracking-wide text-slate-500">
                Abstract *
              </label>
              <textarea
                value={metadata.abstract}
                onChange={(e) => handleMetadataChange('abstract', e.target.value)}
                rows={6}
                className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-ink focus:border-teal-700 focus:outline-none focus:ring-1 focus:ring-teal-700"
                required
              />
            </div>

            {/* Affiliations */}
            <div>
              <label className="block font-mono text-xs uppercase tracking-wide text-slate-500">
                Affiliations
              </label>
              <textarea
                value={metadata.affiliations}
                onChange={(e) => handleMetadataChange('affiliations', e.target.value)}
                rows={2}
                className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-ink focus:border-teal-700 focus:outline-none focus:ring-1 focus:ring-teal-700"
              />
            </div>

            {/* Corresponding Author */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="block font-mono text-xs uppercase tracking-wide text-slate-500">
                  Corresponding Author Name
                </label>
                <input
                  type="text"
                  value={metadata.correspondingAuthorName}
                  onChange={(e) => handleMetadataChange('correspondingAuthorName', e.target.value)}
                  className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-ink focus:border-teal-700 focus:outline-none focus:ring-1 focus:ring-teal-700"
                />
              </div>
              <div>
                <label className="block font-mono text-xs uppercase tracking-wide text-slate-500">
                  Corresponding Author Email
                </label>
                <input
                  type="email"
                  value={metadata.correspondingAuthorEmail}
                  onChange={(e) => handleMetadataChange('correspondingAuthorEmail', e.target.value)}
                  className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-ink focus:border-teal-700 focus:outline-none focus:ring-1 focus:ring-teal-700"
                />
              </div>
            </div>

            {/* Keywords */}
            <div>
              <label className="block font-mono text-xs uppercase tracking-wide text-slate-500">
                Keywords
              </label>
              <input
                type="text"
                value={metadata.keywords}
                onChange={(e) => handleMetadataChange('keywords', e.target.value)}
                className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-ink focus:border-teal-700 focus:outline-none focus:ring-1 focus:ring-teal-700"
              />
              <p className="mt-1 text-xs text-slate-500">
                Separate keywords with commas.
              </p>
            </div>

            {/* References */}
            <div>
              <label className="block font-mono text-xs uppercase tracking-wide text-slate-500">
                References
              </label>
              <textarea
                value={metadata.references}
                onChange={(e) => handleMetadataChange('references', e.target.value)}
                rows={6}
                className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-ink focus:border-teal-700 focus:outline-none focus:ring-1 focus:ring-teal-700"
                placeholder="Extracted references will appear here. Please review before publishing."
              />
              <p className="mt-1 text-xs text-slate-500">
                Extracted from document. Please review before publishing.
              </p>
            </div>

            {/* Article Type and Category */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="block font-mono text-xs uppercase tracking-wide text-slate-500">
                  Article Type *
                </label>
                <select
                  value={metadata.articleType}
                  onChange={(e) => handleMetadataChange('articleType', e.target.value)}
                  className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-ink focus:border-teal-700 focus:outline-none focus:ring-1 focus:ring-teal-700"
                  required
                >
                  <option value="">Select type...</option>
                  <option value="Original Research Article">Original Research Article</option>
                  <option value="Review Article">Review Article</option>
                  <option value="Systematic Review">Systematic Review</option>
                  <option value="Meta-analysis">Meta-analysis</option>
                  <option value="Case Report">Case Report</option>
                  <option value="Case Series">Case Series</option>
                  <option value="Editorial">Editorial</option>
                  <option value="Letter">Letter</option>
                  <option value="Short Communication">Short Communication</option>
                  <option value="Article">Article</option>
                </select>
                {!metadata.articleType && (
                  <p className="mt-1 text-xs text-amber-600">
                    Please select article type (not automatically detected)
                  </p>
                )}
              </div>
              <div>
                <label className="block font-mono text-xs uppercase tracking-wide text-slate-500">
                  Category *
                </label>
                <select
                  value={metadata.category}
                  onChange={(e) => handleMetadataChange('category', e.target.value)}
                  className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-ink focus:border-teal-700 focus:outline-none focus:ring-1 focus:ring-teal-700"
                  required
                >
                  <option value="General">General</option>
                  {categories.map((cat) => (
                    <option key={cat.id} value={cat.slug}>
                      {cat.name}
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-xs text-slate-500">
                  Category is not automatically extracted - please select manually
                </p>
              </div>
            </div>

            {/* Optional publication metadata */}
            <div className="border-t border-slate-200 pt-6">
              <h3 className="font-mono text-xs uppercase tracking-wide text-slate-500">
                Optional Publication Metadata
              </h3>
              
              <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="block font-mono text-xs uppercase tracking-wide text-slate-500">
                    DOI
                  </label>
                  <input
                    type="text"
                    value={metadata.doi}
                    onChange={(e) => handleMetadataChange('doi', e.target.value)}
                    className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-ink focus:border-teal-700 focus:outline-none focus:ring-1 focus:ring-teal-700"
                    placeholder="10.1234/example.doi"
                  />
                </div>
                <div>
                  <label className="block font-mono text-xs uppercase tracking-wide text-slate-500">
                    Publication Date
                  </label>
                  <input
                    type="date"
                    value={metadata.publicationDate}
                    onChange={(e) => handleMetadataChange('publicationDate', e.target.value)}
                    className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-ink focus:border-teal-700 focus:outline-none focus:ring-1 focus:ring-teal-700"
                  />
                </div>
                <div>
                  <label className="block font-mono text-xs uppercase tracking-wide text-slate-500">
                    Journal Name
                  </label>
                  <input
                    type="text"
                    value={metadata.journalName}
                    onChange={(e) => handleMetadataChange('journalName', e.target.value)}
                    className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-ink focus:border-teal-700 focus:outline-none focus:ring-1 focus:ring-teal-700"
                  />
                </div>
                <div>
                  <label className="block font-mono text-xs uppercase tracking-wide text-slate-500">
                    Volume
                  </label>
                  <input
                    type="text"
                    value={metadata.volume}
                    onChange={(e) => handleMetadataChange('volume', e.target.value)}
                    className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-ink focus:border-teal-700 focus:outline-none focus:ring-1 focus:ring-teal-700"
                  />
                </div>
                <div>
                  <label className="block font-mono text-xs uppercase tracking-wide text-slate-500">
                    Issue
                  </label>
                  <input
                    type="text"
                    value={metadata.issue}
                    onChange={(e) => handleMetadataChange('issue', e.target.value)}
                    className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-ink focus:border-teal-700 focus:outline-none focus:ring-1 focus:ring-teal-700"
                  />
                </div>
                <div>
                  <label className="block font-mono text-xs uppercase tracking-wide text-slate-500">
                    Page Range
                  </label>
                  <input
                    type="text"
                    value={metadata.pageRange}
                    onChange={(e) => handleMetadataChange('pageRange', e.target.value)}
                    className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-ink focus:border-teal-700 focus:outline-none focus:ring-1 focus:ring-teal-700"
                    placeholder="1-15"
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="mt-8 flex justify-between">
            <button
              type="button"
              onClick={() => setStep(1)}
              className="rounded-lg border border-slate-300 px-6 py-2.5 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50"
            >
              Back
            </button>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={handleSaveDraftOnly}
                disabled={saving}
                className="rounded-lg border border-slate-300 px-6 py-2.5 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {saving ? 'Saving…' : 'Save Draft'}
              </button>
              <button
                type="button"
                onClick={handleCreateDraft}
                disabled={saving}
                className="rounded-lg bg-ink px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-ink-light disabled:cursor-not-allowed disabled:opacity-60"
              >
                {saving ? 'Creating…' : 'Continue to Review'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Step 3: Publication Review */}
      {step === 3 && (
        <div className="mt-8 rounded-xl border border-slate-200 bg-white p-6">
          <h2 className="font-serif text-lg font-semibold text-ink">
            Review and Publish
          </h2>
          <p className="mt-2 text-sm text-slate-600">
            Review the final publication details before publishing to the Research Library.
          </p>

          <div className="mt-6 space-y-4">
            <div className="rounded-lg bg-slate-50 p-4">
              <h3 className="font-mono text-xs uppercase tracking-wide text-slate-500">
                Article Details
              </h3>
              <div className="mt-3 space-y-2 text-sm">
                <p><span className="font-medium text-ink">Title:</span> {metadata.title}</p>
                <p><span className="font-medium text-ink">Authors:</span> {metadata.authors}</p>
                <p><span className="font-medium text-ink">Article Type:</span> {metadata.articleType}</p>
                <p><span className="font-medium text-ink">Category:</span> {metadata.category}</p>
              </div>
            </div>

            <div className="rounded-lg bg-slate-50 p-4">
              <h3 className="font-mono text-xs uppercase tracking-wide text-slate-500">
                Abstract
              </h3>
              <p className="mt-3 text-sm text-slate-700">{metadata.abstract}</p>
            </div>

            <div className="rounded-lg bg-slate-50 p-4">
              <h3 className="font-mono text-xs uppercase tracking-wide text-slate-500">
                File Information
              </h3>
              <div className="mt-3 text-sm">
                <p><span className="font-medium text-ink">File:</span> {file?.name}</p>
                <p><span className="font-medium text-ink">Size:</span> {file ? (file.size / 1024 / 1024).toFixed(2) + ' MB' : ''}</p>
              </div>
            </div>

            {metadata.doi && (
              <div className="rounded-lg bg-slate-50 p-4">
                <h3 className="font-mono text-xs uppercase tracking-wide text-slate-500">
                  Publication Metadata
                </h3>
                <div className="mt-3 space-y-2 text-sm">
                  <p><span className="font-medium text-ink">DOI:</span> {metadata.doi}</p>
                  {metadata.journalName && <p><span className="font-medium text-ink">Journal:</span> {metadata.journalName}</p>}
                  {metadata.publicationDate && <p><span className="font-medium text-ink">Publication Date:</span> {metadata.publicationDate}</p>}
                </div>
              </div>
            )}
          </div>

          <div className="mt-8 flex justify-between">
            <button
              type="button"
              onClick={() => setStep(2)}
              className="rounded-lg border border-slate-300 px-6 py-2.5 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50"
            >
              Back to Edit
            </button>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={handleSaveDraftOnly}
                disabled={saving}
                className="rounded-lg border border-slate-300 px-6 py-2.5 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {saving ? 'Saving…' : 'Save as Draft'}
              </button>
              <button
                type="button"
                onClick={handlePublish}
                disabled={publishing}
                className="rounded-lg bg-teal-700 px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {publishing ? 'Publishing…' : 'Publish Article'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default AdminImportPage